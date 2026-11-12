
import { SceneManager } from './scene/SceneManager.js';
import { addLighting } from './scene/Lighting.js';

import { PartLibrary } from './objects/PartLibrary.js';
import { Editor } from './editor/Editor.js';

import { ProjectManager } from './project/ProjectManager.js';
import { ProjectStorage } from './project/ProjectStorage.js';
import { AutoSaveManager } from './project/AutoSaveManager.js';
import { HistoryManager } from './history/HistoryManager.js';
import { ProjectToolbar } from './ui/ProjectToolbar.js';
import { GroupToolbar } from './ui/GroupToolbar.js';
import { PartLibraryUI } from './library/PartLibraryUI.js';


// ========================================
// 1. Szene initialisieren
// ========================================

const container = document.getElementById(
    'canvas-container'
);

const sceneManager = new SceneManager(container);

// Beleuchtung hinzufügen
addLighting(sceneManager.scene);


// ========================================
// 2. Bauteilbibliothek erstellen
// ========================================

const library = new PartLibrary(
    sceneManager.scene
);


// ========================================
// 3. Editor initialisieren
// ========================================

const editor = new Editor(
    sceneManager,
    library
);


// ========================================
// 4. ProjectManager initialisieren
// ========================================

const projectManager = new ProjectManager(
    library,
    editor.connectionManager,
    editor.groupManager       // Phase 6: Gruppen mitkopieren
);


// ========================================
// 5. HistoryManager initialisieren
//    (onChange wird NACH dem Startup gesetzt,
//     damit der initiale Zustand keinen
//     Speichervorgang auslöst)
// ========================================

const historyManager = new HistoryManager(
    library,
    editor.connectionManager,
    50,

    // Wird nach Undo und Redo aufgerufen
    () => {
        editor.selectionManager.clearSelection();
        editor.transformManager.detach();
        editor.multiSelectionManager.clearSelection();  // Phase 6
        editor.groupTransformManager.detach();          // Phase 6
    },

    // onChange wird unten gesetzt
    null,

    // Phase 6: Gruppen in Snapshots einschließen
    editor.groupManager
);


// ========================================
// 6. ProjectToolbar erstellen
// ========================================

// ProjectToolbar verwaltet alle Schaltflächen und Statusanzeigen
// im Header. Callbacks werden weiter unten verdrahtet.
const toolbar = new ProjectToolbar();


// ========================================
// 7. AutoSaveManager erstellen
// ========================================

// ProjectStorage kapselt den Zugriff auf localStorage.
// Beim späteren Wechsel auf IndexedDB wird nur diese eine
// Klasse ausgetauscht – AutoSaveManager und main.js bleiben unverändert.
const storage = new ProjectStorage();

const autoSaveManager = new AutoSaveManager(projectManager, storage);

// Status-Callback → ProjectToolbar delegiert an die DOM-Elemente
autoSaveManager.onStatusChange = (status, time, errorMessage) => {
    toolbar.updateSaveStatus(status, time, errorMessage);
};


// ========================================
// 7. Gespeichertes Projekt laden oder
//    Testbauteile hinzufügen
// ========================================

let projectLoaded = false;

if (autoSaveManager.hasSavedProject()) {

    const savedData = autoSaveManager.load();

    if (savedData) {

        try {

            // Schutzvariable setzen: Ladevorgänge sollen keinen
            // neuen Speichervorgang auslösen
            autoSaveManager.setRestoring(true);

            // Gespeicherte Daten als JSON-String übergeben
            projectManager.loadProjectJSON(
                JSON.stringify(savedData)
            );

            projectLoaded = true;

            // Letzten Speicherzeitpunkt anzeigen
            const lastSaved = autoSaveManager.getLastSavedTime();
            autoSaveManager.onStatusChange('saved', lastSaved);

            console.log(
                'Gespeichertes Projekt geladen:',
                projectManager.getProjectInfo()
            );

        } catch (error) {

            console.error(
                'Gespeichertes Projekt konnte nicht geladen werden:',
                error
            );

            alert(
                'Das gespeicherte Projekt konnte nicht geladen werden:\n' +
                error.message +
                '\n\nEin neues Projekt wird gestartet.'
            );

            // Ungültigen Speicherstand NICHT automatisch überschreiben –
            // Benutzer kann ihn über deleteSavedProject() in der Konsole löschen.

        } finally {

            autoSaveManager.setRestoring(false);

        }
    }
}

