/**
 * DevComms AI — Embeddable Changelog Widget
 *
 * Usage:
 *   <script src="https://devcomms.ai/widget.js"
 *           data-team="acme"
 *           data-max="5"
 *           data-theme="light"></script>
 *   <div id="devcomms-changelog"></div>
 *
 * Options (all optional, set as data attributes on the script tag):
 *   data-team   — team slug (default: reads from current host)
 *   data-max    — max entries to show (default: 5, max: 50)
 *   data-theme  — "light" | "dark" (default: "light")
 *   data-api    — API base URL (default: script origin)
 *   data-target — target element ID (default: "devcomms-changelog")
 *
 * ~5 KB gzipped — no dependencies, vanilla JS, works in all modern browsers.
 */
(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────

  // document.currentScript is the most reliable way to get the script element
  // that loaded this code. Fall back to last script tag for very old browsers.
  var currentScript =
    document.currentScript ||
    (function () {
      var all = document.getElementsByTagName('script');
      return all[all.length - 1];
    })();

  var TEAM = currentScript.getAttribute('data-team') || '';
  var MAX = Math.min(Math.max(1, parseInt(currentScript.getAttribute('data-max'), 10) || 5), 50);
  var THEME = (currentScript.getAttribute('data-theme') || 'light') === 'dark' ? 'dark' : 'light';
  var API_BASE = currentScript.getAttribute('data-api') || '';
  var TARGET_ID = currentScript.getAttribute('data-target') || 'devcomms-changelog';

  if (!API_BASE) {
    // Default to the script's origin
    var src = currentScript.src;
    if (src) {
      var a = document.createElement('a');
      a.href = src;
      API_BASE = a.protocol + '//' + a.host;
    }
  }

  // ── Category icons ─────────────────────────────────────────

  var ICONS = {
    added: '✨', // ✨
    changed: '🔧', // 🔧
    fixed: '🐛', // 🐛
    removed: '🗑️', // 🗑️
    deprecated: '⚠️', // ⚠️
    security: '🔒', // 🔒
  };

  function iconFor(category) {
    return ICONS[category] || '📄'; // 📄
  }

  // ── DOM helpers ────────────────────────────────────────────

  function el(tag, className, parent) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (parent) parent.appendChild(e);
    return e;
  }

  function text(tag, className, content, parent) {
    var e = el(tag, className, parent);
    e.textContent = content;
    return e;
  }

  // ── Date formatting ────────────────────────────────────────

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  // ── Render ─────────────────────────────────────────────────

  function render(container, data) {
    container.innerHTML = '';

    if (!data || !data.entries || data.entries.length === 0) {
      var empty = el('div', 'dcc-empty', container);
      empty.textContent = 'No changelog entries yet.';
      return;
    }

    var list = el('ul', 'dcc-entries', container);

    data.entries.forEach(function (entry) {
      var item = el('li', 'dcc-entry', list);

      var icon = el('span', 'dcc-entry-icon', item);
      icon.textContent = iconFor(entry.category);

      var body = el('div', 'dcc-entry-body', item);

      text('h3', 'dcc-entry-title', entry.title, body);
      text('p', 'dcc-entry-summary', entry.summary, body);

      if (entry.publishedAt) {
        text('time', 'dcc-entry-date', formatDate(entry.publishedAt), body);
      }
    });
  }

  function renderError(container, message) {
    container.innerHTML = '';
    var err = el('div', 'dcc-error', container);
    err.textContent = message || 'Unable to load changelog.';
  }

  // ── Inject styles ──────────────────────────────────────────

  function injectStyles() {
    var styleId = 'dcc-styles';
    if (document.getElementById(styleId)) return;

    var css = [
      /* Light theme (default) */
      '.dcc-widget {',
      '  --dcc-bg: #ffffff;',
      '  --dcc-text: #111827;',
      '  --dcc-text-secondary: #6b7280;',
      '  --dcc-border: #e5e7eb;',
      '  --dcc-muted: #9ca3af;',
      '  --dcc-link: #2563eb;',
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;",
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '  color: var(--dcc-text);',
      '  max-width: 640px;',
      '  margin: 0 auto;',
      '}',

      '.dcc-widget.dcc-theme-dark {',
      '  --dcc-bg: #1f2937;',
      '  --dcc-text: #f9fafb;',
      '  --dcc-text-secondary: #d1d5db;',
      '  --dcc-border: #374151;',
      '  --dcc-muted: #6b7280;',
      '  --dcc-link: #60a5fa;',
      '}',

      '.dcc-entries {',
      '  list-style: none;',
      '  margin: 0;',
      '  padding: 0;',
      '}',

      '.dcc-entry {',
      '  display: flex;',
      '  gap: 12px;',
      '  padding: 12px 16px;',
      '  background: var(--dcc-bg);',
      '  border: 1px solid var(--dcc-border);',
      '  border-radius: 8px;',
      '  margin-bottom: 8px;',
      '}',

      '.dcc-entry-icon {',
      '  font-size: 18px;',
      '  flex-shrink: 0;',
      '  margin-top: 1px;',
      '}',

      '.dcc-entry-body {',
      '  flex: 1;',
      '  min-width: 0;',
      '}',

      '.dcc-entry-title {',
      '  margin: 0 0 4px 0;',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  color: var(--dcc-text);',
      '}',

      '.dcc-entry-summary {',
      '  margin: 0;',
      '  font-size: 13px;',
      '  color: var(--dcc-text-secondary);',
      '}',

      '.dcc-entry-date {',
      '  display: block;',
      '  margin-top: 6px;',
      '  font-size: 12px;',
      '  color: var(--dcc-muted);',
      '}',

      '.dcc-empty, .dcc-error {',
      '  text-align: center;',
      '  padding: 24px 16px;',
      '  color: var(--dcc-text-secondary);',
      '  font-size: 13px;',
      '}',

      '.dcc-error {',
      '  color: #ef4444;',
      '}',

      '.dcc-loading {',
      '  text-align: center;',
      '  padding: 24px 16px;',
      '  color: var(--dcc-muted);',
      '  font-size: 13px;',
      '}',

      '.dcc-powered {',
      '  text-align: center;',
      '  margin-top: 16px;',
      '  font-size: 11px;',
      '  color: var(--dcc-muted);',
      '}',

      '.dcc-powered a {',
      '  color: var(--dcc-link);',
      '  text-decoration: none;',
      '}',

      '.dcc-powered a:hover {',
      '  text-decoration: underline;',
      '}',
    ].join('\n');

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Main ───────────────────────────────────────────────────

  function init() {
    var container = document.getElementById(TARGET_ID);
    if (!container) return;

    injectStyles();

    // Theme class on container
    container.classList.add('dcc-widget');
    if (THEME === 'dark') {
      container.classList.add('dcc-theme-dark');
    }

    // Loading state
    container.innerHTML = '<div class="dcc-loading">Loading changelog…</div>';

    if (!TEAM) {
      renderError(container, 'No team slug configured. Add data-team to the script tag.');
      return;
    }

    var apiUrl = API_BASE + '/api/public/' + encodeURIComponent(TEAM) + '?max=' + MAX;

    // Use XMLHttpRequest for broader compatibility (no fetch in very old browsers)
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);
    xhr.timeout = 8000;

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var json = JSON.parse(xhr.responseText);
          if (json.ok && json.data) {
            render(container, json.data);
            // Add powered-by footer
            var powered = el('div', 'dcc-powered', container);
            powered.innerHTML =
              'Powered by <a href="' +
              API_BASE +
              '" target="_blank" rel="noopener">DevComms AI</a>';
          } else {
            renderError(container, json.error || 'Failed to load changelog entries.');
          }
        } catch (e) {
          renderError(container, 'Invalid response from server.');
        }
      } else {
        renderError(container);
      }
    };

    xhr.onerror = function () {
      renderError(container);
    };

    xhr.ontimeout = function () {
      renderError(container, 'Request timed out. Please try again.');
    };

    xhr.send();
  }

  // ── Start ──────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
