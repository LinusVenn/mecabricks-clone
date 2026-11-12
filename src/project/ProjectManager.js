import { ProjectSerializer } from './ProjectSerializer.js';

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

        this.projectInfo = {
            name: 'Neues Projekt',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };
    }

    createNewProject(name = 'Neues Projekt') {
        this.library.clear();
        this.connectionManager.clear();
        this.groupManager?.clear();
        this.componentLibrary?.clear();

        this.projectInfo = {
            name,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };

        return this.projectInfo;
    }

    getProjectInfo() {
        return { ...this.projectInfo };
    }

    renameProject(newName) {
        if (!newName || !newName.trim()) {
            throw new Error('Der Projektname darf nicht leer sein.');
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

    loadProjectJSON(jsonString) {
        if (typeof jsonString !== 'string') {
            throw new Error('Ungültiges Projektformat.');
        }

        const data = this.serializer.fromJSON(jsonString);

        const project = this.serializer.deserialize(
            data,
            this.library,
            this.connectionManager,
            this.groupManager,
            this.componentLibrary
        );

        if (project) {
            this.projectInfo = {
                id: project.id,
                name: project.name,
                createdAt: project.createdAt,
                modifiedAt: project.updatedAt
            };
        }

        return this.projectInfo;
    }

    async importProjectFile(file) {
        if (!file) {
            throw new Error('Keine Datei ausgewählt.');
        }

        if (!file.name.toLowerCase().endsWith('.json')) {
            throw new Error(
                'Es können nur JSON-Projektdateien importiert werden.'
            );
        }

        const jsonString = await file.text();

        return this.loadProjectJSON(jsonString);
    }
}