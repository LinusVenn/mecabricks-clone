
import { SelectionManager }         from './SelectionManager.js';
import { TransformManager }         from './TransformManager.js';
import { InputManager }             from './InputManager.js';
import { MultiSelectionManager }    from './MultiSelectionManager.js';
import { SelectionBox }             from './SelectionBox.js';
import { GroupManager }             from './GroupManager.js';
import { GroupTransformManager }    from './GroupTransformManager.js';
import { CopyPasteManager }         from './CopyPasteManager.js';

import { PartPalette }      from '../ui/PartPalette.js';
import { SnapSystem }       from './SnapSystem.js';
import { CollisionManager } from './CollisionManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { PlacementPreview } from './PlacementPreview.js';
import { PlacementManager } from './PlacementManager.js';


export class Editor {

    constructor(sceneManager, library) {

        this.sceneManager = sceneManager;
        this.library      = library;

        const camera   = sceneManager.camera;
        const renderer = sceneManager.renderer;
        const scene    = sceneManager.scene;

        // ── Bestehende Systeme ────────────────────────────────────────────

        this.snapSystem       = new SnapSystem();
        this.collisionManager = new CollisionManager();
        this.connectionManager = new ConnectionManager();

        this.placementPreview = new PlacementPreview(scene);

        this.placementManager = new PlacementManager(
            camera, renderer, scene, library,
            this.snapSystem, this.collisionManager,
            this.connectionManager, this.placementPreview
        );

        this.selectionManager = new SelectionManager(camera, renderer, scene);

        this.transformManager = new TransformManager(
            camera, renderer, scene, sceneManager,
            this.collisionManager, this.library
        );

        this.inputManager = new InputManager(this);
        this.partPalette  = new PartPalette(this);

        /** @type {import('../history/HistoryManager.js').HistoryManager | null} */
        this.historyManager = null;

        // ── Phase 6: Mehrfachauswahl & Gruppen ───────────────────────────

        this.multiSelectionManager = new MultiSelectionManager();

        this.selectionBox = new SelectionBox(
            camera, renderer, this.multiSelectionManager, library, sceneManager.controls
        );

        // SelectionManager muss einen Space+Drag als Bereichsauswahl erkennen
        // und darf dabei keine normale Einzel-/Mehrfachauswahl auslösen.
        this.selectionManager.selectionBox = this.selectionBox;

        // Im Platzierungsmodus hat das Setzen eines Bauteils Vorrang.
        this.selectionBox.canStart = () => !this.placementManager.selectedPart;

        this.groupManager = new GroupManager();

        this.groupTransformManager = new GroupTransformManager(
            camera, renderer, scene, sceneManager,
            this.collisionManager, this.library
        );

        this.copyPasteManager = new CopyPasteManager();

        /**
         * Wird von main.js gesetzt und erlaubt Editor-Aktionen die UI
         * über den aktuellen Gruppenkontext zu informieren.
         * @type {((count: number, groupName: string|null) => void) | null}
         */
        this.onGroupUIUpdate = null;

        // ── Callbacks verdrahten ──────────────────────────────────────────

        this._wireCallbacks();
        this.setupPlacementEvents();
    }


    // -----------------------------------------------------------------------
    // Interne Verdrahtung
    // -----------------------------------------------------------------------

    _wireCallbacks() {

        // Einzelauswahl → TransformManager (bisheriges Verhalten)
        this.selectionManager.onSelectionChanged = (object) => {
            if (object) {
                // Einzelauswahl: GroupTransformManager deaktivieren
                this.groupTransformManager.detach();
                this.transformManager.attach(object);
            } else {
                this.transformManager.detach();
            }
        };

        // Strg-Klick → Mehrfachauswahl umschalten
        this.selectionManager.onCtrlClick = (brickId) => {
            const brick = this.library.getById(brickId);
            if (brick) {
                // Einzelauswahl aufheben (TransformManager loslassen)
                this.selectionManager.clearSelection();
                this.transformManager.detach();
                this.multiSelectionManager.toggleSelection(brick);
            }
        };

        // Klick auf leere Stelle → Mehrfachauswahl aufheben
        this.selectionManager.onEmptyClick = () => {
            this.multiSelectionManager.clearSelection();
            this.groupTransformManager.detach();
        };

        // Mehrfachauswahl-Änderung → GroupTransformManager oder aufheben
        this.multiSelectionManager.onSelectionChanged = (ids) => {
            if (ids.length > 1) {
                // Mehrere gewählt: GroupTransformManager übernimmt
                this.selectionManager.clearSelection();
                this.transformManager.detach();
                const bricks = this.multiSelectionManager.getSelectedBricks(this.library);
                this.groupTransformManager.attach(bricks);
            } else if (ids.length === 1) {
                // Genau einer: als Einzelauswahl behandeln
                this.groupTransformManager.detach();
                const brick = this.library.getById(ids[0]);
                if (brick) this.selectionManager.selectObject(brick.group);
            } else {
                // Leer: alles trennen
                this.groupTransformManager.detach();
            }
            this._notifyGroupUI();
        };

        // SelectionBox deaktivieren wenn Placement-Modus aktiv
        // (wird in setupPlacementEvents gesetzt)
    }


