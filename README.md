# Overture

Opera One-style tabs and sidebar for [Vivaldi](https://vivaldi.com) on Windows: Tab Islands that group themselves, Tab Traces, Ctrl+Space tab search, workspaces in the sidebar, messenger and AI panels, a compact downloads button and automatic picture-in-picture.

Overture is a mod, not a fork. Vivaldi's interface is closed source, so Overture adds a stylesheet and three scripts to an installed Vivaldi and changes settings once. It is not a browser extension and can't be installed from an extension store.

> Not affiliated with Opera or Vivaldi. Names and trademarks belong to their owners. Built and tested against **Vivaldi 8.3.4191.47** (Chromium 156) on Windows 11.

## What you get

| Feature | How it works |
|---|---|
| **Automatic islands** | A tab opened from a page (middle-click, Ctrl+click, `target=_blank`, `window.open`) joins that page's island, next to its parent. Bookmarks, the start page, typed addresses, **Ctrl+T** and **+** open outside islands, at the end, as measured in Opera One 140. **Alt+T** opens a tab inside the current island. Pinned tabs don't make islands. |
| **Collapse** | Click an island's handle. Without the active tab it becomes an 18 px pill. With it, you see the handle, that tab and two stack bars. Switching to a tab inside keeps it collapsed. The other tabs use the freed space. |
| **Island handle** | Hover to list the island's tabs. Drag to move the island along the strip or onto a workspace in the sidebar. Right-click to move it to a workspace, reload, copy addresses, mute, ungroup or close it. |
| **Tab Traces** | Above 30 tabs in a workspace, the 5 most recently used tabs get an underline, brightest for the newest. |
| **Tab search** | **Ctrl+Space** or the tab-search button. Searches every workspace and window, plus recently closed tabs. |
| **Sidebar** | Hidden until you move the mouse to the left edge. Workspaces at the top, then the services, with bookmarks and history at the bottom. After *Copy from Opera* these are exactly the ones switched on in your Opera. Otherwise: ChatGPT, Claude, Gemini, Messenger, WhatsApp, Instagram, Discord and Spotify. |
| **Downloads** | A compact toolbar popup, also on **Ctrl+J**. Files save without asking. The large panel no longer opens by itself. |
| **Video pop-out** | A playing video moves to picture-in-picture when you switch tabs and returns when you come back. |
| **Active tab** | Clicking the tab you are already on scrolls its page to the top. |
| **Snoozing** | Vivaldi's Memory Saver (balanced). Nothing is closed automatically. |
| **Look** | Sizes and dark gradient measured from Opera One. Island colours other than purple, the pinned-tab width and the light theme are estimates. The light theme follows Windows' setting. |

### Shortcuts changed to Opera's

| Key | Action |
|---|---|
| Ctrl+Space | Search tabs |
| Alt+T | New tab in island |
| Ctrl+T | New tab outside islands |
| Ctrl+E, Alt+D | Address field |
| Alt+P | Settings |
| Alt+F | Main menu |
| Ctrl+J | Downloads popup |
| Ctrl+O | ChatGPT panel |
| Ctrl+Shift+M | Messenger panel |
| Ctrl+Shift+B | Bookmarks manager |
| Ctrl+Shift+C | Inspect element |
| Ctrl+Shift+5 | Capture area |
| Ctrl+Shift+X | Exit |
| Ctrl+Backspace | Parent directory |
| Shift+Backspace | Forward |
| Shift+F5 | Reload without cache |

Backspace no longer goes back and Ctrl+Z no longer reopens tabs. Vivaldi-only shortcuts that clash with web apps are unbound (Ctrl+., Ctrl+Shift+S/D/H/O, Ctrl+F6–F9, Ctrl+Shift+1–9). Mouse and rocker gestures are off, as in Opera.

## Install

1. Install Vivaldi.
2. Download this repository (**Code → Download ZIP**) and **extract it**. Keep the folder, updates need it.
3. Double-click **`install.cmd`**. If Opera One is on the PC, it asks whether to copy your setup from it. For an all-users install under *Program Files*, run it as Administrator.
4. Start Vivaldi.
   - **New profile:** finish Vivaldi's welcome steps, choosing anything. Overture then applies its setup and restarts Vivaldi once by itself.
   - **Existing profile:** click the notice at the bottom to restart.

```powershell
.\install.ps1 -VivaldiPath D:\Apps\Vivaldi   # standalone copy (folder that holds Application\)
.\install.ps1 -AutoRepatch                   # re-apply after Vivaldi updates (scheduled task)
.\install.ps1 -FromOpera                     # copy workspaces, sidebar and icons from the Opera on this PC
```

**Vivaldi updates remove the mod.** Run `install.cmd` again afterwards and answer the Opera question the same way, or install once with `-AutoRepatch`.

### Copy from Opera

`install.cmd` offers this, and `install.ps1 -FromOpera` does it directly. Opera is only read, never changed.

| Copied | Not copied |
|---|---|
| Workspace names, icons and order | Open tabs and islands |
| Which sidebar services, bookmarks and history are switched on | Logins, passwords, cookies, history |
| Opera's sidebar icons | Opera AI and Opera's other built-in tools |

- The copy happens once per Vivaldi profile. Workspaces you already have are kept, after Opera's. One with the same name takes Opera's icon.
- Services that are switched off in Opera stay available under **⋯** at the bottom of the sidebar.
- The result is `from-opera.js` inside that Vivaldi installation. It holds your workspace names and Opera's artwork, and this repository contains neither. **Don't commit or share that file, or a build that contains it.**
- Right-click a workspace in the sidebar to create or edit workspaces. The sidebar shows the icon chosen there.

## Workspaces and logins

**Workspaces don't separate logins.** Cookies and site storage are shared by every workspace in a profile, so signing in to a site in one signs you in everywhere. Overture doesn't change that. To keep accounts apart, use Vivaldi **profiles** (the avatar button), each with its own cookies. A private window is also separate, until it is closed.

### Portable build for another PC

```powershell
.\build-standalone.ps1            # -> dist\Overture-Vivaldi (add -FromOpera only for a personal build)
```

This downloads the current official Vivaldi, checks its signature, installs it standalone and applies Overture. Copy the folder and start `Application\vivaldi.exe`. Don't publish or share a copy after you have browsed with it: its `User Data` folder holds that profile.

## Uninstall and undo

```powershell
.\install.ps1 -Uninstall
```

This restores `window.html` and removes the files and scheduled task. Settings stay changed. To restore those as well, **before uninstalling**:

1. Start Vivaldi with `--debug-packed-apps --silent-debugger-extension-api`.
2. Open `vivaldi://inspect/#apps` and click *inspect* under `window.html`.
3. Run `overture.undoDefaults()`, then restart Vivaldi.

## Configure

- `CFG` at the top of [`mod/overture.js`](mod/overture.js): automatic islands, trace threshold and levels, shortcuts, auto picture-in-picture.
- `PANELS` in the same file: sidebar sites.
- `G` in [`mod/layout.js`](mod/layout.js): every tab and island size.

To keep the sidebar always visible, turn off auto-hide for the panel in Vivaldi's settings. Run `install.cmd` again after editing files.

## Test

```powershell
node test\layout.test.js
& "$env:LOCALAPPDATA\Vivaldi\Application\vivaldi.exe" --remote-debugging-port=9222 --remote-allow-origins=*
node test\smoke.mjs 9222
```

The first test checks the tab geometry without a browser. The second needs Vivaldi running with the debugging port and opens a few example.com tabs. Only use that port for testing: any local program can control the browser while it is open.

## Known limits

- **It relies on Vivaldi internals.** The layout wraps the tab strip's own layout function. If an update changes it, Overture falls back to Vivaldi's normal accordion stacks, and the smoke test reports it.
- **Opera layout needs horizontal tabs** without tab scrolling. With vertical tabs Vivaldi's own layout is used.
- **Context menus, settings pages and the start page are still Vivaldi's.**
- **Without *Copy from Opera*, icons are generic drawings.** A panel then shows the site's own icon after it has loaded once. Claude's icon is always a drawing, as Opera 140 has none.
- **Other programs' global hotkeys win.** If one uses Ctrl+Shift+X, for example, that key never reaches the browser.
- **Workspace switching drives Vivaldi's workspace menu invisibly.** Keep the Workspaces button in the tab-bar toolbar; Overture hides it.
- **Auto picture-in-picture** needs audible video. It sets Vivaldi's permission to *Allow* for all sites and replaces a site's own picture-in-picture media-session handler.
- **Already open tabs aren't regrouped.** As in Opera, islands form when you open links.

## Privacy

Overture makes no network requests of its own and collects nothing. Panels load their sites when opened. Workspaces share cookies, so use Vivaldi profiles to separate logins.

## License

MIT, see [LICENSE](LICENSE). Findings and measurements are in [docs/RESEARCH.md](docs/RESEARCH.md).
