// =====================================================================
// CloudProjectManager – Phase 9.3
//
// Geschäftslogik für benutzerbezogene Cloud-Projekte.
// Stellt die in Phase 9 vorgesehenen Operationen bereit:
//   createProject, saveProject, loadProject,
//   getAllProjects, renameProject, deleteProject
//
// Nutzt CloudStorage für den eigentlichen Datenzugriff und ergänzt
// Validierung, Serialisierung und Fehlerpräzisierung.
// =====================================================================

import { CloudError, CloudErrorCodes } from './CloudService.js';
import { CloudStorage }                from './CloudStorage.js';


export class CloudProjectManager {

    /**
     * @param {import('./CloudService.js').CloudService} cloudService
     */
    constructor(cloudService) {
        if (!cloudService) throw new Error('CloudProjectManager: cloudService ist erforderlich.');
        this._storage = new CloudStorage(cloudService);
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /**
     * Alle Cloud-Projekte des Benutzers laden.
     * @returns {Promise<CloudProject[]>}
     */
    async getAllProjects() {
        return await this._storage.list();
    }


    /**
     * Metadaten eines einzelnen Projekts laden.
     * @param {string} id
     * @returns {Promise<CloudProject>}
     */
    async getProject(id) {
        const project = await this._storage.load(id);
        if (!project) {
            throw new CloudError(`Projekt "${id}" nicht gefunden.`, CloudErrorCodes.NOT_FOUND);
        }
        return project;
    }


    /**
     * Neues Cloud-Projekt aus einem ProjectManager-JSON-String anlegen.
     * @param {string} name
     * @param {string} projectJson
     * @returns {Promise<CloudProject>}
     */
    async createProject(name, projectJson) {
        this._validateName(name);
        this._validateJson(projectJson);

        const data = JSON.parse(projectJson);
        return await this._storage.save(null, { ...data, name });
    }


    /**
     * Bestehendes Cloud-Projekt aktualisieren.
     * Wirft CloudError(CONFLICT), wenn die Version veraltet ist.
     * @param {string} id
     * @param {string} projectJson
     * @param {number} [expectedVersion]
     * @returns {Promise<CloudProject>}
     */
    async saveProject(id, projectJson, expectedVersion) {
        if (!id) throw new CloudError('Keine Projekt-ID.', CloudErrorCodes.INVALID_DATA);
        this._validateJson(projectJson);

        return await this._storage.save(id, projectJson, expectedVersion);
    }


    /**
     * Cloud-Projekt laden (inklusive Datenteil).
     * @param {string} id
     * @returns {Promise<CloudProject>}
     */
    async loadProject(id) {
        return await this.getProject(id);
    }


    /**
     * Cloud-Projekt umbenennen.
     * @param {string} id
     * @param {string} newName
     * @returns {Promise<CloudProject>}
     */
    async renameProject(id, newName) {
        this._validateName(newName);
        const current = await this.getProject(id);

        return await this._storage.save(id, {
            ...current.data,
            name: newName,
        }, current.projectVersion);
    }


    /**
     * Cloud-Projekt löschen.
     * @param {string} id
     */
    async deleteProject(id) {
        if (!id) throw new CloudError('Keine Projekt-ID.', CloudErrorCodes.INVALID_DATA);
        return await this._storage.delete(id);
    }


    // ------------------------------------------------------------------
    // Validierung
    // ------------------------------------------------------------------

    _validateName(name) {
        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new CloudError('Der Projektname darf nicht leer sein.', CloudErrorCodes.INVALID_DATA);
        }
    }

    _validateJson(json) {
        if (!json || typeof json !== 'string') {
            throw new CloudError('Ungültige Projektdaten (kein JSON-String).', CloudErrorCodes.INVALID_DATA);
        }
        try {
            const parsed = JSON.parse(json);
            if (!parsed || typeof parsed !== 'object') throw new Error();
        } catch {
            throw new CloudError('Projektdaten sind kein gültiges JSON.', CloudErrorCodes.INVALID_DATA);
        }
    }
}