    // -----------------------------------------------------------------------
    // Platzierungs-Events
    // -----------------------------------------------------------------------

    setupPlacementEvents() {

        const canvas = this.sceneManager.renderer.domElement;

        canvas.addEventListener('pointermove', event => {
            this.placementManager.updatePreview(event);
        });

        canvas.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            if (!this.placementManager.selectedPart) return;
            if (this.selectionBox.isSpacePressed()) return;

            // Im Placement-Modus wird die Bereichsauswahl durch
            // selectionBox.canStart() blockiert.
            event.stopPropagation();
            this.placementManager.placeBrick();
        });

    }


    // -----------------------------------------------------------------------
    // Bauteile löschen
    // -----------------------------------------------------------------------

    deleteSelected() {

        const multiCount = this.multiSelectionManager.getSelectionCount();

        if (multiCount > 0) {
            // Mehrfachauswahl löschen
            const bricks = this.multiSelectionManager.getSelectedBricks(this.library);
            for (const brick of bricks) {
                this.connectionManager.removeConnections(brick.id);
                const group = this.groupManager.getGroupByBrickId(brick.id);
                if (group) this.groupManager.removeBrickFromGroup(group.id, brick.id);
                this.library.removeBrick(brick);
            }
            this.multiSelectionManager.clearSelection();
            this.groupTransformManager.detach();
            this.historyManager?.saveState();
            return;
        }

        // Einzelauswahl löschen (bestehendes Verhalten)
        const selected = this.selectionManager.selectedObject;
        if (!selected) return;

        const brick = this.library.getById(selected.userData.brickId);
        if (!brick) return;

        this.connectionManager.removeConnections(brick.id);
        const grp = this.groupManager.getGroupByBrickId(brick.id);
        if (grp) this.groupManager.removeBrickFromGroup(grp.id, brick.id);

        const removed = this.library.removeBrick(brick);
        if (!removed) return;

        this.selectionManager.clearSelection();
        this.historyManager?.saveState();
    }


    // -----------------------------------------------------------------------
    // Gruppen-Operationen
    // -----------------------------------------------------------------------

    groupSelected() {
        const bricks = this.multiSelectionManager.getSelectedBricks(this.library);
        if (bricks.length < 2) return;

        const name = window.prompt('Gruppenname:', 'Gruppe');
        if (name === null) return;   // Abbrechen

        this.groupManager.createGroup(bricks, name.trim() || 'Gruppe');
        this.historyManager?.saveState();
        this._notifyGroupUI();
    }

    ungroupSelected() {
        // Alle Gruppen der selektierten Steine auflösen
        const bricks = this.multiSelectionManager.getSelectedBricks(this.library);
        const ids = new Set(bricks.map(b => b.id));

        const groupIds = new Set();
        for (const id of ids) {
            const g = this.groupManager.getGroupByBrickId(id);
            if (g) groupIds.add(g.id);
        }

        // Auch einzeln ausgewählter Stein kann zu einer Gruppe gehören
        const single = this.selectionManager.selectedObject;
        if (single) {
            const g = this.groupManager.getGroupByBrickId(single.userData.brickId);
            if (g) groupIds.add(g.id);
        }

        if (groupIds.size === 0) return;

        for (const gId of groupIds) {
            this.groupManager.ungroup(gId);
        }

        this.historyManager?.saveState();
        this._notifyGroupUI();
    }


    // -----------------------------------------------------------------------
    // Kopieren / Einfügen / Duplizieren
    // -----------------------------------------------------------------------

    copySelected() {
        const bricks = this._getActiveSelection();
        if (bricks.length === 0) return;

        const g = bricks.length > 0
            ? this.groupManager.getGroupByBrickId(bricks[0].id)
            : null;

        this.copyPasteManager.copy(bricks, this.connectionManager, g?.name ?? null);
    }

    pasteSelected() {
        this.copyPasteManager.paste(
            this.library, this.connectionManager,
            this.groupManager, this.historyManager
        );
    }

    duplicateSelected() {
        const bricks = this._getActiveSelection();
        if (bricks.length === 0) return;
        this.copyPasteManager.duplicate(
            bricks, this.connectionManager,
            this.library, this.groupManager,
            this.historyManager
        );
    }


    // -----------------------------------------------------------------------
    // Hilfsmethoden
    // -----------------------------------------------------------------------

    /**
     * Gibt die aktuell aktiven Steine zurück (Mehrfach- oder Einzelauswahl).
     * @returns {import('../objects/Brick.js').Brick[]}
     */
    _getActiveSelection() {
        const multiCount = this.multiSelectionManager.getSelectionCount();
        if (multiCount > 0) {
            return this.multiSelectionManager.getSelectedBricks(this.library);
        }
        const single = this.selectionManager.selectedObject;
        if (single) {
            const brick = this.library.getById(single.userData.brickId);
            return brick ? [brick] : [];
        }
        return [];
    }

    _notifyGroupUI() {
        const bricks    = this._getActiveSelection();
        const groupData = bricks.length > 0
            ? this.groupManager.getGroupByBrickId(bricks[0].id)
            : null;
        const count     = this.multiSelectionManager.getSelectionCount() ||
                          (this.selectionManager.selectedObject ? 1 : 0);

        this.onGroupUIUpdate?.(count, groupData?.name ?? null);
    }
}
