
import { SceneManager } from './scene/SceneManager.js';

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
// Phase 7: Rendering
// ========================================

import { RenderSettings } from './rendering/RenderSettings.js';
import { RenderManager } from './rendering/RenderManager.js';
import { LightingManager } from './rendering/LightingManager.js';
import { ShadowManager } from './rendering/ShadowManager.js';
import { EnvironmentManager } from './rendering/EnvironmentManager.js';

// ========================================
// Phase 7: Materialien
// ========================================

import { MaterialLibrary } from './materials/MaterialLibrary.js';
import { MaterialManager } from './materials/MaterialManager.js';

// ========================================
// Phase 7: UI
// ========================================

import { MaterialPanel } from './ui/MaterialPanel.js';
import { LightingPanel } from './ui/LightingPanel.js';
import { RenderPanel } from './ui/RenderPanel.js';


// ========================================
// 1. Szene initialisieren
// ========================================

const container = document.getElementById(
    'canvas-container'
);

if (!container) {
    throw new Error(
        'Das Element #canvas-container wurde nicht gefunden.'
    );
}

const sceneManager = new SceneManager(container);


// ========================================
// Phase 7: Render-Einstellungen
// ========================================

const renderSettings = sceneManager.renderSettings;


// Der vorhandene SceneManager-Renderer wird weiterverwendet.
// Es wird ausdrücklich kein zweiter Renderer erzeugt.

const renderer = sceneManager.renderer;
const camera = sceneManager.camera;

if (!renderer) {
    throw new Error(
        'SceneManager stellt keinen Renderer über sceneManager.renderer bereit.'
    );
}

if (!camera) {
    throw new Error(
        'SceneManager stellt keine Kamera über sceneManager.camera bereit.'
    );
}


// RenderManager übernimmt die Konfiguration und Größenanpassung.
// Die bestehende Render-Schleife des SceneManagers bleibt erhalten.

const renderManager = sceneManager.renderManager;


// ========================================
// 2. Beleuchtung initialisieren
// Phase 7 ersetzt addLighting()
// ========================================

const lightingManager = sceneManager.lightingManager;


// ========================================
// 3. Schatten initialisieren
// ========================================

const shadowManager = sceneManager.shadowManager;


// ========================================
// 4. Studio-Umgebung initialisieren
// ========================================

const environmentManager = sceneManager.environmaneManager;




// ========================================
// 5. Materialsystem initialisieren
// ========================================

const materialLibrary = new MaterialLibrary();

const materialManager = new MaterialManager({
    library: materialLibrary
});


// ========================================
// 6. Bauteilbibliothek erstellen
// ========================================

const library = new PartLibrary(
    sceneManager.scene
);


// ========================================
// 7. Editor initialisieren
// ========================================

const editor = new Editor(
    sceneManager,
    library
);


// ========================================
// 8. ProjectManager initialisieren
// ========================================

const projectManager = new ProjectManager(
    library,
    editor.connectionManager,
    editor.groupManager
);


// ========================================
// 9. HistoryManager initialisieren
// ========================================

const historyManager = new HistoryManager(
    library,
    editor.connectionManager,
    50,

    // Wird nach Undo und Redo aufgerufen
    () => {

        editor.selectionManager.clearSelection();

        editor.transformManager.detach();

        editor.multiSelectionManager.clearSelection();

        editor.groupTransformManager.detach();

    },

    null,

    // Phase 6: Gruppen in Snapshots einschließen
    editor.groupManager
);


// ========================================
// 10. ProjectToolbar erstellen
// ========================================

const toolbar = new ProjectToolbar();


// ========================================
// 11. AutoSaveManager erstellen
// ========================================

const storage = new ProjectStorage();

const autoSaveManager = new AutoSaveManager(
    projectManager,
    storage
);

autoSaveManager.onStatusChange = (
    status,
    time,
    errorMessage
) => {

    toolbar.updateSaveStatus(
        status,
        time,
        errorMessage
    );

};


// ========================================
// 12. Gespeichertes Projekt laden
// ========================================

let projectLoaded = false;

if (autoSaveManager.hasSavedProject()) {

    const savedData = autoSaveManager.load();

    if (savedData) {

        try {

            autoSaveManager.setRestoring(true);

            projectManager.loadProjectJSON(
                JSON.stringify(savedData)
            );

            projectLoaded = true;

            const lastSaved =
                autoSaveManager.getLastSavedTime();

            autoSaveManager.onStatusChange(
                'saved',
                lastSaved
            );

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

        } finally {

            autoSaveManager.setRestoring(false);

        }
    }
}


