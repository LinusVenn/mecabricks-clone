/**
 * ExportPanel – Benutzeroberfläche für den Modell-Export (Phase H.7)
 *
 * Vanilla-DOM-Komponente (kein React/Vue). Inline-CSS.
 *
 * Custom Events auf container:
 *   'export-request'  → { format: string, options: object }
 *   'export-complete' → { format: string, filename: string }
 *   'export-error'    → { format: string, error: string }
 */

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const STYLES = {
  // ── Panel shell ──────────────────────────────────────────────────────────
  panel: `
    width: 280px;
    background: #1e1e2e;
    color: #cdd6f4;
    border-radius: 8px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.45);
    user-select: none;
  `,

  // ── Header ────────────────────────────────────────────────────────────────
  header: `
    background: #181825;
    padding: 10px 14px;
    font-weight: bold;
    font-size: 13px;
    color: #89b4fa;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #313244;
    display: flex;
    align-items: center;
    gap: 6px;
  `,

  // ── Generic section block ─────────────────────────────────────────────────
  section: `
    padding: 10px 14px;
    border-bottom: 1px solid #313244;
  `,

  // ── Section label ─────────────────────────────────────────────────────────
  label: `
    display: block;
    font-size: 11px;
    font-weight: bold;
    color: #6c7086;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 7px;
  `,

  // ── Format radio item ─────────────────────────────────────────────────────
  formatItem: `
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 7px;
    border-radius: 5px;
    cursor: pointer;
    margin-bottom: 2px;
    transition: background 0.12s;
  `,

  formatItemHover: `background: #313244;`,

  formatRadio: `
    accent-color: #89b4fa;
    cursor: pointer;
    flex-shrink: 0;
  `,

  formatText: `
    font-size: 13px;
    color: #cdd6f4;
    cursor: pointer;
  `,

  // ── Checkbox option ───────────────────────────────────────────────────────
  option: `
    display: flex;
    align-items: flex-start;
    gap: 7px;
    padding: 3px 0;
    cursor: pointer;
    color: #bac2de;
    font-size: 12px;
  `,

  checkbox: `
    accent-color: #89b4fa;
    cursor: pointer;
    margin-top: 2px;
    flex-shrink: 0;
  `,

  // ── Validation ────────────────────────────────────────────────────────────
  validationBase: `
    margin: 8px 14px;
    border-radius: 5px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.45;
  `,

  validationWarning: `
    background: #3d2e00;
    border: 1px solid #f9e2af;
    color: #f9e2af;
  `,

  validationError: `
    background: #3b0f0f;
    border: 1px solid #f38ba8;
    color: #f38ba8;
  `,

  validationOk: `
    background: #0e2a1f;
    border: 1px solid #a6e3a1;
    color: #a6e3a1;
  `,

  // ── Progress ─────────────────────────────────────────────────────────────
  progressWrap: `
    padding: 8px 14px 4px;
    border-bottom: 1px solid #313244;
  `,

  progressTrack: `
    background: #313244;
    border-radius: 10px;
    height: 6px;
    overflow: hidden;
    margin-bottom: 5px;
  `,

  progressFill: `
    height: 100%;
    background: linear-gradient(90deg, #89b4fa, #cba6f7);
    border-radius: 10px;
    width: 0%;
    transition: width 0.25s ease;
  `,

  progressMsg: `
    font-size: 11px;
    color: #6c7086;
    text-align: center;
  `,

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: `
    padding: 10px 14px;
  `,

  exportBtn: `
    display: block;
    width: 100%;
    padding: 8px 0;
    background: #89b4fa;
    color: #1e1e2e;
    border: none;
    border-radius: 5px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    letter-spacing: 0.02em;
    font-family: inherit;
  `,

  exportBtnHover:     `background: #b4befe;`,
  exportBtnDisabled:  `opacity: 0.45; cursor: not-allowed;`,

  // ── Status messages ───────────────────────────────────────────────────────
  statusBase: `
    margin: 4px 14px 10px;
    padding: 7px 10px;
    border-radius: 5px;
    font-size: 12px;
  `,

  statusSuccess: `
    background: #0e2a1f;
    border: 1px solid #a6e3a1;
    color: #a6e3a1;
  `,

  statusError: `
    background: #3b0f0f;
    border: 1px solid #f38ba8;
    color: #f38ba8;
  `,

  // ── Spinner (inline CSS animation via keyframes injected once) ────────────
  spinner: `
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid #313244;
    border-top-color: #89b4fa;
    border-radius: 50%;
    animation: ep-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 5px;
  `,
};

