# Research notes: Opera One behaviour on Vivaldi

Snapshot: **22 November 2026**, Windows 11, Opera One 140.0.6074.36, Vivaldi 8.3.4191.47 (Chromium 156).

- **[measured]**: pixels from screenshots of Opera One 140 at 100 % scale.
- **[test]**: checked in isolated Vivaldi profiles with trusted mouse and key events over the DevTools protocol.
- **[physical]**: checked with Windows `SendInput` cursor, buttons, wheel and keys, in a Remote Desktop session.
- **[source]**: read from Vivaldi's shipped `bundle.js` or `prefs_definitions.json`.
- **[unverified]**: not confirmed.

## Opera measurements [measured]

| Item | Value |
|---|---|
| Tab strip | 40 px, flush with the top when maximised |
| Tab | 28 px tall, 3 px from the top, at most 168 px wide, active at least 78 px |
| Island container | 36 px tall, radius 8, white about 16 % |
| Island padding | 14 px before the first tab (6 + 6 handle + 2), 6 px after the last, 3 px outside |
| Handle | 6 × 24 px, radius 3, saturated colour (first one seen: `#5c2bff`) |
| Collapsed, active tab elsewhere | 18 px pill |
| Collapsed, holds the active tab | handle + tab + bars (4 × 24 and 4 × 20 px, 2 px apart) |
| Traces | 2 px line 4–5 px above the strip's bottom, inset 5 px, 5 tabs at 1 / 1 / .65 / .6 / .4, none on the active tab |
| Sidebar | 48 px, 32 px buttons, 40 px pitch, 18 px icons, active `#3d9ff5` |
| Chrome | horizontal gradient `#020205` → `#2c234f` → `#0a080c`, toolbar is white 10 % on top, radius 8 |

Opera settings mirrored: automatic islands on, traces above 30 tabs, snoozing on, tab previews off, most-recently-used cycling, gestures off, close and quit warnings on, click active tab to scroll up, auto-hiding sidebar, video pop-out on tab switch.

Opera groups by **opener**. Measured in Opera One 140 on an empty profile, with real keys and tab state read from Opera itself:

| Action | Island |
|---|---|
| Middle-click a link, or click a `target=_blank` link | yes |
| Four quick Ctrl+T | no |
| Ctrl+T and a typed address, three times (same site or different sites) | no |
| Ctrl+T while inside an island | no, opens outside |
| Alt+Enter in the address field | no |
| Tab created by an extension with an opener | no |
| Middle-click a link on the start page | no |

No time-based rule appeared within these runs of seconds.

## Root causes found

| Symptom | Cause | Fix |
|---|---|---|
| Unrelated tabs fell into the active island | `vivaldi.tabs.stacking.open_in_current` defaults to true [source, test] | Set it to false, with placement `alwayslast` |
| Islands didn't match "opened from this page" | Vivaldi's related-tab placement isn't an opener rule [test] | `chrome.webNavigation.onCreatedNavigationTarget` gives the exact source tab [test] |
| Collapsed pills left dead space and squeezed tabs | Tabs were shifted with CSS after Vivaldi had sized them | Replace the result of `createFlexBoxLayout`, and `getTabListWidth` for the "+" position [source, test] |
| Islands were uncoloured or split by Alt+T | `tab.groupId` is often -1 for Vivaldi stacks [test] | Use `vivExtData.group` and `tabsPrivate` only |
| Every tab switch scrolled the page to the top | Vivaldi activates on press, so on click every tab looks "already active" | Decide on pointerdown |
| A fresh install had no islands, other theme and toolbar | Vivaldi's welcome wizard writes `stacking.mode`, toolbars, theme and panels after a mod set them [test] | Wait until the active tab is no longer the welcome page, then apply and restart |
| Self-restart did nothing | `runtimePrivate.restart()` is silently blocked by the "confirm exit" settings [test] | Off for the restart, restored at the next start |
| Laggy tab bar | `> :has(.tab.active) + * .tab::before` and two similar selectors restyled every tab on each hover and switch [test] | `overture.js` marks those tabs with `data-ovt-nosep` |
| Sidebar floated off the edge | Vivaldi insets auto-hide bars by 6 px and rounds all corners [source] | `left: 0`, `bottom: 0`, rounded on the right only |
| Clicks on sidebar workspaces were lost | The revealed bar is an `app-region: drag` area, and Vivaldi's no-drag rules don't reach shadow roots [physical] | `app-region: no-drag` |
| Islands couldn't be dragged onto an auto-hidden sidebar | The edge hot spot gets no mouse events during the drag [physical] | Overture shows the bar during the drag |
| First-run setup stopped early, undo threw | `setSitePermission` doesn't always return a promise [test] | `try { await … }`, never `.catch()` |

## Vivaldi 8.3 internals relied on

