
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

// Phase 7: Materialien und Rendering
import { MaterialLibrary } from './materials/MaterialLibrary.js';
import { MaterialManager } from './materials/MaterialManager.js';

import { MaterialPanel } from './ui/MaterialPanel.js';
import { LightingPanel } from './ui/LightingPanel.js';
import { RenderPanel } from './ui/RenderPanel.js';

// Phase 8.1: Objektverwaltung
import { OutlinerManager } from './hierarchy/OutlinerManager.js';
import { OutlinerPanel } from './ui/OutlinerPanel.js';

// Phase 8.2: Transformationen
import { TransformPanel } from './ui/TransformPanel.js';

// Phase 8.4: Erweiterte Auswahl und Isolation
import { SelectionFilter } from './selection/SelectionFilter.js';
import { AdvancedSelectionManager } from './selection/AdvancedSelectionManager.js';
import { IsolationManager } from './selection/IsolationManager.js';
import { SelectionPanel } from './ui/SelectionPanel.js';

// Phase 8.5: Präzisionswerkzeuge
import { PrecisionPanel } from './ui/PrecisionPanel.js';

// Phase 8.6: Baugruppenbibliothek
import { initializeComponentLibraryPhase86 }
    from './component-library/initializeComponentLibraryPhase86.js';

// Phase 8.7: Modellprüfung
import { initializeModelValidationPhase87 }
    from './validation/initializeModelValidationPhase87.js';

// Phase 8.8: Performanceoptimierung
import { initializePerformancePhase88 }
    from './performance/initializePerformancePhase88.js';

// Phase 8.9: Gesamtintegration
import { EditorPanelManager }    from './ui/EditorPanelManager.js';
import { EditorShortcutManager } from './ui/EditorShortcutManager.js';
import { EditorErrorHandler }    from './core/EditorErrorHandler.js';

// Phase 9: Benutzerkonten und Cloud-Speicherung
import { initializeCloudPhase9 } from './cloud/initializeCloudPhase9.js';


// ======================================================
// 1. DOM-CONTAINER
// ======================================================

const container = document.getElementById('canvas-container');
const sidebar = document.getElementById('sidebar');

if (!container) {
    throw new Error('Canvas-Container wurde nicht gefunden.');
}

if (!sidebar) {
    throw new Error('Sidebar wurde nicht gefunden.');
}


// ======================================================
// 2. SZENE UND RENDERING
// ======================================================

const sceneManager = new SceneManager(container);

const renderManager = sceneManager.renderManager;
const renderSettings = sceneManager.renderSettings;
const lightingManager = sceneManager.lightingManager;
const shadowManager = sceneManager.shadowManager;
const environmentManager = sceneManager.environmentManager;

if (
    !renderManager ||
    !renderSettings ||
    !lightingManager ||
    !shadowManager ||
    !environmentManager
) {
    throw new Error(
        'Die Phase-7-Manager wurden nicht vollständig initialisiert.'
    );
}


// ======================================================
// 3. BAUTEILBIBLIOTHEK UND EDITOR
// ======================================================

const library = new PartLibrary(sceneManager.scene);
const editor = new Editor(sceneManager, library);

const groupManager = editor.groupManager;

// Phase 8.3
const assemblyManager = editor.assemblyManager;
const componentLibrary = editor.componentLibrary;
const componentManager = editor.componentManager;

if (!assemblyManager || !componentLibrary || !componentManager) {
    throw new Error(
        'Die Phase-8.3-Komponenten wurden im Editor nicht vollständig initialisiert.'
    );
}

editor.placementManager.editor = editor;

if (!editor.transformInputManager || !editor.transformGizmo) {
    throw new Error(
        'Die Phase-8.2-Transformationskomponenten wurden nicht vollständig initialisiert.'
    );
}

// Phase 8.5: PrecisionManager prüfen
if (!editor.precisionManager) {
    throw new Error(
        'Der PrecisionManager wurde im Editor nicht initialisiert. ' +
        'Bitte überprüfe die Integration in Editor.js.'
    );
}


// ======================================================
// 4. PROJEKTVERWALTUNG UND AUTOSAVE
// ======================================================

const projectStorage = new ProjectStorage();

const projectManager = new ProjectManager(
    library,
    editor.connectionManager,
    groupManager,
    componentLibrary
);

const autoSaveManager = new AutoSaveManager(
    projectManager,
    projectStorage
);


// ======================================================
// 5. UI-HILFSFUNKTIONEN
// ======================================================

function createPanelContainer(id, title) {
    let element = document.getElementById(id);

    if (!element) {
        element = document.createElement('div');
        element.id = id;
        element.className = 'phase-panel-container';

        const heading = document.createElement('h3');
        heading.textContent = title;

        element.appendChild(heading);
        sidebar.appendChild(element);
    }

    return element;
}

function createButton(parent, text, onClick) {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', onClick);

    parent.appendChild(button);

    return button;
}

function createNumberInput(parent, labelText, defaultValue = 0) {
    const wrapper = document.createElement('label');

    wrapper.style.display = 'inline-flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '4px';
    wrapper.style.marginRight = '8px';

    const label = document.createElement('span');
    label.textContent = labelText;

    const input = document.createElement('input');

    input.type = 'number';
    input.step = '0.5';
    input.value = String(defaultValue);

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    parent.appendChild(wrapper);

    return input;
}


// ======================================================
// 6. MATERIALVERWALTUNG – PHASE 7
// ======================================================

const materialLibrary = new MaterialLibrary();

const materialManager = new MaterialManager({
    library: materialLibrary
});

const materialPanelContainer = createPanelContainer(
    'material-panel-container',
    'Materialien'
);

