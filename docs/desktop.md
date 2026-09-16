# Desktop app — Snowball.app

The desktop app is a thin macOS shell (Tauri 2) around the same local service the runbook
describes. Nothing about the data or the trust rules changes: the service is the one ledger
writer, Claude jobs run through `claude -p` under your subscription, and every AI write is tagged.
What the app adds is: no terminal, no PATH, a menu-bar icon, a global capture shortcut, start at
login, and a `.dmg` to download.

## How it runs

```
Snowball.app/Contents/
  MacOS/snowball-desktop          the Rust launcher (window, tray, shortcut, updater)
  MacOS/node                 the Node sidecar — a copy of the build machine's node
  Resources/                 = the app root the service sees (APP_ROOT)
    server/  bin/  packages/ledger/  frontend/dist/  .claude/{settings.json,agents,skills}  package.json
```

At launch the launcher:

1. picks the data folder — `--data <dir>` on the command line, else `SNOW_DATA`, else `~/Snowball`
   (the same folder the runbook uses; the app never writes anywhere else except its own window
   state under `~/Library/Application Support/com.jeffmettel.snowball/`; the sidecar's
   entitlements are in `desktop/src-tauri/entitlements.plist` — V8 needs JIT under the hardened
   runtime, without them `node` dies with SIGTRAP at start);
2. probes for a free port from 4310 upward and writes it to `<data>/.port` (removed on quit) so
   the CLI can find the app's server: `snow` with `SNOW_SERVER=http://127.0.0.1:$(cat ~/Snowball/.port)`;
3. spawns `MacOS/node Resources/server/index.js` with `PORT`, `SNOW_DATA`, `SNOW_APP_ROOT`, `HOME` and a
   `PATH` that starts with `Contents/MacOS` (so `#!/usr/bin/env node` in `bin/snow` resolves inside
   jobs), then `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, then whatever PATH Finder gave
   it. The service's stdout/stderr go to `<data>/runs/desktop.log`;
4. shows a bundled "Starting…" page and polls `http://127.0.0.1:<port>/api/health` every 200 ms
   (90 s limit; an early sidecar exit or timeout shows the last 30 log lines on that page);
5. navigates the window to the service. From then on the page is exactly what the browser shows at
   `http://localhost:4310` — `frontend/src/store.js` sees `window.__TAURI__` and takes server mode
   on the page's own origin.

`claude` is resolved when a job starts (`server/jobs.js → claudeBin()`): PATH first, then
`~/.local/bin/claude`, `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`. If none exists the run
fails with the usual "could not start claude (is it on PATH?)" in `runs/<run>.log`.

**Closing the window hides it.** The service, its scheduler (clarify every 15 min, calendar hourly,
review Fridays) and the tray keep running. **Quit** (tray menu or ⌘Q) sends the sidecar SIGTERM,
waits up to 3 s for a clean stop, then SIGKILL. If the launcher itself crashes the sidecar is
orphaned — `pgrep -f server/index.js` and `kill` it; the next launch simply picks the next free port.

Two servers on one data folder is the thing to avoid: if the launchd service from the runbook is
running on 4310, the app starts a *second* writer on 4311. Run one or the other (`npm run
uninstall-launchd` before switching to the app).

## Tray / menu bar

| Item | Does |
|---|---|
| Open Snowball | shows the window |
| New capture (⌘⇧K, global) | shows the window and opens the capture overlay (`window.__snowOpenCapture`, exported by `frontend/src/features/captureOverlay.js`) |
| Sync calendar | `POST /api/jobs/ingest-calendar` — the same job the Refresh button and the hourly schedule run |
| Start at login | toggles a LaunchAgent for the app (tauri-plugin-autostart); the check mark is the current state |
| Check for updates… | runs the updater check now and reports the result (see Updates) |
| Quit Snowball | stops the sidecar and exits |

The Dock icon stays while the app runs; clicking it reopens the window. Window size and position
are remembered (tauri-plugin-window-state). The default window is 1280×860, minimum 900×600.

## Where the data lives

Unchanged: `~/Snowball/` (`ledger/events.jsonl`, `wiki/`, `attachments/`, `config.json`, `runs/`).
Upgrading the app never touches it. Before 0.2 the folder was `~/GTD-data`: the first 0.2 launch with
the default folder renames it to `~/Snowball` (a same-volume `rename`, never copy-then-delete, logged as
`moved ~/GTD-data → ~/Snowball` in `runs/desktop.log`); if both folders exist nothing is moved and
`~/Snowball` is used. An explicit `--data` or `SNOW_DATA` is never migrated. `GTD_DATA` and the other
`GTD_*` env names still work in 0.2 with a deprecation note and go away after.

Settings → Data (backup, export, import) works exactly as in the browser. To run the app against a
scratch folder: `"/Applications/Snowball.app/Contents/MacOS/snowball-desktop" --data /tmp/snowball-scratch`.

## First launch (Gatekeeper)

The app is ad-hoc signed, not notarized (no Developer ID yet). macOS will refuse a double-click
with "cannot be opened because the developer cannot be verified". Once: **right-click the app →
Open → Open**. After that it opens normally. (Alternative: System Settings → Privacy & Security →
"Open Anyway" after the first refusal.) The first calendar sync also triggers the macOS Automation
prompt for Calendar — answer it in the app's own dialog; the grant is per app, so the app and a
terminal `node` are asked separately.

## Updates

