
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ROTATION_STEP } from '../utils/Constants.js';

// =====================================================================
// GroupTransformManager
//
// Ermöglicht das gemeinsame Verschieben und Drehen aller ausgewählten
// Bauteile über einen unsichtbaren "Pivot"-Punkt.
//
// Prinzip:
//   1. Pivot-Gruppe wird am geometrischen Mittelpunkt der Selektion
//      positioniert und bekommt die TransformControls.
//   2. Beim Verschieben des Pivots wird dasselbe Delta auf alle
//      ausgewählten Steine angewendet.
//   3. Am Ende wird einmalig auf Kollision geprüft; bei Fehler werden
//      alle Ursprungspositionen wiederhergestellt.
//
// Regeln:
//   - Snap auf 0.5-Einheiten-Raster (MOVE_STEP).
//   - Kollision nur gegen Steine außerhalb der Auswahl (keine
//     Selbstkollision innerhalb der Gruppe).
//   - History-Snapshot wird erst nach erfolgreichem mouseUp gespeichert.
// =====================================================================

const MOVE_STEP = 0.5;

export class GroupTransformManager {

    /**
     * @param {THREE.Camera}        camera
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Scene}         scene
     * @param {object}              sceneManager     { controls: OrbitControls }
     * @param {object}              collisionManager
     * @param {import('../objects/PartLibrary.js').PartLibrary} library
     */
    constructor(camera, renderer, scene, sceneManager, collisionManager, library) {
        this._camera           = camera;
        this._renderer         = renderer;
        this._scene            = scene;
        this._sceneManager     = sceneManager;
        this._collisionManager = collisionManager;
        this._library          = library;

        // Unsichtbarer Pivot
        this._pivot = new THREE.Group();
        this._pivot.userData.isPivot = true;
        this._scene.add(this._pivot);

        // TransformControls für den Pivot
        this._controls = new TransformControls(camera, renderer.domElement);
        this._controls.setMode('translate');
        this._scene.add(this._controls.getHelper());

        /** @type {import('../objects/Brick.js').Brick[]} */
        this._selectedBricks    = [];

        /** @type {Map<string, THREE.Vector3>} brickId → Originalposition */
        this._originalPositions = new Map();

        /** @type {Map<string, number>} brickId → original rotation.y */
        this._originalRotations = new Map();

        this._pivotStart = new THREE.Vector3();
        this._pivotStartRotation = new THREE.Euler();
        this._active     = false;

        /** @type {import('../history/HistoryManager.js').HistoryManager | null} */
        this.historyManager = null;

        this._bindControlsEvents();
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /**
     * GroupTransformManager für eine Menge ausgewählter Steine aktivieren.
     * @param {import('../objects/Brick.js').Brick[]} bricks
     */
    attach(bricks) {
        if (!bricks || bricks.length === 0) {
            this.detach();
            return;
        }

        this._selectedBricks = [...bricks];
        this._active         = true;

        const center = this._computeCenter();
        this._pivot.position.copy(center);
        this._controls.attach(this._pivot);
    }

    /** Trennt den Manager. */
    detach() {
        this._controls.detach();
        this._selectedBricks    = [];
        this._originalPositions.clear();
        this._originalRotations.clear();
        this._active = false;
    }

    /**
     * Alle ausgewählten Steine um 90° (ROTATION_STEP) um die Y-Achse
     * drehen, bezogen auf den gemeinsamen Mittelpunkt.
     *
     * @returns {boolean} true wenn Drehung erfolgreich (keine Kollision)
     */
    rotateSelection() {
        if (this._selectedBricks.length === 0) return false;

        const center = this._computeCenter();

        // Zustände sichern
        const saved = this._selectedBricks.map(b => ({
            brick:    b,
            position: b.group.position.clone(),
            rotY:     b.group.rotation.y,
        }));

        // Rotation anwenden
        const axis  = new THREE.Vector3(0, 1, 0);
        const angle = ROTATION_STEP;

        for (const b of this._selectedBricks) {
            // Position um Pivot rotieren
            const offset = b.group.position.clone().sub(center);
            offset.applyAxisAngle(axis, angle);
            const newPos = center.clone().add(offset);

            // Auf Raster einrasten
            b.group.position.x = Math.round(newPos.x / MOVE_STEP) * MOVE_STEP;
            b.group.position.y = newPos.y;
            b.group.position.z = Math.round(newPos.z / MOVE_STEP) * MOVE_STEP;

            // Eigene Rotation
            b.group.rotation.y += angle;
        }

        // Kollisionsprüfung
        if (this._hasCollision()) {
            for (const { brick, position, rotY } of saved) {
                brick.group.position.copy(position);
                brick.group.rotation.y = rotY;
            }
            return false;
        }

        this.historyManager?.saveState();
        return true;
    }

    /** Setzt den Transformationsmodus ('translate' oder 'rotate'). */
    setMode(mode) {
        this._controls.setMode(mode);
    }


    // ------------------------------------------------------------------
    // TransformControls-Events
    // ------------------------------------------------------------------

    
_bindControlsEvents() {

    this._controls.addEventListener('mouseDown', () => {

        this._pivotStart.copy(this._pivot.position);
        this._pivotStartRotation.copy(this._pivot.rotation);

        this._originalPositions.clear();
        this._originalRotations.clear();

        for (const brick of this._selectedBricks) {
            this._originalPositions.set(
                brick.id,
                brick.group.position.clone()
            );

            this._originalRotations.set(
                brick.id,
                brick.group.rotation.clone()
            );
        }
    });

    this._controls.addEventListener('objectChange', () => {

        if (this._controls.mode === 'translate') {

            const delta = this._pivot.position.clone()
                .sub(this._pivotStart);

            const snappedDelta = new THREE.Vector3(
                Math.round(delta.x / MOVE_STEP) * MOVE_STEP,
                Math.round(delta.y / MOVE_STEP) * MOVE_STEP,
                Math.round(delta.z / MOVE_STEP) * MOVE_STEP
            );

            for (const brick of this._selectedBricks) {
                const original = this._originalPositions.get(brick.id);

                if (original) {
                    brick.group.position.copy(original).add(snappedDelta);
                    brick.group.updateMatrixWorld(true);
                }
            }

        } else if (this._controls.mode === 'rotate') {

            const rawAngle = this._pivot.rotation.y -
                this._pivotStartRotation.y;

            const angle = Math.round(
                rawAngle / ROTATION_STEP
            ) * ROTATION_STEP;

            const axis = new THREE.Vector3(0, 1, 0);

            for (const brick of this._selectedBricks) {

                const originalPosition =
                    this._originalPositions.get(brick.id);

                const originalRotation =
                    this._originalRotations.get(brick.id);

                if (!originalPosition || !originalRotation) continue;

                const offset = originalPosition.clone()
                    .sub(this._pivotStart);

                offset.applyAxisAngle(axis, angle);

                brick.group.position.copy(
                    this._pivotStart.clone().add(offset)
                );

                brick.group.rotation.copy(originalRotation);
                brick.group.rotation.y += angle;

                brick.group.updateMatrixWorld(true);
            }
        }
    });

    this._controls.addEventListener('mouseUp', () => {

        const mode = this._controls.mode;

        let changed = false;

        if (mode === 'translate') {

            const delta = this._pivot.position.clone()
                .sub(this._pivotStart);

            const snappedDelta = new THREE.Vector3(
                Math.round(delta.x / MOVE_STEP) * MOVE_STEP,
                Math.round(delta.y / MOVE_STEP) * MOVE_STEP,
                Math.round(delta.z / MOVE_STEP) * MOVE_STEP
            );

            changed = snappedDelta.lengthSq() > 0;

        } else if (mode === 'rotate') {

            const rawAngle = this._pivot.rotation.y -
                this._pivotStartRotation.y;

            const angle = Math.round(
                rawAngle / ROTATION_STEP
            ) * ROTATION_STEP;

            changed = Math.abs(angle) > 0.000001;
        }

        if (!changed) return;

        if (this._hasCollision()) {

            for (const brick of this._selectedBricks) {

                const position =
                    this._originalPositions.get(brick.id);

                const rotation =
                    this._originalRotations.get(brick.id);

                if (position) {
                    brick.group.position.copy(position);
                }

                if (rotation) {
                    brick.group.rotation.copy(rotation);
                }

                brick.group.updateMatrixWorld(true);
            }

            this._pivot.position.copy(this._pivotStart);
            this._pivot.rotation.copy(this._pivotStartRotation);

        } else {

            this.historyManager?.saveState();

        }
    });

    this._controls.addEventListener('dragging-changed', (event) => {

        if (this._sceneManager?.controls) {
            this._sceneManager.controls.enabled = !event.value;
        }
    });
}



    // ------------------------------------------------------------------
    // Hilfsmethoden
    // ------------------------------------------------------------------

    /**
     * Geometrischer Mittelpunkt aller ausgewählten Steine.
     * @returns {THREE.Vector3}
     */
    _computeCenter() {
        const center = new THREE.Vector3();
        if (this._selectedBricks.length === 0) return center;

        for (const b of this._selectedBricks) {
            center.add(b.group.position);
        }
        center.divideScalar(this._selectedBricks.length);
        return center;
    }

    /**
     * Prüft ob einer der ausgewählten Steine mit einem Stein außerhalb
     * der Auswahl kollidiert. Mitglieder der Auswahl werden ignoriert
     * (sie dürfen sich gegenseitig nicht neu blockieren).
     *
     * @returns {boolean}
     */
    _hasCollision() {
        const selectedIds = new Set(this._selectedBricks.map(b => b.id));
        const others      = this._library.getAll().filter(b => !selectedIds.has(b.id));

        for (const b of this._selectedBricks) {
            const pos = b.group.position;
            const rot = b.group.rotation.y;

            if (this._collisionManager.checkCollision(
                b.type,
                { x: pos.x, y: pos.y, z: pos.z },
                rot,
                others,
            )) {
                return true;
            }
        }
        return false;
    }

    dispose() {
        this._controls.detach();
        this._controls.dispose();
        this._scene.remove(this._pivot);
    }
}
