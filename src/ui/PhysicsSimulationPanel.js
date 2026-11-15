/**
 * PhysicsSimulationPanel – Steuerungspanel für die Physiksimulation (Phase G.7)
 *
 * Vanilla-DOM-Komponente (kein React/Vue).
 * Integriert sich über Custom Events in den Editor.
 *
 * Ereignisse auf container:
 *   'physics-start'   → {}
 *   'physics-pause'   → {}
 *   'physics-resume'  → {}
 *   'physics-reset'   → {}
 *   'physics-step'    → {}
 *   'physics-timescale-change' → { value: number }
 *   'physics-debug-toggle'     → { enabled: boolean }
 */
import { MECHANICAL_CONNECTION_TYPES } from '../connections/MechanicalConnectionManager.js';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** @typedef {'edit'|'running'|'paused'} SimulationState */

const STYLES = {
    panel: `
        box-sizing: border-box;
        width: 100%;
        background: #1e1e2e;
        color: #cdd6f4;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        border-radius: 6px;
        overflow: hidden;
        user-select: none;
    `,
    header: `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 12px 8px;
        background: #181825;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
        border-bottom: 1px solid #313244;
    `,
    controls: `
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px 12px;
        border-bottom: 1px solid #313244;
    `,
    btnBase: `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        border: 1px solid #45475a;
        border-radius: 4px;
        background: #313244;
        color: #cdd6f4;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s, opacity 0.12s;
        outline: none;
    `,
    btnStart: `
        border-color: #a6e3a1;
        color: #a6e3a1;
    `,
    btnPause: `
        border-color: #f9e2af;
        color: #f9e2af;
    `,
    btnReset: `
        border-color: #f38ba8;
        color: #f38ba8;
    `,
    btnStep: `
        border-color: #89b4fa;
        color: #89b4fa;
    `,
    btnDisabled: `
        opacity: 0.38;
        cursor: not-allowed;
    `,
    timescale: `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-bottom: 1px solid #313244;
        flex-wrap: wrap;
    `,
    timescaleLabel: `
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #a6adc8;
    `,
    slider: `
        flex: 1;
        accent-color: #89b4fa;
        cursor: pointer;
        min-width: 80px;
    `,
    speedBadge: `
        min-width: 34px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: #89b4fa;
        font-weight: 600;
    `,
    details: `
        border-bottom: 1px solid #313244;
    `,
    summary: `
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        color: #a6adc8;
        list-style: none;
        display: flex;
        align-items: center;
        gap: 4px;
        outline: none;
    `,
    debugInner: `
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px 12px 10px 20px;
    `,
    checkLabel: `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #cdd6f4;
        cursor: pointer;
    `,
    stats: `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1px;
        background: #313244;
        border-top: 1px solid #313244;
    `,
    stat: `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 8px 4px;
        background: #1e1e2e;
        font-size: 11px;
    `,
    statLabel: `
        color: #6c7086;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    `,
    statValue: `
        color: #cdd6f4;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    `,
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Erstellt ein DOM-Element mit optionalen Attributen und Inline-Styles.
 *
 * @param {string} tag
 * @param {{ style?: string, [key: string]: string|boolean|null }} attrs
 * @returns {HTMLElement}
 */
function el(tag, attrs = {}) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'style') {
            node.style.cssText = value;
        } else if (key === 'textContent') {
            node.textContent = value;
        } else if (typeof value === 'boolean') {
            if (value) node.setAttribute(key, '');
        } else if (value !== null && value !== undefined) {
            node.setAttribute(key, value);
        }
    }
    return node;
}

/**
 * Sendet ein typisiertes CustomEvent auf dem angegebenen Ziel.
 *
 * @param {EventTarget} target
 * @param {string} type
 * @param {object} detail
 */
function dispatch(target, type, detail = {}) {
    target.dispatchEvent(
        new CustomEvent(type, { bubbles: true, detail })
    );
}

/**
 * Wendet einen Basis-Style plus optionale Zusatz-Styles auf einen Button an.
 *
 * @param {HTMLButtonElement} btn
 * @param {...string} extraStyles
 */
function applyBtnStyle(btn, ...extraStyles) {
    btn.style.cssText = STYLES.btnBase + extraStyles.join('');
}

// ---------------------------------------------------------------------------
// Klasse
// ---------------------------------------------------------------------------

export class PhysicsSimulationPanel {

