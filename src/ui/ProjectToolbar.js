
// =====================================
// ProjectToolbar
// =====================================

/**
 * Verwaltet die Projektwerkzeugleiste im Header des Editors.
 *
 * Die Toolbar bindet sich an bestehende DOM-Elemente (per ID)
 * und stellt nach außen Callback-Eigenschaften bereit,
 * die von main.js mit der Anwendungslogik verdrahtet werden:
 *
 *   toolbar.onSave       = () => autoSaveManager.save();
 *   toolbar.onNewProject = () => createNewProject();
 *   toolbar.onExport     = () => exportProject();
 *   toolbar.onImport     = async (file) => importFile(file);
 *   toolbar.onUndo       = () => historyManager.undo();
 *   toolbar.onRedo       = () => historyManager.redo();
 *   toolbar.onRename     = (name) => renameProject(name);
 */
export class ProjectToolbar {


    // =====================================
    // Konstruktor
    // =====================================

    constructor() {

        // --- DOM-Elemente ---

        this._nameEl      = document.getElementById('autosave-project-name');
        this._indicatorEl = document.getElementById('autosave-indicator');

        this._btnSave       = document.getElementById('btn-save');
        this._btnNewProject = document.getElementById('btn-new-project');
        this._btnExport     = document.getElementById('btn-export');
        this._btnImport     = document.getElementById('btn-import');
        this._fileInput     = document.getElementById('project-file-input');
        this._btnUndo       = document.getElementById('btn-undo');
        this._btnRedo       = document.getElementById('btn-redo');


        // --- Öffentliche Callbacks ---
        // Werden von main.js gesetzt.

        /** Wird aufgerufen, wenn der Benutzer auf „Speichern" klickt. */
        this.onSave = null;

        /** Wird aufgerufen, wenn der Benutzer auf „Neu" klickt. */
        this.onNewProject = null;

        /** Wird aufgerufen, wenn der Benutzer auf „Export" klickt. */
        this.onExport = null;

        /**
         * Wird aufgerufen, wenn der Benutzer eine Datei zum Importieren
         * ausgewählt hat. Erhält das File-Objekt als Parameter.
         * @type {((file: File) => void) | null}
         */
        this.onImport = null;

        /** Wird aufgerufen, wenn der Benutzer auf „↩ Rückgängig" klickt. */
        this.onUndo = null;

        /** Wird aufgerufen, wenn der Benutzer auf „↪ Wiederholen" klickt. */
        this.onRedo = null;

        /**
         * Wird aufgerufen, wenn der Benutzer den Projektnamen geändert hat.
         * Erhält den neuen Namen als String.
         * @type {((name: string) => void) | null}
         */
        this.onRename = null;


        this._bindEvents();
    }


    // =====================================
    // 1. Ereignisse binden
    // =====================================

    _bindEvents() {

        // Speichern
        this._btnSave?.addEventListener('click', () => {
            this.onSave?.();
        });

        // Neues Projekt
        this._btnNewProject?.addEventListener('click', () => {
            this.onNewProject?.();
        });

        // Export
        this._btnExport?.addEventListener('click', () => {
            this.onExport?.();
        });

        // Import – öffnet den Datei-Auswahldialog
        this._btnImport?.addEventListener('click', () => {
            this._fileInput?.click();
        });

        // Dateiauswahl: Datei an Callback übergeben
        this._fileInput?.addEventListener('change', (event) => {

            const file = event.target.files[0];

            if (file) {
                this.onImport?.(file);
            }

            // Eingabe zurücksetzen, damit dieselbe Datei erneut
            // ausgewählt werden kann.
            event.target.value = '';
        });

        // Undo
        this._btnUndo?.addEventListener('click', () => {
            this.onUndo?.();
        });

        // Redo
        this._btnRedo?.addEventListener('click', () => {
            this.onRedo?.();
        });

        // Projektname umbenennen (Klick auf den Namen)
        this._nameEl?.addEventListener('click', () => {
            this._promptRename();
        });

        // Umbenennen auch per Enter-Taste erreichbar (Barrierefreiheit)
        this._nameEl?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this._promptRename();
            }
        });
    }


    // =====================================
    // 2. Projektnamen umbennen (intern)
    // =====================================

    _promptRename() {

        const current = this._nameEl?.textContent ?? 'Unbenanntes Projekt';

        // Einfaches Eingabedialog – kann später durch ein
        // eingebettetes Eingabefeld ersetzt werden.
        const newName = window.prompt('Projektname:', current);

        if (
            newName !== null &&
            newName.trim() !== '' &&
            newName.trim() !== current
        ) {
            this.onRename?.(newName.trim());
        }
    }


    // =====================================
    // 3. Projektnamen anzeigen
    // =====================================

    /**
     * Aktualisiert die Anzeige des Projektnamens in der Toolbar.
     *
     * @param {string} name
     */
    updateProjectName(name) {

        if (this._nameEl) {
            this._nameEl.textContent = name || 'Unbenanntes Projekt';
        }
    }


    // =====================================
    // 4. Speicherstatus anzeigen
    // =====================================

    /**
     * Aktualisiert den Speicherstatus-Indikator neben dem Projektnamen.
     *
     * @param {'saving'|'saved'|'error'|'idle'} status
     * @param {Date|null} time     – Zeitpunkt der letzten Speicherung
     * @param {string|null} errorMessage – Fehlermeldung (nur bei 'error')
     */
    updateSaveStatus(status, time = null, errorMessage = null) {

        const el = this._indicatorEl;
        if (!el) return;

        el.classList.remove(
            'autosave-idle',
            'autosave-saving',
            'autosave-saved',
            'autosave-error'
        );
        el.title = '';

        switch (status) {

            case 'saving':
                el.classList.add('autosave-saving');
                el.textContent = 'Speichern l\u00e4uft\u2026';
                break;

            case 'saved': {
                el.classList.add('autosave-saved');
                const timeStr = time
                    ? time.toLocaleTimeString()
                    : '';
                el.textContent = `\u2713\u00a0Gespeichert${timeStr ? '\u00a0' + timeStr : ''}`;
                break;
            }

            case 'error':
                el.classList.add('autosave-error');
                el.textContent = '\u26a0\ufe0f Speichern fehlgeschlagen';
                el.title = errorMessage || '';
                break;

            default:
                el.classList.add('autosave-idle');
                el.textContent = '';
        }
    }


    // =====================================
    // 5. Undo/Redo-Schaltflächen aktualisieren
    // =====================================

    /**
     * Aktiviert oder deaktiviert die Undo- und Redo-Schaltflächen
     * entsprechend dem aktuellen History-Zustand.
     *
     * Wird vom HistoryManager über dessen onHistoryChange-Callback
     * aufgerufen.
     *
     * @param {boolean} canUndo
     * @param {boolean} canRedo
     */
    updateUndoRedo(canUndo, canRedo) {

        if (this._btnUndo) {
            this._btnUndo.disabled = !canUndo;
        }

        if (this._btnRedo) {
            this._btnRedo.disabled = !canRedo;
        }
    }
}
