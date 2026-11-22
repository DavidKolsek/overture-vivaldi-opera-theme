// Smoke test against a running Vivaldi with Overture installed.
//   1. start Vivaldi with:  vivaldi.exe --remote-debugging-port=9222 --remote-allow-origins=*
//   2. node test/smoke.mjs [port]
// Exits non-zero if any check fails. Opens a few example.com tabs and closes them again.
const port = process.argv[2] || 9222;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = async () => (await fetch(`http://127.0.0.1:${port}/json`)).json();

async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let n = 0;
  const run = expr => new Promise((resolve, reject) => {
    const id = ++n;
    const timer = setTimeout(() => reject(new Error('timed out')), 30000);
    ws.addEventListener('message', function on(m) {
      const d = JSON.parse(m.data);
      if (d.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener('message', on);
      const failed = d.error?.message || d.result?.exceptionDetails?.exception?.description;
      failed ? reject(new Error(failed)) : resolve(d.result?.result?.value);
    });
    // userGesture: window.open needs one
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true, userGesture: true } }));
  });
  return { run, close: () => ws.close() };
}

const uiTarget = (await targets()).find(t => t.url.endsWith('/window.html') && t.webSocketDebuggerUrl);
if (!uiTarget) throw new Error(`No Vivaldi window found on port ${port}`);
const ui = await connect(uiTarget);
const HELPERS = `
  const ext = t => { try { return JSON.parse(t.vivExtData || '{}'); } catch { return {}; } };
  const win = (await chrome.windows.getCurrent()).id, sleep = ms => new Promise(r => setTimeout(r, ms));`;
const q = expr => ui.run(HELPERS + expr);

let failed = 0;
async function check(name, fn) {
  let ok;
  try {
    const result = await fn();
    if (result === 'skip') return console.log(`SKIP  ${name}`);
    ok = result === true;
  } catch (e) { ok = false; console.log('   ', e.message); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  failed += !ok;
}

await check('mod loaded', () => q(`return !!window.overture`));
await check('Opera tab layout active', () => q(`return !!overture.strip && document.querySelector('#browser').hasAttribute('data-ovt-layout')`));
await check('island settings in place', () => q(`
  for (const [path, want] of [['stacking.mode', 'accordion'], ['stacking.open_in_current', false], ['stacking.auto_expand', false], ['new_placement', 'alwayslast']])
    if ((await vivaldi.prefs.get('vivaldi.tabs.' + path)).value !== want) return false;
  return true`));

const tag = `overture-smoke-${Date.now()}`;
let parent, group;
await check('a link opened from a page forms a coloured island', async () => {
  parent = await q(`return (await chrome.tabs.create({ windowId: win, url: 'https://example.com/?${tag}', active: true })).id`);
  let target;
  for (let i = 0; i < 25 && !target; i++) {
    await sleep(400);
    target = (await targets()).find(t => t.type === 'page' && t.url.endsWith(tag));
  }
  await sleep(1200); // let the page commit
  const page = await connect(target);
  await page.run(`window.open('https://example.com/?${tag}-child')`);
  page.close();
  await sleep(2500);
  group = await q(`return ext(await chrome.tabs.get(${parent})).group || null`);
  return q(`const m = (await chrome.tabs.query({ windowId: win })).filter(t => ext(t).group === '${group}'); return m.length === 2 && !!ext(m[0]).groupColor`);
});
await check('an unrelated new tab stays outside the island', () => q(`
  await chrome.tabs.update(${parent}, { active: true }); await sleep(400);
  const t = await chrome.tabs.create({ windowId: win, url: 'https://example.com/?${tag}-unrelated', active: true });
  await sleep(1500);
  return !ext(await chrome.tabs.get(t.id)).group`));
await check('a collapsed island without the active tab is an 18 px pill', () => q(`
  const find = () => overture.strip.islands().find(i => i.group === '${group}');
  overture.strip.toggle(find()); await sleep(800);
  const i = find();
  return i.kind === 'pill' && i.right - i.left === 18`));
await check('moving an island to a workspace keeps it whole', () => q(`
  const list = (await vivaldi.prefs.get('vivaldi.workspaces.list')).value || [];
  if (!list.length) return 'skip';
  const [active] = await chrome.tabs.query({ active: true, windowId: win });
  const to = (list.find(w => w.id !== ext(active).workspaceId) || {}).id ?? null;
  await overture.moveIsland('${group}', to); await sleep(1500);
  const m = (await chrome.tabs.query({ windowId: win })).filter(t => ext(t).group === '${group}');
  return m.length === 2 && m.every(t => (ext(t).workspaceId || null) === to)`));
await check('tab search lists tabs and is styled', () => q(`
  await overture.openSearch();
  const s = document.querySelector('.ovt-host').shadowRoot.querySelector('.ovt-search');
  const ok = s.querySelectorAll('.ovt-row').length > 0 && getComputedStyle(s).position === 'fixed';
  s.hidden = true;
  return ok`));
await check('sidebar workspace bar has 32 px buttons', () => q(`
  const b = document.querySelector('#switch .ovt-ws-host').shadowRoot.querySelector('.ovt-ws-btn').getBoundingClientRect();
  return b.width === 32 && b.height === 32`));

await q(`await chrome.tabs.remove((await chrome.tabs.query({})).filter(t => (t.pendingUrl || t.url).includes('${tag}')).map(t => t.id))`).catch(() => {});
ui.close();
process.exit(failed ? 1 : 0);
