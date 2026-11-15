// =====================================================================
// CloudAPI – Phase I.6
//
// Öffentliche Fassade für alle Cloud-Operationen.
// Bündelt CloudProjectManager und CloudSyncManager hinter einer
// einzigen, stabilen API-Schicht.
//
// Ziel: Der Rest des Editors (Editor.js, main.js, UI-Panels) kommuniziert
// ausschließlich über CloudAPI mit dem Cloud-Backend.
// CloudAPI versteckt die interne Aufteilung in mehrere Manager.
//
// Architektur:
//   CloudAPI
//     ├── CloudProjectManager  (CRUD-Operationen)
//     └── CloudSyncManager     (Synchronisierung, Autosave, Konflikt)
// =====================================================================


export class CloudAPI {

    /**
     * @param {{
     *   cloudProjectManager: import('./CloudProjectManager.js').CloudProjectManager
     *   cloudSyncManager:    import('./CloudSyncManager.js').CloudSyncManager
     *   authManager:         import('../auth/AuthManager.js').AuthManager
     * }} options
     */
    constructor({ cloudProjectManager, cloudSyncManager, authManager }) {
        if (!cloudProjectManager) throw new Error('CloudAPI: cloudProjectManager ist erforderlich.');
        if (!cloudSyncManager)    throw new Error('CloudAPI: cloudSyncManager ist erforderlich.');
        if (!authManager)         throw new Error('CloudAPI: authManager ist erforderlich.');

        this._cpm  = cloudProjectManager;
        this._sync = cloudSyncManager;
        this._auth = authManager;
    }


    // ------------------------------------------------------------------
    // Authentifizierungsstatus
    // ------------------------------------------------------------------

    /** true, wenn ein Benutzer angemeldet ist. */
    get isLoggedIn() { return this._auth.isLoggedIn; }

    /** Aktueller Benutzer oder null. */
    get currentUser() { return this._auth.currentUser; }


    // ------------------------------------------------------------------
    // Projektliste
    // ------------------------------------------------------------------

    /**
     * Alle Cloud-Projekte des angemeldeten Benutzers laden.
     * @returns {Promise<CloudProject[]>}
     */
    async getProjects() {
        return await this._cpm.getAllProjects();
    }


    // ------------------------------------------------------------------
    // Projekt anlegen / laden / speichern / löschen
    // ------------------------------------------------------------------

    /**
     * Neues Cloud-Projekt aus dem aktuellen Editor-Zustand anlegen.
     * @param {string} name
     * @param {string} projectJson  – Ergebnis von ProjectManager.getProjectJSON()
     * @returns {Promise<CloudProject>}
     */
    async createProject(name, projectJson) {
        return await this._cpm.createProject(name, projectJson);
    }


    /**
     * Cloud-Projekt laden und in den Editor übernehmen.
     * Setzt die Cloud-Verknüpfung (ID + Revision) im SyncManager.
     * @param {string} id
     * @returns {Promise<string>}  – JSON-String des Projekts
     */
    async loadProject(id) {
        return await this._sync.loadFromCloud(id);
    }


    /**
     * Aktuellen Editor-Zustand in der Cloud speichern.
     * Verwendet automatisch die aktuelle Cloud-Projekt-ID falls gesetzt.
     * @param {string} [cloudProjectId]  – Optional: überschreibt die aktuell verknüpfte ID
     * @returns {Promise<CloudProject>}
     */
    async saveProject(cloudProjectId) {
        return await this._sync.saveToCloud(cloudProjectId);
    }


    /**
     * Cloud-Projekt umbenennen.
     * @param {string} id
     * @param {string} newName
     * @returns {Promise<CloudProject>}
     */
    async renameProject(id, newName) {
        return await this._cpm.renameProject(id, newName);
    }


    /**
     * Cloud-Projekt löschen.
     * @param {string} id
     */
    async deleteProject(id) {
        return await this._cpm.deleteProject(id);
    }


    // ------------------------------------------------------------------
    // Synchronisierungsstatus
    // ------------------------------------------------------------------

    /** ID des aktuell geöffneten Cloud-Projekts (null = lokal). */
    get currentCloudProjectId() { return this._sync.currentCloudProjectId; }

    /** true, wenn lokale Änderungen noch nicht in der Cloud gespeichert sind. */
    get isDirty() { return this._sync.isDirty; }

    /** Letzte bekannte Cloud-Revisionsnummer. */
    get lastSyncedVersion() { return this._sync.lastSyncedVersion; }


    /**
     * Änderungen als noch nicht synchronisiert markieren.
     * Löst ggf. einen verzögerten Autosave aus.
     */
    markDirty() {
        this._sync.markDirty();
    }


    /**
     * Synchronisierungszustand zurücksetzen (z. B. beim Abmelden oder neuem Projekt).
     */
    reset() {
        this._sync.reset();
    }


    /**
     * Autosave manuell planen (z. B. nach direkten Änderungen außerhalb des HistoryManagers).
     */
    scheduleAutoSave() {
        this._sync.scheduleAutoSave();
    }


    /**
     * Prüfen, ob die lokal bekannte Version noch der Cloud-Version entspricht.
     * @returns {Promise<boolean>} true = kein Konflikt
     */
    async checkVersion() {
        return await this._sync.checkVersion();
    }
}
