// Command-Pattern und eigenständige Phase-K-Command-History.
// Der globale HistoryManager wird nur zum Speichern des resultierenden
// Modellzustands verwendet. Er wird NICHT zusätzlich für Undo/Redo benutzt,
// da das sonst fremde bzw. zwischenzeitliche Operationen zurücksetzen könnte.

export class Command {
    constructor(description = 'Command') {
        this.description = description;
        this._timestamp = Date.now();
    }

    async execute() {
        throw new Error(`${this.constructor.name}.execute() is not implemented.`);
    }

    async undo() {
        throw new Error(`${this.constructor.name}.undo() is not implemented.`);
    }

    toOperation() { return null; }
    toUndoOperation() { return null; }
}

export class CommandHistory {
    constructor({ historyManager = null, collaborationManager = null, maxSize = 200 } = {}) {
        this._history = historyManager;
        this._collab = collaborationManager;
        this._maxSize = Math.max(1, Number(maxSize) || 200);
        this._undoStack = [];
        this._redoStack = [];
        this._listeners = new Set();
        this._busy = false;
    }

    async execute(command) {
        this._assertCommand(command);
        return this._runExclusive(async () => {
            await command.execute();
            this._redoStack = [];
            this._undoStack.push(command);
            if (this._undoStack.length > this._maxSize) this._undoStack.shift();
            this._history?.saveState?.();
            await this._send(command.toOperation?.());
            this._notify();
            return command;
        });
    }

    async undo() {
        if (!this.canUndo) return false;
        return this._runExclusive(async () => {
            const command = this._undoStack[this._undoStack.length - 1];
            const inverse = command.toUndoOperation?.();
            // Wende lokal an, bevor die Operation übertragen wird. Damit bleibt
            // der lokale Zustand auch bei einem temporären Netzfehler konsistent.
            await command.undo();
            this._undoStack.pop();
            this._redoStack.push(command);
            this._history?.saveState?.();
            await this._send(inverse);
            this._notify();
            return true;
        });
    }

    async redo() {
        if (!this.canRedo) return false;
        return this._runExclusive(async () => {
            const command = this._redoStack[this._redoStack.length - 1];
            await command.execute();
            this._redoStack.pop();
            this._undoStack.push(command);
            this._history?.saveState?.();
            await this._send(command.toOperation?.());
            this._notify();
            return true;
        });
    }

    async _send(operation) {
        if (!operation || !this._collab?.isCollaborating) return;
        try {
            await this._collab.sendOperation(operation.type, operation.payload);
        } catch (error) {
            // Lokale Änderungen bleiben gültig. Der Collaboration-Layer muss
            // fehlgeschlagene Übertragungen selbst behandeln/wiederholen.
            console.warn('[CommandHistory] Operation konnte nicht synchronisiert werden:', error);
        }
    }

    async _runExclusive(callback) {
        if (this._busy) throw new Error('Eine Modellierungsoperation wird bereits ausgeführt.');
        this._busy = true;
        try { return await callback(); }
        finally { this._busy = false; }
    }

    _assertCommand(command) {
        if (!(command instanceof Command)) {
            throw new TypeError('CommandHistory erwartet eine Instanz von Command.');
        }
    }

    get canUndo() { return this._undoStack.length > 0; }
    get canRedo() { return this._redoStack.length > 0; }
    get undoCount() { return this._undoStack.length; }
    get nextUndoDescription() { return this._undoStack.at(-1)?.description ?? null; }
    get nextRedoDescription() { return this._redoStack.at(-1)?.description ?? null; }

    subscribe(callback) {
        if (typeof callback !== 'function') throw new TypeError('callback muss eine Funktion sein.');
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    _notify() {
        for (const callback of this._listeners) {
            try { callback(this); }
            catch (error) { console.error('[CommandHistory] Listener-Fehler:', error); }
        }
    }

    clear() {
        this._undoStack = [];
        this._redoStack = [];
        this._notify();
    }
}
