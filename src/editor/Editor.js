
import { SelectionManager } from './SelectionManager.js';
import { TransformManager } from './TransformManager.js';
import { InputManager } from './InputManager.js';
import { MultiSelectionManager } from './MultiSelectionManager.js';
import { SelectionBox } from './SelectionBox.js';
import { GroupManager } from './GroupManager.js';
import { GroupTransformManager } from './GroupTransformManager.js';
import { CopyPasteManager } from './CopyPasteManager.js';

import { PartPalette } from '../ui/PartPalette.js';
import { SnapSystem } from './SnapSystem.js';
import { CollisionManager } from './CollisionManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { PlacementPreview } from './PlacementPreview.js';
import { PlacementManager } from './PlacementManager.js';
import { CoordinateSystem } from './CoordinateSystem.js';
import { TransformConstraintManager } from './TransformConstraintManager.js';
import { TransformGizmo } from './TransformGizmo.js';
import { TransformInputManager } from './TransformInputManager.js';
import { AssemblyManager } from '../assemblies/AssemblyManager.js';
import { ComponentLibrary } from '../assemblies/ComponentLibrary.js';
import { ComponentManager } from '../assemblies/ComponentManager.js';
import { PrecisionManager } from '../precision/PrecisionManager.js';


export class Editor {

    constructor(sceneManager, library) {

        if (!sceneManager || !library) {
            throw new Error('Editor benötigt einen SceneManager und eine PartLibrary.');
        }

        this.sceneManager = sceneManager;
        this.library = library;

        const camera = sceneManager.camera;
        const renderer = sceneManager.renderer;
        const scene = sceneManager.scene;

        // ---------------------------------------------------------
        // Bestehende Systeme
        // ---------------------------------------------------------

        this.snapSystem = new SnapSystem();
        this.collisionManager = new CollisionManager();
        this.connectionManager = new ConnectionManager();

        this.placementPreview = new PlacementPreview(scene);

        this.placementManager = new PlacementManager(
            camera,
            renderer,
            scene,
            library,
            this.snapSystem,
            this.collisionManager,
            this.connectionManager,
            this.placementPreview
        );

        // PlacementManager benötigt Zugriff auf die History des Editors.
        // Der HistoryManager kann später zugewiesen werden.
        this.placementManager.editor = this;

        this.selectionManager = new SelectionManager(
            camera,
            renderer,
            scene
        );

        this.transformManager = new TransformManager(
            camera,
            renderer,
            scene,
            sceneManager,
            this.collisionManager,
            this.library
        );

        this.inputManager = new InputManager(this);

        /** @type {import('../history/HistoryManager.js').HistoryManager | null} */
        this.historyManager = null;

        // ---------------------------------------------------------
        // Mehrfachauswahl und Gruppen
        // ---------------------------------------------------------

        this.multiSelectionManager = new MultiSelectionManager();

        this.selectionBox = new SelectionBox(
            camera,
            renderer,
            this.multiSelectionManager,
            library,
            sceneManager.controls
        );

        // SelectionBox mit dem SelectionManager verbinden.
        this.selectionManager.selectionBox = this.selectionBox;

        // Bereichsauswahl nur erlauben, wenn kein Bauteil platziert wird.
        this.selectionBox.canStart = () => {
            return !this.placementManager.selectedPart;
        };

        this.groupManager = new GroupManager();

        this.groupTransformManager = new GroupTransformManager(
            camera,
            renderer,
            scene,
            sceneManager,
            this.collisionManager,
            this.library
        );

        // ---------------------------------------------------------
        // Phase 8.3: Baugruppen und wiederverwendbare Komponenten
        // ---------------------------------------------------------

        this.componentLibrary = new ComponentLibrary();

        this.assemblyManager = new AssemblyManager(
            this.groupManager,
            this.library,
            this.connectionManager
        );

        this.componentManager = new ComponentManager(
            this.componentLibrary,
            this.library,
            this.connectionManager,
            this.groupManager
        );

        this.copyPasteManager = new CopyPasteManager();

        // ---------------------------------------------------------
        // Phase 8.2: Erweiterte Transformation
        // ---------------------------------------------------------

        this.coordinateSystem = new CoordinateSystem('world');

        this.transformConstraintManager = new TransformConstraintManager(
            this.snapSystem,
            this.collisionManager,
            this.library
        );

        this.transformGizmo = new TransformGizmo(
            this,
            this.coordinateSystem
        );

        this.transformInputManager = new TransformInputManager(
            this,
            this.transformConstraintManager
        );

        // ---------------------------------------------------------
// Phase 8.5: Präzisionswerkzeuge
// ---------------------------------------------------------

this.precisionManager = new PrecisionManager(this);

        /**
         * Callback für die Aktualisierung der Gruppen-UI.
         * Wird von main.js gesetzt.
         *
         * @type {((count: number, groupName: string|null) => void) | null}
         */
        this.onGroupUIUpdate = null;

        // ---------------------------------------------------------
        // Event-Handler speichern
        // ---------------------------------------------------------

        this._placementHandlers = null;

        // ---------------------------------------------------------
        // Callbacks und Events einrichten
        // ---------------------------------------------------------

        this._wireCallbacks();
        this.setupPlacementEvents();
    }