**0.1.0 → 0.2.0 is a fresh install, not an update.** The rename changed the bundle identifier from
`com.jeffmettel.deliverysystem` to `com.jeffmettel.snowball`, so macOS treats Snowball.app as a new
app: download the dmg, drag it to Applications, delete "Delivery System.app" by hand (its window state
under `~/Library/Application Support/com.jeffmettel.deliverysystem/` can go too). The updater signing
key is unchanged, so `latest.json` signatures still verify — but 0.1.0's updater points at the old
repo URL, which GitHub redirects after the rename; whether it offers 0.2.0 or not, the identifier
change means it would install beside, not over, the old app. Data is unaffected (see above).

**An update never touches `~/Snowball`.** Only the `.app` bundle is replaced; ledger, wiki,
attachments, config and window state all live outside it.

The app checks GitHub Releases (tauri-plugin-updater) about 15 s after launch and every 6 hours,
and on demand from the tray's **Check for updates…**. The endpoint is
`https://github.com/jeff-mettel/snowball/releases/latest/download/latest.json`, which the release
workflow uploads next to the dmg (`includeUpdaterJson`) together with the signed
`Snowball.app.tar.gz` + `.sig`. Signatures are checked against the public key in
`desktop/src-tauri/tauri.conf.json → plugins.updater.pubkey`; the private half is
`~/.tauri/gtd-updater.key` on Jeff's Mac and the `TAURI_SIGNING_PRIVATE_KEY` repository secret —
lose it and no existing install can update again (they can still download the dmg).

When a newer version exists a native dialog says "Snowball X is available — Update now /
Later". Update now downloads with progress in the menu-bar icon's tooltip, swaps the bundle, stops
the sidecar and relaunches. A failed install shows the error and the README link as the fallback.
Silent checks log to the launcher's stderr only; the manual check also reports "up to date" and
errors in a dialog.

**Private repository.** GitHub serves release assets of a private repo only to an authenticated
request. Until the repo is public, put a fine-grained personal access token (repository access:
this repo; permission: Contents → read) in the data folder's config:

```json
{ "updater": { "token": "github_pat_…" } }
```

in `~/Snowball/config.json` (any other keys stay as they are), or export `SNOW_GITHUB_TOKEN` before
launching. The app sends it as `Authorization: Bearer` on both the JSON and the download request.
There is no Settings field for it yet — edit the file; the token is never written anywhere else.
Whether github.com's `releases/latest/download/…` URLs honour a bearer token for a private repo is
**not verified here** (the API asset endpoints do; the web URLs may not) — see the report; the
clean alternatives are making the repo public or publishing releases to a public `snowball-releases` repo.

Manual fallback at any time: download `Snowball-macOS.dmg` from the README link and drag
the app over the old one.

## Building locally

Requirements: Node ≥ 20 (whatever `node` you build with is what ships — see below), Rust stable
(`rustup`), Xcode Command Line Tools. Rust is on PATH via `source ~/.cargo/env`.

```
npm install
npm run desktop:build          # prepare-sidecar → npm run build → tauri build → stable dmg name
open desktop/src-tauri/target/release/bundle/macos/     # Snowball.app
ls   desktop/src-tauri/target/release/bundle/dmg/       # Snowball_<version>_aarch64.dmg + Snowball-macOS.dmg
```

The first build compiles Tauri and WebKit bindings — allow 10 minutes or more; later builds are
incremental. `npm run desktop:dev` runs `tauri dev` (a debug build with a live window) after
building the front-end; resources are copied next to the debug binary so the sidecar finds them.

**The Node version is pinned by the build machine.** `desktop/scripts/prepare-sidecar.mjs` copies
the `node` that runs it (`process.execPath`) to `desktop/src-tauri/binaries/node-<target-triple>`
(gitignored, ~113 MB). Build with the Node you want users to run; the server needs ≥ 20 and no
native modules, so any recent LTS is fine. The CI workflow pins Node 22 for the same reason.

Sizes seen on the first build (arm64, Node 22.23): launcher 4.7 MB, `node` 112 MB, resources ~1.5 MB;
`.app` 113 MB on disk, `.dmg` 40 MB, updater `.app.tar.gz` 41 MB.

## Releasing with the tag workflow

`.github/workflows/release.yml` runs on any `v*` tag (or by hand from the Actions tab):

```
git tag v0.2.0 && git push origin v0.2.0
```

It builds on `macos-latest` (Apple Silicon), sets the app version from the tag, and publishes a
GitHub Release with tauri-action's `Snowball_<version>_aarch64.dmg`, a copy named
`Snowball-macOS.dmg`, and the updater set (`Snowball.app.tar.gz`, `.sig`,
`latest.json`). The updater artifacts need the `TAURI_SIGNING_PRIVATE_KEY` /
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets; the build fails without them. Locally the same
artifacts come from `TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/gtd-updater.key)" npm run build
--workspace desktop -- --config src-tauri/tauri.release.conf.json` (`createUpdaterArtifacts` is off
in the main config so a plain `npm run desktop:build` needs no key). The README links the copy via
`https://github.com/jeff-mettel/snowball/releases/latest/download/Snowball-macOS.dmg`, which
GitHub resolves to the newest *non-prerelease* release — so the workflow publishes every tag as a
full release (`prerelease: false`, not a draft), including `-beta` tags. If a beta must not be
"latest", publish it by hand as a prerelease and the link keeps pointing at the previous release.

Signing/notarization is optional and secret-driven (`APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`,
`APPLE_TEAM_ID`); with them set the same workflow produces a notarized dmg and the Gatekeeper step
above disappears. Intel, Windows and Linux entries are in the matrix as comments.
