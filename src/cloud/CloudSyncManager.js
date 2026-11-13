// =====================================================================
// CloudSyncManager – Phase 9.5
//
// Koordiniert die Synchronisierung zwischen lokalem ProjectManager
// und Cloud-Projekten.
//
// Ablauf (Speichern):
//   1. Lokales JSON vom ProjectManager holen
//   2. Online-Status prüfen
//   3. In der Cloud speichern (neu oder aktualisieren)
//   4. SyncStatusManager informieren
//
// Ablauf (Laden):
//   1. Cloud-Projekt laden
//   2. JSON an ProjectManager übergeben
//   3. SyncStatusManager informieren
//
// Konfliktbehandlung:
//   • Vor jedem Update wird die erwartete projectVersion mitgesendet.
//   • Weicht die Cloud-Version ab, wird CONFLICT gemeldet.
//   • Der Benutzer entscheidet: Überschreiben oder als neues Projekt
//     speichern.
// =====================================================================

import { CloudError, CloudErrorCodes } from './CloudService.js';
import { SyncStatus }                  from './SyncStatusManager.js';


export class CloudSyncManager {

    /**
     * @param {{
     *   projectManager:      import('../project/ProjectManager.js').ProjectManager
     *   cloudProjectManager: import('./CloudProjectManager.js').CloudProjectManager
     *   syncStatusManager:   import('./SyncStatusManager.js').SyncStatusManager
     *   authManager:         import('../auth/AuthManager.js').AuthManager
     *   cloudErrorHandler:   import('./CloudErrorHandler.js').CloudErrorHandler
     * }} options
     */
    constructor({
        projectManager,
        cloudProjectManager,
        syncStatusManager,
        authManager,
        cloudErrorHandler,
    }) {
        this._pm      = projectManager;
        this._cpm     = cloudProjectManager;
        this._status  = syncStatusManager;
        this._auth    = authManager;
        this._errors  = cloudErrorHandler;

        /** @type {string|null} */
        this._currentCloudProjectId = null;

        /** @type {number|null} */
        this._lastSyncedVersion = null;

        /** @type {boolean} */
        this._isDirty = false;
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /** ID des aktuell geöffneten Cloud-Projekts (null = lokal). */
    get currentCloudProjectId() { return this._currentCloudProjectId; }

    /** true, wenn lokale Änderungen noch nicht in der Cloud gespeichert sind. */
    get isDirty()               { return this._isDirty; }

    /** Letzte bekannte Cloud-Versionsnummer. */
    get lastSyncedVersion()     { return this._lastSyncedVersion; }


    /**
     * Lokales Projekt als unsynchronisiert markieren.
     * Wird von AutoSaveManager oder nach Änderungen aufgerufen.
     */
    markDirty() {
        this._isDirty = true;
        if (!this._status.isSyncing()) {
            this._status.setStatus(
                this._currentCloudProjectId
                    ? SyncStatus.MODIFIED
                    : SyncStatus.LOCAL_ONLY
            );
        }
    }


    /**
     * Aktuelles lokales Projekt in der Cloud speichern.
     * Falls kein Cloud-Projekt verknüpft ist, wird ein neues angelegt.
     *
     * @param {string} [cloudProjectId]  – Überschreibt currentCloudProjectId
     * @returns {Promise<CloudProject>}
     */
    async saveToCloud(cloudProjectId = this._currentCloudProjectId) {
        this._requireLogin();
        this._requireOnline();

        this._status.setStatus(SyncStatus.SYNCING);

        try {
            const json        = this._pm.getProjectJSON();
            const projectInfo = this._pm.getProjectInfo();

            let saved;

            if (cloudProjectId) {
                // Bestehendes Projekt aktualisieren
                saved = await this._cpm.saveProject(
                    cloudProjectId,
                    json,
                    this._lastSyncedVersion ?? undefined
                );
            } else {
                // Neues Cloud-Projekt anlegen
                saved = await this._cpm.createProject(projectInfo.name, json);
            }

            this._currentCloudProjectId = saved.id;
            this._lastSyncedVersion     = saved.projectVersion;
            this._isDirty               = false;
            this._status.setStatus(SyncStatus.SYNCED);

            return saved;

        } catch (error) {
            const entry = this._errors.handle(error, 'CloudSyncManager.saveToCloud');
            const nextStatus = this._errors.isConflictError(error)
                ? SyncStatus.CONFLICT
                : SyncStatus.ERROR;
            this._status.setStatus(nextStatus, { error: entry });
            throw error;
        }
    }


    /**
     * Cloud-Projekt laden und in den lokalen Editor übernehmen.
     * Gibt den geladenen JSON-String zurück, damit der Aufrufer
     * weitere Aufräumarbeiten (History reset, Panel-Updates) durchführen kann.
     *
     * @param {string} cloudProjectId
     * @returns {Promise<string>}  JSON-String
     */
    async loadFromCloud(cloudProjectId) {
        this._requireLogin();
        this._requireOnline();

        this._status.setStatus(SyncStatus.SYNCING);

        try {
            const cloudProject = await this._cpm.loadProject(cloudProjectId);
            const json         = JSON.stringify(cloudProject.data);

            // In lokalen ProjectManager laden
            this._pm.loadProjectJSON(json);

            this._currentCloudProjectId = cloudProjectId;
            this._lastSyncedVersion     = cloudProject.projectVersion;
            this._isDirty               = false;
            this._status.setStatus(SyncStatus.SYNCED);

            return json;

        } catch (error) {
            const entry = this._errors.handle(error, 'CloudSyncManager.loadFromCloud');
            this._status.setStatus(SyncStatus.ERROR, { error: entry });
            throw error;
        }
    }


    /**
     * Überprüfen, ob die lokal bekannte Version noch der Cloud-Version
     * entspricht.
     * @returns {Promise<boolean>} true = kein Konflikt
     */
    async checkVersion() {
        if (!this._currentCloudProjectId) return true;

        try {
            const cloud = await this._cpm.getProject(this._currentCloudProjectId);
            return cloud.projectVersion === this._lastSyncedVersion;
        } catch {
            return true;  // im Zweifel kein Konflikt annehmen
        }
    }


    /**
     * Synchronisierungszustand zurücksetzen.
     * Wird aufgerufen, wenn ein neues lokales Projekt erstellt wird.
     */
    reset() {
        this._currentCloudProjectId = null;
        this._lastSyncedVersion     = null;
        this._isDirty               = false;
        this._status.setStatus(SyncStatus.LOCAL_ONLY);
    }


    /**
     * Cloud-Verknüpfung setzen (z. B. nach einem außerhalb vorgenommenen
     * Cloud-Load).
     */
    setCloudProject(id, version) {
        this._currentCloudProjectId = id   ?? null;
        this._lastSyncedVersion     = version ?? null;
    }


    // ------------------------------------------------------------------
    // Private
    // ------------------------------------------------------------------

    _requireLogin() {
        if (!this._auth.isLoggedIn) {
            throw new CloudError('Nicht angemeldet.', 'AUTH');
        }
    }

    _requireOnline() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this._status.setStatus(SyncStatus.OFFLINE);
            throw new CloudError('Keine Internetverbindung.', 'OFFLINE');
        }
    }
}