const materialPanel = new MaterialPanel(
    materialPanelContainer,
    materialManager,
    {
        onApplied: ({ preset, meshCount }) => {
            console.log(
                `Material ${preset} auf ${meshCount} Meshes angewendet.`
            );

            autoSaveManager.scheduleSave();
        }
    }
);


// ======================================================
// 7. LIGHTING-PANEL
// ======================================================

const lightingPanelContainer = createPanelContainer(
    'lighting-panel-container',
    'Beleuchtung'
);

const lightingPanel = new LightingPanel(
    lightingPanelContainer,
    lightingManager
);


// ======================================================
// 8. RENDER-PANEL
// ======================================================

const renderPanelContainer = createPanelContainer(
    'render-panel-container',
    'Rendering'
);

const renderPanel = new RenderPanel(
    renderPanelContainer,
    renderSettings
);


// ======================================================
// 9. OUTLINER – PHASE 8.1
// ======================================================

const outlinerManager = new OutlinerManager(
    sceneManager.scene,
    {
        library,
        groupManager,
        connectionManager: editor.connectionManager
    }
);

const outlinerContainer = createPanelContainer(
    'outliner-panel-container',
    'Objektverwaltung'
);

const outlinerPanel = new OutlinerPanel(
    outlinerContainer,
    outlinerManager
);


// ======================================================
// 10. TOOLBARS
// ======================================================

const projectToolbar = new ProjectToolbar();
const groupToolbar = new GroupToolbar();


// ======================================================
// 11. TRANSFORMATIONSPANEL – PHASE 8.2
// ======================================================

const transformPanelContainer = createPanelContainer(
    'transform-panel-container',
    'Transformationen'
);

const transformPanel = new TransformPanel(
    transformPanelContainer,
    editor.transformInputManager,
    editor.transformGizmo
);

transformPanel.update();


// ======================================================
// 11.1 PRÄZISIONSPANEL – PHASE 8.5
// ======================================================

const precisionPanelContainer = createPanelContainer(
    'precision-panel-container',
    'Präzisionswerkzeuge'
);

const precisionPanel = new PrecisionPanel(
    precisionPanelContainer,
    editor.precisionManager
);

precisionPanel.update();


// ======================================================
// 12. HISTORY – UNDO UND REDO
// ======================================================

const historyManager = new HistoryManager(
    library,
    editor.connectionManager,
    50,

    () => {
        editor.multiSelectionManager.disposeAllHighlights();
        editor.multiSelectionManager.clearSelection();

        editor.selectionManager.clearSelection();

        editor.groupTransformManager.detach();
        editor.transformManager.detach();

        outlinerManager.clearSelection();
        outlinerManager.refresh();

        transformPanel.update();

        // Phase 8.5: Präzisionspanel nach Undo/Redo aktualisieren.
        precisionPanel.update();

        updateAssemblyPanel();

        // Phase 8.4: Filteroptionen nach Wiederherstellung aktualisieren.
        selectionFilter.updateOptions?.();
        selectionPanel.updateOptions();
        selectionPanel.updateStatus();
    },

    () => {
        autoSaveManager.scheduleSave();
    },

    groupManager,
    componentLibrary
);

editor.historyManager = historyManager;

editor.transformManager.historyManager = historyManager;
editor.groupTransformManager.historyManager = historyManager;

assemblyManager.historyManager = historyManager;
componentManager.historyManager = historyManager;

historyManager.initialize();

const componentLibraryPhase86 =
    await initializeComponentLibraryPhase86({
        sidebar,
        library,
        connectionManager: editor.connectionManager,
        groupManager,
        assemblyManager,
        historyManager,
        editor,
        onInsert: () => {
            outlinerManager.refresh();
            transformPanel.update();
            selectionPanel.updateOptions();
            selectionPanel.updateStatus();
            autoSaveManager.scheduleSave();
        }
    });

window.componentTemplateManager =
    componentLibraryPhase86.templateManager;

window.componentTemplatePanel =
    componentLibraryPhase86.panel;

historyManager.onHistoryChange = (canUndo, canRedo) => {
    projectToolbar.updateUndoRedo(canUndo, canRedo);
};


// ======================================================
// 13. PHASE 8.3 – BAUGRUPPEN UND KOMPONENTEN
// ======================================================

const assemblyPanelContainer = createPanelContainer(
    'assembly-panel-container',
    'Baugruppen und Komponenten'
);

const assemblyPanel = document.createElement('div');

assemblyPanel.style.display = 'flex';
assemblyPanel.style.flexDirection = 'column';
assemblyPanel.style.gap = '10px';

assemblyPanelContainer.appendChild(assemblyPanel);


// ------------------------------------------------------
// 13.1 Baugruppen
// ------------------------------------------------------

const assemblyHeading = document.createElement('h4');
assemblyHeading.textContent = 'Baugruppen';

assemblyPanel.appendChild(assemblyHeading);

const assemblySelect = document.createElement('select');
assemblySelect.style.width = '100%';

assemblyPanel.appendChild(assemblySelect);

createButton(
    assemblyPanel,
    'Baugruppe umbenennen',
    () => {
        const groupId = assemblySelect.value;
        if (!groupId) return;

        const group = assemblyManager.get(groupId);
        if (!group) return;

        const newName = window.prompt(
            'Neuer Baugruppenname:',
            group.name
        );

        if (newName === null || !newName.trim()) return;

        assemblyManager.rename(groupId, newName.trim());

        updateAssemblyPanel();
        outlinerManager.refresh();
        autoSaveManager.scheduleSave();
    }
);

createButton(
    assemblyPanel,
    'Baugruppe duplizieren',
    () => {
        const groupId = assemblySelect.value;
        if (!groupId) return;

        try {
            editor.duplicateAssembly(
                groupId,
                { x: 1, y: 0, z: 1 }
            );

            updateAssemblyPanel();
            outlinerManager.refresh();

        } catch (error) {
            console.error(
                'Baugruppe konnte nicht dupliziert werden:',
                error
            );

            window.alert(error.message);
        }
    }
);