    /**
     * @param {{ container: HTMLElement, options?: object }} params
     */
    constructor({ container, options = {} }) {

        if (!container || !(container instanceof HTMLElement)) {
            throw new Error('PhysicsSimulationPanel: container muss ein HTMLElement sein.');
        }

        /** @type {HTMLElement} */
        this._container = container;

        /** @type {object} */
        this._options = options;

        /** @type {SimulationState} */
        this._state = 'edit';

        /** @type {boolean} */
        this._enabled = true;

        /** @type {boolean} */
        this._mounted = false;

        // DOM-Referenzen – werden in _build() gesetzt
        this._panel         = null;
        this._btnStart      = null;
        this._btnPause      = null;
        this._btnReset      = null;
        this._btnStep       = null;
        this._slider        = null;
        this._speedLabel    = null;
        this._chkColliders  = null;
        this._chkJoints     = null;
        this._chkContacts   = null;
        this._statBodies    = null;
        this._statJoints    = null;
        this._statSteps     = null;

        // Gebundene Event-Listener-Referenzen (für saubere Entsorgung)
        this._listeners = [];
    }


    // -----------------------------------------------------------------------
    // Öffentliche API
    // -----------------------------------------------------------------------

    /**
     * Erzeugt die DOM-Struktur und hängt das Panel in den Container.
     * Idempotent – mehrfache Aufrufe werden ignoriert.
     */
    mount() {
        if (this._mounted) return;
        this._build();
        this._container.appendChild(this._panel);
        this._mounted = true;
        this.refresh();
    }

    /**
     * Entfernt das Panel aus dem DOM und bereinigt alle Event-Listener.
     * Idempotent – mehrfache Aufrufe werden ignoriert.
     */
    unmount() {
        if (!this._mounted) return;
        this._removeListeners();
        this._panel?.remove();
        this._mounted = false;
    }

    /**
     * Setzt den Simulationszustand und aktualisiert die Steuerelemente.
     *
     * @param {SimulationState} state
     */
    setSimulationState(state) {
        if (state !== 'edit' && state !== 'running' && state !== 'paused') {
            console.warn(`[PhysicsSimulationPanel] Unbekannter Zustand: "${state}"`);
            return;
        }
        this._state = state;
        if (this._mounted) {
            this._applyState();
        }
    }

    /**
     * Aktualisiert die Statistik-Anzeige.
     *
     * @param {{ bodyCount?: number, jointCount?: number, stepCount?: number, fps?: number }} stats
     */
    setStats(stats = {}) {
        if (!this._mounted) return;

        if (this._statBodies && stats.bodyCount !== undefined) {
            this._statBodies.textContent = String(stats.bodyCount ?? 0);
        }
        if (this._statJoints && stats.jointCount !== undefined) {
            this._statJoints.textContent = String(stats.jointCount ?? 0);
        }
        if (this._statSteps && stats.stepCount !== undefined) {
            this._statSteps.textContent = String(stats.stepCount ?? 0);
        }
    }

    /**
     * Aktiviert oder deaktiviert alle Steuerelemente.
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = Boolean(enabled);
        if (this._mounted) {
            this._applyEnabled();
        }
    }

    /**
     * Erzwingt eine vollständige Neu-Darstellung auf Basis des aktuellen Zustands.
     */
    refresh() {
        if (!this._mounted) return;
        this._applyState();
        this._applyEnabled();
    }

    /**
     * Gibt den aktuellen Zeitfaktor zurück.
     *
     * @returns {number}
     */
    getTimeScale() {
        if (!this._slider) return 1.0;
        return parseFloat(this._slider.value);
    }


    // -----------------------------------------------------------------------
    // Interne Hilfsmethoden – DOM-Aufbau
    // -----------------------------------------------------------------------

    /**
     * Erstellt die vollständige DOM-Struktur des Panels.
     * Wird nur einmal aufgerufen (in mount()).
     */
    _build() {

        // --- Panel-Root ---
        const panel = el('div', { style: STYLES.panel });
        panel.classList.add('psp-panel');

        // --- Header ---
        const header = el('div', { style: STYLES.header });
        header.classList.add('psp-header');
        header.textContent = '⚙️ Physiksimulation';
        panel.appendChild(header);

        // --- Steuer-Buttons ---
        panel.appendChild(this._buildControls());

        // --- Zeitskala ---
        panel.appendChild(this._buildTimescale());

        // --- Debug-Sektion ---
        panel.appendChild(this._buildDebug());

        // --- Statistik ---
        panel.appendChild(this._buildStats());

        this._panel = panel;
    }

