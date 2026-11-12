
import * as THREE from 'three';

export class SelectionManager {
    constructor(camera, renderer, scene) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.selectedObject = null;
        this.onSelectionChanged = null;

        /**
         * Wird bei Strg-/Cmd-Klick auf einen Stein aufgerufen.
         * Signatur: (brickId: string) => void
         * Erlaubt Editor.js, MultiSelectionManager.toggleSelection() zu rufen.
         * @type {((brickId: string) => void) | null}
         */
        this.onCtrlClick = null;

        /**
         * Wird aufgerufen, wenn auf eine leere Stelle geklickt wird
         * (kein Stein unter Cursor, kein Ctrl-Key).
         * @type {(() => void) | null}
         */
        this.onEmptyClick = null;

        this.renderer.domElement.addEventListener(
            'pointerdown',
            (event) => this.handleClick(event)
        );
    }

    handleClick(event) {
        if (event.button !== 0) return;

        // Space+Drag gehört ausschließlich der SelectionBox.
        // So wird beim Start der Bereichsauswahl kein einzelner Stein
        // versehentlich ausgewählt oder die bestehende Auswahl gelöscht.
        if (this.selectionBox?.isSpacePressed()) return;

        // Mausposition relativ zum Canvas berechnen
        const rect = this.renderer.domElement.getBoundingClientRect();

        this.mouse.x =
            ((event.clientX - rect.left) / rect.width) * 2 - 1;

        this.mouse.y =
            -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Strahl von der Kamera durch die Mausposition
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Highlight-Meshes ignorieren (userData.isHighlight)
        const objects = this.scene.children.filter(
            o => !o.userData?.isHighlight
        );

        const intersects = this.raycaster.intersectObjects(objects, true);

        // Erstes Objekt suchen, das zu einem Block gehört
        let selectedBrick = null;

        for (const intersection of intersects) {
            // Highlight-Meshes überspringen
            if (intersection.object.userData?.isHighlight) continue;

            let object = intersection.object;

            while (object) {
                if (object.userData.brickId !== undefined) {
                    selectedBrick = object;
                    break;
                }
                object = object.parent;
            }

            if (selectedBrick) break;
        }

        const isCtrl = event.ctrlKey || event.metaKey;

        if (selectedBrick) {
            if (isCtrl && this.onCtrlClick) {
                // Strg-/Cmd-Klick: zur Mehrfachauswahl hinzufügen/entfernen
                this.onCtrlClick(selectedBrick.userData.brickId);
                return;   // Einzelauswahl bleibt unverändert
            }

            // Normaler Klick: Mehrfachauswahl aufheben, Einzelauswahl setzen
            this.onEmptyClick?.();   // löscht MultiSelection in Editor
            this.selectObject(selectedBrick);
        } else {
            if (!isCtrl) {
                // Leere Stelle, kein Ctrl: alles abwählen
                this.onEmptyClick?.();
                this.clearSelection();
            }
            // Ctrl-Klick auf leere Stelle: nichts ändern
        }
    }

    selectObject(object) {
        this.selectedObject = object;
        this.onSelectionChanged?.(object);

        console.log('Block ausgewählt:', object.userData.brickId);
    }

    clearSelection() {
        this.selectedObject = null;
        this.onSelectionChanged?.(null);
    }
}