createButton(
    assemblyPanel,
    'Baugruppe auflösen',
    () => {
        const groupId = assemblySelect.value;
        if (!groupId) return;

        if (!window.confirm(
            'Möchtest du diese Baugruppe wirklich auflösen?'
        )) {
            return;
        }

        assemblyManager.dissolve(groupId);

        updateAssemblyPanel();
        outlinerManager.refresh();
        autoSaveManager.scheduleSave();
    }
);


// ------------------------------------------------------
// 13.2 Komponentenbibliothek
// ------------------------------------------------------

const componentHeading = document.createElement('h4');
componentHeading.textContent = 'Wiederverwendbare Komponenten';

assemblyPanel.appendChild(componentHeading);

const componentSelect = document.createElement('select');
componentSelect.style.width = '100%';

assemblyPanel.appendChild(componentSelect);


// ------------------------------------------------------
// 13.3 Einfügeposition
// ------------------------------------------------------

const positionHeading = document.createElement('h5');
positionHeading.textContent = 'Einfügeposition';

assemblyPanel.appendChild(positionHeading);

const positionRow = document.createElement('div');

positionRow.style.display = 'flex';
positionRow.style.flexWrap = 'wrap';
positionRow.style.gap = '6px';

assemblyPanel.appendChild(positionRow);

const componentX = createNumberInput(positionRow, 'X', 0);
const componentY = createNumberInput(positionRow, 'Y', 0);
const componentZ = createNumberInput(positionRow, 'Z', 0);


// ------------------------------------------------------
// 13.4 Komponente speichern
// ------------------------------------------------------

createButton(
    assemblyPanel,
    'Ausgewählte Baugruppe als Komponente speichern',
    () => {
        const name = window.prompt(
            'Name der neuen Komponente:',
            'Neue Komponente'
        );

        if (name === null || !name.trim()) return;

        try {
            const component = editor.saveSelectedAsComponent(
                name.trim()
            );

            console.log(
                'Komponente gespeichert:',
                component.name
            );

            updateAssemblyPanel();
            autoSaveManager.scheduleSave();

        } catch (error) {
            console.error(
                'Komponente konnte nicht gespeichert werden:',
                error
            );

            window.alert(error.message);
        }
    }
);


// ------------------------------------------------------
// 13.5 Komponente einsetzen
// ------------------------------------------------------

createButton(
    assemblyPanel,
    'Komponente einsetzen',
    () => {
        const componentId = componentSelect.value;

        if (!componentId) {
            window.alert('Bitte zuerst eine Komponente auswählen.');
            return;
        }

        const position = {
            x: Number(componentX.value),
            y: Number(componentY.value),
            z: Number(componentZ.value)
        };

        if (
            !Number.isFinite(position.x) ||
            !Number.isFinite(position.y) ||
            !Number.isFinite(position.z)
        ) {
            window.alert('Die Einfügeposition ist ungültig.');
            return;
        }

        try {
            const result = editor.insertComponent(
                componentId,
                position
            );

            console.log(
                'Komponente eingesetzt:',
                result.bricks.length,
                'Bauteile'
            );

            updateAssemblyPanel();
            outlinerManager.refresh();
            transformPanel.update();
            precisionPanel.update();

        } catch (error) {
            console.error(
                'Komponente konnte nicht eingesetzt werden:',
                error
            );

            window.alert(error.message);
        }
    }
);


// ------------------------------------------------------
// 13.6 Komponente umbenennen
// ------------------------------------------------------

createButton(
    assemblyPanel,
    'Komponente umbenennen',
    () => {
        const componentId = componentSelect.value;
        if (!componentId) return;

        const component = componentManager
            .getAll()
            .find(item => item.id === componentId);

        if (!component) return;

        const newName = window.prompt(
            'Neuer Komponentenname:',
            component.name
        );

        if (newName === null || !newName.trim()) return;

        componentManager.rename(
            componentId,
            newName.trim()
        );

        updateAssemblyPanel();
        autoSaveManager.scheduleSave();
    }
);


// ------------------------------------------------------
// 13.7 Komponente löschen
// ------------------------------------------------------

createButton(
    assemblyPanel,
    'Komponente aus Bibliothek löschen',
    () => {
        const componentId = componentSelect.value;
        if (!componentId) return;

        if (!window.confirm(
            'Möchtest du diese Komponente aus der Bibliothek löschen? ' +
            'Bereits eingesetzte Bauteile bleiben erhalten.'
        )) {
            return;
        }

        componentManager.delete(componentId);

        updateAssemblyPanel();
        autoSaveManager.scheduleSave();
    }
);


// ------------------------------------------------------
// 13.8 Panel aktualisieren
// ------------------------------------------------------

function updateAssemblyPanel() {
    if (
        typeof assemblySelect === 'undefined' ||
        typeof componentSelect === 'undefined'
    ) {
        return;
    }

    const selectedGroupId = assemblySelect.value;
    const selectedComponentId = componentSelect.value;

    const groups = assemblyManager.getAll();
    const components = componentManager.getAll();

    assemblySelect.replaceChildren();

    const groupPlaceholder = document.createElement('option');
    groupPlaceholder.value = '';
    groupPlaceholder.textContent = 'Baugruppe auswählen';

    assemblySelect.appendChild(groupPlaceholder);

    for (const group of groups) {
        const option = document.createElement('option');

        option.value = group.id;
        option.textContent =
            `${group.name} (${group.brickIds.length} Bauteile)`;

        assemblySelect.appendChild(option);
    }

    if (groups.some(group => group.id === selectedGroupId)) {
        assemblySelect.value = selectedGroupId;
    }

    componentSelect.replaceChildren();

    const componentPlaceholder = document.createElement('option');
    componentPlaceholder.value = '';
    componentPlaceholder.textContent = 'Komponente auswählen';

    componentSelect.appendChild(componentPlaceholder);

    for (const component of components) {
        const option = document.createElement('option');

        option.value = component.id;
        option.textContent =
            `${component.name} (${component.bricks.length} Bauteile)`;

        componentSelect.appendChild(option);
    }

    if (
        components.some(
            component => component.id === selectedComponentId
        )
    ) {
        componentSelect.value = selectedComponentId;
    }
}