if (!projectLoaded) {

    // Testbauteile hinzufügen, wenn kein gespeichertes Projekt vorliegt.
    // Diese drei Beispiele kannst du durch deine bisherigen Bauteile ersetzen.
    library.addBrick(
        0, 0, 0,
        0xff0000,
        'brick_2x4'
    );

    library.addBrick(
        4, 0, 0,
        0x0000ff,
        'brick_2x2'
    );

    library.addBrick(
        0, 0, 3,
        0x00ff00,
        'brick_1x2'
    );
}


// ========================================
// 9. History nach dem Laden initialisieren
//    (so ist der geladene Zustand der
//     Ausgangspunkt – nicht ein leeres Modell)
// ========================================

historyManager.initialize();

// onChange erst NACH initialize() setzen, damit
// der initiale saveState() keinen Autosave auslöst.
historyManager.onChange = () => autoSaveManager.scheduleSave();


// ========================================
// 10. Bauteilbibliothek initialisieren
// ========================================

const partLibraryUI = new PartLibraryUI(
    document.getElementById('sidebar'),
    (partId) => {
        // Bauteil an den PlacementManager übergeben
        editor.placementManager.setSelectedPart(partId);
    }
);

window.partLibraryUI = partLibraryUI;

// onHistoryChange → Undo/Redo-Buttons in der Toolbar aktualisieren.
// Ebenfalls erst nach initialize() setzen.
historyManager.onHistoryChange = (canUndo, canRedo) => {
    toolbar.updateUndoRedo(canUndo, canRedo);
};

// HistoryManager mit Editor und Untermanagern verknüpfen
editor.historyManager                       = historyManager;
editor.placementManager.historyManager      = historyManager;
editor.transformManager.historyManager      = historyManager;
editor.groupTransformManager.historyManager = historyManager;   // Phase 6

// ========================================
// Phase 6: GroupToolbar initialisieren
// ========================================

const groupToolbar = new GroupToolbar();

// Toolbar-Callbacks von Editor empfangen
editor.onGroupUIUpdate = (count, groupName) => {
    groupToolbar.updateSelectionInfo(count, groupName);
};

groupToolbar.onGroup   = () => editor.groupSelected();
groupToolbar.onUngroup = () => editor.ungroupSelected();
groupToolbar.onCopy    = () => editor.copySelected();
groupToolbar.onDuplicate = () => editor.duplicateSelected();
groupToolbar.onDelete  = () => editor.deleteSelected();
groupToolbar.onPaste   = () => editor.pasteSelected();

// Einfügen-Button im rechten Toolbar
document.getElementById('tool-paste')
    ?.addEventListener('click', () => editor.pasteSelected());

window.groupToolbar = groupToolbar;

// Projektnamen in der Toolbar anzeigen
toolbar.updateProjectName(projectManager.getProjectInfo().name);


// ========================================
// 9. Seite schließen – ausstehenden
//    Speichervorgang abschließen
// ========================================

window.addEventListener('beforeunload', () => {
    autoSaveManager.flush();
});


// ========================================
// 10. Projekt exportieren
// ========================================

function exportProject() {

    try {

        projectManager.exportProject();

        console.log('Export abgeschlossen.');

    } catch (error) {

        console.error(
            'Export fehlgeschlagen:',
            error
        );

        alert(error.message);
    }
}


// ========================================
// 11. Neues Projekt erstellen
// ========================================

function createNewProject(name) {

    const confirmed = confirm(
        'Möchtest du wirklich ein neues Projekt erstellen? ' +
        'Alle aktuellen Bauteile gehen dabei verloren.'
    );

    if (!confirmed) return;

    // Ausstehenden Speichervorgang des alten Projekts abschließen
    autoSaveManager.flush();

    projectManager.createNewProject(name);

    editor.selectionManager.clearSelection();

    // History auf den neuen Projektzustand zurücksetzen.
    // clear() ruft saveState() → onChange → scheduleSave() auf.
    historyManager.clear();

    // Projektnamen in der Toolbar aktualisieren
    toolbar.updateProjectName(projectManager.getProjectInfo().name);

    console.log('Neues Projekt gestartet.');
}


