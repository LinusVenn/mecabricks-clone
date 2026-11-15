import * as THREE from 'three';
import { AlignmentCommand } from '../commands/AlignmentCommand.js';

const AXES = ['x', 'y', 'z'];

export class AlignmentManager {
    constructor({ precisionAlignmentManager = null, commandHistory, library = null, assemblyEditingManager = null, transformConstraintManager = null }) {
        if (!commandHistory) throw new Error('AlignmentManager benötigt commandHistory.');
        this._precision = precisionAlignmentManager;
        this._history = commandHistory;
        this._library = library;
        this._assemblyEditing = assemblyEditingManager;
        this._constraints = transformConstraintManager;
    }

    _assertAxis(axis) {
        if (!AXES.includes(axis)) throw new TypeError(`Ungültige Achse: ${axis}`);
    }

    _assertEditable(bricks) {
        for (const brick of bricks) {
            if (!brick?.group || (this._assemblyEditing && !this._assemblyEditing.canTransform(brick))) {
                throw new Error(`Bauteil ${brick?.id ?? '?'} kann nicht transformiert werden.`);
            }
        }
    }

    _bounds(brick) {
        brick.group.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(brick.group);
    }

    _positionMap(bricks) {
        return new Map(bricks.map(brick => [brick.id, {
            x: brick.group.position.x,
            y: brick.group.position.y,
            z: brick.group.position.z
        }]));
    }

    async _commit(bricks, before, after, description) {
        if (this._constraints?.isSelectionValid && this._constraints.collisionEnabled !== false) {
            let valid = false;
            try {
                for (const brick of bricks) {
                    const position = after.get(brick.id);
                    brick.group.position.set(position.x, position.y, position.z);
                    brick.group.updateMatrixWorld?.(true);
                }
                valid = this._constraints.isSelectionValid(bricks);
            } finally {
                for (const brick of bricks) {
                    const position = before.get(brick.id);
                    brick.group.position.set(position.x, position.y, position.z);
                    brick.group.updateMatrixWorld?.(true);
                }
            }
            if (!valid) throw new Error('Ausrichtung abgelehnt: Die resultierende Position verursacht eine Kollision.');
        }
        const command = new AlignmentCommand({ bricks, beforePositions: before, afterPositions: after, description });
        await this._history.execute(command);
        return true;
    }

    async alignAxis(bricks, axis, mode = 'center', referenceBrick = null) {
        this._assertAxis(axis);
        if (!['min', 'max', 'center'].includes(mode)) throw new TypeError(`Ungültiger Ausrichtungsmodus: ${mode}`);
        if (!Array.isArray(bricks) || bricks.length === 0) return false;
        if (referenceBrick && bricks.includes(referenceBrick)) throw new Error('Referenzbauteil darf nicht Teil der Auswahl sein.');
        this._assertEditable(bricks);

        const boxes = bricks.map(brick => ({ brick, box: this._bounds(brick) }));
        let target;
        if (referenceBrick) {
            const ref = this._bounds(referenceBrick);
            target = mode === 'min' ? ref.min[axis] : mode === 'max' ? ref.max[axis] : (ref.min[axis] + ref.max[axis]) / 2;
        } else {
            const min = Math.min(...boxes.map(item => item.box.min[axis]));
            const max = Math.max(...boxes.map(item => item.box.max[axis]));
            target = mode === 'min' ? min : mode === 'max' ? max : (min + max) / 2;
        }

        const before = this._positionMap(bricks);
        const after = new Map();
        for (const { brick, box } of boxes) {
            const current = mode === 'min' ? box.min[axis] : mode === 'max' ? box.max[axis] : (box.min[axis] + box.max[axis]) / 2;
            const position = { ...before.get(brick.id) };
            position[axis] += target - current;
            after.set(brick.id, position);
        }
        return this._commit(bricks, before, after, `Ausrichten ${axis.toUpperCase()} (${mode})`);
    }

    alignLeft(bricks, ref) { return this.alignAxis(bricks, 'x', 'min', ref); }
    alignRight(bricks, ref) { return this.alignAxis(bricks, 'x', 'max', ref); }
    alignCenterX(bricks, ref) { return this.alignAxis(bricks, 'x', 'center', ref); }
    alignBottom(bricks, ref) { return this.alignAxis(bricks, 'y', 'min', ref); }
    alignTop(bricks, ref) { return this.alignAxis(bricks, 'y', 'max', ref); }
    alignCenterY(bricks, ref) { return this.alignAxis(bricks, 'y', 'center', ref); }
    alignFront(bricks, ref) { return this.alignAxis(bricks, 'z', 'min', ref); }
    alignBack(bricks, ref) { return this.alignAxis(bricks, 'z', 'max', ref); }
    alignCenterZ(bricks, ref) { return this.alignAxis(bricks, 'z', 'center', ref); }

    async distribute(bricks, axis, spacing = null) {
        this._assertAxis(axis);
        if (!Array.isArray(bricks) || bricks.length < 3) return false;
        this._assertEditable(bricks);
        const sorted = [...bricks].sort((a, b) => this._bounds(a).min[axis] - this._bounds(b).min[axis]);
        const boxes = sorted.map(brick => ({ brick, box: this._bounds(brick) }));
        const start = boxes[0].box.min[axis];
        const end = boxes.at(-1).box.max[axis];
        const totalObjectSize = boxes.reduce((sum, item) => sum + (item.box.max[axis] - item.box.min[axis]), 0);
        const gap = spacing == null ? (end - start - totalObjectSize) / (boxes.length - 1) : spacing;
        if (!Number.isFinite(gap) || gap < 0) throw new RangeError('Abstand muss eine nichtnegative Zahl sein.');

        const before = this._positionMap(sorted);
        const after = new Map();
        let cursor = start;
        for (const item of boxes) {
            const position = { ...before.get(item.brick.id) };
            position[axis] += cursor - item.box.min[axis];
            after.set(item.brick.id, position);
            cursor += item.box.max[axis] - item.box.min[axis] + gap;
        }
        return this._commit(sorted, before, after, `Verteilen entlang ${axis.toUpperCase()}`);
    }

    async alignConnectionPoints(brickA, pointA, brickB, pointB) {
        if (!brickA?.group || !brickB?.group || !pointA || !pointB) throw new Error('Bauteile und Verbindungspunkte werden benötigt.');
        this._assertEditable([brickA]);
        const toWorld = (brick, point) => {
            const v = point.isVector3 ? point.clone() : new THREE.Vector3(point.x, point.y, point.z);
            return brick.group.localToWorld(v);
        };
        const worldA = toWorld(brickA, pointA);
        const worldB = toWorld(brickB, pointB);
        const delta = worldB.sub(worldA);
        const before = this._positionMap([brickA]);
        const after = new Map([[brickA.id, {
            x: before.get(brickA.id).x + delta.x,
            y: before.get(brickA.id).y + delta.y,
            z: before.get(brickA.id).z + delta.z
        }]]);
        return this._commit([brickA], before, after, 'Verbindungspunkte ausrichten');
    }
}
