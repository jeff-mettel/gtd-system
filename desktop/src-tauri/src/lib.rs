// Delivery System desktop shell.
//
// The app is a thin window around the local service: at launch it picks a free port (4310 upward),
// spawns the bundled Node (`node` sidecar) on `server/index.js` from the app's Resources folder with
// PORT + GTD_DATA, shows the bundled "Starting…" page until /api/health answers, then navigates the
// webview to http://127.0.0.1:<port>. Closing the window hides it (the scheduler keeps running);
// Quit — tray or ⌘Q — stops the sidecar. Data lives in GTD_DATA (default ~/GTD-data), never in the app.
//
// CLI / env: `--data <dir>` or GTD_DATA picks the data folder (tests use a temp dir).

use std::{
    collections::HashMap,
    env, fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::PathBuf,
    process::{Command as StdCommand, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as _};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt as _};
use tauri_plugin_window_state::{AppHandleExt as _, StateFlags};

mod updater;

const FIRST_PORT: u16 = 4310;
pub(crate) const TRAY_ID: &str = "main";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(90);
const MAIN: &str = "main";

/// Chosen at launch, before the Tauri builder runs.
pub(crate) struct Config {
    pub(crate) data: PathBuf,
    port: u16,
    url: String,
}

#[derive(Default)]
struct Sidecar(Mutex<Option<CommandChild>>);

pub fn run() {
    let data = data_dir();
    if let Err(e) = fs::create_dir_all(data.join("runs")) {
        eprintln!("[desktop] cannot create {}: {e}", data.display());
    }
    let port = free_port(FIRST_PORT);
    let _ = fs::write(data.join(".port"), format!("{port}\n"));
    let cfg = Config { url: format!("http://127.0.0.1:{port}"), data, port };
    eprintln!("[desktop] data {} · port {port}", cfg.data.display());

    let app = tauri::Builder::default()
        .manage(cfg)
        .manage(Sidecar::default())
        .manage(Ready::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["CmdOrCtrl+Shift+K"])
                .expect("valid shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        open_capture(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            build_tray(app.handle())?;
            spawn_sidecar(app.handle())?;
            updater::start_schedule(app.handle());
            Ok(())
        })
        // Closing the window hides it: the service (and its scheduler) keeps running in the tray.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.app_handle().save_window_state(StateFlags::all());
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the Delivery System app");

    app.run(|app, event| match event {
        RunEvent::Exit => stop_sidecar(app),
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => show_main(app),
        _ => {}
    });
}

/* ---------- data folder and port ---------- */

fn home() -> PathBuf {
    env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("/"))
}

/// `--data <dir>` / `--data=<dir>` on the command line, else GTD_DATA, else ~/GTD-data.
fn data_dir() -> PathBuf {
    let mut args = env::args().skip(1);
    let mut from_cli = None;
    while let Some(a) = args.next() {
        if a == "--data" {
            from_cli = args.next();
        } else if let Some(v) = a.strip_prefix("--data=") {
            from_cli = Some(v.to_string());
        }
    }
    let raw = from_cli
        .or_else(|| env::var("GTD_DATA").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "~/GTD-data".to_string());
    let expanded = if raw == "~" {
        home()
    } else if let Some(rest) = raw.strip_prefix("~/") {
        home().join(rest)
    } else {
        PathBuf::from(raw)
    };
    if expanded.is_absolute() {
        expanded
    } else {
        env::current_dir().map(|d| d.join(&expanded)).unwrap_or(expanded)
    }
}

/// First port from `start` that we can bind on 127.0.0.1 (released again before the sidecar takes it).
fn free_port(start: u16) -> u16 {
    for p in start..start.saturating_add(200) {
        if TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], p))).is_ok() {
            return p;
        }
    }
    // Let the OS choose; the sidecar reads PORT so this still works.
    TcpListener::bind("127.0.0.1:0").and_then(|l| l.local_addr()).map(|a| a.port()).unwrap_or(start)
}

/* ---------- sidecar ---------- */

/// Where `claude`, `node`, `git` are looked up by the sidecar and by the jobs it spawns. A Finder-launched
/// app has a minimal PATH, so the bundle's own Node (next to the executable) and the usual install dirs
/// go first.
fn child_path() -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            parts.push(dir.display().to_string());
        }
    }
    let h = home();
    for p in [h.join(".local/bin"), PathBuf::from("/opt/homebrew/bin"), PathBuf::from("/usr/local/bin")] {
        parts.push(p.display().to_string());
    }
    if let Ok(p) = env::var("PATH") {
        parts.push(p);
    } else {
        parts.push("/usr/bin:/bin:/usr/sbin:/sbin".into());
    }
    parts.join(":")
}

