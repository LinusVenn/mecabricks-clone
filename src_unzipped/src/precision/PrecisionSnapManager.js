
import * as THREE from 'three';
import { STUD_PITCH } from '../utils/Constants.js';

export class PrecisionSnapManager {
    constructor(editor) {
        this.editor = editor;
        this.scene = editor.sceneManager.scene;
        this.camera = editor.sceneManager.camera;
        this.renderer = editor.sceneManager.renderer;

        this.enabled = true;
        this.mode = 'grid';
        this.threshold = 0.35;
        this.gridSize = STUD_PITCH;

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 12, 12),
            new THREE.MeshBasicMaterial({
                color: 0x00e5ff,
                depthTest: false
            })
        );

        this.marker.visible = false;
        this.marker.renderOrder = 1000;
        this.scene.add(this.marker);
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);

        if (!this.enabled) {
            this.marker.visible = false;
        }
    }

    setMode(mode) {
        const modes = [
            'grid',
            'vertex',
            'edge',
            'face',
            'center'
        ];

        if (!modes.includes(mode)) {
            throw new Error(`Unbekannter Snap-Modus: ${mode}`);
        }

        this.mode = mode;
    }

    setThreshold(value) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error('Der Snap-Abstand muss größer als 0 sein.');
        }

        this.threshold = value;
    }

    setGridSize(value) {
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error('Die Rastergröße muss größer als 0 sein.');
        }

        this.gridSize = value;
    }

    snapPoint(point, mode = this.mode) {
        if (!this.enabled) return point.clone();

        const result = point.clone();

        if (mode === 'grid') {
            result.x = Math.round(result.x / this.gridSize) * this.gridSize;
            result.y = Math.round(result.y / this.gridSize) * this.gridSize;
            result.z = Math.round(result.z / this.gridSize) * this.gridSize;
        }

        return result;
    }

    _getBrickObjects() {
        return this.editor.library
            .getAll()
            .map(brick => brick.group);
    }

    _getCenter(object) {
        object.updateMatrixWorld(true);

        return new THREE.Box3()
            .setFromObject(object)
            .getCenter(new THREE.Vector3());
    }

    _getVertices(object, hitPoint) {
        const candidates = [];

        object.traverse(child => {
            if (!child.isMesh || !child.geometry?.attributes?.position) {
                return;
            }

            child.updateMatrixWorld(true);

            const position = child.geometry.attributes.position;
            const world = new THREE.Vector3();

            for (let i = 0; i < position.count; i++) {
                world.fromBufferAttribute(position, i);
                world.applyMatrix4(child.matrixWorld);

                candidates.push(world.clone());
            }
        });

        candidates.sort((a, b) =>
            a.distanceToSquared(hitPoint) -
            b.distanceToSquared(hitPoint)
        );

        return candidates[0] ?? null;
    }

    _getEdgePoint(object, hitPoint) {
        const candidates = [];

        object.traverse(child => {
            if (!child.isMesh || !child.geometry) return;

            child.updateMatrixWorld(true);

            const edges = new THREE.EdgesGeometry(child.geometry);
            const positions = edges.attributes.position;
            const a = new THREE.Vector3();
            const b = new THREE.Vector3();

            for (let i = 0; i + 1 < positions.count; i += 2) {
                a.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
                b.fromBufferAttribute(positions, i + 1).applyMatrix4(child.matrixWorld);

                const segment = new THREE.Line3(a, b);
                const closest = segment.closestPointToPoint(
                    hitPoint,
                    true,
                    new THREE.Vector3()
                );

                candidates.push(closest.clone());
            }

            edges.dispose();
        });

        candidates.sort((a, b) =>
            a.distanceToSquared(hitPoint) -
            b.distanceToSquared(hitPoint)
        );

        return candidates[0] ?? null;
    }

    _showMarker(point) {
        this.marker.position.copy(point);
        this.marker.visible = true;
    }

    hideMarker() {
        this.marker.visible = false;
    }

    snapFromPointer(event, mode = this.mode) {
        if (!this.enabled) return null;

        const rect = this.renderer.domElement.getBoundingClientRect();

        this.pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const objects = this._getBrickObjects();
        const intersections = this.raycaster.intersectObjects(objects, true);

        if (!intersections.length) {
            this.hideMarker();
            return null;
        }

        const hit = intersections[0];
        let point = hit.point.clone();

        if (mode === 'grid') {
            point = this.snapPoint(point, 'grid');

        } else if (mode === 'center') {
            const root = this._findBrickRoot(hit.object);
            if (root) point = this._getCenter(root);

        } else if (mode === 'vertex') {
            const candidate = this._getVertices(hit.object, hit.point);
            if (candidate) point = candidate;

        } else if (mode === 'edge') {
            const candidate = this._getEdgePoint(hit.object, hit.point);
            if (candidate) point = candidate;

        } else if (mode !== 'face') {
            throw new Error(`Unbekannter Snap-Modus: ${mode}`);
        }

        if (point.distanceTo(hit.point) > this.threshold && mode !== 'face') {
            this.hideMarker();
            return null;
        }

        this._showMarker(point);

        return {
            point,
            object: hit.object,
            face: hit.face ?? null,
            distance: point.distanceTo(hit.point),
            mode
        };
    }

    _findBrickRoot(object) {
        let current = object;

        while (current) {
            if (current.userData?.brickId) {
                return current;
            }

            current = current.parent;
        }

        return null;
    }

    dispose() {
        this.scene.remove(this.marker);
        this.marker.geometry.dispose();
        this.marker.material.dispose();
    }
}