- **Tab strip component**, reached from `.tab-strip` through its React fiber: `createFlexBoxLayout(tabs, width, height, opts)`, `handleAccordionToggle(group, isOpen)`. Its parent has `getTabListWidth(substrip)`. Drawing, drag and drop and close-freeze all read the first one [source].
- **`tabsPrivate.move`** (always pass `debug`, otherwise "ambiguous windowId"):

  | Purpose | Arguments |
  |---|---|
  | New island | `{tabIds:[parent, child], target: parent, tweaks:['do-not-reparent','create-new-group']}` |
  | Join after a member | `{tabIds, target: member ext_id, windowId, tweaks:['do-not-reparent','below','strip-down']}`. With `strip-accordion` the tab lands outside when the target is the last member. |
  | Reorder an island | `{tabIds, target: group or ext_id, windowId, tweaks:['do-not-reparent','above' or 'below','strip-up']}` |
  | To a workspace | `{tabIds, target:'last', tweaks:['do-not-reparent'], workspaceId: id or 'window'}`. Activate a tab outside the island first. |
  | Ungroup in place | `{tabIds, target: first id, tweaks:['do-not-reparent','ungroup','untile']}` |

- **Events:** stack changes only show up in `tabsPrivate.onExtDataChanged`. There are no `tabGroups` or `groupId` events.
- **Don't** write `workspaceId` or groups with `chrome.tabs.update({vivExtData})`: the workspace is stripped and `groupId` desyncs.
- **`sitePermissions.setSitePermission(primary, secondary, permission, value)`**: `('*', origin, …)` crashes Vivaldi for auto-PiP.
- **Workspaces:** activating a tab in another workspace doesn't switch to it, so Overture drives the workspace popup.
- **Web panels** render from `vivaldi.panels.web.elements` and need a restart.
- **Style cost:** inserting nodes into Vivaldi's document restyles the whole window (about 75 ms at 270 tabs), so Overture's UI lives in shadow roots. Shadow hosts look `:empty` and need `display:block`.

## Test results [test]

- **Links:** middle, Ctrl, Shift+middle, `target=_blank`, `noopener` and `window.open` all form coloured islands. Quick repeated clicks and second-generation links join the same island.
- **Stay outside:** bookmark-style tabs, background tabs, Ctrl+T and "+".
- **Islands:** collapse, expand, hover list, every menu action, handle drag along the strip and onto a workspace, native tab drag, close-freeze, reopen into island.
- **Keys:** Ctrl+Space, Ctrl+T, Alt+T, Ctrl+E, Ctrl+J, Ctrl+O, Ctrl+Shift+M, Alt+P and Backspace, as key events.
- **Physical:** 65 checks: edge reveal (maximised and windowed), grouping, collapse, menus, both island drags, workspace clicks, panels, tab clicks and the shortcuts in the README except Ctrl+Shift+X, plus Alt+F by screenshot.
- **Other:** second window, vertical-tab fallback, light theme, narrow window, new profile through onboarding, upgrade from settings v2, undo, auto-PiP.

At 257 tabs in 5 workspaces:

| Action | Time |
|---|---|
| Layout, 500 tabs | 0.03 ms |
| Open search | 21 ms |
| Keystroke in search | 18 ms |
| Switch workspace | 84 ms |
| Switch tab | 60 ms |

Style work per action with 120 tabs, compared with plain Vivaldi on the same profile:

| Action | Plain Vivaldi | Overture before | Overture now |
|---|---|---|---|
| Mouse move over tabs | 0.7–0.8 ms | 4.6–4.8 ms | 0.7 ms |
| Switch tab | 31–36 ms | 45–49 ms | 31 ms |
| Open and close a tab | 138–148 ms | 191–196 ms | 135–137 ms |

Over Remote Desktop the test PC delivered a frame every 31 ms (32 fps), also when idle.

Workspaces share cookies and localStorage, a private window doesn't [test].

## Not verified

- Display scaling other than 100 %, more than one monitor, macOS and Linux.
- A multi-day session with real browsing.
- Which tab Opera activates after closing one.
- Ctrl+Shift+X (another program's global hotkey took it on the test PC), and the effect of most mirrored settings (stored values were checked).
- Island colours other than purple, pinned-tab width and the light theme against Opera.
- Auto-islands from Ctrl+Shift+click: it opened a new window in the test.

## Community projects reviewed

| Project | Licence | Finding |
|---|---|---|
| Skolodac/Operaldi | MIT | CSS look only, no island behaviour |
| PaRr0tBoY/Awesome-Vivaldi | GPL-3.0 | Arc/Zen look, not reused |
| jms830/VivaldiMods | GPL-3.0 | Installer reference |
| SpookyKipper/ContextualTabGroups | GPL-3.0 | Extension, not needed |
| seanharsh/better-auto-pip | MIT | Confirmed the media-session approach |
| maddada/sharptabs | none | Replaces the tab strip, unsuitable |
| luetage/vivaldi_modding | MIT, archived | Historical reference |
