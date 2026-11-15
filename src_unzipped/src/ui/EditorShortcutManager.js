// =====================================================================
// EditorShortcutManager – Schritt 6 (Phase 8.9)
//
// Zentrale Tastatursteuerung für den Editor.
//
// Aufgaben
// ────────
// • Shortcuts registrieren und verwalten.
// • Deregistrierung über das zurückgegebene Objekt.
// • Shortcuts nicht auslösen in Texteingabefeldern
//   (INPUT, TEXTAREA, contentEditable).
// • Ersten passenden Shortcut ausführen; weitere Shortcuts für
//   dieselbe Taste werden nach einem Treffer nicht mehr geprüft.
// • dispose() entfernt alle Event-Listener.
//
// Vorgesehene Phase-8.9-Shortcuts:
//   Ctrl+A        – Alle auswählen
//   G             – Verschieben-Modus
//   R             – Drehen-Modus
//   S             – Skalieren-Modus
//   F             – Kamera auf Auswahl fokussieren
//   Ctrl+G        – Gruppe erstellen
//   Ctrl+Shift+G  – Gruppe auflösen
//
// (Die bestehenden Shortcuts Ctrl+Z/Y/S/C/V/D, Delete, Escape
//  bleiben im main.js-Handler und werden hier nicht dupliziert.)
// =====================================================================


export class EditorShortcutManager {

    /**
     * @param {EventTarget} [target]  – Standard: window
     */
    constructor(target = (typeof window !== 'undefined' ? window : null)) {
        this._target    = target;
        this._shortcuts = [];   // Array<ShortcutEntry>
        this._handler   = this._handleKeydown.bind(this);

        if (this._target) {
            this._target.addEventListener('keydown', this._handler);
        }
    }


    // ------------------------------------------------------------------
    // Registrierung
    // ------------------------------------------------------------------

    /**
     * Registriert einen Shortcut.
     *
     * @param {{
     *   key:            string    – Taste (case-insensitive)
     *   ctrl?:          boolean   – Ctrl- oder Meta-Taste (Standard: false)
     *   shift?:         boolean   – Shift-Taste (Standard: false)
     *   alt?:           boolean   – Alt-Taste (Standard: false)
     *   allowInInput?:  boolean   – Auch in Eingabefeldern auslösen (Standard: false)
     *   preventDefault?: boolean  – event.preventDefault() aufrufen (Standard: true)
     * }} spec
     * @param {(event: KeyboardEvent) => void} callback
     * @returns {{ unregister: () => void }}  – Deregistrierungshandle.
     */
    register(spec, callback) {
        const entry = {
            key:             spec.key.toLowerCase(),
            ctrl:            Boolean(spec.ctrl),
            shift:           Boolean(spec.shift),
            alt:             Boolean(spec.alt),
            allowInInput:    Boolean(spec.allowInInput),
            preventDefault:  spec.preventDefault !== false,
            callback
        };

        this._shortcuts.push(entry);

        return {
            unregister: () => {
                const idx = this._shortcuts.indexOf(entry);
                if (idx !== -1) this._shortcuts.splice(idx, 1);
            }
        };
    }

    /**
     * Entfernt alle Shortcuts und den Event-Listener.
     */
    dispose() {
        if (this._target) {
            this._target.removeEventListener('keydown', this._handler);
        }
        this._shortcuts = [];
    }


    // ------------------------------------------------------------------
    // Interne Verarbeitung
    // ------------------------------------------------------------------

    _isEditableTarget(target) {
        if (!target) return false;
        const tag = target.tagName;
        return Boolean(
            target.isContentEditable ||
            tag === 'INPUT'           ||
            tag === 'TEXTAREA'        ||
            tag === 'SELECT'
        );
    }

    _handleKeydown(event) {
        const isTyping = this._isEditableTarget(event.target);
        const pressedKey = event.key.toLowerCase();
        const hasCtrl    = event.ctrlKey || event.metaKey;
        const hasShift   = event.shiftKey;
        const hasAlt     = event.altKey;

        for (const s of this._shortcuts) {
            if (isTyping && !s.allowInInput) continue;
            if (pressedKey !== s.key)        continue;
            if (s.ctrl  !== hasCtrl)         continue;
            if (s.shift !== hasShift)        continue;
            if (s.alt   !== hasAlt)          continue;

            if (s.preventDefault) event.preventDefault();

            try {
                s.callback(event);
            } catch (err) {
                // Fehler in einem Shortcut-Callback soll nicht den ganzen
                // Editor blockieren.
                console.error('[EditorShortcutManager] Fehler in Shortcut-Callback:', err);
            }

            // Ersten passenden Shortcut ausführen, dann stoppen.
            break;
        }
    }
}
