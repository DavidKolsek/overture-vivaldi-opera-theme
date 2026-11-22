// Overture: Opera One-style tabs for Vivaldi.
// Loaded once per browser window from window.html (install.ps1 adds the tags), after layout.js and icons.js.
// Uses Vivaldi internals: chrome.* and vivaldi.* APIs, its DOM, and the tab strip component (layout.js).
(() => {
  'use strict';

  // ---- Tunables -----------------------------------------------------------
  const CFG = {
    autoIslands: true,    // Opera "Automatically create tab islands"
    traceMinTabs: 31,     // Opera "Show traces on most recently used tabs": More than 30 tabs
    traceLevels: [1, 1, .65, .6, .4], // brightness by recency rank (measured)
    searchKey: 'Ctrl+Space',
    islandTabKey: 'Alt+T', // Opera "New tab in island"
    autoPip: true,        // Opera "video pop-out autodetach"
    operaIcons: true,     // use Opera's sidebar icons once install.ps1 -FromOpera has read them
  };
  const ISLAND_COLORS = ['color7', 'color9', 'color5', 'color6', 'color2', 'color4', 'color8', 'color3']; // purple first, as in Opera
  const DEFAULTS_VERSION = 4;
  const OPERA = window.overtureOpera || {}; // what install.ps1 -FromOpera read from this PC's Opera
  const PANELS = [ // Opera's sidebar order
    ['ChatGPT', 'https://chatgpt.com/'],
    ['Claude', 'https://claude.ai/'],
    ['Gemini', 'https://gemini.google.com/'],
    ['Messenger', 'https://www.messenger.com/'],
    ['WhatsApp', 'https://web.whatsapp.com/'],
    ['Instagram', 'https://www.instagram.com/'],
    ['Discord', 'https://discord.com/app'],
    ['Spotify', 'https://open.spotify.com/'],
  ];
  // Without these, islands stop working like Opera's, so they are re-checked on every start.
  const ISLAND_PREFS = {
    'vivaldi.tabs.stacking.mode': 'accordion',
    'vivaldi.tabs.stacking.open_in_current': false, // on, every new tab falls into the active island
    'vivaldi.tabs.stacking.auto_expand': false,     // switching into a collapsed island keeps it collapsed
    'vivaldi.tabs.new_placement': 'alwayslast',     // unrelated tabs go last; linked ones join their island
  };

  // ---- Helpers ------------------------------------------------------------
  const { G, install: installLayout } = window.overtureLayout;
  const ICONS = window.overtureIcons;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ext = t => { try { return JSON.parse(t.vivExtData || '{}'); } catch { return {}; } };
  const wsOf = t => ext(t).workspaceId || null;
  const isPanel = t => !!ext(t).panelId; // web panels are tabs too
  const pref = async p => (await vivaldi.prefs.get(p))?.value;
  const log = e => console.warn('[overture]', e);
  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(() => fn().catch(log), ms); }; };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const favicon = t => /^(https?|data):/.test(t.favIconUrl || '') ? t.favIconUrl
    : `chrome://favicon2/?size=16&pageUrl=${encodeURIComponent(t.url || '')}`;
  // Overture's own UI lives in shadow roots: adding nodes to Vivaldi's DOM restyles the whole window
  // (measured ~75 ms per update with 270 tabs), inside a shadow root it is ~1 ms.
  const shadowHost = cls => {
    const host = h('div', cls), root = host.attachShadow({ mode: 'open' });
    const css = h('link'); css.rel = 'stylesheet'; css.href = 'overture/overture.css';
    root.append(css);
    return [host, root];
  };
  const inside = (e, el) => e.composedPath().includes(el);
  const swallow = e => { e.preventDefault(); e.stopPropagation(); };
  // React listens for pointer/mouse events, a bare .click() is not enough for toolbar buttons.
  const press = el => { for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) el.dispatchEvent(new (type[0] === 'p' ? PointerEvent : MouseEvent)(type, { bubbles: true, cancelable: true, view: window, button: 0 })); };
  // `debug` is required: without it Vivaldi answers "ambiguous windowId".
  const moveTabs = async args => {
    const result = await vivaldi.tabsPrivate.move({ debug: 'overture', ...args });
    if (!result?.success) throw new Error(`move failed: ${result?.message || 'unknown reason'}`);
    return result;
  };
  let WIN;          // this window's id
  let strip = null; // handle from layout.js, null while Vivaldi's own layout is in use

  // ---- One-time Opera-like defaults --------------------------------------
  const DEFAULT_PREFS = {
    ...ISLAND_PREFS,
    'vivaldi.tabs.stacking.auto_editor': false,
    'vivaldi.tabs.activation.on_close': 'right',
    'vivaldi.tabs.activation.prefer_related': true,
    'vivaldi.tabs.cycle_by_recent_order': true,
    'vivaldi.tabs.show_trash_can': false,          // recently closed lives in Ctrl+Space
    'vivaldi.tabs.show_synced_tabs_button': false,
    'vivaldi.tabs.tooltip': false,                 // Opera "Show tab previews": off
    'vivaldi.tabs.unread': false,
    'vivaldi.tabs.confirm_closing_tabs': false,
    'vivaldi.tabs.double_click': 'ignore',
    'vivaldi.tabs.bar.position': 'top',
    'vivaldi.windows.show_window_close_confirmation_dialog': true,
    'vivaldi.system.show_exit_confirmation_dialog': true,
    'vivaldi.sessions.save_on_exit': 'on',
    'vivaldi.downloads.open_panel_on_new': false,  // no full-height panel on download
    'vivaldi.downloads.start_automatically': true,
    'vivaldi.panels.position': 'left',
    'vivaldi.panels.as_overlay.enabled': true,     // panels float over the page
    'vivaldi.panels.as_overlay.auto_close': true,
    'vivaldi.auto_hide.enabled': true,             // Opera's auto-hiding sidebar, and only the sidebar
    'vivaldi.auto_hide.panel': true,
    'vivaldi.auto_hide.tab_bar': false,
    'vivaldi.auto_hide.address_bar': false,
    'vivaldi.auto_hide.bookmarks_bar': false,
    'vivaldi.auto_hide.status_bar': false,
    'vivaldi.auto_hide.show_introduction': false,
    'vivaldi.status_bar.display': 'off',
    'vivaldi.mouse_gestures.enabled': false,
    'vivaldi.mouse_gestures.rocker_gestures.enabled': false,
    'vivaldi.webpages.tab_focuses_links': true,
    'vivaldi.keyboard.shortcuts.space_fast_forwards': false,
    'performance_tuning.high_efficiency_mode.state': 2, // Memory Saver on (Opera: tab snoozing)
    'performance_tuning.high_efficiency_mode.aggressiveness': 1,
  };
  const OPERA_KEYS = { // key: Vivaldi command, or null to unbind
    'ctrl+t': 'COMMAND_NEW_TAB_OUTSIDE_GROUP',
    'ctrl+e': 'COMMAND_FOCUS_ADDRESSFIELD',
    'alt+d': 'COMMAND_FOCUS_ADDRESSFIELD',
    'alt+p': 'COMMAND_SHOW_SETTINGS',
    'alt+f': 'COMMAND_FOCUS_MAINMENU',
    'ctrl+shift+c': 'COMMAND_DEVTOOLS_INSPECTOR',
    'ctrl+shift+b': 'COMMAND_SHOW_BOOKMARKS',
    'ctrl+shift+x': 'COMMAND_EXIT',
    'ctrl+shift+5': 'COMMAND_CAPTURE_AREA_TO_CLIPBOARD',
    'ctrl+backspace': 'COMMAND_GO_TO_PARENT_DIRECTORY',
    'shift+backspace': 'COMMAND_PAGE_FORWARD',
    'shift+f5': 'COMMAND_PAGE_RELOAD_NOCACHE',
    // Vivaldi-only keys that would surprise an Opera user or steal keys from web apps
    'backspace': null, 'ctrl+z': null, 'ctrl+.': null, 'ctrl+shift+s': null,
    'ctrl+shift+d': null, 'ctrl+shift+h': null, 'ctrl+shift+o': null,
    'ctrl+f6': null, 'ctrl+f7': null, 'ctrl+f8': null, 'ctrl+f9': null,
    ...Object.fromEntries([1, 2, 3, 4, 6, 7, 8, 9].map(n => [`ctrl+shift+${n}`, null])),
    // Handled by Overture itself
    'ctrl+space': null, 'alt+t': null, 'ctrl+j': null, 'ctrl+o': null, 'ctrl+shift+m': null,
  };

  async function defaultsFor() {
    const prefs = { ...DEFAULT_PREFS };

    // Opera's toolbar: navigation, VPN badge, address field, ... downloads, settings, profile, extensions
    const nav = (await pref('vivaldi.toolbars.navigation') || [])
      .filter(b => !['PanelToggle', 'PanelWidthSpacer', 'Spacer', 'VPNButton', 'DownloadButton', 'Settings'].includes(b));
    const addr = nav.indexOf('AddressField');
    if (addr >= 0) {
      nav.splice(addr, 1, 'VPNButton', 'AddressField', 'DownloadButton', 'Settings');
      prefs['vivaldi.toolbars.navigation'] = nav;
    }

    const actions = structuredClone(await pref('vivaldi.actions') || [{}]);
    const map = actions[0] ||= {};
    for (const [key, cmd] of Object.entries(OPERA_KEYS)) {
      for (const c of Object.values(map)) if (c.shortcuts) c.shortcuts = c.shortcuts.filter(s => s !== key);
      if (cmd) { const c = map[cmd] ||= {}; c.shortcuts = [...(c.shortcuts || []), key]; }
    }
    prefs['vivaldi.actions'] = actions;

    // The sidebar renders panels.web.elements (panels.web.items is something else).
    const els = structuredClone(await pref('vivaldi.panels.web.elements') || []);
    const ids = PANELS.map(([title, url]) => {
      let el = els.find(e => e.url === url);
      if (!el) els.push(el = { id: `WEBPANEL_${crypto.randomUUID()}`, url, title, faviconUrl: '', mobileMode: false, zoom: 1 });
      if (!el.faviconUrl || el.faviconUrl.startsWith('chrome://favicon2')) el.faviconUrl = ICONS.service[title];
      return el.id;
    });
    prefs['vivaldi.panels.web.elements'] = els;
    // All services stay available under "...". In the bar: those switched on in Opera, or all of them.
    const shown = name => !OPERA.sidebar || OPERA.sidebar.includes(name);
    prefs['vivaldi.toolbars.panel'] = ['FlexibleSpacer', ...ids.filter((id, i) => shown(PANELS[i][0])), 'FlexibleSpacer',
      ...(shown('Bookmarks') ? ['PanelBookmarks'] : []), ...(shown('History') ? ['PanelHistory'] : []), 'PanelWeb'];

    prefs['vivaldi.themes.user'] = [...(await pref('vivaldi.themes.user') || []).filter(t => !t.id.startsWith('overture-')), ...THEMES];
    prefs['vivaldi.theme.schedule.enabled'] = 'system';
    prefs['vivaldi.theme.schedule.o_s'] = { light: 'overture-light', dark: 'overture-dark' };
    return prefs;
  }

  // Vivaldi's welcome wizard writes stacking, toolbars, theme and sidebar. Whatever is set before it ends is lost.
  async function afterWelcome() {
    let waited = false;
    for (;;) {
      const active = await chrome.tabs.query({ active: true });
      const busy = !active.length || active.some(t => {
        const url = t.pendingUrl || t.url;
        return !url || /\/components\/welcome\/welcome\.html|^(chrome|vivaldi):\/\/welcome/.test(url);
      });
      if (!busy) return waited;
      waited = true;
      await sleep(1000);
    }
  }
  // Opera's workspaces, in Opera's order. A workspace with the same name is kept, others follow after.
  function mergeWorkspaces(current) {
    const rest = [...current], base = Date.now();
    const ours = OPERA.workspaces.map(({ name, icon, emoji }, i) => {
      const at = rest.findIndex(w => w.name.trim().toLowerCase() === name.trim().toLowerCase());
      const w = at < 0 ? { id: base + i, name } : rest.splice(at, 1)[0];
      return { ...w, icon: emoji ? '' : ICONS.asVivaldiIcon(icon) || w.icon || '', emoji: emoji || '' };
    });
    return [...ours, ...rest];
  }
  // With either "confirm exit" setting on, runtimePrivate.restart() silently does nothing. Off just for the restart.
  const CONFIRMS = ['vivaldi.system.show_exit_confirmation_dialog', 'vivaldi.windows.show_window_close_confirmation_dialog'];
  async function restart() {
    const keep = {};
    for (const path of CONFIRMS) keep[path] = await pref(path);
    await chrome.storage.local.set({ ovtRestarting: keep });
    for (const path of CONFIRMS) await vivaldi.prefs.set({ path, value: false });
    await sleep(700);
    vivaldi.runtimePrivate.restart();
  }
  async function afterRestart() {
    const { ovtRestarting } = await chrome.storage.local.get('ovtRestarting');
    if (!ovtRestarting) return;
    for (const [path, value] of Object.entries(ovtRestarting)) await vivaldi.prefs.set({ path, value });
    await chrome.storage.local.remove('ovtRestarting');
  }

  async function applyDefaults() {
    const todo = async () => {
      const s = await chrome.storage.local.get(['ovtDefaults', 'ovtBackup', 'ovtUndone', 'ovtFromOpera']);
      s.importing = !!(OPERA.workspaces || OPERA.sidebar) && !s.ovtFromOpera; // once, so later edits here are kept
      return !s.ovtUndone && (s.importing || (s.ovtDefaults || 0) < DEFAULTS_VERSION) ? s : null;
    };
    if (!await todo()) return false;
    await sleep(1500); // on a new profile the welcome tab needs a moment to appear
    const isNew = await afterWelcome();
    const stored = await todo(); // again: another window may have done it meanwhile
    if (!stored) return false;
    await chrome.storage.local.set({ ovtDefaults: DEFAULTS_VERSION, ...(stored.importing && { ovtFromOpera: true }) }); // claim first so other windows skip
    const prefs = await defaultsFor();
    const backup = stored.ovtBackup || {}; // originals from an earlier version win
    for (const path of Object.keys(prefs)) if (!(path in backup)) backup[path] = await pref(path).catch(log);
    const sp = vivaldi.sitePermissions;
    backup['site:auto-picture-in-picture'] ??= (await sp.getOverridesForSite('*')).find(p => p.permission === 'auto-picture-in-picture')?.setting || 'ask';
    await chrome.storage.local.set({ ovtBackup: backup }); // saved before anything changes

    for (const [path, value] of Object.entries(prefs)) {
      try { await vivaldi.prefs.set({ path, value }); } catch (e) { log(`${path}: ${e.message}`); }
    }
    // Not in the backup: undo must never delete a workspace that has tabs in it.
    if (stored.importing && OPERA.workspaces) {
      try {
        await vivaldi.prefs.set({ path: 'vivaldi.workspaces.list', value: mergeWorkspaces(await pref('vivaldi.workspaces.list') || []) });
        if (isNew) await chrome.storage.local.set({ ovtSettle: true });
      } catch (e) { log(e); }
    }
    if (isNew) { // nothing is open yet that a restart could disturb
      toast('Overture is finishing setup. Vivaldi restarts by itself in a moment.');
      await sleep(3000);
    }
    // Chromium only auto-PiPs sites whose permission is Allow (default Ask).
    // Argument order matters: ('*', origin, ...) crashes Vivaldi 8.3.
    try { await sp.setSitePermission('*', '*', 'auto-picture-in-picture', 'allow'); } catch (e) { log(e); } // not always a promise
    if (isNew) { // workspaces, panels and theme all load at start
      await restart();
      return true;
    }
    renderWorkspaces(); dressPanels().catch(log); // own pref writes don't always come back as change events
    toast('Overture changed some settings. Click here to restart Vivaldi and finish.', () => restart().catch(log));
    return false;
  }
  // A new profile with Opera's workspaces starts inside the first one, as Opera does.
  async function settleIn() {
    if (!(await chrome.storage.local.get('ovtSettle')).ovtSettle) return;
    await chrome.storage.local.remove('ovtSettle');
    const first = (await pref('vivaldi.workspaces.list') || [])[0];
    if (!first) return;
    await sleep(1500); // the workspace button has to be there
    const loose = (await chrome.tabs.query({ windowId: WIN })).filter(t => !wsOf(t) && !isPanel(t)).map(t => t.id);
    await switchWorkspace(first.id);
    if (loose.length) await moveTabs({ tabIds: loose, target: 'last', tweaks: ['do-not-reparent'], workspaceId: first.id });
    renderWorkspaces();
  }
  async function enforceIslandPrefs() {
    if ((await chrome.storage.local.get('ovtUndone')).ovtUndone) return;
    for (const [path, value] of Object.entries(ISLAND_PREFS)) if (await pref(path) !== value) await vivaldi.prefs.set({ path, value });
  }
  // Undo from DevTools: overture.undoDefaults()
  async function undoDefaults() {
    const { ovtBackup = {} } = await chrome.storage.local.get('ovtBackup');
    await chrome.storage.local.set({ ovtUndone: true }); // or the next start would put them straight back
    for (const [path, value] of Object.entries(ovtBackup)) {
      if (value === undefined) continue;
      try { // these APIs do not always return promises, so no .catch()
        if (path.startsWith('site:')) await vivaldi.sitePermissions.setSitePermission('*', '*', path.slice(5), value);
        else await vivaldi.prefs.set({ path, value });
      } catch (e) { log(`${path}: ${e.message}`); }
    }
  }
  const theme = (id, name, bg, win, fg, hi) => ({
    engineVersion: 1, id, name, version: 2, accentFromPage: false, accentOnWindow: false, accentSaturationLimit: 1,
    alpha: 1, backgroundImage: '', backgroundPosition: 'stretch', backgroundSource: '', blur: 0, contrast: 0,
    colorAccentBg: bg, colorBg: bg, colorFg: fg, colorHighlightBg: hi, colorWindowBg: win, colorPosition: 'unified',
    preferSystemAccent: false, radius: 8, transparencyTabBar: false, transparencyTabs: false, url: '',
  });
  const THEMES = [ // sampled from Opera One's dark chrome
    theme('overture-dark', 'Overture Dark', '#21212f', '#0b0b1d', '#ffffff', '#3d9ff5'),
    theme('overture-light', 'Overture Light', '#f6f6fa', '#e4e4ec', '#1d1d26', '#3d9ff5'),
  ];

  // ---- Islands: automatic grouping ----------------------------------------
  // Chromium reports exactly which tab a link was opened from (middle/Ctrl/Shift click, target=_blank,
  // window.open, "open in new tab"). Bookmarks, Ctrl+T, "+" and other apps' links don't fire it.
  let queue = Promise.resolve();
  const serial = fn => { queue = queue.then(fn).catch(log); return queue; }; // quick successive clicks must not race

  async function addToIsland(parent, child) {
    const p = ext(parent), all = await chrome.tabs.query({ windowId: WIN });
    const members = p.group ? all.filter(t => ext(t).group === p.group) : [];
    if (members.length > 1) {
      if (members.some(t => t.id === child.id)) return;
      const earlier = members.filter(t => t.index > parent.index && ext(t).parent_ext_id === p.ext_id).sort((a, b) => b.index - a.index)[0];
      await moveTabs({ tabIds: [child.id], target: ext(earlier || parent).ext_id, windowId: WIN, tweaks: ['do-not-reparent', 'below', 'strip-down'] }); // strip-down = inside the stack
    } else {
      await moveTabs({ tabIds: [parent.id, child.id], target: parent.id, tweaks: ['do-not-reparent', 'create-new-group'] });
    }
  }
  async function onLinkOpened({ sourceTabId, tabId }) {
    const [parent, child] = await Promise.all([sourceTabId, tabId].map(id => chrome.tabs.get(id).catch(() => null)));
    if (!parent || !child || parent.windowId !== WIN || child.windowId !== WIN) return;
    if (parent.pinned || child.pinned || isPanel(parent) || isPanel(child)) return;
    if (isNewTabPage(parent)) return; // Opera doesn't make islands from its start page either
    await addToIsland(parent, child);
  }
  // Alt+T: new tab inside the current island (creates one if needed).
  async function newTabInIsland() {
    const [active] = await chrome.tabs.query({ active: true, windowId: WIN });
    if (!active || active.pinned) return;
    const child = await chrome.tabs.create({ windowId: WIN, index: active.index + 1, openerTabId: active.id });
    await addToIsland(active, child);
  }

  // Opera gives every island a colour, different from its neighbours'.
  let colorIx = 0;
  const colorIslands = debounce(async () => {
    const groups = new Map();
    for (const t of await chrome.tabs.query({ windowId: WIN })) {
      const e = ext(t);
      if (!e.group || isPanel(t)) continue;
      const g = groups.get(e.group) || { id: e.group, size: 0 };
      g.size++; g.color ||= e.groupColor;
      groups.set(e.group, g);
    }
    const list = [...groups.values()].filter(g => g.size > 1); // query order is strip order
    for (const [i, g] of list.entries()) {
      if (g.color) continue;
      const taken = [list[i - 1]?.color, list[i + 1]?.color];
      while (taken.includes(ISLAND_COLORS[colorIx % ISLAND_COLORS.length])) colorIx++;
      g.color = ISLAND_COLORS[colorIx++ % ISLAND_COLORS.length];
      await vivaldi.tabsPrivate.setGroupProperties({ groupExtId: g.id, groupColor: g.color });
    }
  }, 150);

  // ---- Islands: handle (click, hover list, drag, menu) --------------------
  const stripRect = () => $('#browser .tab-strip').getBoundingClientRect();
  function islandAt(e) {
    if (!strip?.enabled() || !e.target.closest?.('.tab-strip')) return null;
    const x = e.clientX - stripRect().left;
    return strip.islands().find(i => x >= i.left && x < Math.min(i.right, i.left + (i.kind === 'pill' ? G.PILL : G.PRE))) || null;
  }
  const membersOf = async group => (await chrome.tabs.query({ windowId: WIN })).filter(t => ext(t).group === group);

  const islandList = h('div', 'ovt-pop ovt-island-list'); islandList.hidden = true;
  let hovered = null, hoverT;
  const hideIslandList = () => {
    clearTimeout(hoverT); hovered = null;
    if (islandList.hidden) return;
    islandList.hidden = true;
    document.body.classList.remove('ovt-island-open');
  };
  islandList.onmouseenter = () => clearTimeout(hoverT);
  islandList.onmouseleave = () => { hoverT = setTimeout(hideIslandList, 250); };
  let moved = null;
  document.addEventListener('mousemove', e => {
    if (inside(e, islandList) || drag) { moved = null; return; }
    // Measuring inside the event would force a style pass for every move; one per frame is enough.
    if (!moved) requestAnimationFrame(hoverFrame);
    moved = { target: e.target, clientX: e.clientX };
  }, { passive: true });
  function hoverFrame() {
    if (!moved) return;
    const island = menu.hidden ? islandAt(moved) : null;
    moved = null;
    if ((island?.group || null) === hovered) return;
    hovered = island?.group || null;
    clearTimeout(hoverT);
    hoverT = setTimeout(() => (island ? showIslandList(island).catch(log) : hideIslandList()), island ? 400 : 250);
  }

  async function showIslandList(island) {
    const tabs = await membersOf(island.group);
    if (hovered !== island.group || !tabs.length) return;
    const close = h('button', 'ovt-close-island', 'Close island');
    close.onclick = () => { hideIslandList(); closeTabs(tabs.map(t => t.id)).catch(log); };
    islandList.replaceChildren(...tabs.map(t => tabRow(t, {
      onPick: () => { hideIslandList(); chrome.tabs.update(t.id, { active: true }); },
      onClose: async row => { await chrome.tabs.remove(t.id); row.remove(); },
    })), close);
    const r = stripRect();
    Object.assign(islandList.style, { left: `${Math.min(r.left + island.left, innerWidth - 312)}px`, top: `${r.top + G.ISLAND_H + 6}px` });
    islandList.hidden = false;
    document.body.classList.add('ovt-island-open'); // hides Vivaldi's own tooltip meanwhile
  }

  const startPage = () => chrome.tabs.create({ windowId: WIN, active: true, url: 'chrome://vivaldi-webui/startpage' });
  // Before the active island leaves this workspace or is closed, make a tab outside it active.
  async function stepOutOf(ids) {
    const all = await chrome.tabs.query({ windowId: WIN });
    const active = all.find(t => t.active);
    if (!active || !ids.includes(active.id)) return;
    const rest = all.filter(t => !ids.includes(t.id) && !isPanel(t) && wsOf(t) === wsOf(active));
    rest.sort((a, b) => Math.abs(a.index - active.index) - Math.abs(b.index - active.index));
    if (rest[0]) await chrome.tabs.update(rest[0].id, { active: true });
    else await startPage(); // the workspace would be left empty
    await sleep(150); // Vivaldi moves only part of a group while one of it is still active
  }
  async function closeTabs(ids) {
    await stepOutOf(ids);
    await chrome.tabs.remove(ids);
  }
  async function moveIsland(group, workspaceId) {
    const ids = (await membersOf(group)).map(t => t.id);
    if (!ids.length) return;
    await stepOutOf(ids);
    await moveTabs({ tabIds: ids, target: 'last', tweaks: ['do-not-reparent'], workspaceId: workspaceId ?? 'window' });
    renderWorkspaces(); traces();
  }

  const menu = h('div', 'ovt-pop ovt-menu'); menu.hidden = true; menu.tabIndex = -1;
  const hideMenu = () => { menu.hidden = true; };
  menu.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); });
  menu.addEventListener('focusout', e => { if (!menu.contains(e.relatedTarget)) hideMenu(); });
  async function showMenu(island, x, y) {
    const [tabs, list] = await Promise.all([membersOf(island.group), pref('vivaldi.workspaces.list')]);
    if (!tabs.length) return;
    const ids = tabs.map(t => t.id), current = wsOf(tabs[0]), muted = tabs.every(t => t.mutedInfo?.muted);
    const item = (label, fn, cls = '') => {
      const r = h('button', `ovt-mi ${cls}`, label);
      r.onclick = () => { hideMenu(); Promise.resolve(fn()).catch(log); };
      return r;
    };
    const targets = [...(list || []), { id: null, name: 'No workspace' }].filter(w => w.id !== current);
    const sub = h('div', 'ovt-pop ovt-sub');
    for (const w of targets) {
      const r = item('', () => moveIsland(island.group, w.id));
      r.dataset.ws = w.id ?? 'window';
      r.append(wsIcon(w, (list || []).indexOf(w)), h('span', 'ovt-title', w.name));
      sub.append(r);
    }
    const move = h('div', 'ovt-mi ovt-has-sub', 'Move to workspace');
    move.append(h('span', 'ovt-chev', '›'), sub);
    menu.replaceChildren(
      item(island.kind === 'open' ? 'Collapse island' : 'Expand island', () => strip.toggle(island)),
      ...(list?.length ? [move] : []),
      item('Reload', () => Promise.all(ids.map(id => chrome.tabs.reload(id)))),
      item('Copy page addresses', () => navigator.clipboard.writeText(tabs.map(t => t.url).join('\n'))),
      item(muted ? 'Unmute all tabs in island' : 'Mute all tabs in island', () => Promise.all(ids.map(id => chrome.tabs.update(id, { muted: !muted })))),
      item('Ungroup tabs', () => moveTabs({ tabIds: ids, target: ids[0], tweaks: ['do-not-reparent', 'ungroup', 'untile'] })),
      item('Close all tabs in island', () => closeTabs(ids), 'ovt-danger'));
    hideIslandList();
    menu.hidden = false;
    const left = Math.max(4, Math.min(x, innerWidth - menu.offsetWidth - 4));
    Object.assign(menu.style, { left: `${left}px`, top: `${Math.max(4, Math.min(y + 4, innerHeight - menu.offsetHeight - 4))}px` });
    menu.classList.toggle('ovt-flip', left + menu.offsetWidth + 230 > innerWidth);
    menu.focus();
  }
  document.addEventListener('contextmenu', e => {
    const island = islandAt(e);
    if (island) { swallow(e); showMenu(island, e.clientX, e.clientY).catch(log); }
    else if (!inside(e, menu)) hideMenu();
  }, true);

  // Dragging the handle moves the whole island: along the strip, or onto a sidebar workspace.
  let drag = null;
  const dragLabel = h('div', 'ovt-pop ovt-drag'); dragLabel.hidden = true;
  const dropLine = h('div', 'ovt-drop-line'); dropLine.hidden = true;
  function dropTarget(e) {
    const button = wsRoot.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-ws]');
    if (button && document.elementFromPoint(e.clientX, e.clientY) === wsHost) return { button };
    const r = stripRect();
    if (e.clientY < r.top - 8 || e.clientY > r.top + G.ISLAND_H + 8 || e.clientX < r.left - 20 || e.clientX > r.right + 20) return null;
    const x = e.clientX - r.left, others = strip.items().filter(i => i.key !== drag.island.group);
    if (!others.length) return null;
    const next = others.find(i => (i.left + i.right) / 2 > x);
    const item = next || others.at(-1);
    return { item, before: !!next, at: r.left + (next ? item.left : item.right), top: r.top };
  }
  function endDrag() {
    drag = null;
    dragLabel.hidden = dropLine.hidden = true;
    document.body.classList.remove('ovt-dragging', 'ovt-drag-side');
    for (const b of $$('.drop', wsRoot)) b.classList.remove('drop');
  }
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moving) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.moving = true;
      hideIslandList();
      document.body.classList.add('ovt-dragging'); // pages must not eat the pointer
      membersOf(drag.island.group).then(t => { dragLabel.textContent = `${t.length} tabs`; }).catch(log);
      dragLabel.hidden = false;
    }
    swallow(e);
    // Vivaldi's edge hot spot gets no mouse events during this drag, so show the auto-hidden sidebar ourselves.
    document.body.classList.toggle('ovt-drag-side', e.clientX < 64 && e.clientY > stripRect().bottom + 8);
    drag.to = dropTarget(e);
    for (const b of $$('[data-ws]', wsRoot)) b.classList.toggle('drop', b === drag.to?.button);
    dropLine.hidden = !drag.to?.item;
    if (drag.to?.item) Object.assign(dropLine.style, { left: `${drag.to.at - 1}px`, top: `${drag.to.top}px` });
    Object.assign(dragLabel.style, { left: `${e.clientX + 12}px`, top: `${e.clientY + 12}px` });
  }, true);
  document.addEventListener('pointerup', e => {
    if (!drag) return;
    const { island, moving, to } = drag;
    endDrag();
    swallow(e);
    if (!moving) { hideIslandList(); strip.toggle(island); return; } // a plain click on the handle
    if (to?.button) {
      const id = to.button.dataset.ws === 'window' ? null : Number(to.button.dataset.ws);
      moveIsland(island.group, id).catch(log);
    } else if (to?.item) {
      membersOf(island.group).then(tabs => moveTabs({
        tabIds: tabs.map(t => t.id), target: to.item.key, windowId: WIN,
        tweaks: ['do-not-reparent', to.before ? 'above' : 'below', 'strip-up'],
      })).catch(log);
    }
  }, true);
  window.addEventListener('blur', () => { if (drag?.moving) endDrag(); });
  document.addEventListener('keydown', e => { if (drag && e.key === 'Escape') endDrag(); }, true);

  // One place decides what a press on the tab bar means, before Vivaldi sees it.
  let pressed = null, eatClick = false;
  const isSearchButton = e => e.target.closest?.('button[data-name="TabButton"]');
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !inside(e, menu)) hideMenu();
    const searchButton = isSearchButton(e);
    if (!searchButton && !search.hidden && !inside(e, search)) closeSearch();
    pressed = null; eatClick = false;
    if (e.button !== 0) return;
    const island = islandAt(e);
    if (island) { drag = { island, x: e.clientX, y: e.clientY }; eatClick = true; swallow(e); return; }
    if (searchButton) { swallow(e); return; }
    // Vivaldi activates on press, so "was it already active?" has to be answered now, not on click.
    const tab = e.target.closest?.('.tab-strip .tab-wrapper.active');
    if (tab && !e.ctrlKey && !e.shiftKey && !e.target.closest('.close')) pressed = { id: tab.dataset.id, x: e.clientX, y: e.clientY };
  }, true);
  for (const type of ['mousedown', 'mouseup', 'dblclick']) {
    document.addEventListener(type, e => { if (e.button === 0 && (islandAt(e) || isSearchButton(e))) swallow(e); }, true);
  }
  document.addEventListener('click', e => {
    if (e.button !== 0) return;
    if (isSearchButton(e)) { swallow(e); openSearch().catch(log); return; }
    // Handled on pointerup; by now the island may already have moved from under the pointer.
    if (eatClick || e.target.closest?.('.accordion-toggle-arrow.expanded')) { eatClick = false; swallow(e); return; }
    // Opera: clicking the tab that is already active scrolls its page to the top.
    const was = pressed; pressed = null;
    if (!was || e.detail > 1 || e.target.closest?.('.tab-wrapper')?.dataset.id !== was.id) return;
    if (Math.hypot(e.clientX - was.x, e.clientY - was.y) > 4) return;
    chrome.tabs.query({ active: true, windowId: WIN })
      .then(([t]) => t && chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); } }))
      .catch(() => {}); // internal pages can't be scripted
  }, true);

  // ---- Tab Traces ---------------------------------------------------------
  const traceCss = h('style'); traceCss.id = 'ovt-traces';
  // Tabs without a separator on their left: the first, and those right after the active tab or an island.
  // Worked out here, because as CSS selectors this restyled every tab on each hover.
  function markSeparators() {
    let prev = null;
    for (const el of $('#browser #tabs-container .tab-strip')?.children || []) {
      const off = !prev || prev.classList.contains('accordion-toggle-arrow') || !!prev.querySelector('.tab.active');
      if (el.hasAttribute('data-ovt-nosep') !== off) el.toggleAttribute('data-ovt-nosep', off);
      prev = el;
    }
  }
  const traces = debounce(async () => {
    markSeparators();
    const tabs = await chrome.tabs.query({ windowId: WIN });
    const active = tabs.find(t => t.active);
    if (!active) return;
    const mine = tabs.filter(t => wsOf(t) === wsOf(active) && !isPanel(t));
    const recent = mine.length < CFG.traceMinTabs ? [] : mine.filter(t => !t.active)
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)).slice(0, CFG.traceLevels.length);
    const css = recent.map((t, i) => `.tab-wrapper[data-id="tab-${t.id}"]{--ovt-trace:${CFG.traceLevels[i]}}`).join('\n');
    if (traceCss.textContent !== css) traceCss.textContent = css; // each change restyles the tab strip
  }, 60);

  const isNewTabPage = t => /^chrome:\/\/(newtab|vivaldi-webui\/startpage)/.test(t.pendingUrl || t.url || '');

  // ---- Tab search (Ctrl+Space): open tabs in every workspace + recently closed ----
  const search = h('div', 'ovt-pop ovt-search'); search.hidden = true;
  const input = h('input'); input.placeholder = 'Search tabs'; input.spellcheck = false;
  const results = h('div', 'ovt-results');
  search.append(input, results);
  let data = { open: [], closed: [] }, items = [], sel = 0, wsNames = {};

  function tabRow(t, { meta = '', onPick, onClose }) {
    const r = h('div', 'ovt-row'); r.tabIndex = -1;
    const img = h('img'); img.src = favicon(t); img.onerror = () => { img.style.visibility = 'hidden'; };
    r.append(img, h('span', 'ovt-title', isNewTabPage(t) ? 'Start Page' : t.title || t.url), h('span', 'ovt-meta', meta));
    if (onClose) {
      const x = h('button', 'ovt-x', '✕'); x.title = 'Close tab'; x.tabIndex = -1;
      x.onclick = e => { e.stopPropagation(); onClose(r).catch(log); };
      r.append(x);
    }
    r.onclick = onPick;
    return r;
  }

  async function openSearch() {
    if (!search.hidden) return closeSearch();
    const [tabs, closed, wsl] = await Promise.all([
      chrome.tabs.query({}),
      chrome.sessions.getRecentlyClosed({ maxResults: 25 }).catch(() => []),
      pref('vivaldi.workspaces.list'),
    ]);
    wsNames = Object.fromEntries((wsl || []).map(w => [w.id, `${w.emoji ? w.emoji + ' ' : ''}${w.name}`]));
    data = {
      open: tabs.filter(t => !(t.active && t.windowId === WIN) && t.url && !isPanel(t)).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)),
      closed: closed.map(c => c.tab).filter(Boolean),
    };
    input.value = '';
    render();
    search.hidden = false;
    openedAt = Date.now();
    // Vivaldi hands focus back to the page after a shortcut; grab it once that settles.
    for (const ms of [0, 60, 200]) setTimeout(() => { if (!search.hidden) input.focus(); }, ms);
  }
  let openedAt = 0;
  const closeSearch = () => { search.hidden = true; };

  function render() {
    const q = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = t => { const s = `${t.title} ${t.url}`.toLowerCase(); return q.every(w => s.includes(w)); };
    const rank = t => !q.length ? 0 : t.title?.toLowerCase().startsWith(q[0]) ? 2 : t.title?.toLowerCase().includes(q[0]) ? 1 : 0;
    const open = data.open.filter(hit).sort((a, b) => rank(b) - rank(a)).slice(0, 80); // stable: ties keep recency
    const closed = data.closed.filter(hit).slice(0, 10);
    items = [...open.map(t => ({ t })), ...closed.map(t => ({ t, closed: true }))];
    const rows = items.map((it, i) => {
      const t = it.t;
      const meta = it.closed ? '' : t.windowId !== WIN ? 'Other window' : wsNames[wsOf(t)] || '';
      const r = tabRow(t, {
        meta, onPick: () => choose(i).catch(log),
        onClose: it.closed ? null : async row => {
          await chrome.tabs.remove(t.id);
          data.open = data.open.filter(o => o !== t);
          row.remove(); items[i] = null;
        },
      });
      r.onmousemove = () => { const k = $$('.ovt-row', results).indexOf(r); if (sel !== k) { sel = k; paint(false); } };
      return r;
    });
    results.replaceChildren(
      ...(open.length ? [h('div', 'ovt-head', 'Open tabs')] : []), ...rows.slice(0, open.length),
      ...(closed.length ? [h('div', 'ovt-head', 'Recently closed')] : []), ...rows.slice(open.length),
      ...(items.length ? [] : [h('div', 'ovt-empty', 'No matching tabs')]));
    sel = 0; paint(true);
  }
  function paint(scroll) {
    $$('.ovt-row', results).forEach((r, i) => r.classList.toggle('sel', i === sel));
    if (scroll) $$('.ovt-row', results)[sel]?.scrollIntoView({ block: 'nearest' });
  }
  async function choose(i) {
    const it = items[i];
    if (!it) return;
    closeSearch();
    if (it.closed) return chrome.sessions.restore(it.t.sessionId);
    if (it.t.windowId === WIN) return goTo(it.t.id);
    await chrome.windows.update(it.t.windowId, { focused: true });
    chrome.runtime.sendMessage({ overture: 'goto', windowId: it.t.windowId, tabId: it.t.id }).catch(() => {});
  }
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => {
    const n = $$('.ovt-row', results).length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (n) { sel = (sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; paint(true); } }
    else if (e.key === 'Enter') { e.preventDefault(); const r = $$('.ovt-row', results)[sel]; r?.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  });
  search.addEventListener('focusout', e => { if (Date.now() - openedAt > 400 && !search.contains(e.relatedTarget)) closeSearch(); });

  // Activate a tab in this window, switching workspace first when needed.
  async function goTo(tabId) {
    const [t, [cur]] = await Promise.all([chrome.tabs.get(tabId), chrome.tabs.query({ active: true, windowId: WIN })]);
    if (cur && wsOf(t) !== wsOf(cur)) await switchWorkspace(wsOf(t));
    await chrome.tabs.update(tabId, { active: true });
  }
  chrome.runtime.onMessage.addListener(m => { if (m?.overture === 'goto' && m.windowId === WIN) goTo(m.tabId).catch(log); });

  // ---- Workspaces in the sidebar -----------------------------------------
  // Vivaldi has no public "switch workspace" call, so drive its own workspace popup invisibly.
  async function switchWorkspace(id, visible = false) {
    const btn = $('button[data-name="WorkspaceButton"]');
    if (!btn) return;
    if (!visible) {
      const [cur] = await chrome.tabs.query({ active: true, windowId: WIN });
      if (cur && wsOf(cur) === (id ?? null)) return;
      document.body.classList.add('ovt-ghost');
    }
    try {
      if (btn.getAttribute('aria-expanded') !== 'true') press(btn);
      let pop;
      for (let i = 0; i < 40 && !(pop = $('.WorkspacePopup')); i++) await sleep(25);
      if (!pop || visible) return;
      const list = await pref('vivaldi.workspaces.list') || [];
      const ix = list.findIndex(w => w.id === id), name = list[ix]?.name;
      const nameOf = b => $('.title p', b)?.textContent;
      const buttons = $$('button.workspace-item-wrapper', pop);
      // same order as the list; the name check covers a list that is mid-reorder
      const target = id == null ? $('button.this-window', pop)
        : buttons[ix] && nameOf(buttons[ix]) === name ? buttons[ix] : buttons.find(b => nameOf(b) === name);
      press(target || btn);
      for (let i = 0; i < 40; i++) {
        const [cur] = await chrome.tabs.query({ active: true, windowId: WIN });
        if (!target || (cur && wsOf(cur) === (id ?? null) && !$('.WorkspacePopup'))) break;
        await sleep(25);
      }
    } finally {
      if (!visible) document.body.classList.remove('ovt-ghost');
    }
  }

  // A workspace's own icon: emoji, or Vivaldi's SVG shown through a mask (never parsed as HTML).
  function wsIcon(w, ix) {
    const custom = w.emoji || w.icon || '';
    if (custom && !custom.trim().startsWith('<svg')) return h('span', 'ovt-emoji', custom);
    let url = w.id == null ? ICONS.loose : ICONS.workspace[Math.max(0, ix) % ICONS.workspace.length];
    if (custom) url = ICONS.uri(custom.includes('xmlns=') ? custom : custom.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
    const icon = h('span', 'ovt-icon');
    icon.style.maskImage = `url("${url}")`;
    return icon;
  }

  const wsBar = h('div', 'ovt-ws');
  const [wsHost, wsRoot] = shadowHost('ovt-ws-host');
  wsRoot.append(wsBar);
  let wsDrawn = '';
  const renderWorkspaces = debounce(async () => {
    const [list, tabs] = await Promise.all([pref('vivaldi.workspaces.list'), chrome.tabs.query({ windowId: WIN })]);
    const active = wsOf(tabs.find(t => t.active) || {});
    const loose = tabs.some(t => wsOf(t) == null && !isPanel(t));
    const entries = list?.length ? [...(loose ? [{ id: null, name: 'Tabs without a workspace' }] : []), ...list] : [];
    const key = JSON.stringify([active, entries]);
    if (key === wsDrawn) return; // rebuilding on every tab switch would break hover and drag
    wsDrawn = key;
    const buttons = entries.map(w => {
      const b = h('button', `ovt-ws-btn${w.id === active ? ' active' : ''}`);
      b.title = w.name + '\nRight-click to create or edit workspaces';
      b.dataset.ws = w.id ?? 'window';
      b.append(wsIcon(w, (list || []).indexOf(w)));
      b.onclick = () => switchWorkspace(w.id).catch(log);
      b.oncontextmenu = e => { swallow(e); switchWorkspace(null, true).catch(log); };
      return b;
    });
    const add = h('button', 'ovt-ws-btn add');
    add.title = 'Create or edit workspaces';
    const dots = h('span', 'ovt-icon'); dots.style.maskImage = `url("${ICONS.more}")`;
    add.append(dots);
    add.onclick = () => switchWorkspace(null, true).catch(log);
    wsBar.replaceChildren(...buttons, ...(list?.length ? [] : [add])); // Opera has no extra button; right-click edits
  }, 120);

  // Opera's icons on the panel buttons, which are Vivaldi's own elements: CSS only, matched by panel id.
  const iconCss = h('style');
  async function dressPanels() {
    const o = CFG.operaIcons ? ICONS.opera : {}, rules = [];
    const els = await pref('vivaldi.panels.web.elements') || [];
    for (const [title, url] of PANELS) {
      const el = els.find(e => e.url === url);
      if (el && o[title]) rules.push(`#switch button[data-name="${CSS.escape(el.id)}"] img { content: url("${o[title]}") !important; background: none !important; }`);
    }
    for (const [button, name, size] of [['PanelBookmarks', 'bookmarks', 24], ['PanelHistory', 'history', 24], ['PanelWeb', 'more', 20]]) { // Opera's canvases differ
      if (!o[name]) continue;
      rules.push(`#switch button[data-name="${button}"] .button-icon svg { visibility: hidden; }`,
        `#switch button[data-name="${button}"] .button-icon { background: var(--colorFg); mask: url("${o[name]}") center / ${size}px no-repeat; }`);
    }
    const css = rules.join('\n');
    if (iconCss.textContent !== css) iconCss.textContent = css;
  }

  // Ctrl+Shift+M / Ctrl+O. Found by address: a loaded panel's title is the page's, e.g. "(3) Messenger".
  async function togglePanel(name) {
    const url = PANELS.find(([title]) => title === name)[1];
    const el = (await pref('vivaldi.panels.web.elements') || []).find(e => e.url === url);
    const b = el && $(`#switch button[data-name="${el.id}"]`);
    if (b) press(b);
  }

  // ---- Auto picture-in-picture -------------------------------------------
  // Chromium enters PiP on tab switch for pages that register the mediaSession "enterpictureinpicture" action.
  function armPip() {
    if (window.__ovtPip || !navigator.mediaSession) return;
    window.__ovtPip = true;
    try {
      navigator.mediaSession.setActionHandler('enterpictureinpicture', async () => {
        const v = [...document.querySelectorAll('video')].filter(v => !v.paused && v.readyState > 2 && !v.disablePictureInPicture)
          .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
        if (v && document.pictureInPictureElement !== v) await v.requestPictureInPicture().catch(() => {});
      });
    } catch { /* action unsupported */ }
  }
  const armTab = id => chrome.scripting.executeScript({ target: { tabId: id, allFrames: true }, func: armPip }).catch(() => {});

  // ---- Misc ---------------------------------------------------------------
  const [popHost, popRoot] = shadowHost('ovt-host');
  popRoot.append(search, islandList, menu, dragLabel, dropLine);
  function toast(msg, action) { // with an action it stays until clicked
    const t = h('div', 'ovt-toast', msg);
    t.onclick = () => { t.remove(); action?.(); };
    popRoot.append(t);
    if (!action) setTimeout(() => t.remove(), 15000);
  }

  // ---- Boot ---------------------------------------------------------------
  async function init() {
    for (let i = 0; !$('#browser .tab-strip'); i++) { if (i > 150) return; await sleep(200); } // not a tabbed window
    WIN = (await chrome.windows.getCurrent()).id;
    document.head.append(traceCss, iconCss);

    let hookedEl = null;
    const attach = () => {
      const browser = $('#browser');
      if (!browser) return;
      if (popHost.parentNode !== browser) browser.append(popHost);
      const bar = $('#switch .toolbar-panel');
      if (bar && wsHost.parentNode !== bar) bar.prepend(wsHost);
      const el = $('#browser #tabs-container .tab-strip');
      if (el && el !== hookedEl) {
        hookedEl = el;
        strip = installLayout(el);
        if (!strip) log('tab strip internals changed: using Vivaldi\'s own layout');
      }
      // Without the layout, none of the island CSS applies and Vivaldi's accordions stay usable.
      const on = !!strip?.enabled();
      if (browser.hasAttribute('data-ovt-layout') !== on) browser.toggleAttribute('data-ovt-layout', on);
    };
    let queued = false; // Vivaldi changes the DOM many times per frame
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; attach(); markSeparators(); });
    }).observe(document.body, { childList: true, subtree: true });
    attach();

    vivaldi.tabsPrivate.onKeyboardShortcut.addListener((winId, combo) => {
      if (winId !== WIN) return;
      if (combo === CFG.searchKey) openSearch().catch(log);
      else if (combo === CFG.islandTabKey) serial(newTabInIsland);
      else if (combo === 'Ctrl+J') { const b = $('button[data-name="DownloadButton"]'); if (b) press(b); }
      else if (combo === 'Ctrl+Shift+M') togglePanel('Messenger').catch(log);
      else if (combo === 'Ctrl+O') togglePanel('ChatGPT').catch(log);
    });
    if (CFG.autoIslands) chrome.webNavigation.onCreatedNavigationTarget.addListener(d => serial(() => onLinkOpened(d)));

    const changed = () => { traces(); renderWorkspaces(); };
    chrome.tabs.onActivated.addListener(info => { if (info.windowId === WIN) changed(); });
    chrome.tabs.onCreated.addListener(t => { if (t.windowId === WIN) { changed(); colorIslands(); } });
    chrome.tabs.onRemoved.addListener((id, info) => { if (info.windowId === WIN) { changed(); colorIslands(); } });
    chrome.tabs.onUpdated.addListener((id, ch, t) => { if (t.windowId === WIN && CFG.autoPip && ch.audible) armTab(id); });
    // Vivaldi 8.3 fires no tabGroups/groupId events for stacks; stack membership shows up as ext-data changes.
    vivaldi.tabsPrivate.onExtDataChanged.addListener((id, data) => {
      if (data && ('group' in data || 'groupColor' in data)) { colorIslands(); traces(); }
      if (data && 'workspaceId' in data) changed();
    });
    vivaldi.prefs.onChanged.addListener(p => {
      if (p?.path === 'vivaldi.workspaces.list') renderWorkspaces();
      if (p?.path === 'vivaldi.panels.web.elements') dressPanels().catch(log);
      if (p?.path === 'vivaldi.tabs.stacking.mode' || p?.path === 'vivaldi.tabs.bar.position') setTimeout(attach, 300);
    });

    changed(); colorIslands(); dressPanels().catch(log); // first: applyDefaults can wait a long time for the wizard
    await afterRestart();
    if (await applyDefaults()) return; // restarting: the rest belongs to the next start
    await enforceIslandPrefs();
    await settleIn();
    if (CFG.autoPip) for (const t of await chrome.tabs.query({ windowId: WIN, audible: true })) armTab(t.id);
  }
  window.overture = { CFG, openSearch, switchWorkspace, moveIsland, undoDefaults, newTabInIsland, get strip() { return strip; } };
  init().catch(log);
})();
