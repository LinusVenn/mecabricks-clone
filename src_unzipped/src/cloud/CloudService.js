// =====================================================================
// CloudService – Phase 9.1 (abstrakte Basisklasse)
//
// Definiert die einheitliche Schnittstelle für Cloud-Projektoperationen.
// Konkrete Implementierungen (z. B. SupabaseCloudService) erben von
// dieser Klasse.
//
// Datenmodell Cloud-Projekt:
// {
//   id:             string   (UUID)
//   ownerId:        string   (Benutzer-UUID)
//   name:           string
//   projectVersion: number   (optimistisches Locking – steigt mit jedem Update)
//   schemaVersion:  number   (Format-Version der Projektdaten)
//   data:           object   (Projektdaten aus ProjectManager.getProjectJSON())
//   createdAt:      string   (ISO 8601)
//   updatedAt:      string   (ISO 8601)
// }
// =====================================================================


/**
 * Fehlerklasse für Cloud-Operationsfehler.
 */
export class CloudError extends Error {
    /**
     * @param {string} message
     * @param {string} [code]
     * @param {object} [details]
     */
    constructor(message, code = 'UNKNOWN', details = {}) {
        super(message);
        this.name    = 'CloudError';
        this.code    = code;
        this.details = details;
    }
}


/**
 * Bekannte Fehlercodes für Cloud-Operationen.
 */
export const CloudErrorCodes = {
    NETWORK:       'NETWORK',
    AUTH:          'AUTH',
    NOT_FOUND:     'NOT_FOUND',
    FORBIDDEN:     'FORBIDDEN',
    CONFLICT:      'CONFLICT',     // projectVersion veraltet
    INVALID_DATA:  'INVALID_DATA',
    SERVER_ERROR:  'SERVER_ERROR',
    OFFLINE:       'OFFLINE',
    UNKNOWN:       'UNKNOWN',
};


/**
 * Abstrakte Basisklasse für Cloud-Datendienste.
 */
export class CloudService {

    /**
     * Alle Projekte des angemeldeten Benutzers laden.
     * @returns {Promise<CloudProject[]>}
     */
    async listProjects() {
        throw new Error('CloudService.listProjects ist nicht implementiert.');
    }

    /**
     * Ein einzelnes Projekt laden.
     * @param {string} id
     * @returns {Promise<CloudProject|null>}
     */
    async getProject(id) {
        throw new Error('CloudService.getProject ist nicht implementiert.');
    }

    /**
     * Neues Projekt anlegen.
     * @param {{ name: string, data: object, schemaVersion?: number }} options
     * @returns {Promise<CloudProject>}
     */
    async createProject(options) {
        throw new Error('CloudService.createProject ist nicht implementiert.');
    }

    /**
     * Bestehendes Projekt aktualisieren.
     * Wirft CloudError(CONFLICT), wenn expectedVersion !== aktuelle Version.
     * @param {string} id
     * @param {{ name?: string, data: object, expectedVersion?: number }} options
     * @returns {Promise<CloudProject>}
     */
    async updateProject(id, options) {
        throw new Error('CloudService.updateProject ist nicht implementiert.');
    }

    /**
     * Projekt löschen.
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteProject(id) {
        throw new Error('CloudService.deleteProject ist nicht implementiert.');
    }

    /**
     * ID des aktuell angemeldeten Benutzers.
     * @returns {string|null}
     */
    getCurrentUserId() {
        throw new Error('CloudService.getCurrentUserId ist nicht implementiert.');
    }
}


// ─────────────────────────────────────────────────────────────────────
// NullCloudService – Stub für den Fall, dass kein Anbieter konfiguriert
// ─────────────────────────────────────────────────────────────────────

const NULL_MSG = 'Cloud-Funktionen sind nicht konfiguriert.';

export class NullCloudService extends CloudService {
    async listProjects()           { throw new CloudError(NULL_MSG, CloudErrorCodes.UNKNOWN); }
    async getProject()             { throw new CloudError(NULL_MSG, CloudErrorCodes.UNKNOWN); }
    async createProject()          { throw new CloudError(NULL_MSG, CloudErrorCodes.UNKNOWN); }
    async updateProject()          { throw new CloudError(NULL_MSG, CloudErrorCodes.UNKNOWN); }
    async deleteProject()          { throw new CloudError(NULL_MSG, CloudErrorCodes.UNKNOWN); }
    getCurrentUserId()             { return null; }
}
