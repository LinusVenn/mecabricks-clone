// =====================================================================
// EditorPanelManager – Schritt 2 (Phase 8.9)
//
// Zentrale Verwaltung aller Seitenleisten-Panels des Editors.
//
// Aufgaben
// ────────
// • Panels registrieren (mit ihrem DOM-Container und Panel-Instanz).
// • Panels per ID öffnen / schließen / umschalten.
// • Aktive Panels verfolgen und vor Doppelinitialisierung schützen.
// • Normalisiertes update() für alle Panel-Typen (verschiedene APIs).
// • Panel-Zustände im sessionStorage sichern (optional).
//
// Anforderungserfüllung (Schritt 1)
// ──────────────────────────────────
//   ✓ Einheitliches Verhalten beim Ein- und Ausblenden
//   ✓ Panels überdecken sich nicht (CSS-Klasse 'hidden' steuert display)
//   ✓ Änderungen in einem Panel werden in anderen sichtbar (via updateAll)
//   ✓ Bestehende UI bleibt erhalten (kein Eingriff in Panel-Konstruktoren)
// =====================================================================


const STORAGE_KEY = 'editor-panel-visibility';

export class EditorPanelManager {

    constructor({ persist = false } = {}) {
        /**
         * Map<id, { panel: object, container: HTMLElement | null }>
         * @type {Map<string, { panel: object, container: HTMLElement | null }>}
         */
        this._registry = new Map();

        /** @type {Set<string>} */
        this._visible = new Set();

        this._persist = persist;

        if (persist) {
            this._loadPersistedState();
        }
    }


    // ------------------------------------------------------------------
    // Registrierung
    // ------------------------------------------------------------------

    /**
     * Registriert ein Panel. Doppelte IDs werden stillschweigend ignoriert.
     *
     * @param {string}          id        – Eindeutige Panel-ID.
     * @param {object}          panel     – Panel-Instanz (beliebige API).
     * @param {HTMLElement|null} container – DOM-Container dessen Sichtbarkeit
     *                                      der Manager steuert.
     *                                      null = kein DOM-Eingriff.
     */
    register(id, panel, container = null) {
        if (this._registry.has(id)) return this;
        this._registry.set(id, { panel, container });

        // Anfangssichtbarkeit: aus persistiertem Zustand oder sichtbar.
        if (this._persist && this._visible.has(id)) {
            this._applyVisibility(id, true);
        } else if (!this._persist) {
            // Ohne Persistence: Container-Zustand unverändert lassen.
        }

        return this;
    }

    /**
     * Meldet ein Panel ab.
     * @param {string} id
     */
    unregister(id) {
        this._registry.delete(id);
        this._visible.delete(id);
        return this;
    }


    // ------------------------------------------------------------------
    // Sichtbarkeit
    // ------------------------------------------------------------------

    /**
     * Zeigt ein Panel.
     * @param {string} id
     */
    show(id) {
        if (!this._registry.has(id)) return false;
        this._applyVisibility(id, true);
        this._visible.add(id);
        if (this._persist) this._saveState();
        return true;
    }

    /**
     * Versteckt ein Panel.
     * @param {string} id
     */
    hide(id) {
        if (!this._registry.has(id)) return false;
        this._applyVisibility(id, false);
        this._visible.delete(id);
        if (this._persist) this._saveState();
        return true;
    }

    /**
     * Wechselt die Sichtbarkeit eines Panels.
     * @param {string} id
     * @returns {boolean} Neuer Sichtbarkeits-Status.
     */
    toggle(id) {
        if (this.isVisible(id)) {
            this.hide(id);
            return false;
        } else {
            this.show(id);
            return true;
        }
    }

    /**
     * @param {string} id
     * @returns {boolean}
     */
    isVisible(id) {
        return this._visible.has(id);
    }

    /**
     * Gibt alle registrierten Panel-IDs zurück.
     * @returns {string[]}
     */
    getIds() {
        return [...this._registry.keys()];
    }

    /**
     * Gibt die Panel-Instanz zurück.
     * @param {string} id
     * @returns {object | null}
     */
    getPanel(id) {
        return this._registry.get(id)?.panel ?? null;
    }


    // ------------------------------------------------------------------
    // Aktualisierung
    // ------------------------------------------------------------------

    /**
     * Aktualisiert ein einzelnes Panel (normalisiertes Interface).
     * Unterstützt update(), refresh(), updateStatus() und updateOptions().
     * @param {string} id
     */
    update(id) {
        const entry = this._registry.get(id);
        if (!entry) return false;
        _callPanelUpdate(entry.panel);
        return true;
    }

    /**
     * Aktualisiert alle registrierten Panels.
     */
    updateAll() {
        for (const { panel } of this._registry.values()) {
            _callPanelUpdate(panel);
        }
    }


    // ------------------------------------------------------------------
    // Interne Hilfsmethoden
    // ------------------------------------------------------------------

    _applyVisibility(id, visible) {
        const entry = this._registry.get(id);
        if (!entry?.container) return;

        if (visible) {
            entry.container.classList.remove('hidden');
        } else {
            entry.container.classList.add('hidden');
        }
    }

    _saveState() {
        try {
            const state = [...this._visible];
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch { /* ignore (z.B. private mode) */ }
    }

    _loadPersistedState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                const ids = JSON.parse(raw);
                if (Array.isArray(ids)) ids.forEach(id => this._visible.add(id));
            }
        } catch { /* ignore */ }
    }
}


// ------------------------------------------------------------------
// Modul-Helper: normalisierte update-Methode
// ------------------------------------------------------------------

function _callPanelUpdate(panel) {
    if (!panel) return;
    if (typeof panel.update === 'function')        { panel.update();        return; }
    if (typeof panel.refresh === 'function')       { panel.refresh();       return; }
    if (typeof panel.updateStatus === 'function')  { panel.updateStatus();  return; }
    if (typeof panel.updateOptions === 'function') { panel.updateOptions(); return; }
    // Panel hat keine bekannte Update-Methode – kein Fehler.
}
