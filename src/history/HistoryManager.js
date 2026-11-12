
import { ModelSnapshot } from './ModelSnapshot.js';

export class HistoryManager {

    /**
     * @param {object}   library            - PartLibrary-Instanz
     * @param {object}   connectionManager  - ConnectionManager-Instanz
     * @param {number}   maxHistory         - Maximale Anzahl gespeicherter Zustände
     * @param {function} onRestore          - Wird nach Undo/Redo aufgerufen (z. B. Auswahl zurücksetzen)
     * @param {function} onChange           - Wird aufgerufen, wenn sich der Modellzustand ändert.
     *                                        Kann nachträglich als Eigenschaft gesetzt werden:
     *                                        historyManager.onChange = () => autoSave();
     */
    /**
     * @param {object}   library
     * @param {object}   connectionManager
     * @param {number}   maxHistory
     * @param {function} onRestore
     * @param {function} onChange
     * @param {import('../editor/GroupManager.js').GroupManager | null} groupManager
     */
    constructor(library, connectionManager, maxHistory = 50, onRestore = null, onChange = null, groupManager = null) {
        this.library = library;
        this.connectionManager = connectionManager;
        this.groupManager = groupManager;
        this.maxHistory = maxHistory;
        this.onRestore = onRestore;

        // Wird aufgerufen, wenn saveState() einen neuen Zustand speichert
        // oder wenn undo()/redo() den aktuellen Zustand verändern.
        // Kann nach der Konstruktion gesetzt werden.
        this.onChange = onChange;

        /**
         * Wird immer dann aufgerufen, wenn sich der Undo/Redo-Zustand
         * ändert (nach saveState, undo, redo, initialize, clear).
         *
         * Signatur: onHistoryChange(canUndo: boolean, canRedo: boolean)
         *
         * Typische Verwendung:
         *   historyManager.onHistoryChange = (canUndo, canRedo) =>
         *     toolbar.updateUndoRedo(canUndo, canRedo);
         */
        this.onHistoryChange = null;

        this.history = [];
        this.currentIndex = -1;
    }

    initialize() {
        this.history = [];
        this.currentIndex = -1;

        this.saveState();
    }

    saveState() {
        const snapshot = ModelSnapshot.capture(
            this.library,
            this.connectionManager,
            this.groupManager
        );

        const newState = ModelSnapshot.clone(snapshot);

        const currentState = this.history[this.currentIndex];

        // Identische Zustände nicht doppelt speichern
        if (
            currentState &&
            JSON.stringify(currentState) === JSON.stringify(newState)
        ) {
            return false;
        }

        // Nach Undo werden alte Redo-Zustände verworfen
        this.history = this.history.slice(0, this.currentIndex + 1);

        this.history.push(newState);
        this.currentIndex++;

        // Maximale Anzahl an Zuständen begrenzen
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.currentIndex--;
        }

        // Autosave-Callback benachrichtigen
        if (typeof this.onChange === 'function') {
            this.onChange();
        }

        // Toolbar über geänderten Undo/Redo-Zustand informieren
        if (typeof this.onHistoryChange === 'function') {
            this.onHistoryChange(this.canUndo(), this.canRedo());
        }

        return true;
    }

    undo() {
        if (!this.canUndo()) {
            return false;
        }

        const nextIndex = this.currentIndex - 1;

        this.restoreState(nextIndex);

        // Wiederhergestellten Zustand auch autosaven
        if (typeof this.onChange === 'function') {
            this.onChange();
        }

        // Toolbar über geänderten Undo/Redo-Zustand informieren
        if (typeof this.onHistoryChange === 'function') {
            this.onHistoryChange(this.canUndo(), this.canRedo());
        }

        console.log('Undo ausgeführt.');
        return true;
    }

    redo() {
        if (!this.canRedo()) {
            return false;
        }

        const nextIndex = this.currentIndex + 1;

        this.restoreState(nextIndex);

        // Wiederhergestellten Zustand auch autosaven
        if (typeof this.onChange === 'function') {
            this.onChange();
        }

        // Toolbar über geänderten Undo/Redo-Zustand informieren
        if (typeof this.onHistoryChange === 'function') {
            this.onHistoryChange(this.canUndo(), this.canRedo());
        }

        console.log('Redo ausgeführt.');
        return true;
    }

    restoreState(index) {
        const snapshot = this.history[index];

        // Zustand wiederherstellen
        ModelSnapshot.restore(
            snapshot,
            this.library,
            this.connectionManager
        );

        this.currentIndex = index;

        // Beispielsweise Auswahl und TransformControls zurücksetzen
        if (typeof this.onRestore === 'function') {
            this.onRestore();
        }
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    clear() {
        this.history = [];
        this.currentIndex = -1;

        this.saveState();
    }

    getHistoryLength() {
        return this.history.length;
    }
}