updateAssemblyPanel();


// ======================================================
// 14. PHASE 8.4 – ERWEITERTE AUSWAHL UND ISOLATION
// ======================================================

// ------------------------------------------------------
// 14.1 Auswahlfilter
// ------------------------------------------------------

const selectionFilter = new SelectionFilter(
    library,
    groupManager
);


// ------------------------------------------------------
// 14.2 Erweiterter Auswahlmanager
// ------------------------------------------------------

const advancedSelectionManager = new AdvancedSelectionManager({
    library,
    groupManager: editor.groupManager,
    multiSelectionManager: editor.multiSelectionManager,
    selectionManager: editor.selectionManager,
    selectionFilter
});


// ------------------------------------------------------
// 14.3 Isolationsmanager
// ------------------------------------------------------

const isolationManager = new IsolationManager(
    sceneManager.scene,
    library,
    outlinerManager.visibilityManager
);


// ------------------------------------------------------
// 14.4 Auswahlpanel
// ------------------------------------------------------

const selectionPanelContainer = document.getElementById(
    'selection-container'
) ?? createPanelContainer(
    'selection-container',
    'Erweiterte Auswahl'
);

const selectionPanel = new SelectionPanel(
    selectionPanelContainer,
    advancedSelectionManager,
    selectionFilter,
    isolationManager
);

const previousMultiSelectionCallback =
    editor.multiSelectionManager.onSelectionChanged;

editor.multiSelectionManager.onSelectionChanged = ids => {
    previousMultiSelectionCallback?.(ids);

    selectionPanel.updateStatus();

    // Phase 8.5: Auswahländerung im Präzisionspanel anzeigen.
    precisionPanel.update();
};

const previousSingleSelectionCallback =
    editor.selectionManager.onSelectionChanged;

editor.selectionManager.onSelectionChanged = object => {
    previousSingleSelectionCallback?.(object);

    selectionPanel.updateStatus();

    // Phase 8.5: Auswahländerung im Präzisionspanel anzeigen.
    precisionPanel.update();
};


// ======================================================
// 15. AUSWAHL ZWISCHEN EDITOR UND OUTLINER SYNCHRONISIEREN
// ======================================================

let syncingSelection = false;

const selectionManager = editor.selectionManager;
const multiSelectionManager = editor.multiSelectionManager;


// ------------------------------------------------------
// 15.1 Auswahl aus dem Outliner in den Editor übernehmen
// ------------------------------------------------------

outlinerManager.onSelectionChange = objects => {
    if (syncingSelection) return;

    syncingSelection = true;

    try {
        const bricks = objects
            .map(object => {
                const brickId = outlinerManager.getBrickId(object);

                return brickId !== null
                    ? library.getById(brickId)
                    : null;
            })
            .filter(Boolean);

        if (objects.length === 0) {
            multiSelectionManager.clearSelection();
            selectionManager.clearSelection();

            transformPanel.update();
            selectionPanel.updateStatus();
            precisionPanel.update();

            return;
        }

        if (objects.length === 1) {
            multiSelectionManager.clearSelection();
            selectionManager.selectObject(objects[0]);

            transformPanel.update();
            selectionPanel.updateStatus();
            precisionPanel.update();

            return;
        }

        selectionManager.clearSelection();
        multiSelectionManager.setSelection(bricks);

        transformPanel.update();
        selectionPanel.updateStatus();
        precisionPanel.update();

    } finally {
        syncingSelection = false;
    }
};


// ------------------------------------------------------
// 15.2 Einzelauswahl aus dem 3D-Fenster übernehmen
// ------------------------------------------------------

const previousSelectionChanged =
    selectionManager.onSelectionChanged;

selectionManager.onSelectionChanged = object => {
    previousSelectionChanged?.(object);

    if (syncingSelection) return;

    syncingSelection = true;

    try {
        if (object) {
            outlinerManager.selectObjects([object]);

        } else if (multiSelectionManager.getSelectionCount() > 0) {
            const bricks = multiSelectionManager.getSelectedBricks(
                library
            );

            outlinerManager.selectObjects(
                bricks.map(brick => brick.group)
            );

        } else {
            outlinerManager.clearSelection();
        }

        setMaterialPanelTarget(object);

        transformPanel.update();
        selectionPanel.updateStatus();
        precisionPanel.update();

    } finally {
        syncingSelection = false;
    }
};


// ------------------------------------------------------
// 15.3 Mehrfachauswahl aus dem 3D-Fenster übernehmen
// ------------------------------------------------------

const previousMultiSelectionChanged =
    multiSelectionManager.onSelectionChanged;

multiSelectionManager.onSelectionChanged = ids => {
    previousMultiSelectionChanged?.(ids);

    if (syncingSelection) return;

    syncingSelection = true;

    try {
        const bricks = multiSelectionManager.getSelectedBricks(
            library
        );

        if (bricks.length > 0) {
            outlinerManager.selectObjects(
                bricks.map(brick => brick.group)
            );

        } else if (selectionManager.selectedObject) {
            outlinerManager.selectObjects([
                selectionManager.selectedObject
            ]);

        } else {
            outlinerManager.clearSelection();
        }

        transformPanel.update();
        selectionPanel.updateStatus();
        precisionPanel.update();

    } finally {
        syncingSelection = false;
    }
};


