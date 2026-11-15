// =====================================================================
// CloudStorage – Phase 9.3
//
// Schlanke Datenzugriffsschicht über CloudService. Stellt einfache
// Methoden zum Speichern, Laden und Löschen von Projektdaten bereit.
//
// CloudProjectManager nutzt CloudStorage für alle Datenbankoperationen.
// =====================================================================

import { CloudError, CloudErrorCodes } from './CloudService.js';


export class CloudStorage {

    /**
     * @param {import('./CloudService.js').CloudService} cloudService
     */
    constructor(cloudService) {
        if (!cloudService) throw new Error('CloudStorage: cloudService ist erforderlich.');
        this._service = cloudService;
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /**
     * Alle Projekte des angemeldeten Benutzers auflisten.
     * @returns {Promise<CloudProject[]>}
     */
    async list() {
        return await this._service.listProjects();
    }


    /**
     * Ein einzelnes Projekt anhand seiner ID laden.
     * @param {string} id
     * @returns {Promise<CloudProject|null>}
     */
    async load(id) {
        if (!id) throw new CloudError('Keine Projekt-ID angegeben.', CloudErrorCodes.INVALID_DATA);
        return await this._service.getProject(id);
    }


    /**
     * Projektdaten speichern. Wenn id übergeben wird, wird das bestehende
     * Projekt aktualisiert; sonst wird ein neues angelegt.
     *
     * @param {string|null} id
     * @param {string|object} projectJson  – JSON-String oder Objekt
     * @param {number} [expectedVersion]   – für optimistisches Locking
     * @returns {Promise<CloudProject>}
     */
    async save(id, projectJson, expectedVersion) {
        const data = typeof projectJson === 'string'
            ? JSON.parse(projectJson)
            : projectJson;

        if (!data || typeof data !== 'object') {
            throw new CloudError('Ungültige Projektdaten.', CloudErrorCodes.INVALID_DATA);
        }

        if (id) {
            return await this._service.updateProject(id, {
                name:            data.name ?? data.projectInfo?.name ?? 'Projekt',
                data,
                expectedVersion,
            });
        }

        return await this._service.createProject({
            name:          data.name ?? data.projectInfo?.name ?? 'Neues Projekt',
            data,
            schemaVersion: data.version ?? data.schemaVersion ?? 1,
        });
    }


    /**
     * Projekt löschen.
     * @param {string} id
     */
    async delete(id) {
        if (!id) throw new CloudError('Keine Projekt-ID angegeben.', CloudErrorCodes.INVALID_DATA);
        return await this._service.deleteProject(id);
    }
}
