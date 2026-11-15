import { TransformCommand } from '../commands/TransformCommand.js';

const AXES = ['x', 'y', 'z'];
const IDENTITY = Object.freeze({
    position: Object.freeze({ x: 0, y: 0, z: 0 }),
    rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
    scale: Object.freeze({ x: 1, y: 1, z: 1 })
});

function vector(value, name, defaults) {
    const result = {};
    for (const axis of AXES) {
        const number = value?.[axis] ?? defaults[axis];
        if (!Number.isFinite(number)) throw new TypeError(`${name}.${axis} muss eine endliche Zahl sein.`);
        result[axis] = number;
    }
    return result;
}

function snapshotBrick(brick) {
    const group = brick?.group;
    if (!group?.position || !group?.rotation || !group?.scale) {
        throw new Error(`Bauteil ${brick?.id ?? '(ohne ID)'} besitzt keine vollständige Three.js-Transformation.`);
    }
    return {
        position: vector(group.position, 'position', IDENTITY.position),
        rotation: vector(group.rotation, 'rotation', IDENTITY.rotation),
        scale: vector(group.scale, 'scale', IDENTITY.scale)
    };
}

function applyState(brick, state) {
    if (state.position) brick.group.position.set(state.position.x, state.position.y, state.position.z);
    if (state.rotation) brick.group.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
    if (state.scale) brick.group.scale.set(state.scale.x, state.scale.y, state.scale.z);
    brick.group.updateMatrix?.();
    brick.group.updateMatrixWorld?.(true);
}

export class TransformManager {
    constructor({ library, commandHistory, historyManager = null, assemblyEditingManager = null, transformConstraintManager = null }) {
        if (!library || !commandHistory) throw new Error('TransformManager benötigt library und commandHistory.');
        this.library = library;
        this.commandHistory = commandHistory;
        this.historyManager = historyManager;
        this.assemblyEditingManager = assemblyEditingManager;
        this.transformConstraintManager = transformConstraintManager;
    }

    _assertTransformable(brick) {
        if (!brick?.id || !this.library.getById(brick.id)) throw new Error('Bauteil ist nicht mehr in der PartLibrary vorhanden.');
        snapshotBrick(brick);
        if (this.assemblyEditingManager && !this.assemblyEditingManager.canTransform(brick)) {
            throw new Error(`Bauteil ${brick.id} gehört zu einer gesperrten Baugruppe.`);
        }
    }

    getTransform(brick) { this._assertTransformable(brick); return snapshotBrick(brick); }

    async setPosition(brick, position) { return this.applyTransform(brick, { position }); }
    async setRotation(brick, rotation) { return this.applyTransform(brick, { rotation }); }
    async setScale(brick, scale) {
        const normalized = vector(scale, 'scale', IDENTITY.scale);
        if (AXES.some(axis => normalized[axis] <= 0)) throw new RangeError('Skalierungswerte müssen größer als 0 sein.');
        return this.applyTransform(brick, { scale: normalized });
    }

    async translate(brick, offset) {
        const current = this.getTransform(brick);
        const delta = vector(offset, 'offset', { x: 0, y: 0, z: 0 });
        return this.setPosition(brick, {
            x: current.position.x + delta.x,
            y: current.position.y + delta.y,
            z: current.position.z + delta.z
        });
    }

    async rotate(brick, axis, angle) {
        if (!AXES.includes(axis) || !Number.isFinite(angle)) throw new TypeError('Ungültige Rotationsachse oder Winkel.');
        const current = this.getTransform(brick);
        const rotation = { ...current.rotation, [axis]: current.rotation[axis] + angle };
        return this.setRotation(brick, rotation);
    }

    async resetTransform(brick) { return this.applyTransform(brick, IDENTITY); }

    async applyTransform(brick, partialTransform) {
        this._assertTransformable(brick);
        const before = snapshotBrick(brick);
        const after = {
            position: partialTransform.position ? vector(partialTransform.position, 'position', before.position) : before.position,
            rotation: partialTransform.rotation ? vector(partialTransform.rotation, 'rotation', before.rotation) : before.rotation,
            scale: partialTransform.scale ? vector(partialTransform.scale, 'scale', before.scale) : before.scale
        };
        if (AXES.some(axis => after.scale[axis] <= 0)) throw new RangeError('Skalierungswerte müssen größer als 0 sein.');
        const beforeStates = new Map([[brick.id, before]]);
        const afterStates = new Map([[brick.id, after]]);
        this._assertCollisionFree([brick], beforeStates, afterStates);
        const command = new TransformCommand({
            bricks: [brick],
            transformFn: applyState,
            beforeStates,
            afterStates,
            description: 'Bauteil transformieren'
        });
        await this.commandHistory.execute(command);
        return after;
    }

    _assertCollisionFree(bricks, beforeStates, afterStates) {
        if (!this.transformConstraintManager?.isSelectionValid || this.transformConstraintManager.collisionEnabled === false) return;
        let valid = false;
        try {
            for (const brick of bricks) applyState(brick, afterStates.get(brick.id));
            valid = this.transformConstraintManager.isSelectionValid(bricks);
        } finally {
            for (const brick of bricks) applyState(brick, beforeStates.get(brick.id));
        }
        if (!valid) throw new Error('Transformation abgelehnt: Die resultierende Auswahl kollidiert mit anderen Bauteilen.');
    }

    async applyToSelection(bricks, transformFactory) {
        if (!Array.isArray(bricks) || bricks.length === 0) return false;
        const beforeStates = new Map();
        const afterStates = new Map();
        for (const brick of bricks) {
            this._assertTransformable(brick);
            const before = snapshotBrick(brick);
            const requested = typeof transformFactory === 'function' ? transformFactory(brick, before) : transformFactory;
            beforeStates.set(brick.id, before);
            afterStates.set(brick.id, {
                position: requested.position ? vector(requested.position, 'position', before.position) : before.position,
                rotation: requested.rotation ? vector(requested.rotation, 'rotation', before.rotation) : before.rotation,
                scale: requested.scale ? vector(requested.scale, 'scale', before.scale) : before.scale
            });
        }
        this._assertCollisionFree(bricks, beforeStates, afterStates);
        const command = new TransformCommand({ bricks, transformFn: applyState, beforeStates, afterStates, description: 'Auswahl transformieren' });
        await this.commandHistory.execute(command);
        return true;
    }
}