// ========================================
// 12. Projekt umbenennen
// ========================================

function renameProject(name) {

    try {

        projectManager.renameProject(name);

        // Projektnamen sofort in der Toolbar aktualisieren
        toolbar.updateProjectName(projectManager.getProjectInfo().name);

        // Umbenennung autosaven
        autoSaveManager.scheduleSave();

        console.log(
            'Neuer Projektname:',
            projectManager.getProjectInfo().name
        );

    } catch (error) {

        console.error(error.message);

        alert(error.message);
    }
}


// ========================================
// 13. Projekt importieren (intern)
// ========================================

async function importProjectFile(file) {

    try {

        // Während des Imports keine Autosaves durch Nebeneffekte
        autoSaveManager.setRestoring(true);

        await projectManager.importProjectFile(file);

        autoSaveManager.setRestoring(false);

        // Eventuell ausgewählten Stein abwählen
        editor.selectionManager.clearSelection();

        // Importiertes Projekt als neuen Ausgangszustand speichern.
        // clear() → saveState() → onChange → scheduleSave()
        historyManager.clear();

        // Projektnamen in der Toolbar aktualisieren
        toolbar.updateProjectName(projectManager.getProjectInfo().name);

        console.log('Import abgeschlossen.');

    } catch (error) {

        autoSaveManager.setRestoring(false);

        console.error(
            'Import fehlgeschlagen:',
            error
        );

        alert(
            'Fehler beim Importieren: ' +
            error.message
        );
    }
}


// ========================================
// 14. Lokalen Speicherstand löschen
// ========================================

function deleteSavedProject() {

    const confirmed = confirm(
        'Möchtest du den lokalen Speicherstand wirklich löschen?\n' +
        'Das aktuell geöffnete Modell bleibt unverändert.'
    );

    if (!confirmed) return;

    autoSaveManager.deleteSavedProject();

    console.log('Lokaler Speicherstand gelöscht.');
}


// ========================================
// 15. Toolbar-Callbacks verdrahten
// ========================================

// Manuell speichern (sofort, ohne Debounce)
toolbar.onSave = () => autoSaveManager.save();

// Neues Projekt
toolbar.onNewProject = () => createNewProject();

// Export
toolbar.onExport = () => exportProject();

// Import – Datei wird von ProjectToolbar geöffnet,
// der File-Handler landet hier
toolbar.onImport = (file) => importProjectFile(file);

// Undo / Redo
toolbar.onUndo = () => historyManager.undo();
toolbar.onRedo = () => historyManager.redo();

// Umbenennen (ProjectToolbar fragt den neuen Namen ab)
toolbar.onRename = (name) => renameProject(name);


// ========================================
// 16. Funktionen für Browser-Konsole
// ========================================

window.projectManager     = projectManager;
window.historyManager     = historyManager;
window.autoSaveManager    = autoSaveManager;
window.storage            = storage;
window.toolbar            = toolbar;

window.exportProject      = exportProject;
window.createNewProject   = createNewProject;
window.renameProject      = renameProject;
window.deleteSavedProject = deleteSavedProject;


// ========================================
// 17. Tastaturkürzel
// ========================================

window.addEventListener('keydown', (event) => {

    // Keine Shortcuts aus Eingabefeldern ausführen
    const target = event.target;

    if (
        target instanceof HTMLElement &&
        (
            target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        )
    ) {
        return;
    }

    // Strg + S bzw. Cmd + S → Manuell speichern
    if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 's'
    ) {
        event.preventDefault();
        autoSaveManager.save();
        return;
    }

    // Strg + Z bzw. Cmd + Z → Undo
    if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z'
    ) {
        event.preventDefault();
        historyManager.undo();
        return;
    }

    // Strg + Y bzw. Cmd + Shift + Z → Redo
    if (
        (event.ctrlKey || event.metaKey) &&
        (
            event.key.toLowerCase() === 'y' ||
            (event.shiftKey && event.key.toLowerCase() === 'z')
        )
    ) {
        event.preventDefault();
        historyManager.redo();
    }

});


// ========================================
// 18. Projektstart
// ========================================

console.log(
    'Mecabricks-Clone erfolgreich gestartet!'
);

console.log(
    'Aktuelles Projekt:',
    projectManager.getProjectInfo()
);
