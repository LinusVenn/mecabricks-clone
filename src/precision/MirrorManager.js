
import * as THREE from 'three';

export class MirrorManager {
    constructor(editor) {
        this.editor = editor;
    }

    mirror(axis, plane = 0) {
        if (!['x', 'y', 'z'].includes(axis)) {
            throw new Error('Ungültige Spiegelachse.');
        }

        if (!Number.isFinite(plane)) {
            throw new Error('Ungültige Spiegelebene.');
        }

        const bricks = this.editor._getActiveSelection();

        if (!bricks.length) return false;

        const originals = bricks.map(brick => ({
            brick,
            position: brick.group.position.clone(),
            rotation: brick.group.rotation.clone()
        }));

        try {
            for (const brick of bricks) {
                const position = brick.group.position;
                const rotation = brick.group.rotation;

                position[axis] = 2 * plane - position[axis];

                if (axis === 'x') {
                    rotation.y = -rotation.y;
                } else if (axis === 'z') {
                    rotation.y = Math.PI - rotation.y;
                }

                rotation.y = THREE.MathUtils.euclideanModulo(
                    rotation.y,
                    Math.PI * 2
                );

                brick.group.updateMatrixWorld(true);
            }

            if (
                this.editor.transformConstraintManager &&
                !this.editor.transformConstraintManager.isSelectionValid(bricks)
            ) {
                throw new Error('Die Spiegelung verursacht eine ungültige Kollision.');
            }

            this.editor.historyManager?.saveState();
            return true;

        } catch (error) {
            for (const item of originals) {
                item.brick.group.position.copy(item.position);
                item.brick.group.rotation.copy(item.rotation);
                item.brick.group.updateMatrixWorld(true);
            }

            console.warn('Spiegelung abgebrochen:', error.message);
            return false;
        }
    }

    mirrorX(plane = 0) {
        return this.mirror('x', plane);
    }

    mirrorY(plane = 0) {
        return this.mirror('y', plane);
    }

    mirrorZ(plane = 0) {
        return this.mirror('z', plane);
    }

    mirrorAroundSelectionCenter(axis) {
        const bricks = this.editor._getActiveSelection();

        if (!bricks.length) return false;

        const bounds = new THREE.Box3();

        for (const brick of bricks) {
            brick.group.updateMatrixWorld(true);
            bounds.union(new THREE.Box3().setFromObject(brick.group));
        }

        const center = bounds.getCenter(new THREE.Vector3());

        return this.mirror(axis, center[axis]);
    }
}