    /**
     * Erstellt den Bereich mit den Steuer-Buttons.
     *
     * @returns {HTMLElement}
     */
    _buildControls() {
        const wrap = el('div', { style: STYLES.controls });
        wrap.classList.add('psp-controls');

        // ▶ Starten / Fortsetzen
        const btnStart = el('button', {});
        btnStart.classList.add('psp-btn', 'psp-start');
        btnStart.textContent = '▶ Starten';
        applyBtnStyle(btnStart, STYLES.btnStart);
        this._addListener(btnStart, 'click', () => this._onStartClick());
        this._btnStart = btnStart;

        // ⏸ Pausieren
        const btnPause = el('button', { disabled: true });
        btnPause.classList.add('psp-btn', 'psp-pause');
        btnPause.textContent = '⏸ Pausieren';
        applyBtnStyle(btnPause, STYLES.btnPause);
        this._addListener(btnPause, 'click', () => this._onPauseClick());
        this._btnPause = btnPause;

        // ⏹ Zurücksetzen
        const btnReset = el('button', { disabled: true });
        btnReset.classList.add('psp-btn', 'psp-reset');
        btnReset.textContent = '⏹ Zurücksetzen';
        applyBtnStyle(btnReset, STYLES.btnReset);
        this._addListener(btnReset, 'click', () => dispatch(this._container, 'physics-reset'));
        this._btnReset = btnReset;

        // ⟩ Einzelschritt
        const btnStep = el('button', { disabled: true });
        btnStep.classList.add('psp-btn', 'psp-step');
        btnStep.textContent = '⟩ Einzelschritt';
        applyBtnStyle(btnStep, STYLES.btnStep);
        this._addListener(btnStep, 'click', () => dispatch(this._container, 'physics-step'));
        this._btnStep = btnStep;

        wrap.appendChild(btnStart);
        wrap.appendChild(btnPause);
        wrap.appendChild(btnReset);
        wrap.appendChild(btnStep);

        return wrap;
    }

    /**
     * Erstellt den Zeitskala-Regler.
     *
     * @returns {HTMLElement}
     */
    _buildTimescale() {
        const wrap = el('div', { style: STYLES.timescale });
        wrap.classList.add('psp-timescale');

        const labelWrap = el('label', { style: STYLES.timescaleLabel });
        labelWrap.textContent = 'Geschwindigkeit:';

        const slider = el('input', {
            type:  'range',
            min:   '0.1',
            max:   '2.0',
            step:  '0.1',
            value: '1.0',
            style: STYLES.slider,
        });
        slider.classList.add('psp-speed-slider');
        this._slider = slider;

        const speedLabel = el('span', { style: STYLES.speedBadge });
        speedLabel.classList.add('psp-speed-label');
        speedLabel.textContent = '1.0×';
        this._speedLabel = speedLabel;

        this._addListener(slider, 'input', () => {
            const value = parseFloat(slider.value);
            speedLabel.textContent = value.toFixed(1) + '×';
            dispatch(this._container, 'physics-timescale-change', { value });
        });

        labelWrap.appendChild(slider);
        wrap.appendChild(labelWrap);
        wrap.appendChild(speedLabel);

        return wrap;
    }

    /**
     * Erstellt die aufklappbare Debug-Sektion.
     *
     * @returns {HTMLElement}
     */
    _buildDebug() {
        const details = el('details', { style: STYLES.details });
        details.classList.add('psp-debug-section');

        const summary = el('summary', { style: STYLES.summary });
        summary.textContent = '🔧 Debug-Anzeige';
        details.appendChild(summary);

        const inner = el('div', { style: STYLES.debugInner });

        const mkCheck = (cls, labelText) => {
            const labelEl = el('label', { style: STYLES.checkLabel });
            const chk = el('input', { type: 'checkbox' });
            chk.classList.add(cls);
            const span = el('span', {});
            span.textContent = labelText;
            labelEl.appendChild(chk);
            labelEl.appendChild(span);

            this._addListener(chk, 'change', () => {
                dispatch(this._container, 'physics-debug-toggle', {
                    kind:    cls,
                    enabled: chk.checked,
                });
            });

            return { label: labelEl, chk };
        };

        const colliders = mkCheck('psp-debug-colliders', 'Collider anzeigen');
        const joints    = mkCheck('psp-debug-joints',    'Gelenkachsen anzeigen');
        const contacts  = mkCheck('psp-debug-contacts',  'Kontaktpunkte anzeigen');

        this._chkColliders = colliders.chk;
        this._chkJoints    = joints.chk;
        this._chkContacts  = contacts.chk;

        inner.appendChild(colliders.label);
        inner.appendChild(joints.label);
        inner.appendChild(contacts.label);
        details.appendChild(inner);

        return details;
    }

    /**
     * Erstellt das Statistik-Gitter.
     *
     * @returns {HTMLElement}
     */
    _buildStats() {
        const grid = el('div', { style: STYLES.stats });
        grid.classList.add('psp-stats');

        const mkStat = (labelText, cls) => {
            const cell = el('div', { style: STYLES.stat });
            cell.classList.add('psp-stat');

            const lbl = el('span', { style: STYLES.statLabel });
            lbl.textContent = labelText;

            const val = el('span', { style: STYLES.statValue });
            val.classList.add(cls);
            val.textContent = '0';

            cell.appendChild(lbl);
            cell.appendChild(val);
            grid.appendChild(cell);

            return val;
        };

        this._statBodies = mkStat('Körper',  'psp-stat-bodies');
        this._statJoints = mkStat('Gelenke', 'psp-stat-joints');
        this._statSteps  = mkStat('Schritte','psp-stat-steps');

        return grid;
    }


