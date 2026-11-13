
import * as THREE from 'three';

export class DistributionManager {
    constructor(editor) {
        this.editor = editor;
    }

    _bounds(brick) {
        brick.group.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(brick.group);
    }

    distribute(axis) {
        if (!['x', 'y', 'z'].includes(axis)) {
            throw new Error('Ungültige Verteilungsachse.');
        }

        const bricks = this.editor._getActiveSelection();

        if (bricks.length < 3) return false;

        const entries = bricks.map(brick => {
            const bounds = this._bounds(brick);

            return {
                brick,
                min: bounds.min[axis],
                max: bounds.max[axis],
                center: (bounds.min[axis] + bounds.max[axis]) / 2,
                size: bounds.max[axis] - bounds.min[axis]
            };
        });

        entries.sort((a, b) => a.center - b.center);

        const first = entries[0];
        const last = entries[entries.length - 1];

        const totalDistance = last.center - first.center;
        const step = totalDistance / (entries.length - 1);

        const originals = entries.map(entry => ({
            brick: entry.brick,
            position: entry.brick.group.position.clone()
        }));

        try {
            for (let i = 1; i < entries.length - 1; i++) {
                const entry = entries[i];
                const targetCenter = first.center + step * i;
                const delta = targetCenter - entry.center;

                entry.brick.group.position[axis] += delta;
                entry.brick.group.updateMatrixWorld(true);
            }

            if (
                this.editor.transformConstraintManager &&
                !this.editor.transformConstraintManager.isSelectionValid(
                    entries.map(entry => entry.brick)
                )
            ) {
                throw new Error('Die Verteilung verursacht eine ungültige Kollision.');
            }

            this.editor.historyManager?.saveState();
            return true;

        } catch (error) {
            for (const item of originals) {
                item.brick.group.position.copy(item.position);
                item.brick.group.updateMatrixWorld(true);
            }

            console.warn('Verteilung abgebrochen:', error.message);
            return false;
        }
    }

    distributeX() {
        return this.distribute('x');
    }

    distributeY() {
        return this.distribute('y');
    }

    distributeZ() {
        return this.distribute('z');
    }
}
