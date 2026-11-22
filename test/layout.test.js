// node test/layout.test.js
const assert = require('node:assert/strict');
const { G, layout, naturalWidth } = require('../mod/layout.js');

const page = (group, active = false, pinned = false) => ({ active, pinned, vivExtData: { group } });
const plain = (active, pinned) => ({ type: 'tab', page: page(undefined, active, pinned), pageCount: 0 });
const toggle = g => ({ type: 'accordionToggle', page: page(g) });
const stack = (g, active) => [{ type: 'tab', isStack: true, pageCount: 0, page: page(g, active) }, toggle(g)];
const open = (g, n, activeIx = -1) => [
  ...Array.from({ length: n }, (_, i) => ({ type: 'tab', pageCount: n, page: page(g, i === activeIx) })),
  toggle(g),
];
const tabsOf = kids => kids.filter(k => k.type === 'tab');

{ // collapsed island without the active tab: a bare pill, and the freed room goes to the other tabs
  const kids = [plain(true), ...stack('a', false), plain(false)];
  const { islands } = layout(kids, 2000);
  const [first, pill, after] = tabsOf(kids);
  assert.equal(islands[0].kind, 'pill');
  assert.equal(pill.layout.width, G.PILL);
  assert.equal(first.layout.width, G.MAX);
  assert.equal(after.layout.left, G.MAX + 2 * G.GAP + G.PILL);
}
{ // collapsed island with the active tab: handle + that tab + stack bars, inside one container
  const kids = stack('a', true);
  const { islands } = layout(kids, 2000);
  assert.equal(islands[0].kind, 'peek');
  assert.equal(kids[0].layout.left, islands[0].left + G.PRE);
  assert.equal(islands[0].right, kids[0].layout.right + G.PEEK_POST);
  assert.equal(kids[1].layout.width, islands[0].right - islands[0].left - 1);
}
{ // open island: one container behind all its tabs; neighbours and adjacent islands never overlap
  const kids = [...open('a', 3, 1), ...open('b', 2), plain(false)];
  const { islands } = layout(kids, 2000);
  assert.deepEqual(islands.map(i => i.kind), ['open', 'open']);
  assert.equal(kids[0].layout.left - islands[0].left, G.PRE);
  assert.equal(islands[0].right - kids[2].layout.right, G.POST);
  assert.equal(islands[1].left - islands[0].right, 2 * G.GAP);
  assert.equal(kids.at(-1).layout.left, islands[1].right + G.GAP);
}
{ // crowded: fills the strip exactly, the active tab keeps its minimum
  const kids = [plain(true), ...Array.from({ length: 99 }, () => plain(false))];
  assert.equal(layout(kids, 1600).width, 1600);
  assert.equal(kids[0].layout.width, G.ACTIVE_MIN);
}
{ // more islands than pixels: squeeze, never overflow or go negative
  const kids = Array.from({ length: 120 }, (_, i) => stack(`g${i}`, false)).flat();
  assert.equal(layout(kids, 900).width, 900);
  assert.ok(kids.every(k => k.layout.width >= -1));
}
{ // closing with the mouse keeps widths, but never freezes at a pill's width
  const kids = [plain(false), plain(false)];
  layout(kids, 2000, { width: 90 });
  assert.equal(kids[0].layout.width, 90);
  layout(kids, 2000, { width: G.PILL });
  assert.equal(kids[0].layout.width, G.MAX);
}
{ // pinned tabs are fixed, a tab hidden while dragged takes no room
  const hidden = { ...plain(false), style: { width: 0 } };
  const kids = [plain(false, true), hidden, plain(true)];
  layout(kids, 2000);
  assert.equal(kids[0].layout.width, G.PINNED);
  assert.equal(kids[2].layout.left, G.PINNED);
}
{ // the strip asks for exactly the room the layout uses
  const kids = [...open('a', 2), ...stack('b', false), ...stack('c', true), plain(false)];
  const tabs = [
    { type: 'group', page: page('a'), pages: [page('a'), page('a')] },
    { type: 'group', page: page('b'), pages: [page('b')] },
    { type: 'group', page: page('c', true), pages: [page('c', true)] },
    { type: 'page', page: page() },
  ];
  assert.equal(naturalWidth(tabs, new Set(['a'])), layout(kids, 5000).width);
}
console.log('layout: all checks pass');
