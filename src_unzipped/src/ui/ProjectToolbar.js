
export class ProjectToolbar {

    constructor() {
        this._nameEl = document.getElementById('autosave-project-name');
        this._statusEl = document.getElementById('autosave-indicator');

        this._saveBtn = document.getElementById('btn-save');
        this._newBtn = document.getElementById('btn-new-project');
        this._exportBtn = document.getElementById('btn-export');
        this._importBtn = document.getElementById('btn-import');
        this._undoBtn = document.getElementById('btn-undo');
        this._redoBtn = document.getElementById('btn-redo');
        this._fileInput = document.getElementById('project-file-input');

        this.onSave = null;
        this.onNewProject = null;
        this.onExport = null;
        this.onImport = null;
        this.onUndo = null;
        this.onRedo = null;
        this.onRename = null;

        this._bindEvents();
    }

    _bindEvents() {
        this._saveBtn?.addEventListener('click', () => {
            this.onSave?.();
        });

        this._newBtn?.addEventListener('click', () => {
            this.onNewProject?.();
        });

        this._exportBtn?.addEventListener('click', () => {
            this.onExport?.();
        });

        this._importBtn?.addEventListener('click', () => {
            this._fileInput?.click();
        });

        this._undoBtn?.addEventListener('click', () => {
            this.onUndo?.();
        });

        this._redoBtn?.addEventListener('click', () => {
            this.onRedo?.();
        });

        this._fileInput?.addEventListener('change', event => {
            const file = event.target.files?.[0];

            if (file) {
                this.onImport?.(file);
            }

            // Ermöglicht, dieselbe Datei erneut auszuwählen.
            event.target.value = '';
        });

        this._nameEl?.addEventListener('click', () => {
            this._promptRename();
        });

        this._nameEl?.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this._promptRename();
            }
        });
    }

    _promptRename() {
        const current =
            this._nameEl?.textContent?.trim() ||
            'Unbenanntes Projekt';

        const newName = window.prompt(
            'Projektname:',
            current
        );

        if (newName === null) {
            return;
        }

        const trimmedName = newName.trim();

        if (
            trimmedName !== '' &&
            trimmedName !== current
        ) {
            this.onRename?.(trimmedName);
        }
    }

    updateProjectName(name) {
        if (!this._nameEl) {
            return;
        }

        this._nameEl.textContent =
            name || 'Unbenanntes Projekt';
    }

    updateSaveStatus(
        status,
        time = null,
        errorMessage = null
    ) {
        if (!this._statusEl) {
            return;
        }

        this._statusEl.className = '';
        this._statusEl.classList.add('autosave-indicator');

        switch (status) {
            case 'saving':
                this._statusEl.textContent = 'Speichert...';
                this._statusEl.title = 'Projekt wird gespeichert.';
                this._statusEl.classList.add('saving');
                break;

            case 'saved':
                this._statusEl.textContent = 'Gespeichert';

                this._statusEl.title = time
                    ? `Zuletzt gespeichert: ${new Date(time).toLocaleString()}`
                    : 'Projekt wurde gespeichert.';

                this._statusEl.classList.add('saved');
                break;

            case 'error':
                this._statusEl.textContent = 'Speicherfehler';
                this._statusEl.title =
                    errorMessage || 'Das Projekt konnte nicht gespeichert werden.';

                this._statusEl.classList.add('error');
                break;

            case 'idle':
            default:
                this._statusEl.textContent = '';
                this._statusEl.title = '';
                this._statusEl.classList.add('idle');
                break;
        }
    }

    updateUndoRedo(canUndo, canRedo) {
        if (this._undoBtn) {
            this._undoBtn.disabled = !canUndo;
        }

        if (this._redoBtn) {
            this._redoBtn.disabled = !canRedo;
        }
    }
}
