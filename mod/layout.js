// Overture: Opera One tab-strip geometry.
//
// Vivaldi lays the strip out in one function on its tab-strip component (createFlexBoxLayout) and uses the
// result for drawing, animation, drag and drop and close-button "freeze". Overture replaces that result, so
// all of those follow Opera's geometry. Nothing is moved with CSS afterwards.
//
// An island is drawn by Vivaldi's own "accordion toggle" element, stretched behind the island's tabs:
//   open   [ handle | tab | tab | tab ]
//   peek   [ handle | active tab ||]     collapsed, holds the active tab
//   pill   [ handle ]                    collapsed, does not
(() => {
  'use strict';

  // Measured in Opera One 140 at 100 % scale.
  const G = {
    MAX: 168,        // widest tab
    ACTIVE_MIN: 78,  // the active tab never gets narrower than this while there is room
    PINNED: 32,
    PRE: 14,         // island edge -> first tab: 6 padding, 6 handle, 2 gap
    POST: 6,         // last tab -> island edge
    PEEK_POST: 18,   // the same with two stack bars in it
    PILL: 18,
    GAP: 3,          // outside an island, each side
    TAB_TOP: 3,
    TAB_H: 28,
    ISLAND_H: 36,
  };

  const groupOf = page => page?.vivExtData?.group;

  // `kids` are Vivaldi's layout nodes in strip order; their .layout is overwritten.
  // Pure apart from that, so test/layout.test.js can feed it plain objects.
  function layout(kids, avail, freeze) {
    const cells = [], islands = [];
    let open = null, last = null;
    const fixed = (w, extra) => cells.push({ w, ...extra });
    const begin = (kind, node) => {
      fixed(G.GAP);
      last = { kind, group: groupOf(node.page), active: false };
      islands.push(last);
      fixed(0, { start: last });
      return last;
    };
    const end = island => { fixed(0, { end: island }); fixed(G.GAP); };
    const closeOpen = () => { if (open) { fixed(G.POST); end(open); open = null; } };

    for (const node of kids) {
      if (node.type === 'accordionToggle') {
        node.layout = { left: 0, top: 0, width: 0, height: 0 };
        if (last && groupOf(node.page) === last.group) last.toggle = node;
        if (open && groupOf(node.page) === open.group) closeOpen();
        continue;
      }
      if (node.type === 'separator') { fixed(8, { node }); continue; }
      if (node.type !== 'tab') { cells.push({ node, flex: true }); continue; } // drop placeholder

      const { page } = node, group = groupOf(page);
      const inOpen = !node.isStack && node.pageCount > 0 && !!group;
      if (open && !(inOpen && group === open.group)) closeOpen();
      if (node.style?.width === 0) { fixed(0, { node }); continue; } // hidden while dragged

      if (node.isStack) {
        if (!page.active) {
          const island = begin('pill', node);
          fixed(G.PILL, { node, pill: true });
          end(island);
          continue;
        }
        begin('peek', node).active = true;
        fixed(G.PRE);
      } else if (inOpen && !open) {
        open = begin('open', node);
        fixed(G.PRE);
      }
      if (open && page.active) open.active = true;
      cells.push(page.pinned ? { node, w: G.PINNED } : { node, flex: true, active: !!page.active });
      if (node.isStack) { fixed(G.PEEK_POST); end(last); }
    }
    closeOpen();

    const flex = cells.filter(c => c.flex);
    const fixedSum = cells.reduce((sum, c) => sum + (c.flex ? 0 : c.w), 0);
    const squeeze = fixedSum > avail ? avail / fixedSum : 1; // more islands than pixels
    const room = Math.max(0, avail - fixedSum);
    const active = flex.find(c => c.active);
    let each = flex.length ? Math.min(G.MAX, room / flex.length) : 0;
    let activeW = each;
    if (active && each < G.ACTIVE_MIN) {
      activeW = Math.min(G.ACTIVE_MIN, room);
      each = flex.length > 1 ? (room - activeW) / (flex.length - 1) : 0;
    }
    // While closing tabs with the mouse, widths stay put so the next close button is under the cursor.
    // A pill's width is never a sensible width to freeze at.
    if (freeze?.width > G.PILL && freeze.width < each) {
      each = freeze.width;
      if (active) activeW = Math.max(each, Math.min(G.ACTIVE_MIN, room));
    }

    let x = 0;
    for (const c of cells) {
      const left = Math.round(x);
      x += c.flex ? (c.active ? activeW : each) : c.w * squeeze;
      const width = Math.round(x) - left;
      if (c.start) c.start.left = left;
      if (c.end) c.end.right = left;
      if (c.node) {
        const top = c.pill ? 0 : G.TAB_TOP, height = c.pill ? G.ISLAND_H : G.TAB_H;
        c.node.layout = { left, top, width, height, right: left + width, bottom: top + height };
      }
    }
    for (const i of islands) {
      // Vivaldi draws toggles one pixel further left and one pixel wider than their layout.
      if (i.toggle) i.toggle.layout = { left: i.left + 1, top: 0, width: i.right - i.left - 1, height: G.ISLAND_H };
    }
    return { islands, width: Math.round(x) };
  }

  // How much room the strip wants; Vivaldi puts the "+" button straight after it.
  function naturalWidth(tabs, openGroups, freeze) {
    const tab = freeze > G.PILL ? freeze : G.MAX;
    const activeTab = Math.max(tab, G.ACTIVE_MIN);
    let total = 0;
    tabs.forEach(({ page, pages, type }) => {
      const w = page.pinned ? G.PINNED : page.active ? activeTab : tab;
      if (type !== 'group') { total += w; return; }
      total += 2 * G.GAP;
      if (openGroups.has(groupOf(page))) {
        total += G.PRE + G.POST;
        pages.forEach(p => { total += p.pinned ? G.PINNED : p.active ? activeTab : tab; });
      } else total += page.active ? G.PRE + w + G.PEEK_POST : G.PILL;
    });
    return Math.ceil(total);
  }

  const fiberOf = el => el[Object.keys(el).find(k => k.startsWith('__reactFiber'))];
  const findUp = (fiber, method) => {
    for (let f = fiber; f; f = f.return) if (typeof f.stateNode?.[method] === 'function') return f;
    return null;
  };

  // Returns a handle on the hooked strip, or null when Vivaldi's internals no longer match
  // (the caller then leaves Vivaldi's own accordion layout and look alone).
  function install(stripEl) {
    const fiber = fiberOf(stripEl);
    const stripFiber = fiber && findUp(fiber, 'createFlexBoxLayout');
    const barFiber = stripFiber && findUp(stripFiber, 'getTabListWidth');
    if (!barFiber || typeof stripFiber.stateNode.handleAccordionToggle !== 'function') return null;
    const strip = stripFiber.stateNode, bar = barFiber.stateNode;
    const enabled = props =>
      ['top', 'bottom'].includes(props.tabPosition) &&
      props.prefValues['vivaldi.tabs.stacking.mode'] === 'accordion' &&
      !props.prefValues['vivaldi.tabs.horizontal_scrolling'];

    let islands = [], items = [];
    const baseLayout = strip.createFlexBoxLayout;
    strip.createFlexBoxLayout = function (tabs, width, height, opts) {
      const tree = baseLayout.apply(this, arguments);
      if (!enabled(strip.props) || !(width > 0)) { islands = []; items = []; return tree; }
      const kids = tree.children.at(-1).children;
      islands = layout(kids, width, opts.freeze).islands;
      // Top-level drop positions, for dragging a whole island by its handle.
      items = [
        ...islands.map(i => ({ key: i.group, left: i.left, right: i.right })),
        ...kids.filter(k => k.type === 'tab' && !k.isStack && !(k.pageCount > 0))
          .map(k => ({ key: k.page.vivExtData.ext_id, left: k.layout.left, right: k.layout.right })),
      ].sort((a, b) => a.left - b.left);
      return tree;
    };

    const baseWidth = bar.getTabListWidth;
    bar.getTabListWidth = function (substrip) {
      if (substrip || !enabled(bar.props)) return baseWidth.apply(this, arguments);
      const { tabs, openAccordions, freezeTabWidth, tabBarContainerWidth } = bar.state;
      const want = naturalWidth(tabs, new Set(openAccordions.map(a => a.groupId)), freezeTabWidth);
      return Math.min(Math.max(want, G.PINNED), tabBarContainerWidth);
    };

    bar.forceUpdate();
    strip.forceUpdate();
    return {
      enabled: () => enabled(strip.props),
      islands: () => islands,
      items: () => items,
      toggle: island => strip.handleAccordionToggle(island.group, island.kind === 'open'),
    };
  }

  const api = { G, layout, naturalWidth, install };
  if (typeof module === 'object') module.exports = api;
  else window.overtureLayout = api;
})();
