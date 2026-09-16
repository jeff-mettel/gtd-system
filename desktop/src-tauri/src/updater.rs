// In-app updates over GitHub Releases (tauri-plugin-updater).
//
// Endpoint: https://github.com/jeff-mettel/snowball/releases/latest/download/latest.json, produced by the
// release workflow (tauri-action, includeUpdaterJson) and signed with the key whose public half is in
// tauri.conf.json. Checked ~15 s after launch and every 6 h, plus the tray's "Check for updates…".
// When an update exists: a native dialog "Snowball X is available — Update now / Later"; on
// Update the download progress shows in the tray tooltip, the bundle is replaced, the app relaunches.
// The data folder (~/Snowball) is never touched by an update — only the .app bundle changes.
//
// While the repo is private the fetch needs a GitHub token: <data>/config.json → updater.token, or the
// SNOW_GITHUB_TOKEN env var, sent as `Authorization: Bearer …` on both the JSON and the download request.

use std::{fs, path::Path, thread, time::Duration};

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt as _, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt as _;

use crate::{Config, TRAY_ID};

const FIRST_CHECK_AFTER: Duration = Duration::from_secs(15);
const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

/// Launch-time + periodic checks on a background thread. Silent unless an update exists.
pub fn start_schedule(app: &AppHandle) {
    let handle = app.clone();
    thread::spawn(move || {
        thread::sleep(FIRST_CHECK_AFTER);
        loop {
            check(&handle, false);
            thread::sleep(CHECK_EVERY);
        }
    });
}

/// `manual` = the tray item: also report "up to date" and errors in a dialog.
pub fn check(app: &AppHandle, manual: bool) {
    let data = app.state::<Config>().data.clone();
    let token = github_token(&data);
    let mut builder = app.updater_builder();
    if let Some(t) = token {
        match builder.header("Authorization", format!("Bearer {t}")) {
            Ok(b) => builder = b,
            Err(e) => {
                eprintln!("[desktop] updater: bad token header: {e}");
                return;
            }
        }
    }
    let updater = match builder.build() {
        Ok(u) => u,
        Err(e) => {
            eprintln!("[desktop] updater: {e}");
            if manual {
                notice(app, MessageDialogKind::Error, &format!("Could not set up the updater.\n\n{e}"));
            }
            return;
        }
    };
    let result = tauri::async_runtime::block_on(updater.check());
    match result {
        Ok(Some(update)) => {
            let version = update.version.clone();
            let body = update.body.clone().unwrap_or_default();
            let text = if body.trim().is_empty() {
                format!("Snowball {version} is available (you have {}).\n\nYour data in the data folder is not touched by an update.", update.current_version)
            } else {
                format!("Snowball {version} is available (you have {}).\n\n{}\n\nYour data in the data folder is not touched by an update.", update.current_version, body.trim())
            };
            let go = app
                .dialog()
                .message(text)
                .title("Update available")
                .kind(MessageDialogKind::Info)
                .buttons(MessageDialogButtons::OkCancelCustom("Update now".into(), "Later".into()))
                .blocking_show();
            if !go {
                return;
            }
            set_tooltip(app, &format!("Snowball — downloading {version}…"));
            let h = app.clone();
            let v = version.clone();
            let mut got: u64 = 0;
            let r = tauri::async_runtime::block_on(update.download_and_install(
                move |chunk, total| {
                    got += chunk as u64;
                    let pct = total.map(|t| format!("{}%", got * 100 / t.max(1))).unwrap_or_else(|| format!("{} MB", got / 1_000_000));
                    set_tooltip(&h, &format!("Snowball — downloading {v}: {pct}"));
                },
                || {},
            ));
            match r {
                Ok(()) => {
                    set_tooltip(app, &format!("Snowball — {version} installed, restarting"));
                    eprintln!("[desktop] update {version} installed; restarting");
                    crate::stop_sidecar(app);
                    app.restart();
                }
                Err(e) => {
                    set_tooltip(app, "Snowball");
                    eprintln!("[desktop] update failed: {e}");
                    notice(app, MessageDialogKind::Error, &format!("The update could not be installed.\n\n{e}\n\nYou can download it from the README link instead."));
                }
            }
        }
        Ok(None) => {
            eprintln!("[desktop] updater: up to date");
            if manual {
                notice(app, MessageDialogKind::Info, &format!("Snowball {} is the newest version.", app.package_info().version));
            }
        }
        Err(e) => {
            eprintln!("[desktop] updater: {e}");
            if manual {
                notice(app, MessageDialogKind::Warning, &format!("Could not check for updates.\n\n{e}\n\nIf the repository is private, put a GitHub token with read access to releases in config.json → updater.token (see docs/desktop.md)."));
            }
        }
    }
}

fn notice(app: &AppHandle, kind: MessageDialogKind, text: &str) {
    app.dialog().message(text).title("Snowball").kind(kind).blocking_show();
}

fn set_tooltip(app: &AppHandle, text: &str) {
    if let Some(t) = app.tray_by_id(TRAY_ID) {
        let _ = t.set_tooltip(Some(text));
    }
}

/// SNOW_GITHUB_TOKEN (or the old GTD_GITHUB_TOKEN), else <data>/config.json → updater.token. None when neither is set (public repo).
fn github_token(data: &Path) -> Option<String> {
    // GTD_GITHUB_TOKEN is the pre-0.2 name, accepted for one release.
    for name in ["SNOW_GITHUB_TOKEN", "GTD_GITHUB_TOKEN"] {
        if let Ok(t) = std::env::var(name) {
            if !t.trim().is_empty() {
                return Some(t.trim().to_string());
            }
        }
    }
    let raw = fs::read_to_string(data.join("config.json")).ok()?;
    let cfg: serde_json::Value = serde_json::from_str(&raw).ok()?;
    cfg.get("updater")?.get("token")?.as_str().map(str::trim).filter(|s| !s.is_empty()).map(String::from)
}