    // -------------------------------------------------------------
    // Interne Callback-Verdrahtung
    // -------------------------------------------------------------

    _wireCallbacks() {

        // ---------------------------------------------------------
        // Einzelauswahl
        // ---------------------------------------------------------

        this.selectionManager.onSelectionChanged = (object) => {

            if (object) {

                // Gruppentransformation deaktivieren.
                this.groupTransformManager.detach();

                // Normale Transformation aktivieren.
                this.transformManager.attach(object);

            } else {

                this.transformManager.detach();

            }

            this._notifyGroupUI();
        };


        // ---------------------------------------------------------
        // Strg-Klick: Mehrfachauswahl umschalten
        // ---------------------------------------------------------

        this.selectionManager.onCtrlClick = (brickId) => {

            const brick = this.library.getById(brickId);

            if (!brick) return;

            // Einzelauswahl aufheben.
            this.selectionManager.clearSelection();

            this.transformManager.detach();

            // Bauteil zur Mehrfachauswahl hinzufügen oder entfernen.
            this.multiSelectionManager.toggleSelection(brick);
        };


        // ---------------------------------------------------------
        // Klick auf eine leere Stelle
        // ---------------------------------------------------------

        this.selectionManager.onEmptyClick = () => {

            this.multiSelectionManager.clearSelection();

            this.groupTransformManager.detach();

            this.transformManager.detach();

            this._notifyGroupUI();
        };


        // ---------------------------------------------------------
        // Änderungen der Mehrfachauswahl
        // ---------------------------------------------------------

        this.multiSelectionManager.onSelectionChanged = (ids) => {

            if (ids.length > 1) {

                // Mehrere Bauteile ausgewählt.
                this.selectionManager.clearSelection();

                this.transformManager.detach();

                const bricks = this.multiSelectionManager
                    .getSelectedBricks(this.library);

                if (bricks.length > 1) {
                    this.groupTransformManager.attach(bricks);
                } else {
                    this.groupTransformManager.detach();
                }

            } else if (ids.length === 1) {

                // Genau ein Bauteil ausgewählt.
                this.groupTransformManager.detach();

                const brick = this.library.getById(ids[0]);

                if (brick) {
                    this.selectionManager.selectObject(brick.group);
                }

            } else {

                // Keine Bauteile ausgewählt.
                this.groupTransformManager.detach();

            }

            this._notifyGroupUI();
        };
    }


    // -------------------------------------------------------------
    // Platzierungs-Events
    // -------------------------------------------------------------

    setupPlacementEvents() {

        const canvas = this.sceneManager.renderer.domElement;

        if (!canvas) {
            throw new Error('Renderer besitzt kein DOM-Element.');
        }

        // Verhindert, dass Events mehrfach registriert werden.
        this.removePlacementEvents();

        const onPointerMove = (event) => {

            this.placementManager.updatePreview(event);

        };

        const onPointerDown = (event) => {

            if (event.button !== 0) return;

            if (!this.placementManager.selectedPart) return;

            // Während einer Bereichsauswahl mit gedrückter Leertaste
            // darf kein Bauteil platziert werden.
            if (this.selectionBox.isSpacePressed()) return;

            event.stopPropagation();

            this.placementManager.placeBrick();
        };

        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerdown', onPointerDown);

        this._placementHandlers = {
            canvas,
            onPointerMove,
            onPointerDown
        };
    }


    // -------------------------------------------------------------
    // Platzierungs-Events entfernen
    // -------------------------------------------------------------

