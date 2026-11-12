
import { ProjectSerializer } from './ProjectSerializer.js';


// ========================================
// Hilfsfunktion: Projekt-ID erzeugen
// ========================================

function generateProjectId() {

    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return crypto.randomUUID();
    }

    return `project-${Date.now()}-${Math.random()
        .toString(36).slice(2, 10)}`;
}


// ========================================
// ProjectManager
// ========================================

export class ProjectManager {

    /**
     * @param {object} library
     * @param {object} connectionManager
     * @param {import('../editor/GroupManager.js').GroupManager | null} [groupManager]
     */
    constructor(library, connectionManager, groupManager = null) {

        this.library = library;
        this.connectionManager = connectionManager;
        this.groupManager = groupManager;

        // Serializer für JSON-Import und -Export
        this.serializer = new ProjectSerializer();

        // Informationen zum aktuellen Projekt
        const now = new Date().toISOString();

        this.projectInfo = {
            id: generateProjectId(),
            name: 'Unbenanntes Projekt',
            createdAt: now,
            updatedAt: now
        };
    }


    // ========================================
    // 1. Neues Projekt erstellen
    // ========================================

    createNewProject(name = 'Neues Projekt') {

        // Aktuelles Modell entfernen
        this.library.clear();

        // Alle Verbindungen entfernen
        this.connectionManager.clear();

        // Alle Gruppen entfernen
        this.groupManager?.clear();

        const now = new Date().toISOString();

        // Neue Projektinformationen erstellen
        this.projectInfo = {
            id: generateProjectId(),
            name: name.trim() || 'Neues Projekt',
            createdAt: now,
            updatedAt: now
        };

        console.log('Neues Projekt erstellt:', this.projectInfo);

        return this.getProjectInfo();
    }


    // ========================================
    // 2. Projektinformationen abrufen
    // ========================================

    getProjectInfo() {

        return { ...this.projectInfo };
    }


    // ========================================
    // 3. Projekt umbenennen
    // ========================================

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

        this.projectInfo.updatedAt = new Date().toISOString();

        console.log(
            'Projekt umbenannt:',
            this.projectInfo.name
        );

        return this.getProjectInfo();
    }


    // ========================================
    // 4. Projekt in JSON umwandeln
    // ========================================

    getProjectJSON() {

        // Aktuelles Projekt aus Bauteilen und
        // Verbindungen zusammensetzen
        const projectData = this.serializer.createProject(
            this.library,
            this.connectionManager,
            this.projectInfo
        );

        // Aktualisierte Projektinformationen übernehmen
        this.projectInfo = {
            ...projectData.project
        };

        // Projekt als JSON-String zurückgeben
        return this.serializer.toJSON(projectData);
    }


    // ========================================
    // 5. Projekt als JSON-Datei exportieren
    // ========================================

    exportProject() {

        const json = this.getProjectJSON();

        // JSON in einen Blob umwandeln
        const blob = new Blob(
            [json],
            { type: 'application/json' }
        );

        // Temporäre Download-URL erstellen
        const url = URL.createObjectURL(blob);

        // Download-Link erstellen
        const link = document.createElement('a');

        // Dateinamen aus dem Projektnamen erzeugen
        const filename = this.projectInfo.name
            .replace(/[^a-z0-9_-]/gi, '_');

        link.href = url;
        link.download = `${filename}.json`;

        // Download auslösen
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // URL nach dem Download freigeben
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        console.log(
            'Projekt erfolgreich exportiert:',
            filename
        );

        return json;
    }


    // ========================================
    // 6. Projekt aus JSON laden
    // ========================================

    loadProjectJSON(jsonString) {

        // JSON einlesen und validieren
        const projectData = this.serializer.fromJSON(
            jsonString
        );

        // Projekt wiederherstellen (inkl. Gruppen falls vorhanden)
        const loadedProject = this.serializer.deserialize(
            projectData,
            this.library,
            this.connectionManager,
            this.groupManager
        );

        // Projektinformationen übernehmen
        this.projectInfo = {
            ...loadedProject
        };

        console.log(
            'Projekt erfolgreich geladen:',
            this.projectInfo
        );

        return this.getProjectInfo();
    }


    // ========================================
    // 7. JSON-Datei importieren
    // ========================================

    async importProjectFile(file) {

        if (!file) {
            throw new Error(
                'Es wurde keine Datei ausgewählt.'
            );
        }

        if (
            !file.name.toLowerCase().endsWith('.json')
        ) {
            throw new Error(
                'Bitte eine JSON-Datei auswählen.'
            );
        }

        try {

            // Dateiinhalt auslesen
            const jsonString = await file.text();

            // Projekt laden
            return this.loadProjectJSON(jsonString);

        } catch (error) {

            console.error(
                'Fehler beim Importieren:',
                error
            );

            throw error;
        }
    }

}