fn spawn_sidecar(app: &AppHandle) -> tauri::Result<()> {
    let cfg = app.state::<Config>();
    let resources = app.path().resource_dir()?;
    let entry = resources.join("server").join("index.js");
    if !entry.exists() {
        let msg = format!("server/index.js not found in resources ({})", resources.display());
        report_error(app, &msg);
        return Ok(());
    }
    let log_path = cfg.data.join("runs").join("desktop.log");
    let mut envs: HashMap<String, String> = HashMap::new();
    envs.insert("PORT".into(), cfg.port.to_string());
    envs.insert("GTD_DATA".into(), cfg.data.display().to_string());
    envs.insert("GTD_APP_ROOT".into(), resources.display().to_string());
    envs.insert("PATH".into(), child_path());
    envs.insert("HOME".into(), home().display().to_string());
    envs.insert("GTD_DESKTOP".into(), "1".into());

    let (mut rx, child) = app
        .shell()
        .sidecar("node")
        .map_err(|e| tauri::Error::Anyhow(e.into()))?
        .args([entry.display().to_string()])
        .current_dir(resources)
        .envs(envs)
        .spawn()
        .map_err(|e| tauri::Error::Anyhow(e.into()))?;
    eprintln!("[desktop] sidecar node pid {}", child.pid());
    *app.state::<Sidecar>().0.lock().unwrap() = Some(child);

    // Relay the service's output to <data>/runs/desktop.log and notice an early exit.
    let handle = app.clone();
    let lp = log_path.clone();
    tauri::async_runtime::spawn(async move {
        let mut log = fs::OpenOptions::new().create(true).append(true).open(&lp).ok();
        let mut tail: Vec<String> = Vec::new();
        let note = |line: String, log: &mut Option<fs::File>, tail: &mut Vec<String>| {
            if let Some(f) = log.as_mut() {
                let _ = writeln!(f, "{line}");
            }
            tail.push(line);
            if tail.len() > 30 {
                tail.remove(0);
            }
        };
        while let Some(ev) = rx.recv().await {
            match ev {
                CommandEvent::Stdout(b) | CommandEvent::Stderr(b) => {
                    for l in String::from_utf8_lossy(&b).lines() {
                        note(l.to_string(), &mut log, &mut tail);
                    }
                }
                CommandEvent::Error(e) => note(format!("[desktop] sidecar error: {e}"), &mut log, &mut tail),
                CommandEvent::Terminated(t) => {
                    note(format!("[desktop] sidecar exited (code {:?}, signal {:?})", t.code, t.signal), &mut log, &mut tail);
                    *handle.state::<Sidecar>().0.lock().unwrap() = None;
                    let _ = fs::remove_file(handle.state::<Config>().data.join(".port"));
                    if !handle.state::<Ready>().0.load(std::sync::atomic::Ordering::SeqCst) {
                        report_error(&handle, &format!("The service exited before it was ready.\n\n{}", tail.join("\n")));
                    }
                }
                _ => {}
            }
        }
    });

    // Wait for /api/health, then swap the "Starting…" page for the app.
    let handle = app.clone();
    let url = cfg.url.clone();
    thread::spawn(move || {
        let started = Instant::now();
        let mut n = 0u32;
        loop {
            if health_ok(&url) {
                handle.state::<Ready>().0.store(true, std::sync::atomic::Ordering::SeqCst);
                if let Some(w) = handle.get_webview_window(MAIN) {
                    match url.parse::<tauri::Url>() {
                        Ok(u) => {
                            if let Err(e) = w.navigate(u) {
                                report_error(&handle, &format!("could not open {url}: {e}"));
                            }
                        }
                        Err(e) => report_error(&handle, &format!("bad url {url}: {e}")),
                    }
                }
                return;
            }
            if handle.state::<Sidecar>().0.lock().unwrap().is_none() {
                return; // it died; the reader reported it
            }
            if started.elapsed() > HEALTH_TIMEOUT {
                report_error(&handle, &format!("no answer from {url}/api/health after {}s — see {}", HEALTH_TIMEOUT.as_secs(), log_path.display()));
                return;
            }
            n += 1;
            if n % 10 == 0 {
                status(&handle, &format!("Starting the local service ({}s)", started.elapsed().as_secs()));
            }
            thread::sleep(Duration::from_millis(200));
        }
    });
    Ok(())
}

#[derive(Default)]
struct Ready(std::sync::atomic::AtomicBool);

/// SIGTERM first so the server closes cleanly, then SIGKILL if it lingers.
pub(crate) fn stop_sidecar(app: &AppHandle) {
    let child = app.state::<Sidecar>().0.lock().unwrap().take();
    if let Some(child) = child {
        let pid = child.pid();
        let _ = StdCommand::new("kill").args(["-TERM", &pid.to_string()]).stderr(Stdio::null()).status();
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline && process_alive(pid) {
            thread::sleep(Duration::from_millis(50));
        }
        if process_alive(pid) {
            let _ = child.kill();
        }
        eprintln!("[desktop] sidecar {pid} stopped");
    }
    let _ = fs::remove_file(app.state::<Config>().data.join(".port"));
}