// ========================================
// 13. Testbauteile hinzufügen
// ========================================

if (!projectLoaded) {

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
// Phase 7: Schatten auf Szene anwenden
// ========================================

// Bereits vorhandene Bauteile erhalten Schatten.

shadowManager.applyToScene(
    sceneManager.scene,
    {
        cast: true,
        receive: true
    }
);


// ========================================
// 14. History initialisieren
// ========================================

historyManager.initialize();

historyManager.onChange = () => {
    autoSaveManager.scheduleSave();
};


// ========================================
// 15. Bauteilbibliothek initialisieren
// ========================================

const partLibraryUI = new PartLibraryUI(
    document.getElementById('sidebar'),
    (partId) => {

        editor.placementManager.setSelectedPart(
            partId
        );

    }
);

window.partLibraryUI = partLibraryUI;


// ========================================
// 16. History-Buttons aktualisieren
// ========================================

historyManager.onHistoryChange = (
    canUndo,
    canRedo
) => {

    toolbar.updateUndoRedo(
        canUndo,
        canRedo
    );

};


// ========================================
// 17. HistoryManager mit Editor verbinden
// ========================================

editor.historyManager = historyManager;

editor.placementManager.historyManager =
    historyManager;

editor.transformManager.historyManager =
    historyManager;

editor.groupTransformManager.historyManager =
    historyManager;


// ========================================
// 18. GroupToolbar initialisieren
// ========================================

const groupToolbar = new GroupToolbar();

editor.onGroupUIUpdate = (
    count,
    groupName
) => {

    groupToolbar.updateSelectionInfo(
        count,
        groupName
    );

};

groupToolbar.onGroup = () =>
    editor.groupSelected();

groupToolbar.onUngroup = () =>
    editor.ungroupSelected();

groupToolbar.onCopy = () =>
    editor.copySelected();

groupToolbar.onDuplicate = () =>
    editor.duplicateSelected();

groupToolbar.onDelete = () =>
    editor.deleteSelected();

groupToolbar.onPaste = () =>
    editor.pasteSelected();


document.getElementById('tool-paste')
    ?.addEventListener('click', () => {

        editor.pasteSelected();

    });

window.groupToolbar = groupToolbar;


// ========================================
// 19. Phase 7: UI-Container erstellen
// ========================================

// Die neuen Panels werden in der Sidebar untergebracht.
// Die bestehende PartLibraryUI wird nicht verändert.

const sidebar = document.getElementById('sidebar');

if (!sidebar) {
    throw new Error(
        'Das Element #sidebar wurde nicht gefunden.'
    );
}


function createPhase7PanelContainer(id) {

    let element = document.getElementById(id);

    if (!element) {

        element = document.createElement('div');

        element.id = id;

        element.className = 'phase7-panel-container';

        sidebar.appendChild(element);

    }

    return element;
}


const materialPanelContainer =
    createPhase7PanelContainer('material-panel');

const lightingPanelContainer =
    createPhase7PanelContainer('lighting-panel');

const renderPanelContainer =
    createPhase7PanelContainer('render-panel');


// ========================================
// 20. Phase 7: MaterialPanel
// ========================================

const materialPanel = new MaterialPanel(
    materialPanelContainer,
    materialManager,
    {
        onApplied: ({ preset, meshCount }) => {

            console.log(
                `Material ${preset} auf ${meshCount} Mesh(es) angewendet.`
            );

            // Materialänderungen als Projektänderung behandeln.
            autoSaveManager.scheduleSave();

        }
    }
);


// ========================================
// 21. Phase 7: LightingPanel
// ========================================

const lightingPanel = new LightingPanel(
    lightingPanelContainer,
    lightingManager
);


// ========================================
// 22. Phase 7: RenderPanel
// ========================================

const renderPanel = new RenderPanel(
    renderPanelContainer,
    renderSettings
);


// ========================================
// 23. Projektnamen anzeigen
// ========================================

toolbar.updateProjectName(
    projectManager.getProjectInfo().name
);


// ========================================
// 24. Seite schließen
// ========================================

window.addEventListener('beforeunload', () => {

    autoSaveManager.flush();

});


// ========================================
// 25. Projekt exportieren
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
// 26. Neues Projekt erstellen
// ========================================

function createNewProject(name) {

    const confirmed = confirm(
        'Möchtest du wirklich ein neues Projekt erstellen? ' +
        'Alle aktuellen Bauteile gehen dabei verloren.'
    );

    if (!confirmed) return;

    autoSaveManager.flush();

    projectManager.createNewProject(name);

    editor.selectionManager.clearSelection();

    historyManager.clear();

    toolbar.updateProjectName(
        projectManager.getProjectInfo().name
    );

    // Nach dem Erstellen eines neuen Projekts
    // Schatten auf die aktuelle Szene anwenden.

    shadowManager.applyToScene(
        sceneManager.scene
    );

    console.log('Neues Projekt gestartet.');

}


// ========================================
// 27. Projekt umbenennen
// ========================================

function renameProject(name) {

    try {

        projectManager.renameProject(name);

        toolbar.updateProjectName(
            projectManager.getProjectInfo().name
        );

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
// 28. Projekt importieren
// ========================================

async function importProjectFile(file) {

    try {

        autoSaveManager.setRestoring(true);

        await projectManager.importProjectFile(file);

        autoSaveManager.setRestoring(false);

        editor.selectionManager.clearSelection();

        historyManager.clear();

        toolbar.updateProjectName(
            projectManager.getProjectInfo().name
        );

        // Phase 7: Schatten auf importierte Objekte anwenden.

        shadowManager.applyToScene(
            sceneManager.scene
        );

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
// 29. Lokalen Speicherstand löschen
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
// 30. Toolbar-Callbacks
// ========================================

toolbar.onSave = () => {
    autoSaveManager.save();
};

toolbar.onNewProject = () => {
    createNewProject();
};

toolbar.onExport = () => {
    exportProject();
};

toolbar.onImport = (file) => {
    importProjectFile(file);
};

toolbar.onUndo = () => {
    historyManager.undo();
};

toolbar.onRedo = () => {
    historyManager.redo();
};

toolbar.onRename = (name) => {
    renameProject(name);
};


// ========================================
// 31. Phase 7: Material auf Auswahl anwenden
// ========================================

// Diese Funktion kann vom SelectionManager aufgerufen werden,
// sobald sich die aktuelle Auswahl ändert.
//
// Die konkrete Auswahl-API des SelectionManagers ist hier
// bewusst nicht vorausgesetzt.

function setMaterialPanelTarget(selectedObject) {

    materialPanel.setTarget(selectedObject);

}


// ========================================
// 32. Funktionen für Browser-Konsole
// ========================================

window.projectManager = projectManager;

window.historyManager = historyManager;

window.autoSaveManager = autoSaveManager;

window.storage = storage;

window.toolbar = toolbar;

window.exportProject = exportProject;

window.createNewProject = createNewProject;

window.renameProject = renameProject;

window.deleteSavedProject = deleteSavedProject;


// ========================================
// Phase 7: Manager global verfügbar machen
// ========================================

window.renderManager = renderManager;

window.renderSettings = renderSettings;

window.lightingManager = lightingManager;

window.shadowManager = shadowManager;

window.environmentManager = environmentManager;

window.materialLibrary = materialLibrary;

window.materialManager = materialManager;

window.materialPanel = materialPanel;

window.lightingPanel = lightingPanel;

window.renderPanel = renderPanel;

window.setMaterialPanelTarget = setMaterialPanelTarget;


// ========================================
// 33. Tastaturkürzel
// ========================================

window.addEventListener('keydown', (event) => {

    const target = event.target;

    // Keine Shortcuts aus Eingabefeldern ausführen.

    if (
        target instanceof HTMLElement &&
        (
            target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
        )
    ) {
        return;
    }


    // Strg + S / Cmd + S → Speichern

    if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 's'
    ) {

        event.preventDefault();

        autoSaveManager.save();

        return;
    }


    // Strg + Z / Cmd + Z → Undo

    if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'z'
    ) {

        event.preventDefault();

        historyManager.undo();

        return;
    }


    // Strg + Y / Cmd + Shift + Z → Redo

    if (
        (event.ctrlKey || event.metaKey) &&
        (
            event.key.toLowerCase() === 'y' ||
            (
                event.shiftKey &&
                event.key.toLowerCase() === 'z'
            )
        )
    ) {

        event.preventDefault();

        historyManager.redo();

    }

});


// ========================================
// 34. Projektstart
// ========================================

console.log(
    'Mecabricks-Clone erfolgreich gestartet!'
);

console.log(
    'Aktuelles Projekt:',
    projectManager.getProjectInfo()
);

console.log(
    'Phase 7: Rendering und Materialien initialisiert.'
);