// ======================================================
// 16. PHASE 8.7 – MODELLPRÜFUNG
// ======================================================

const modelValidationPhase87 =
    initializeModelValidationPhase87({

        sidebar,

        library,

        connectionManager:
            editor.connectionManager,

        collisionManager:
            editor.collisionManager,

        groupManager,

        materialLibrary,

        componentLibrary,

        editor,

        outlinerManager
    });

const modelValidator =
    modelValidationPhase87.modelValidator;

const validationPanel =
    modelValidationPhase87.panel;


// ======================================================
// 17. MATERIAL-PANEL MIT AUSWAHL VERBINDEN
// ======================================================

function setMaterialPanelTarget(selectedObject) {
    materialPanel.setTarget(selectedObject);
}

window.setMaterialPanelTarget = setMaterialPanelTarget;


// ======================================================
// 18. OUTLINER-LÖSCHEN MIT EDITOR VERBINDEN
// ======================================================

outlinerManager.onDeleteSelection = () => {
    editor.deleteSelected();

    outlinerManager.refresh();
    updateAssemblyPanel();
    selectionPanel.updateOptions();
    selectionPanel.updateStatus();
    precisionPanel.update();
};


// ======================================================
// 19. GROUP-TOOLBAR MIT EDITOR VERBINDEN
// ======================================================

groupToolbar.onGroup = () => {
    editor.groupSelected();

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();
};

groupToolbar.onUngroup = () => {
    editor.ungroupSelected();

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();
};

groupToolbar.onCopy = () => {
    editor.copySelected();
};

groupToolbar.onDuplicate = () => {
    editor.duplicateSelected();

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();
};

groupToolbar.onDelete = () => {
    editor.deleteSelected();

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();
};

groupToolbar.onPaste = () => {
    editor.pasteSelected();

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();
};

editor.onGroupUIUpdate = (count, groupName) => {
    groupToolbar.updateSelectionInfo(
        count,
        groupName
    );
};


// ------------------------------------------------------
// 19.1 Gruppeninformationen aktualisieren
// ------------------------------------------------------

function updateGroupToolbar() {
    const objects = outlinerManager.getSelection();

    const bricks = objects
        .map(object => {
            const id = outlinerManager.getBrickId(object);

            return id !== null
                ? library.getById(id)
                : null;
        })
        .filter(Boolean);

    const group = bricks.length > 0
        ? groupManager.getGroupByBrickId(bricks[0].id)
        : null;

    groupToolbar.updateSelectionInfo(
        bricks.length,
        group?.name ?? null
    );
}


// ------------------------------------------------------
// 19.2 Outliner-Ereignisse
// ------------------------------------------------------

outlinerManager.subscribe(event => {
    if (event.type === 'selection') {
        updateGroupToolbar();
        precisionPanel.update();
    }

    if (
        event.type === 'group-membership' ||
        event.type === 'rename-group'
    ) {
        historyManager.saveState();
        updateAssemblyPanel();
        selectionPanel.updateOptions();
        precisionPanel.update();
    }
});


// ======================================================
// 20. PROJEKT-TOOLBAR VERBINDEN
// ======================================================

projectToolbar.onSave = () => {
    autoSaveManager.save();
};

projectToolbar.onUndo = () => {
    historyManager.undo();
};

projectToolbar.onRedo = () => {
    historyManager.redo();
};

projectToolbar.onNewProject = () => {
    createNewProject();
};

projectToolbar.onExport = () => {
    exportProject();
};

projectToolbar.onImport = file => {
    importProjectFile(file);
};

projectToolbar.onRename = name => {
    renameProject(name);
};

autoSaveManager.onStatusChange = (
    status,
    time,
    errorMessage
) => {
    projectToolbar.updateSaveStatus(
        status,
        time,
        errorMessage
    );
};


// ======================================================
// 21. PART-LIBRARY-UI
// ======================================================

const partLibraryContainer = document.getElementById(
    'part-library-container'
) ?? createPanelContainer(
    'part-library-container',
    'Bauteilbibliothek'
);

function selectPartForPlacement(partId) {
    const placementManager = editor.placementManager;

    if (typeof placementManager.selectPart === 'function') {
        placementManager.selectPart(partId);
        return;
    }

    if (typeof placementManager.setSelectedPart === 'function') {
        placementManager.setSelectedPart(partId);
        return;
    }

    if (typeof placementManager.selectPartById === 'function') {
        placementManager.selectPartById(partId);
        return;
    }

    console.warn(
        'Der PlacementManager besitzt keine erkannte Auswahlmethode.',
        partId
    );
}

const partLibraryUI = new PartLibraryUI(
    partLibraryContainer,
    selectPartForPlacement
);


// ======================================================
// 22. SCHATTEN
// ======================================================

function updateSceneShadows() {
    shadowManager.applyToScene(
        sceneManager.scene,
        {
            cast: true,
            receive: true
        }
    );
}


// ======================================================
// 23. EDITOR-AUSWAHL ZURÜCKSETZEN
// ======================================================

function clearEditorSelection() {
    editor.multiSelectionManager.disposeAllHighlights();
    editor.multiSelectionManager.clearSelection();

    editor.selectionManager.clearSelection();

    editor.groupTransformManager.detach();
    editor.transformManager.detach();

    outlinerManager.clearSelection();

    // Eine aktive Isolation vor dem Projektwechsel beenden.
    isolationManager.exitIsolation();
    outlinerManager.exitIsolation();

    transformPanel.update();
    updateAssemblyPanel();

    selectionFilter.updateOptions?.();
    selectionPanel.updateOptions();
    selectionPanel.updateStatus();

    // Phase 8.5: Präzisionspanel nach dem Zurücksetzen aktualisieren.
    precisionPanel.update();
}


