// =====================================================================
// SessionManager – Phase I.3
//
// Verwaltet den Sitzungszustand eines Benutzers und stellt dem Editor
// eine typisierte Schnittstelle für die Projektquelle bereit.
//
// Konzept Projektquelle (I.9):
//   Jedes geöffnete Projekt hat eine Quelle:
//     • "local"  – lokal gespeichertes Projekt, keine Cloud-Verknüpfung
//     • "cloud"  – Cloud-Projekt mit ID und Revision
//
// Der SessionManager verknüpft die Authentifizierung (AuthManager) mit
// dem Projektzustand (CloudSyncManager) zu einem einheitlichen Bild.
// =====================================================================


/**
 * Mögliche Projektquellen.
 * @enum {string}
 */
export const ProjectSource = Object.freeze({
    LOCAL: 'local',
    CLOUD: 'cloud',
});


export class SessionManager {

    /**
     * @param {{
     *   authManager:       import('../auth/AuthManager.js').AuthManager
     *   cloudSyncManager:  import('./CloudSyncManager.js').CloudSyncManager
     * }} options
     */
    constructor({ authManager, cloudSyncManager }) {
        if (!authManager)      throw new Error('SessionManager: authManager ist erforderlich.');
        if (!cloudSyncManager) throw new Error('SessionManager: cloudSyncManager ist erforderlich.');

        this._auth = authManager;
        this._sync = cloudSyncManager;
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /** true, wenn ein Benutzer angemeldet ist. */
    get isLoggedIn() { return this._auth.isLoggedIn; }

    /** Aktueller Benutzer oder null. */
    get currentUser() { return this._auth.currentUser; }


    /**
     * Aktueller Projektzustand als Quelle-Objekt.
     *
     * Für ein Cloud-Projekt:
     *   { source: "cloud", projectId: "uuid", revision: 5, dirty: false }
     *
     * Für ein lokales Projekt:
     *   { source: "local", projectId: null, revision: null, dirty: false }
     *
     * @returns {{ source: string, projectId: string|null, revision: number|null, dirty: boolean }}
     */
    get projectState() {
        const id = this._sync.currentCloudProjectId;
        return {
            source:    id ? ProjectSource.CLOUD : ProjectSource.LOCAL,
            projectId: id ?? null,
            revision:  this._sync.lastSyncedVersion ?? null,
            dirty:     this._sync.isDirty,
        };
    }


    /**
     * true, wenn das aktuelle Projekt aus der Cloud stammt.
     */
    get isCloudProject() {
        return this._sync.currentCloudProjectId !== null;
    }


    /**
     * true, wenn das aktuelle Projekt lokal ist (keine Cloud-Verknüpfung).
     */
    get isLocalProject() {
        return !this.isCloudProject;
    }


    /**
     * Prüft, ob ein Gerätewechsel sicher ist: kein Cloud-Projekt offen
     * oder keine ungespeicherten Änderungen.
     * @returns {boolean}
     */
    get canSafelyLeave() {
        if (!this.isCloudProject) return true;
        return !this._sync.isDirty;
    }


    /**
     * Sitzung wiederherstellen (nach Seiten-Reload).
     * Gibt den wiederhergestellten Benutzer zurück oder null.
     * @returns {Promise<{ id: string, email: string } | null>}
     */
    async restoreSession() {
        return await this._auth.restoreSession();
    }


    /**
     * Benutzer abmelden.
     * Setzt den Cloud-Synchronisierungszustand zurück.
     * Ein lokal geöffnetes Projekt bleibt erhalten.
     * @returns {Promise<void>}
     */
    async logout() {
        await this._auth.logout();
        this._sync.reset();
    }


    /**
     * Auf Authentifizierungsänderungen reagieren.
     * @param {(event: string, user: object|null) => void} callback
     * @returns {() => void} Unsubscribe-Funktion
     */
    subscribe(callback) {
        return this._auth.subscribe(callback);
    }
}