fn process_alive(pid: u32) -> bool {
    StdCommand::new("kill").args(["-0", &pid.to_string()]).stderr(Stdio::null()).status().map(|s| s.success()).unwrap_or(false)
}

/* ---------- tiny HTTP (no client crate: two requests to our own loopback server) ---------- */

fn http(url_base: &str, method: &str, path: &str, body: Option<&str>) -> Option<(u16, String)> {
    let addr = url_base.trim_start_matches("http://");
    let sock: SocketAddr = addr.parse().ok()?;
    let mut s = TcpStream::connect_timeout(&sock, Duration::from_millis(800)).ok()?;
    s.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    let body = body.unwrap_or("");
    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: {addr}\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    s.write_all(req.as_bytes()).ok()?;
    let mut out = String::new();
    s.read_to_string(&mut out).ok()?;
    let code: u16 = out.split_whitespace().nth(1)?.parse().ok()?;
    let body = out.split_once("\r\n\r\n").map(|(_, b)| b.to_string()).unwrap_or_default();
    Some((code, body))
}

fn health_ok(url: &str) -> bool {
    matches!(http(url, "GET", "/api/health", None), Some((200, b)) if b.contains("\"ok\":true"))
}

/* ---------- window helpers ---------- */

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn open_capture(app: &AppHandle) {
    show_main(app);
    if let Some(w) = app.get_webview_window(MAIN) {
        // The front-end exports this hook from features/captureOverlay.js; on the "Starting…" page it is a no-op.
        let _ = w.eval("setTimeout(() => { if (window.__gtdOpenCapture) window.__gtdOpenCapture(); }, 50)");
    }
}

fn status(app: &AppHandle, text: &str) {
    if let Some(w) = app.get_webview_window(MAIN) {
        let _ = w.eval(&format!("window.__gtdStatus && window.__gtdStatus({})", js_str(text)));
    }
}

fn report_error(app: &AppHandle, text: &str) {
    eprintln!("[desktop] {text}");
    if let Some(w) = app.get_webview_window(MAIN) {
        let _ = w.show();
        let _ = w.eval(&format!("window.__gtdError && window.__gtdError({})", js_str(text)));
    }
}

/// A one-line notice inside the running app (the front-end's toast when present, else console).
fn report_toast(app: &AppHandle, text: &str) {
    if let Some(w) = app.get_webview_window(MAIN) {
        let _ = w.eval(&format!("(window.__gtdToast || console.warn)({})", js_str(text)));
    }
}

fn js_str(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '<' => out.push_str("\\u003c"),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/* ---------- tray / menu bar ---------- */

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Delivery System", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "capture", "New capture", true, Some("CmdOrCtrl+Shift+K"))?;
    let sync = MenuItem::with_id(app, "sync", "Sync calendar", true, None::<&str>)?;
    let at_login = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart = CheckMenuItem::with_id(app, "autostart", "Start at login", true, at_login, None::<&str>)?;
    let updates = MenuItem::with_id(app, "updates", "Check for updates…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Delivery System", true, Some("CmdOrCtrl+Q"))?;
    let menu = Menu::with_items(
        app,
        &[&open, &capture, &sync, &PredefinedMenuItem::separator(app)?, &autostart, &updates, &PredefinedMenuItem::separator(app)?, &quit],
    )?;

    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Delivery System")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "capture" => open_capture(app),
            "sync" => {
                let url = app.state::<Config>().url.clone();
                let handle = app.clone();
                thread::spawn(move || {
                    let r = http(&url, "POST", "/api/jobs/ingest-calendar", Some("{}"));
                    match r {
                        Some((200, _)) => eprintln!("[desktop] ingest-calendar queued"),
                        other => {
                            let msg = format!("Sync calendar failed: {:?}", other.map(|(c, b)| format!("{c} {}", b.chars().take(200).collect::<String>())));
                            eprintln!("[desktop] {msg}");
                            report_toast(&handle, &msg);
                        }
                    }
                });
                show_main(app);
            }
            "autostart" => {
                let al = app.autolaunch();
                let enabled = al.is_enabled().unwrap_or(false);
                let r = if enabled { al.disable() } else { al.enable() };
                if let Err(e) = r {
                    eprintln!("[desktop] autostart: {e}");
                }
                let now = al.is_enabled().unwrap_or(false);
                let _ = autostart.set_checked(now);
            }
            "updates" => {
                let h = app.clone();
                thread::spawn(move || updater::check(&h, true));
            }
            "quit" => {
                let _ = app.save_window_state(StateFlags::all());
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}