    removePlacementEvents() {

        if (!this._placementHandlers) return;

        const {
            canvas,
            onPointerMove,
            onPointerDown
        } = this._placementHandlers;

        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerDown);

        this._placementHandlers = null;
    }


    // -------------------------------------------------------------
    // Bauteile löschen
    // -------------------------------------------------------------

    deleteSelected() {

        const multiCount =
            this.multiSelectionManager.getSelectionCount();

        // ---------------------------------------------------------
        // Mehrfachauswahl löschen
        // ---------------------------------------------------------

        if (multiCount > 0) {

            const bricks = this.multiSelectionManager
                .getSelectedBricks(this.library);

            let deletedAny = false;

            for (const brick of bricks) {

                if (!brick) continue;

                // Verbindungen entfernen.
                this.connectionManager.removeConnections(brick.id);

                // Gruppenmitgliedschaft entfernen.
                const group = this.groupManager
                    .getGroupByBrickId(brick.id);

                if (group) {
                    this.groupManager.removeBrickFromGroup(
                        group.id,
                        brick.id
                    );
                }

                // Bauteil aus der Bibliothek entfernen.
                const removed = this.library.removeBrick(brick);

                if (removed !== false) {
                    deletedAny = true;
                }
            }

            this.multiSelectionManager.clearSelection();

            this.selectionManager.clearSelection();

            this.transformManager.detach();
            this.groupTransformManager.detach();

            if (deletedAny) {
                this.historyManager?.saveState();
            }

            this._notifyGroupUI();

            return;
        }


        // ---------------------------------------------------------
        // Einzelauswahl löschen
        // ---------------------------------------------------------

        const selected = this.selectionManager.selectedObject;

        if (!selected) return;

        const brickId = selected.userData?.brickId;

        if (!brickId) return;

        const brick = this.library.getById(brickId);

        if (!brick) return;

        // Verbindungen entfernen.
        this.connectionManager.removeConnections(brick.id);

        // Gruppenmitgliedschaft entfernen.
        const group = this.groupManager
            .getGroupByBrickId(brick.id);

        if (group) {
            this.groupManager.removeBrickFromGroup(
                group.id,
                brick.id
            );
        }

        // Bauteil entfernen.
        const removed = this.library.removeBrick(brick);

        if (removed === false) return;

        // Auswahl und Transformation zurücksetzen.
        this.selectionManager.clearSelection();

        this.multiSelectionManager.clearSelection();

        this.transformManager.detach();
        this.groupTransformManager.detach();

        // History aktualisieren.
        this.historyManager?.saveState();

        this._notifyGroupUI();
    }


    // -------------------------------------------------------------
    // Gruppen erstellen
    // -------------------------------------------------------------

    groupSelected() {

        const bricks = this.multiSelectionManager
            .getSelectedBricks(this.library);

        if (bricks.length < 2) return;

        const name = window.prompt(
            'Gruppenname:',
            'Gruppe'
        );

        if (name === null) return;

        const groupName = name.trim() || 'Gruppe';

        this.groupManager.createGroup(
            bricks,
            groupName
        );

        this.historyManager?.saveState();

        this._notifyGroupUI();
    }


    // -------------------------------------------------------------
    // Gruppen auflösen
    // -------------------------------------------------------------

    ungroupSelected() {

        const bricks = this.multiSelectionManager
            .getSelectedBricks(this.library);

        const ids = new Set(
            bricks.map(brick => brick.id)
        );

        const groupIds = new Set();

        // Gruppen der Mehrfachauswahl ermitteln.
        for (const id of ids) {

            const group = this.groupManager
                .getGroupByBrickId(id);

            if (group) {
                groupIds.add(group.id);
            }
        }

        // Auch die Einzelauswahl berücksichtigen.
        const single = this.selectionManager.selectedObject;

        if (single) {

            const brickId = single.userData?.brickId;

            if (brickId) {

                const group = this.groupManager
                    .getGroupByBrickId(brickId);

                if (group) {
                    groupIds.add(group.id);
                }
            }
        }

        if (groupIds.size === 0) return;

        // Alle ermittelten Gruppen auflösen.
        for (const groupId of groupIds) {
            this.groupManager.ungroup(groupId);
        }

        this.historyManager?.saveState();

        this._notifyGroupUI();
    }


    // -------------------------------------------------------------
    // Kopieren
    // -------------------------------------------------------------

    copySelected() {

        const bricks = this._getActiveSelection();

        if (bricks.length === 0) return;

        const group = this.groupManager
            .getGroupByBrickId(bricks[0].id);

        this.copyPasteManager.copy(
            bricks,
            this.connectionManager,
            group?.name ?? null
        );
    }


    // -------------------------------------------------------------
    // Einfügen
    // -------------------------------------------------------------

    pasteSelected() {

        this.copyPasteManager.paste(
            this.library,
            this.connectionManager,
            this.groupManager,
            this.historyManager
        );

        this._notifyGroupUI();
    }


    // -------------------------------------------------------------
    // Duplizieren
    // -------------------------------------------------------------

    duplicateSelected() {

        const bricks = this._getActiveSelection();

        if (bricks.length === 0) return;

        this.copyPasteManager.duplicate(
            bricks,
            this.connectionManager,
            this.library,
            this.groupManager,
            this.historyManager
        );

        this._notifyGroupUI();
    }


    // -------------------------------------------------------------
    // Aktive Auswahl ermitteln
    // -------------------------------------------------------------

    /**
     * Gibt die aktuell aktiven Bauteile zurück.
     * Berücksichtigt Einzel- und Mehrfachauswahl.
     *
     * @returns {import('../objects/Brick.js').Brick[]}
     */
    _getActiveSelection() {

        const multiCount =
            this.multiSelectionManager.getSelectionCount();

        if (multiCount > 0) {

            return this.multiSelectionManager
                .getSelectedBricks(this.library);
        }

        const single = this.selectionManager.selectedObject;

        if (single) {

            const brickId = single.userData?.brickId;

            if (!brickId) return [];

            const brick = this.library.getById(brickId);

            return brick ? [brick] : [];
        }

        return [];
    }


    // -------------------------------------------------------------
    // Gruppen-UI aktualisieren
    // -------------------------------------------------------------

    _notifyGroupUI() {

        const bricks = this._getActiveSelection();

        const groupData = bricks.length > 0
            ? this.groupManager.getGroupByBrickId(bricks[0].id)
            : null;

        const count =
            this.multiSelectionManager.getSelectionCount() ||
            (this.selectionManager.selectedObject ? 1 : 0);

        this.onGroupUIUpdate?.(
            count,
            groupData?.name ?? null
        );
    }


    // -------------------------------------------------------------
    // Editor aufräumen
    // -------------------------------------------------------------

    dispose() {

        this.removePlacementEvents();

        this.placementManager.cancelPlacement();

        this.selectionBox.dispose?.();

        this.transformManager.detach();
        this.groupTransformManager.detach();

        this.multiSelectionManager.clearSelection();

        this.selectionManager.clearSelection();

        this.precisionManager?.dispose();
    }

    // -------------------------------------------------------------