// ======================================================
// 24. PROJEKT LADEN
// ======================================================

async function loadInitialProject() {
    autoSaveManager.setRestoring(true);

    try {
        const savedProject = autoSaveManager.load();

        if (savedProject) {
            projectManager.loadProjectJSON(
                JSON.stringify(savedProject)
            );

            console.log('Gespeichertes Projekt geladen.');

        } else {
            console.log('Kein gespeichertes Projekt gefunden.');
        }

        clearEditorSelection();

        historyManager.initialize();

        updateSceneShadows();

        projectToolbar.updateProjectName(
            projectManager.getProjectInfo().name
        );

        outlinerManager.refresh();
        updateAssemblyPanel();

        selectionFilter.updateOptions?.();
        selectionPanel.updateOptions();
        selectionPanel.updateStatus();

        // Phase 8.5: Nach dem Projektladen aktualisieren.
        precisionPanel.update();

    } catch (error) {
        console.error(
            'Fehler beim Laden des gespeicherten Projekts:',
            error
        );

        historyManager.initialize();

        precisionPanel.update();

    } finally {
        autoSaveManager.setRestoring(false);
    }
}


// ======================================================
// 25. PROJEKT EXPORTIEREN
// ======================================================

function exportProject() {
    return projectManager.exportProject();
}


// ======================================================
// 26. NEUES PROJEKT
// ======================================================

function createNewProject() {
    const confirmed = window.confirm(
        'Möchtest du wirklich ein neues Projekt erstellen?'
    );

    if (!confirmed) return false;

    autoSaveManager.setRestoring(true);

    try {
        projectManager.createNewProject();

        clearEditorSelection();

        outlinerManager.showAll();

        historyManager.initialize();

        updateSceneShadows();

        projectToolbar.updateProjectName(
            projectManager.getProjectInfo().name
        );

        outlinerManager.refresh();
        updateAssemblyPanel();

        selectionFilter.updateOptions?.();
        selectionPanel.updateOptions();
        selectionPanel.updateStatus();

        // Phase 8.5: Nach dem Erstellen eines Projekts aktualisieren.
        precisionPanel.update();

        console.log('Neues Projekt erstellt.');

        return true;

    } finally {
        autoSaveManager.setRestoring(false);
        autoSaveManager.scheduleSave();
    }
}


// ======================================================
// 27. PROJEKT UMBENENNEN
// ======================================================

function renameProject(newName) {
    if (
        typeof newName !== 'string' ||
        !newName.trim()
    ) {
        return false;
    }

    projectManager.renameProject(newName.trim());

    projectToolbar.updateProjectName(
        projectManager.getProjectInfo().name
    );

    autoSaveManager.scheduleSave();

    return true;
}


// ======================================================
// 28. PROJEKT IMPORTIEREN
// ======================================================

async function importProjectFile(file) {
    if (!file) return;

    autoSaveManager.setRestoring(true);

    try {
        await projectManager.importProjectFile(file);

        // Erst nach erfolgreichem Import den Editor aktualisieren.
        editor.selectionManager?.clearSelection?.();

        historyManager.initialize();

        editor.updateShadows?.();

        projectToolbar.updateProjectName(
            projectManager.getProjectInfo().name
        );

        outlinerManager?.refresh?.();
        updateAssemblyPanel();

        selectionFilter.updateOptions?.();
        selectionPanel.updateOptions();
        selectionPanel.updateStatus();

        // Phase 8.5: Nach dem Import aktualisieren.
        precisionPanel.update();

    } catch (error) {
        console.error('Projektimport fehlgeschlagen:', error);

        alert(
            `Das Projekt konnte nicht importiert werden:\n${error.message}`
        );

    } finally {
        autoSaveManager.setRestoring(false);
        autoSaveManager.scheduleSave();
    }
}


// ======================================================
// 29. GESPEICHERTES PROJEKT LÖSCHEN
// ======================================================

function deleteSavedProject() {
    const confirmed = window.confirm(
        'Möchtest du das gespeicherte Projekt wirklich löschen?'
    );

    if (!confirmed) return false;

    autoSaveManager.deleteSavedProject();

    console.log('Gespeichertes Projekt gelöscht.');

    return true;
}


// ======================================================
// 30. TASTATURKÜRZEL
// ======================================================

window.addEventListener('keydown', event => {
    const target = event.target;

    const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

    if (isTyping) return;

    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (modifier && key === 's') {
        event.preventDefault();
        autoSaveManager.save();
        return;
    }

    if (modifier && key === 'z') {
        event.preventDefault();

        if (event.shiftKey) {
            historyManager.redo();
        } else {
            historyManager.undo();
        }

        return;
    }

    if (modifier && key === 'y') {
        event.preventDefault();
        historyManager.redo();
        return;
    }

    if (modifier && key === 'c') {
        editor.copySelected();
        return;
    }

    if (modifier && key === 'v') {
        editor.pasteSelected();

        updateAssemblyPanel();
        outlinerManager.refresh();
        selectionPanel.updateOptions();
        precisionPanel.update();

        return;
    }

    if (modifier && key === 'd') {
        event.preventDefault();
        editor.duplicateSelected();

        updateAssemblyPanel();
        outlinerManager.refresh();
        selectionPanel.updateOptions();
        precisionPanel.update();

        return;
    }

    if (
        event.key === 'Delete' ||
        event.key === 'Backspace'
    ) {
        editor.deleteSelected();

        updateAssemblyPanel();
        outlinerManager.refresh();
        selectionPanel.updateOptions();
        precisionPanel.update();

        return;
    }

    if (event.key === 'Escape') {
        if (isolationManager.isIsolating()) {
            isolationManager.exitIsolation();
            selectionPanel.updateStatus();
            precisionPanel.update();
        }

        if (outlinerManager.isIsolating()) {
            outlinerManager.exitIsolation();
        }
    }
});