    // -----------------------------------------------------------------------
    // Interne Hilfsmethoden – Zustandsverwaltung
    // -----------------------------------------------------------------------

    /**
     * Aktualisiert die Button-Zustände passend zum aktuellen Simulationszustand.
     * Regeln:
     *   edit    → Start=an,  Pause=aus, Reset=aus, Step=aus
     *   running → Start=aus, Pause=an,  Reset=an,  Step=an
     *   paused  → Start=an(Resume), Pause=aus, Reset=an, Step=an
     */
    _applyState() {
        const { _state: state } = this;

        switch (state) {

            case 'edit':
                this._setBtn(this._btnStart, true,  '▶ Starten',    STYLES.btnStart);
                this._setBtn(this._btnPause, false, '⏸ Pausieren',  STYLES.btnPause);
                this._setBtn(this._btnReset, false, '⏹ Zurücksetzen', STYLES.btnReset);
                this._setBtn(this._btnStep,  false, '⟩ Einzelschritt', STYLES.btnStep);
                break;

            case 'running':
                this._setBtn(this._btnStart, false, '▶ Starten',    STYLES.btnStart);
                this._setBtn(this._btnPause, true,  '⏸ Pausieren',  STYLES.btnPause);
                this._setBtn(this._btnReset, true,  '⏹ Zurücksetzen', STYLES.btnReset);
                this._setBtn(this._btnStep,  true,  '⟩ Einzelschritt', STYLES.btnStep);
                break;

            case 'paused':
                this._setBtn(this._btnStart, true,  '▶ Fortsetzen', STYLES.btnStart);
                this._setBtn(this._btnPause, false, '⏸ Pausieren',  STYLES.btnPause);
                this._setBtn(this._btnReset, true,  '⏹ Zurücksetzen', STYLES.btnReset);
                this._setBtn(this._btnStep,  true,  '⟩ Einzelschritt', STYLES.btnStep);
                break;

            default:
                break;
        }
    }

    /**
     * Setzt Aktivierungs-/Deaktivierungs-Overlay für alle interaktiven Elemente.
     */
    _applyEnabled() {
        const disabled = !this._enabled;
        const elems = [
            this._btnStart,
            this._btnPause,
            this._btnReset,
            this._btnStep,
            this._slider,
            this._chkColliders,
            this._chkJoints,
            this._chkContacts,
        ];
        for (const elem of elems) {
            if (!elem) continue;
            elem.disabled = disabled;
        }
        if (this._panel) {
            this._panel.style.opacity = disabled ? '0.5' : '1';
            this._panel.style.pointerEvents = disabled ? 'none' : '';
        }
    }

    /**
     * Konfiguriert einen einzelnen Button.
     *
     * @param {HTMLButtonElement} btn
     * @param {boolean} active        – ob der Button klickbar ist
     * @param {string}  label         – anzuzeigender Text
     * @param {string}  colorStyle    – Farb-Style-Snippet
     */
    _setBtn(btn, active, label, colorStyle) {
        if (!btn) return;
        btn.textContent = label;
        btn.disabled    = !active;
        applyBtnStyle(btn, colorStyle, active ? '' : STYLES.btnDisabled);
    }


    // -----------------------------------------------------------------------
    // Interne Click-Handler
    // -----------------------------------------------------------------------

    /**
     * Verarbeitet einen Klick auf den Start/Resume-Button.
     * Sendet je nach aktuellem Zustand 'physics-start' oder 'physics-resume'.
     */
    _onStartClick() {
        if (this._state === 'paused') {
            dispatch(this._container, 'physics-resume');
        } else {
            dispatch(this._container, 'physics-start');
        }
    }

    /**
     * Verarbeitet einen Klick auf den Pause-Button.
     */
    _onPauseClick() {
        dispatch(this._container, 'physics-pause');
    }


    // -----------------------------------------------------------------------
    // Listener-Verwaltung
    // -----------------------------------------------------------------------

    /**
     * Registriert einen Event-Listener und merkt ihn für die spätere Entsorgung vor.
     *
     * @param {EventTarget} target
     * @param {string}      type
     * @param {Function}    handler
     */
    _addListener(target, type, handler) {
        target.addEventListener(type, handler);
        this._listeners.push({ target, type, handler });
    }

    /**
     * Entfernt alle registrierten Event-Listener.
     */
    _removeListeners() {
        for (const { target, type, handler } of this._listeners) {
            target.removeEventListener(type, handler);
        }
        this._listeners = [];
    }
}