// ---------------------------------------------------------------------------
// Keyframe injection (once per page load)
// ---------------------------------------------------------------------------

let _keyframesInjected = false;

function injectKeyframes() {
  if (_keyframesInjected) return;
  _keyframesInjected = true;
  const el = document.createElement('style');
  el.textContent = `@keyframes ep-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(el);
}

// ---------------------------------------------------------------------------
// Format definitions
// ---------------------------------------------------------------------------

const FORMATS = [
  { value: 'glb',  label: '📦 glTF / GLB – 3D-Modell' },
  { value: 'ldr',  label: '🧱 LDraw – LDR / MPD'      },
  { value: 'csv',  label: '📊 CSV – Stückliste'         },
  { value: 'json', label: '📄 JSON – Stückliste'        },
  { value: 'pdf',  label: '🖨 PDF – Druckansicht'       },
];

// ---------------------------------------------------------------------------
// ExportPanel
// ---------------------------------------------------------------------------

export class ExportPanel {
  /**
   * @param {object} params
   * @param {HTMLElement}   params.container
   * @param {object|null}   [params.exportManager=null]
   * @param {object}        [params.options={}]
   */
  constructor({ container, exportManager = null, options = {} }) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('[ExportPanel] container muss ein HTMLElement sein.');
    }

    this._container     = container;
    this._manager       = exportManager;
    this._options       = options;

    // Internal state
    this._mounted       = false;
    this._enabled       = true;
    this._currentFormat = 'glb';

    // DOM refs (populated in mount())
    this._panel         = null;
    this._formatRadios  = [];
    this._optInvisible  = null;
    this._optAssemblies = null;
    this._optMPD        = null;
    this._optSemicolon  = null;
    this._ldrawOpt      = null;
    this._csvOpt        = null;
    this._validationEl  = null;
    this._progressWrap  = null;
    this._progressFill  = null;
    this._progressMsg   = null;
    this._exportBtn     = null;
    this._statusEl      = null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Renders the panel into the container. */
  mount() {
    if (this._mounted) return;
    injectKeyframes();

    this._panel = this._buildPanel();
    this._container.appendChild(this._panel);
    this._mounted = true;
  }

  /** Removes the panel from the DOM and cleans up listeners. */
  unmount() {
    if (!this._mounted) return;
    if (this._panel && this._panel.parentNode) {
      this._panel.parentNode.removeChild(this._panel);
    }
    this._panel    = null;
    this._mounted  = false;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Replaces (or sets) the ExportManager used for actual export calls.
   * @param {object} manager
   */
  setExportManager(manager) {
    this._manager = manager;
  }

  /**
   * Shows and updates the progress bar.
   * @param {number} percent  0–100
   * @param {string} message
   */
  setProgress(percent, message) {
    if (!this._progressWrap) return;

    const clamped = Math.min(100, Math.max(0, percent));
    this._progressFill.style.width = `${clamped}%`;
    this._progressMsg.textContent  = message ?? 'Exportiere…';

    this._show(this._progressWrap);
  }

  /**
   * Displays a validation result block above the export button.
   * @param {{ level?: 'ok'|'warning'|'error', messages?: string[] }|null} result
   */
  setValidationResult(result) {
    if (!this._validationEl) return;

    if (!result || !result.messages?.length) {
      this._hide(this._validationEl);
      return;
    }

    const level = result.level ?? 'warning';
    const msgs  = result.messages;

    let styleAddition;
    let prefix;
    switch (level) {
      case 'error':
        styleAddition = STYLES.validationError;
        prefix        = '✖ ';
        break;
      case 'ok':
        styleAddition = STYLES.validationOk;
        prefix        = '✔ ';
        break;
      default: // warning
        styleAddition = STYLES.validationWarning;
        prefix        = '⚠ ';
        break;
    }

    this._validationEl.style.cssText = STYLES.validationBase + styleAddition;
    this._validationEl.innerHTML = msgs
      .map(m => `<div>${_esc(prefix + m)}</div>`)
      .join('');
    this._show(this._validationEl);
  }

  /**
   * Shows a green success status message.
   * @param {string} filename
   */
  showSuccess(filename) {
    this._hideProgress();
    this._setStatus('success', `✔ Export abgeschlossen: ${_esc(filename)}`);
  }

  /**
   * Shows a red error status message.
   * @param {string} message
   */
  showError(message) {
    this._hideProgress();
    this._setStatus('error', `✖ Fehler: ${_esc(message)}`);
  }

  /**
   * Enables or disables the export button (and all interactive controls).
   * @param {boolean} bool
   */
  setEnabled(bool) {
    this._enabled = !!bool;
    if (!this._exportBtn) return;

    this._exportBtn.disabled    = !this._enabled;
    this._exportBtn.style.cssText = STYLES.exportBtn +
      (this._enabled ? '' : STYLES.exportBtnDisabled);

    this._formatRadios.forEach(r => { r.disabled = !this._enabled; });
    [this._optInvisible, this._optAssemblies, this._optMPD, this._optSemicolon]
      .filter(Boolean)
      .forEach(el => { el.disabled = !this._enabled; });
  }

  /** Re-renders format-specific options visibility without a full remount. */
  refresh() {
    this._applyFormatVisibility(this._currentFormat);
  }

  // -------------------------------------------------------------------------
  // Panel construction
  // -------------------------------------------------------------------------

  /** @private */
  _buildPanel() {
    const panel = _el('div', STYLES.panel);
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Exportoptionen');

    panel.appendChild(this._buildHeader());
    panel.appendChild(this._buildFormatSection());
    panel.appendChild(this._buildOptionsSection());

    // Validation area
    this._validationEl = _el('div', STYLES.validationBase + STYLES.validationWarning);
    this._validationEl.style.display = 'none';
    panel.appendChild(this._validationEl);

    panel.appendChild(this._buildProgressSection());
    panel.appendChild(this._buildActionsSection());

    // Status message
    this._statusEl = _el('div', STYLES.statusBase);
    this._statusEl.style.display = 'none';
    panel.appendChild(this._statusEl);

    return panel;
  }

  /** @private */
  _buildHeader() {
    const header = _el('div', STYLES.header);
    header.textContent = '⬇ Modell exportieren';
    return header;
  }

  /** @private */
  _buildFormatSection() {
    const section  = _el('div', STYLES.section);
    const lbl      = _el('span', STYLES.label);
    lbl.textContent = 'Exportformat';
    section.appendChild(lbl);

    const list = _el('div', '');
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'Exportformat wählen');

    FORMATS.forEach(({ value, label }, idx) => {
      const wrapper = _el('label', STYLES.formatItem);
      wrapper.setAttribute('title', label);

      const radio = document.createElement('input');
      radio.type    = 'radio';
      radio.name    = 'ep-format';
      radio.value   = value;
      radio.checked = (idx === 0);
      radio.style.cssText = STYLES.formatRadio;
      radio.setAttribute('aria-label', label);
      this._formatRadios.push(radio);

      const span = _el('span', STYLES.formatText);
      span.textContent = label;

      wrapper.appendChild(radio);
      wrapper.appendChild(span);
      list.appendChild(wrapper);

      // Hover effect
      wrapper.addEventListener('mouseenter', () => {
        wrapper.style.background = '#313244';
      });
      wrapper.addEventListener('mouseleave', () => {
        wrapper.style.background = 'transparent';
      });

      // Format change handler
      radio.addEventListener('change', () => {
        if (radio.checked) {
          this._currentFormat = value;
          this._applyFormatVisibility(value);
          this._clearStatus();
        }
      });
    });

    section.appendChild(list);
    return section;
  }

  /** @private */
  _buildOptionsSection() {
    const section  = _el('div', STYLES.section);
    const lbl      = _el('span', STYLES.label);
    lbl.textContent = 'Exportoptionen';
    section.appendChild(lbl);

    // ── Always-visible options ───────────────────────────────────────────
    this._optInvisible  = this._buildCheckbox(section, 'Unsichtbare Bauteile berücksichtigen', false);
    this._optAssemblies = this._buildCheckbox(section, 'Baugruppenstruktur übernehmen', true);

    // ── LDraw-specific ────────────────────────────────────────────────────
    this._ldrawOpt = _el('label', STYLES.option);
    this._ldrawOpt.style.display = 'none';
    this._optMPD = this._appendCheckboxInto(this._ldrawOpt, 'Als MPD (Baugruppen in Untermodellen)', false);
    section.appendChild(this._ldrawOpt);

    // ── CSV-specific ──────────────────────────────────────────────────────
    this._csvOpt = _el('label', STYLES.option);
    this._csvOpt.style.display = 'none';
    this._optSemicolon = this._appendCheckboxInto(this._csvOpt, 'Semikolon als Trennzeichen (Excel DE)', false);
    section.appendChild(this._csvOpt);

    return section;
  }

  /**
   * Creates a labelled checkbox, appends it to parent, returns the input.
   * @private
   */
  _buildCheckbox(parent, labelText, checked = false) {
    const wrapper = _el('label', STYLES.option);
    const input = this._appendCheckboxInto(wrapper, labelText, checked);
    parent.appendChild(wrapper);
    return input;
  }

  /**
   * Creates a checkbox + text node inside wrapper, returns the input.
   * @private
   */
  _appendCheckboxInto(wrapper, labelText, checked) {
    const input = document.createElement('input');
    input.type    = 'checkbox';
    input.checked = checked;
    input.style.cssText = STYLES.checkbox;

    const span = _el('span', '');
    span.textContent = labelText;

    wrapper.appendChild(input);
    wrapper.appendChild(span);
    return input;
  }

  /** @private */
  _buildProgressSection() {
    this._progressWrap = _el('div', STYLES.progressWrap);
    this._progressWrap.style.display = 'none';

    const track = _el('div', STYLES.progressTrack);
    this._progressFill = _el('div', STYLES.progressFill);
    track.appendChild(this._progressFill);

    this._progressMsg = _el('div', STYLES.progressMsg);
    this._progressMsg.textContent = 'Exportiere…';

    this._progressWrap.appendChild(track);
    this._progressWrap.appendChild(this._progressMsg);
    return this._progressWrap;
  }

  /** @private */
  _buildActionsSection() {
    const actions = _el('div', STYLES.actions);

    this._exportBtn = _el('button', STYLES.exportBtn);
    this._exportBtn.textContent = 'Export starten';
    this._exportBtn.type        = 'button';
    this._exportBtn.setAttribute('aria-label', 'Export starten');

    // Hover effect
    this._exportBtn.addEventListener('mouseenter', () => {
      if (this._enabled) this._exportBtn.style.cssText = STYLES.exportBtn + STYLES.exportBtnHover;
    });
    this._exportBtn.addEventListener('mouseleave', () => {
      if (this._enabled) this._exportBtn.style.cssText = STYLES.exportBtn;
    });

    this._exportBtn.addEventListener('click', () => this._handleExport());

    actions.appendChild(this._exportBtn);
    return actions;
  }

  // -------------------------------------------------------------------------
  // Export logic
  // -------------------------------------------------------------------------

  /** @private */
  async _handleExport() {
    if (!this._enabled) return;

    this._clearStatus();
    this._hide(this._validationEl);

    const format  = this._currentFormat;
    const options = this._collectOptions();

    // Fire export-request event so external code can intercept / validate
    this._emit('export-request', { format, options });

    if (!this._manager) {
      this.showError('Kein ExportManager konfiguriert.');
      return;
    }

    this.setEnabled(false);
    this._showSpinnerInButton();
    this.setProgress(0, 'Exportiere…');

    try {
      // ExportManager.export() should return { filename } or similar
      const result = await this._manager.export(format, options);

      const filename = result?.filename ?? `export.${format}`;
      this.setProgress(100, 'Abgeschlossen');
      this.showSuccess(filename);
      this._emit('export-complete', { format, filename });
    } catch (err) {
      const msg = err?.message ?? String(err);
      this.showError(msg);
      this._emit('export-error', { format, error: msg });
    } finally {
      this._restoreButtonLabel();
      this.setEnabled(true);
    }
  }

  // -------------------------------------------------------------------------
  // Helpers – state
  // -------------------------------------------------------------------------

  /** @private */
  _collectOptions() {
    return {
      includeInvisible:  this._optInvisible?.checked  ?? false,
      keepAssemblies:    this._optAssemblies?.checked  ?? true,
      useMPD:            this._optMPD?.checked          ?? false,
      semicolonDelimiter: this._optSemicolon?.checked   ?? false,
    };
  }

  /**
   * Shows/hides format-specific option rows.
   * @private
   */
  _applyFormatVisibility(format) {
    if (!this._ldrawOpt || !this._csvOpt) return;

    this._ldrawOpt.style.display = (format === 'ldr')  ? ''     : 'none';
    this._csvOpt.style.display   = (format === 'csv')  ? ''     : 'none';
  }

  /** @private */
  _showSpinnerInButton() {
    if (!this._exportBtn) return;
    const spinner = _el('span', STYLES.spinner);
    spinner.setAttribute('aria-hidden', 'true');
    spinner.dataset.epSpinner = '1';
    this._exportBtn.textContent = '';
    this._exportBtn.appendChild(spinner);
    this._exportBtn.appendChild(document.createTextNode(' Exportiere…'));
  }

  /** @private */
  _restoreButtonLabel() {
    if (!this._exportBtn) return;
    this._exportBtn.textContent = 'Export starten';
  }

  // -------------------------------------------------------------------------
  // Helpers – display
  // -------------------------------------------------------------------------

  /** @private */
  _setStatus(type, html) {
    if (!this._statusEl) return;

    const addStyle = type === 'success' ? STYLES.statusSuccess : STYLES.statusError;
    this._statusEl.style.cssText = STYLES.statusBase + addStyle;
    this._statusEl.innerHTML = html;
    this._show(this._statusEl);

    // Auto-hide success after 8 s
    if (type === 'success') {
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => this._clearStatus(), 8000);
    }
  }

  /** @private */
  _clearStatus() {
    clearTimeout(this._statusTimer);
    if (this._statusEl) this._hide(this._statusEl);
  }

  /** @private */
  _hideProgress() {
    if (this._progressWrap) this._hide(this._progressWrap);
  }

  /** @private */
  _show(el) {
    if (el) el.style.display = '';
  }

  /** @private */
  _hide(el) {
    if (el) el.style.display = 'none';
  }

  // -------------------------------------------------------------------------
  // Event helper
  // -------------------------------------------------------------------------

  /**
   * Fires a CustomEvent on the container with detail payload.
   * @private
   */
  _emit(name, detail) {
    this._container.dispatchEvent(
      new CustomEvent(name, { bubbles: true, composed: true, detail })
    );
  }
}

// ---------------------------------------------------------------------------
// Module-private utilities
// ---------------------------------------------------------------------------

/**
 * Creates a DOM element and sets its cssText.
 * @param {string} tag
 * @param {string} cssText
 * @returns {HTMLElement}
 */
function _el(tag, cssText) {
  const el = document.createElement(tag);
  if (cssText) el.style.cssText = cssText;
  return el;
}

/**
 * Minimal HTML-escape for status / validation messages.
 * @param {unknown} val
 * @returns {string}
 */
function _esc(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
