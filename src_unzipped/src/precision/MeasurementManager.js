
import * as THREE from 'three';

export class MeasurementManager {
    constructor(editor) {
        this.editor = editor;
        this.scene = editor.sceneManager.scene;
        this.measurements = [];
    }

    _getBounds(brick) {
        brick.group.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(brick.group);
    }

    _createLine(start, end) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            start.clone(),
            end.clone()
        ]);

        const material = new THREE.LineBasicMaterial({
            color: 0xff9800,
            depthTest: false
        });

        const line = new THREE.Line(geometry, material);
        line.renderOrder = 999;
        this.scene.add(line);

        this.measurements.push(line);
        return line;
    }

    measurePoints(start, end, draw = true) {
        const a = new THREE.Vector3(start.x, start.y, start.z);
        const b = new THREE.Vector3(end.x, end.y, end.z);

        const distance = a.distanceTo(b);

        if (draw) {
            this._createLine(a, b);
        }

        return {
            start: a,
            end: b,
            distance,
            x: Math.abs(b.x - a.x),
            y: Math.abs(b.y - a.y),
            z: Math.abs(b.z - a.z)
        };
    }

    measureObjects(first, second, draw = true) {
        if (!first || !second) {
            throw new Error('Zwei Bauteile werden benötigt.');
        }

        const a = this._getBounds(first);
        const b = this._getBounds(second);

        const pointA = a.clampPoint(b.getCenter(new THREE.Vector3()), new THREE.Vector3());
        const pointB = b.clampPoint(pointA, new THREE.Vector3());

        return this.measurePoints(pointA, pointB, draw);
    }

    measureAxis(first, second, axis) {
        if (!['x', 'y', 'z'].includes(axis)) {
            throw new Error('Ungültige Messachse.');
        }

        const a = this._getBounds(first);
        const b = this._getBounds(second);

        const centerA = a.getCenter(new THREE.Vector3());
        const centerB = b.getCenter(new THREE.Vector3());

        return Math.abs(centerB[axis] - centerA[axis]);
    }

    getDimensions(brick) {
        const bounds = this._getBounds(brick);
        const size = bounds.getSize(new THREE.Vector3());

        return {
            width: size.x,
            height: size.y,
            depth: size.z,
            center: bounds.getCenter(new THREE.Vector3()),
            min: bounds.min.clone(),
            max: bounds.max.clone()
        };
    }

    getSelectionDimensions() {
        const bricks = this.editor._getActiveSelection();

        if (!bricks.length) return null;

        const bounds = new THREE.Box3();

        for (const brick of bricks) {
            bounds.union(this._getBounds(brick));
        }

        const size = bounds.getSize(new THREE.Vector3());

        return {
            width: size.x,
            height: size.y,
            depth: size.z,
            center: bounds.getCenter(new THREE.Vector3()),
            min: bounds.min.clone(),
            max: bounds.max.clone()
        };
    }

    clear() {
        for (const line of this.measurements) {
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }

        this.measurements = [];
    }

    dispose() {
        this.clear();
    }
}
