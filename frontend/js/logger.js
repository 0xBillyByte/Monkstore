// logger.js – Frontend system log panel
// Creates a collapsible log panel in the bottom-left corner.
// Exposes window.AppLogger so non-module scripts (e.g. nft-modal.js) can use it.

'use strict';

const MAX_ENTRIES = 150;

const LEVEL_CONFIG = {
  info:    { label: 'INFO',    color: '#4991ff' },
  success: { label: 'OK',      color: '#4caf50' },
  warn:    { label: 'WARN',    color: '#ffc247' },
  error:   { label: 'ERROR',   color: '#ff4d4f' },
};

class Logger {
  constructor() {
    this._entries = [];
    this._panel   = null;
    this._list    = null;
    this._open    = true;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this._createPanel());
    } else {
      this._createPanel();
    }
  }

  // ------------------------------------------------------------------ DOM
  _createPanel() {
    const panel = document.createElement('div');
    panel.id = 'appLogPanel';
    panel.className = 'log-panel log-panel--open';
    panel.setAttribute('aria-label', 'System log panel');
    panel.innerHTML = `
      <div class="log-panel__header">
        <span class="log-panel__title">📋 System Logs</span>
        <div class="log-panel__controls">
          <button class="log-panel__btn log-panel__clear" title="Clear all log entries">Clear</button>
          <button class="log-panel__btn log-panel__toggle" title="Collapse log panel" aria-expanded="true">▲</button>
        </div>
      </div>
      <ul class="log-panel__list" role="log" aria-live="polite" aria-label="Log entries"></ul>
    `;

    document.body.appendChild(panel);

    this._panel = panel;
    this._list  = panel.querySelector('.log-panel__list');

    panel.querySelector('.log-panel__clear').addEventListener('click', () => this.clear());
    panel.querySelector('.log-panel__toggle').addEventListener('click', () => this._togglePanel());

    // Replay any entries that arrived before the DOM was ready
    this._entries.forEach(e => this._renderEntry(e));

    this.info('Log panel initialised.', 'Logger');
  }

  _togglePanel() {
    this._open = !this._open;
    const btn = this._panel.querySelector('.log-panel__toggle');
    if (this._open) {
      this._panel.classList.add('log-panel--open');
      btn.textContent = '▲';
      btn.title = 'Collapse log panel';
      btn.setAttribute('aria-expanded', 'true');
    } else {
      this._panel.classList.remove('log-panel--open');
      btn.textContent = '▼';
      btn.title = 'Expand log panel';
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  // ------------------------------------------------------------------ rendering
  _renderEntry(entry) {
    if (!this._list) return;

    const cfg = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.info;
    const li  = document.createElement('li');
    li.className = `log-entry log-entry--${entry.level}`;
    li.innerHTML =
      `<span class="log-entry__ts">${this._esc(entry.ts)}</span>` +
      `<span class="log-entry__badge" style="color:${cfg.color}">[${cfg.label}]</span>` +
      (entry.context ? `<span class="log-entry__ctx">${this._esc(entry.context)}</span>` : '') +
      `<span class="log-entry__msg">${this._esc(entry.message)}</span>`;

    this._list.appendChild(li);
    this._list.scrollTop = this._list.scrollHeight;
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ------------------------------------------------------------------ internal append
  _append(level, message, context) {
    const ts    = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = { ts, level, message: String(message), context: context ? String(context) : '' };

    this._entries.push(entry);

    // Trim oldest entries once the cap is reached
    if (this._entries.length > MAX_ENTRIES) {
      this._entries.shift();
      if (this._list && this._list.firstChild) {
        this._list.removeChild(this._list.firstChild);
      }
    }

    this._renderEntry(entry);
  }

  // ------------------------------------------------------------------ public API
  /** Log an informational message. */
  info(message, context = '') {
    this._append('info', message, context);
  }

  /** Log a success message. */
  success(message, context = '') {
    this._append('success', message, context);
  }

  /** Log a warning. */
  warn(message, context = '') {
    this._append('warn', message, context);
  }

  /** Log an error. */
  error(message, context = '') {
    this._append('error', message, context);
  }

  /** Remove all log entries. */
  clear() {
    this._entries = [];
    if (this._list) this._list.innerHTML = '';
  }
}

const logger = new Logger();

// Expose globally so non-module scripts (nft-modal.js) can call window.AppLogger.*
window.AppLogger = logger;

export default logger;