// ======================================================
// 31. BEFOREUNLOAD
// ======================================================

window.addEventListener('beforeunload', () => {
    autoSaveManager.flush();
});


// ======================================================
// 32. GLOBALE ZUGRIFFSPUNKTE
// ======================================================

window.sceneManager = sceneManager;

window.library = library;
window.editor = editor;

window.projectManager = projectManager;
window.projectStorage = projectStorage;
window.autoSaveManager = autoSaveManager;

window.historyManager = historyManager;

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

window.outlinerManager = outlinerManager;
window.outlinerPanel = outlinerPanel;

window.transformPanel = transformPanel;
window.transformInputManager = editor.transformInputManager;
window.transformGizmo = editor.transformGizmo;

// Phase 8.3
window.assemblyManager = assemblyManager;
window.componentLibrary = componentLibrary;
window.componentManager = componentManager;
window.assemblyPanel = assemblyPanel;

// Phase 8.4
window.selectionFilter = selectionFilter;
window.advancedSelectionManager = advancedSelectionManager;
window.isolationManager = isolationManager;
window.selectionPanel = selectionPanel;

// Phase 8.5
window.precisionPanel = precisionPanel;
window.precisionManager = editor.precisionManager;

window.alignmentManager = editor.precisionManager.alignmentManager;
window.distributionManager = editor.precisionManager.distributionManager;
window.measurementManager = editor.precisionManager.measurementManager;
window.mirrorManager = editor.precisionManager.mirrorManager;
window.precisionSnapManager = editor.precisionManager.precisionSnapManager;

// Phase 8.6
window.componentLibraryPhase86 = componentLibraryPhase86;

window.projectToolbar = projectToolbar;
window.groupToolbar = groupToolbar;

window.partLibraryUI = partLibraryUI;

// Phase 8.7
window.modelValidator = modelValidator;
window.validationPanel = validationPanel;
window.modelValidationPhase87 = modelValidationPhase87;


// ======================================================
// 16.1 PHASE 8.8 – PERFORMANCEOPTIMIERUNG
// ======================================================
// (bereits oben mit await initializePerformancePhase88 ausgeführt)

const phase88 = await initializePerformancePhase88({
    sidebar,
    scene:    sceneManager.scene,
    camera:   sceneManager.camera,
    renderer: sceneManager.renderer,
    library,
    sceneManager,
    shadowManager,
    selectionManager:     editor.selectionManager,
    multiSelectionManager: editor.multiSelectionManager,
    connectionManager:    editor.connectionManager,
    groupManager,
    componentLibrary
});


// ======================================================
// 33. ÖFFENTLICHE PROJEKTFUNKTIONEN
// ======================================================

window.exportProject = exportProject;
window.createNewProject = createNewProject;
window.renameProject = renameProject;
window.importProjectFile = importProjectFile;
window.deleteSavedProject = deleteSavedProject;


// ======================================================
// 36. PHASE 9 – BENUTZERKONTEN UND CLOUD-SPEICHERUNG
// ======================================================

const phase9 = await initializeCloudPhase9({
    sidebar,
    projectManager,
    autoSaveManager,
    historyManager,
    editor,
    panelManager:  window.panelManager  ?? null,
    errorHandler:  window.errorHandler  ?? null,
    onProjectLoaded: () => {
        clearEditorSelection();
        historyManager.initialize();
        outlinerManager.refresh();
        updateAssemblyPanel();
        selectionFilter.updateOptions?.();
        selectionPanel.updateOptions();
        selectionPanel.updateStatus();
        precisionPanel.update();
        projectToolbar.updateProjectName(
            projectManager.getProjectInfo().name
        );
    }
});

// Phase 9
window.phase9              = phase9;
window.authManager         = phase9.authManager;
window.cloudProjectManager = phase9.cloudProjectManager;
window.cloudSyncManager    = phase9.cloudSyncManager;
window.syncStatusManager   = phase9.syncStatusManager;


// ======================================================
// 36. PHASE 8.9 – GESAMTINTEGRATION
// ======================================================


// --------------------------------------------------
// 36.1 Zentraler Fehler-Handler
// --------------------------------------------------

const editorErrorHandler = new EditorErrorHandler({
    onError: (entry) => {
        console.warn(
            `[EditorErrorHandler] ${entry.context}:`,
            entry.message
        );
    }
});


// --------------------------------------------------
// 36.2 Panel-Manager
// --------------------------------------------------

const panelManager = new EditorPanelManager();

// Alle Phase-8-Panels registrieren
editorErrorHandler.try(() => {
    panelManager.register('outliner',     outlinerPanel,
        { container: document.getElementById('outliner-panel-container') });

    panelManager.register('transform',   transformPanel,
        { container: document.getElementById('transform-panel-container') });

    panelManager.register('precision',   precisionPanel,
        { container: document.getElementById('precision-panel-container') });

    panelManager.register('assembly',    assemblyPanel,
        { container: document.getElementById('assembly-panel-container') });

    panelManager.register('selection',   selectionPanel,
        { container: document.getElementById('selection-container') });

    panelManager.register('material',    materialPanel,
        { container: document.getElementById('material-panel-container') });

    panelManager.register('lighting',    lightingPanel,
        { container: document.getElementById('lighting-panel-container') });

    panelManager.register('render',      renderPanel,
        { container: document.getElementById('render-panel-container') });

    if (validationPanel) {
        panelManager.register('validation', validationPanel);
    }

    if (phase88?.panel) {
        panelManager.register('performance', phase88.panel);
    }

    if (window.componentTemplatePanel) {
        panelManager.register('components', window.componentTemplatePanel);
    }
}, 'Phase 8.9 – Panel-Manager-Registrierung');


