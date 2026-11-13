
export class AutoSaveManager {

    static DEBOUNCE_MS = 500;

    constructor(projectManager, storage) {
        this.projectManager = projectManager;
        this.storage = storage;

        this.onStatusChange = null;

        this._debounceTimer = null;
        this._isRestoring = false;
    }

    setRestoring(value) {
        this._isRestoring = !!value;

        if (this._isRestoring) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }
    }

    scheduleSave() {
        if (this._isRestoring) {
            return;
        }

        clearTimeout(this._debounceTimer);

        this._setStatus('saving');

        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this.save();
        }, AutoSaveManager.DEBOUNCE_MS);
    }

    save() {
        if (this._isRestoring) {
            return false;
        }

        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;

        try {
            const json = this.projectManager.getProjectJSON();
            const projectData = JSON.parse(json);

            projectData.savedAt = new Date().toISOString();

            this.storage.save(projectData);

            this._setStatus(
                'saved',
                new Date(projectData.savedAt)   // Date-Objekt für die Toolbar
            );

            return true;

        } catch (error) {
            console.error('Automatisches Speichern fehlgeschlagen:', error);

            const isQuotaError =
                error?.name === 'QuotaExceededError' ||
                error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';

            this._setStatus(
                'error',
                null,
                isQuotaError
                    ? 'Nicht genügend Speicherplatz verfügbar.'
                    : error.message
            );

            return false;
        }
    }

    load() {
        try {
            return this.storage.load();
        } catch (error) {
            console.error('Gespeichertes Projekt konnte nicht geladen werden:', error);
            return null;
        }
    }

    hasSavedProject() {
        return this.storage.has();
    }

    deleteSavedProject() {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;

        this.storage.clear();
    }

    getLastSavedTime() {
        const project = this.load();

        return project?.savedAt ? new Date(project.savedAt) : null;
    }

    flush() {
        if (this._debounceTimer === null) {
            return false;
        }

        if (this._isRestoring) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
            return false;
        }

        return this.save();
    }

    _setStatus(status, time = null, errorMessage = null) {
        this.onStatusChange?.(
            status,
            time,
            errorMessage
        );
    }
}
