// Overture's own line icons and service glyphs (drawn for this project, no third-party artwork).
// Service glyphs only stand in until a panel has loaded once; Vivaldi then shows the site's favicon.
(() => {
  'use strict';
  const line = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const tile = (bg, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${defs}<rect width="20" height="20" rx="5" fill="${bg}"/>${body}</svg>`;
  const uri = svg => `data:image/svg+xml,${encodeURIComponent(svg)}`;

  // For workspaces that have neither an icon nor an emoji, in sidebar order.
  const workspace = [
    line('<path d="M10 5.5C8.3 4 5.2 4 3 5v10.5c2.2-1 5.3-1 7 .5 1.7-1.5 4.800-1.500 7-.5V5c-2.200-1-5.300-1-7 .5v10"/>'),
    line('<path d="M5 2.500h6.500l4 4v11H5zM11 2.500v4.500h4.500M7.500 11h5M7.500 14h5"/>'),
    line('<path d="M3.500 9.500 10 3.500l6.500 6v7.500h-13z"/>'),
    line('<path d="m10 2.800 2.200 4.600 5 .7-3.600 3.500.9 5-4.500-2.400-4.500 2.400.9-5L2.800 8.100l5-.7z"/>'),
    line('<path d="M8 12c0-5 3-9 8.500-9.500C17 8 13 12 8 12zM8 12l-3.500-1L7 7.200l2.700.3M8 12l1 3.500 3.800-2.500-.3-2.700M4.500 13.500c-1.500 1-1.700 3-1.700 3.700.700 0 2.700-.2 3.700-1.700"/><circle cx="12.700" cy="6.500" r="1.300"/>'),
    line('<circle cx="10" cy="10" r="7.300"/><path d="M7.300 8h.1M12.700 8h.1M6.500 12c1.800 2.700 5.200 2.700 7 0"/>'),
    line('<path d="M5 2.500h10M5 17.500h10M6 2.500c0 4.500 4 4.500 4 7.500s-4 3-4 7.500M14 2.500c0 4.500-4 4.500-4 7.500s4 3 4 7.500"/>'),
    line('<path d="M3 6.500h14v10H3zM7.500 6.500v-3h5v3M3 11h14"/>'),
    line('<path d="M7.500 15.500h5M8 18h4M6.800 12.800a5.300 5.300 0 1 1 6.400 0l-.700 2.700h-5z"/>'),
    line('<path d="m7 6-4 4 4 4M13 6l4 4-4 4"/>'),
  ];
  // Opera's own icons, present only after "install.ps1 -FromOpera" read them from this PC's Opera.
  const opera = window.overtureOpera?.icons || {};
  // As a workspace icon Vivaldi stores the SVG itself and shows it in its menus, so it must follow the text colour.
  const asVivaldiIcon = name => !opera[name] ? '' : opera[name]
    .replace(/(stroke|fill)="(?!none)[^"]*"/g, '$1="currentColor"')
    .replace(/<svg([^>]*)>/, (_, attrs) => `<svg width="16" height="16" fill="currentColor"${attrs.replace(/ (width|height|fill)="[^"]*"/g, '')}>`);
  const loose = line('<path d="M3 11.500 5.500 4h9l2.500 7.500v5H3zM3 11.500h4.500c0 3 5 3 5 0H17"/>');
  const more = line('<path d="M4.500 10h.1M10 10h.1M15.500 10h.1" stroke-width="2.600"/>');

  const stroke = (d, w = 1.5) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const service = {
    ChatGPT: tile('#10a37f', stroke('M10 4 15 7v6l-5 3-5-3V7zM5 7l10 6M15 7 5 13M10 4v12', 1.2)),
    Claude: tile('#d97757', stroke('M10 4v12M4 10h12M5.800 5.800l8.400 8.400M14.200 5.800l-8.400 8.400', 1.6)),
    Gemini: tile('url(#g)', '<path d="M10 3c.700 4.500 2.500 6.300 7 7-4.500.700-6.300 2.500-7 7-.700-4.500-2.500-6.300-7-7 4.500-.700 6.300-2.500 7-7z" fill="#fff"/>',
      '<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#4285f4"/><stop offset="1" stop-color="#9b72cb"/></linearGradient></defs>'),
    Messenger: tile('#1677f2', '<path d="M10 4c8 0 8 11 0 11l-3.500 1.500.2-2.500C1.500 10.500 4.500 4 10 4z" fill="#fff"/><path d="m6.500 11 2.500-3 2 2 2.500-2-2.500 3-2-2z" fill="#1677f2"/>'),
    WhatsApp: tile('#25d366', stroke('m4 16 1-3a6 6 0 1 1 2.500 2.300z') + stroke('M8 7.500c0 3 1.500 4.500 4.500 4.500', 1.8)),
    Instagram: tile('url(#i)', stroke('M7 4h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM7.300 10a2.700 2.700 0 1 0 5.400 0 2.700 2.700 0 1 0-5.400 0M13.300 6.700h.1'),
      '<defs><linearGradient id="i" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#feda75"/><stop offset=".5" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs>'),
    Discord: tile('#5865f2', '<path d="M6 5h8c2 2 3 6 3 9-1 1-2 1.500-3.500 1.500l-1-1.500h-5l-1 1.500C5 15.500 4 15 3 14c0-3 1-7 3-9z" fill="#fff"/><circle cx="7.700" cy="10.500" r="1.300" fill="#5865f2"/><circle cx="12.300" cy="10.500" r="1.300" fill="#5865f2"/>'),
    Spotify: tile('#1ed760', '<path d="M4.500 7.500c4-1.300 8-.8 11 1M5.300 10.700c3.200-.9 6.400-.5 8.900.9M6 13.600c2.500-.6 4.800-.3 6.800.8" fill="none" stroke="#07170d" stroke-width="1.600" stroke-linecap="round"/>'),
  };

  window.overtureIcons = {
    workspace: workspace.map(uri),
    loose: uri(loose),
    more: uri(opera.more || more),
    opera: Object.fromEntries(Object.entries(opera).map(([name, svg]) => [name, uri(svg)])),
    asVivaldiIcon,
    service: Object.fromEntries(Object.entries(service).map(([name, svg]) => [name, uri(svg)])),
    uri,
  };
})();
