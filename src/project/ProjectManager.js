
import { ProjectSerializer } from './ProjectSerializer.js';

function _generateProjectId() {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class ProjectManager {

    constructor(
        library,
        connectionManager,
        groupManager = null,
        componentLibrary = null
    ) {
        this.library = library;
        this.connectionManager = connectionManager;
        this.groupManager = groupManager;
        this.componentLibrary = componentLibrary;

        this.serializer = new ProjectSerializer();

        const now = new Date().toISOString();

        this.projectInfo = {
            id: _generateProjectId(),
            name: 'Neues Projekt',
            createdAt: now,
            updatedAt: now,
            modifiedAt: now
        };
    }

    createNewProject(name = 'Neues Projekt') {
        this.library.clear();
        this.connectionManager.clear();
        this.groupManager?.clear();
        this.componentLibrary?.clear();

        const trimmed = (
            typeof name === 'string'
        ) ? name.trim() : '';

        const now = new Date().toISOString();

        this.projectInfo = {
            id: _generateProjectId(),
            name: trimmed || 'Neues Projekt',
            createdAt: now,
            updatedAt: now,
            modifiedAt: now
        };

        return this.projectInfo;
    }

    getProjectInfo() {
        return { ...this.projectInfo };
    }

    renameProject(newName) {
        if (
            typeof newName !== 'string' ||
            !newName.trim()
        ) {
            throw new Error(
                'Der Projektname darf nicht leer sein.'
            );
        }

        this.projectInfo.name = newName.trim();
        this.projectInfo.modifiedAt = new Date().toISOString();

        return this.projectInfo;
    }

    getProjectJSON() {
        this.projectInfo.modifiedAt = new Date().toISOString();

        return this.serializer.serialize(
            this.library,
            this.connectionManager,
            this.projectInfo,
            this.groupManager,
            this.componentLibrary
        );
    }

    exportProject() {
        const json = this.getProjectJSON();

        const blob = new Blob(
            [json],
            { type: 'application/json' }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;

        link.download =
            `${this.projectInfo.name.replace(/[^a-z0-9_-]/gi, '_')}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        return json;
    }

    /**
     * Lädt ein Projekt aus einem JSON-String.
     *
     * Die Projektinformationen werden erst aktualisiert,
     * wenn das Deserialisieren vollständig erfolgreich war.
     */
    loadProjectJSON(jsonString) {
        if (typeof jsonString !== 'string') {
            throw new Error('Ungültiges Projektformat.');
        }

        // JSON parsen und validieren, ohne den aktuellen
        // Projektzustand zu verändern.
        const data = this.serializer.fromJSON(jsonString);

        // Die Deserialisierung ist transaktional.
        const project = this.serializer.deserialize(
            data,
            this.library,
            this.connectionManager,
            this.groupManager,
            this.componentLibrary
        );

        // Erst nach erfolgreichem Laden übernehmen.
        if (project) {
            const now = new Date().toISOString();

            this.projectInfo = {
                id: project.id,
                name: project.name,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                modifiedAt: project.updatedAt || now
            };
        }

        return this.getProjectInfo();
    }

    /**
     * Importiert eine JSON-Projektdatei.
     */
    async importProjectFile(file) {
        if (!file) {
            throw new Error('Keine Datei ausgewählt.');
        }

        if (
            typeof file.name !== 'string' ||
            !file.name.toLowerCase().endsWith('.json')
        ) {
            throw new Error(
                'Es können nur JSON-Projektdateien importiert werden.'
            );
        }

        if (typeof file.text !== 'function') {
            throw new Error(
                'Die ausgewählte Datei kann nicht gelesen werden.'
            );
        }

        let jsonString;

        try {
            jsonString = await file.text();
        } catch {
            throw new Error(
                'Die Projektdatei konnte nicht gelesen werden.'
            );
        }

        return this.loadProjectJSON(jsonString);
    }
}