// Aktive Baugruppe als Komponente speichern
// -------------------------------------------------------------

saveSelectedAsComponent(name = null) {
    const bricks = this._getActiveSelection();

    if (bricks.length === 0) {
        throw new Error('Es sind keine Bauteile ausgewählt.');
    }

    const group = this.groupManager.getGroupByBrickId(
        bricks[0].id
    );

    if (!group) {
        throw new Error(
            'Die ausgewählten Bauteile gehören keiner Baugruppe an.'
        );
    }

    const selectedIds = new Set(bricks.map(brick => brick.id));

    if (
        group.brickIds.length !== selectedIds.size ||
        group.brickIds.some(id => !selectedIds.has(id))
    ) {
        throw new Error(
            'Bitte wähle die gesamte Baugruppe aus, um sie als Komponente zu speichern.'
        );
    }

    return this.componentManager.saveGroup(
        group.id,
        name
    );
}


// -------------------------------------------------------------
// Komponente einsetzen
// -------------------------------------------------------------

insertComponent(componentId, position) {
    const result = this.componentManager.insert(
        componentId,
        position
    );

    // Neue Baugruppe auswählen.
    this.multiSelectionManager.setSelection(result.bricks);

    this._notifyGroupUI();

    return result;
}


// -------------------------------------------------------------
// Baugruppe duplizieren
// -------------------------------------------------------------

duplicateAssembly(groupId, offset = { x: 1, y: 0, z: 1 }) {
    const result = this.assemblyManager.duplicate(
        groupId,
        offset
    );

    this.multiSelectionManager.setSelection(
        result.bricks
    );

    this._notifyGroupUI();

    return result;
}

}