// --------------------------------------------------
// 36.3 Tastatursteuerung (neue Phase-8.9-Shortcuts)
// --------------------------------------------------

const shortcutManager = new EditorShortcutManager(window);

// Kamera auf Auswahl fokussieren (F)
shortcutManager.register({ key: 'f' }, () => {
    const bricks = editor.multiSelectionManager
        .getSelectedBricks(library);

    const single = editor.selectionManager.selectedObject;

    if (bricks.length > 0 || single) {
        sceneManager.controls?.update?.();
        // Fokus via OrbitControls (wenn vorhanden)
        if (typeof sceneManager.controls?.target?.set === 'function') {
            const targets = bricks.length > 0
                ? bricks.map(b => b.group.position)
                : [single.position];
            const cx = targets.reduce((s, p) => s + p.x, 0) / targets.length;
            const cy = targets.reduce((s, p) => s + p.y, 0) / targets.length;
            const cz = targets.reduce((s, p) => s + p.z, 0) / targets.length;
            sceneManager.controls.target.set(cx, cy, cz);
            sceneManager.controls.update();
        }
    }
});

// Alle Bauteile auswählen (Ctrl + A)
shortcutManager.register({ key: 'a', ctrl: true }, () => {
    const all = library.getAll();
    if (all.length === 0) return;

    editor.multiSelectionManager.setSelection(all);
    selectionPanel.updateStatus();
    precisionPanel.update();
});

// Gruppe erstellen (Ctrl + G)
shortcutManager.register({ key: 'g', ctrl: true }, () => {
    editor.groupSelected();

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();
});

// Gruppe auflösen (Ctrl + Shift + G)
shortcutManager.register({ key: 'g', ctrl: true, shift: true }, () => {
    editor.ungroupSelected();

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();
});

// Verschieben-Modus (G)
shortcutManager.register({ key: 'g' }, () => {
    editor.transformManager.setMode('translate');
    editor.groupTransformManager.setMode('translate');
    transformPanel.update();
});

// Drehen-Modus (R)
shortcutManager.register({ key: 'r' }, () => {
    editor.transformManager.setMode('rotate');
    editor.groupTransformManager.setMode('rotate');
    transformPanel.update();
});

// Skalieren nicht nativ unterstützt; Hinweis im Konsolen-Log (S)
shortcutManager.register({ key: 's' }, () => {
    // Skalierung für Einzelbauteile ist in dieser Architektur
    // nicht vorgesehen (Steine haben feste Maße). S aktiviert
    // stattdessen den Rotationsmodus als sinnvollen Fallback.
    editor.transformManager.setMode('rotate');
    transformPanel.update();
});


// --------------------------------------------------
// 36.4 Globale Zugriffspunkte (Phase 8.9)
// --------------------------------------------------

window.editorErrorHandler = editorErrorHandler;
window.panelManager       = panelManager;
window.shortcutManager    = shortcutManager;


// ======================================================
// 34. ÖFFENTLICHE PHASE-8.3-FUNKTIONEN
// ======================================================

window.saveSelectedAsComponent = (name = null) => {
    const component = editor.saveSelectedAsComponent(name);

    updateAssemblyPanel();
    autoSaveManager.scheduleSave();

    return component;
};

window.insertComponent = (
    componentId,
    position = { x: 0, y: 0, z: 0 }
) => {
    const result = editor.insertComponent(
        componentId,
        position
    );

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();

    return result;
};

window.duplicateAssembly = (
    groupId,
    offset = { x: 1, y: 0, z: 1 }
) => {
    const result = editor.duplicateAssembly(
        groupId,
        offset
    );

    updateAssemblyPanel();
    outlinerManager.refresh();
    selectionPanel.updateOptions();
    precisionPanel.update();

    return result;
};


// ======================================================
// 35. ÖFFENTLICHE PHASE-8.4-FUNKTIONEN
// ======================================================

window.selectAllFiltered = criteria => {
    advancedSelectionManager.selectFiltered(criteria);
    selectionPanel.updateStatus();
    precisionPanel.update();
};

window.invertSelection = () => {
    advancedSelectionManager.invertSelection();
    selectionPanel.updateStatus();
    precisionPanel.update();
};

window.isolateCurrentSelection = () => {
    const selected = advancedSelectionManager.getSelection();

    const success = isolationManager.isolate(selected);

    selectionPanel.updateStatus();
    precisionPanel.update();

    return success;
};

window.exitSelectionIsolation = () => {
    const success = isolationManager.exitIsolation();

    selectionPanel.updateStatus();
    precisionPanel.update();

    return success;
};


// ======================================================
// 36. ÖFFENTLICHE PHASE-8.5-FUNKTIONEN
// ======================================================

window.updatePrecisionPanel = () => {
    precisionPanel.update();
};


// ======================================================
// 37. ÖFFENTLICHE PHASE-8.7-FUNKTIONEN
// ======================================================

window.runModelValidation = () => {
    return modelValidator.validate();
};


// ======================================================
// 38. INITIALISIERUNG
// ======================================================

await loadInitialProject();

precisionPanel.update();

console.log('======================================');
console.log('Mecabricks Clone gestartet.');
console.log('Phase 1–7: Rendering, Materialien und Editor.');
console.log('Phase 8.1: Objektverwaltung und Outliner.');
console.log('Phase 8.2: Transformationen und Transformationspanel.');
console.log('Phase 8.3: Baugruppen und wiederverwendbare Komponenten.');
console.log('Phase 8.4: Erweiterte Auswahl und Isolation.');
console.log('Phase 8.5: Präzisionswerkzeuge.');
console.log('Phase 8.6: Baugruppenbibliothek und Wiederverwendung.');
console.log('Phase 8.7: Modellprüfung und Fehlererkennung.');
console.log('======================================');
