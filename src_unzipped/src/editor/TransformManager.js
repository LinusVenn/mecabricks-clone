
import * as THREE from 'three';
import { TransformControls } from
    'three/addons/controls/TransformControls.js';

const MOVE_STEP = 0.5;

export class TransformManager {
    constructor(
        camera,
        renderer,
        scene,
        sceneManager,
        collisionManager,
        library
    ) {
        this.sceneManager = sceneManager;
        this.collisionManager = collisionManager;
        this.library = library;

        // Wird von main.js nach der Initialisierung gesetzt
        this.historyManager = null;

        this.selectedObject = null;

        // Letzte gültige Position
        this.lastValidPosition = null;

        // Ursprüngliche Position beim Start des Verschiebens
        this.startPosition = null;

        this.controls = new TransformControls(
            camera,
            renderer.domElement
        );

        this.controls.setMode('translate');

        // Beim Start des Ziehens Position speichern
        this.controls.addEventListener(
            'mouseDown',
            () => {
                if (!this.selectedObject) return;

                this.startPosition =
                    this.selectedObject.position.clone();

                this.lastValidPosition =
                    this.selectedObject.position.clone();
            }
        );

        // Bei jeder Veränderung Raster und Kollision prüfen
        this.controls.addEventListener(
            'objectChange',
            () => {
                this.handleObjectChange();
            }
        );

        // Beim Loslassen abschließend prüfen
        this.controls.addEventListener(
            'mouseUp',
            () => {
                this.handleMouseUp();
            }
        );

        // Kamera während des Ziehens deaktivieren
        this.controls.addEventListener(
            'dragging-changed',
            (event) => {
                sceneManager.controls.enabled = !event.value;
            }
        );

        scene.add(this.controls.getHelper());
    }

    attach(object) {
        if (!object) return;

        // Zur übergeordneten Brick-Gruppe wechseln
        let brickGroup = object;

        while (
            brickGroup.parent &&
            brickGroup.userData.brickId === undefined
        ) {
            brickGroup = brickGroup.parent;
        }

        if (brickGroup.userData.brickId !== undefined) {
            this.selectedObject = brickGroup;
            this.controls.attach(brickGroup);
        }
    }

    detach() {
        this.controls.detach();
        this.selectedObject = null;
        this.lastValidPosition = null;
        this.startPosition = null;
    }

    // Position auf halbe Studs einrasten lassen
    snapPosition(position) {
        position.x =
            Math.round(position.x / MOVE_STEP) * MOVE_STEP;

        position.z =
            Math.round(position.z / MOVE_STEP) * MOVE_STEP;

        position.y =
            Math.round(position.y / MOVE_STEP) * MOVE_STEP;

        return position;
    }

    // Prüfen, ob die aktuelle Position gültig ist
    isPositionValid(object) {
        const type = object.userData.type;

        if (!type) {
            console.error('Blocktyp fehlt in userData.type');
            return false;
        }

        // Alle anderen Steine berücksichtigen,
        // den gerade verschobenen Stein ausschließen
        const otherBricks = this.library
            .getAll()
            .filter(brick => brick.id !== object.userData.brickId);

        return !this.collisionManager.checkCollision(
            type,
            object.position,
            object.rotation.y,
            otherBricks
        );
    }

    handleObjectChange() {
        const object = this.selectedObject;

        if (!object) return;

        // Zuerst auf das halbe Stud-Raster einrasten
        this.snapPosition(object.position);

        // Weltmatrix aktualisieren
        object.updateMatrixWorld(true);

        if (this.isPositionValid(object)) {
            // Position ist gültig: als letzte gültige Position speichern
            this.lastValidPosition = object.position.clone();
        } else {
            // Position ist ungültig: zur letzten gültigen Position zurück
            if (this.lastValidPosition) {
                object.position.copy(this.lastValidPosition);
                object.updateMatrixWorld(true);
            }
        }
    }

    handleMouseUp() {
        const object = this.selectedObject;

        if (!object) return;

        // Abschließende Kollisionsprüfung
        this.snapPosition(object.position);
        object.updateMatrixWorld(true);

        if (!this.isPositionValid(object)) {
            // Kollision — Position zurücksetzen, kein Snapshot
            if (this.lastValidPosition) {
                object.position.copy(this.lastValidPosition);
            } else if (this.startPosition) {
                object.position.copy(this.startPosition);
            }
            object.updateMatrixWorld(true);
            return;
        }

        object.updateMatrixWorld(true);

        // Bewegung erfolgreich abgeschlossen — Zustand speichern
        this.historyManager?.saveState();
    }

    setMode(mode) {
        this.controls.setMode(mode);
    }

    rotateSelected() {
        const object = this.selectedObject;

        if (!object) return;

        object.rotation.y += Math.PI / 2;

        // Nach Drehung Kollisionsprüfung durchführen
        object.updateMatrixWorld(true);

        if (!this.isPositionValid(object)) {
            // Kollision — Drehung zurücksetzen, kein Snapshot
            object.rotation.y -= Math.PI / 2;
            object.updateMatrixWorld(true);
            return;
        }

        // Drehung erfolgreich — Zustand speichern
        this.historyManager?.saveState();
    }
}
