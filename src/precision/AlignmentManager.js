
import * as THREE from 'three';

export class AlignmentManager {
    constructor(editor) {
        this.editor = editor;
    }

    _getBounds(brick) {
        brick.group.updateMatrixWorld(true);
        return new THREE.Box3().setFromObject(brick.group);
    }

    _getSelection() {
        return this.editor._getActiveSelection();
    }

    _getValue(box, axis, mode) {
        const min = box.min[axis];
        const max = box.max[axis];

        if (mode === 'min') return min;
        if (mode === 'max') return max;
        return (min + max) / 2;
    }

    _move(bricks, axis, mode, target) {
        if (!bricks.length) return false;

        const originals = bricks.map(brick => ({
            brick,
            position: brick.group.position.clone()
        }));

        try {
            for (const brick of bricks) {
                const bounds = this._getBounds(brick);
                const current = this._getValue(bounds, axis, mode);
                brick.group.position[axis] += target - current;
                brick.group.updateMatrixWorld(true);
            }

            if (
                this.editor.transformConstraintManager &&
                !this.editor.transformConstraintManager.isSelectionValid(bricks)
            ) {
                throw new Error('Die Ausrichtung verursacht eine ungültige Kollision.');
            }

            this.editor.historyManager?.saveState();
            return true;

        } catch (error) {
            for (const item of originals) {
                item.brick.group.position.copy(item.position);
                item.brick.group.updateMatrixWorld(true);
            }

            console.warn('Ausrichtung abgebrochen:', error.message);
            return false;
        }
    }

    align(axis, mode, referenceBrick = null) {
        const bricks = this._getSelection();

        if (!['x', 'y', 'z'].includes(axis)) {
            throw new Error('Ungültige Ausrichtungsachse.');
        }

        if (!['min', 'max', 'center'].includes(mode)) {
            throw new Error('Ungültiger Ausrichtungsmodus.');
        }

        if (!bricks.length) return false;

        if (referenceBrick) {
            if (bricks.includes(referenceBrick)) {
                throw new Error('Das Referenzobjekt darf nicht Teil der Auswahl sein.');
            }

            const target = this._getValue(
                this._getBounds(referenceBrick),
                axis,
                mode
            );

            return this._move(bricks, axis, mode, target);
        }

        if (bricks.length < 2) return false;

        const boxes = bricks.map(brick => this._getBounds(brick));

        let target;

        if (mode === 'min') {
            target = Math.min(...boxes.map(box => box.min[axis]));
        } else if (mode === 'max') {
            target = Math.max(...boxes.map(box => box.max[axis]));
        } else {
            const min = Math.min(...boxes.map(box => box.min[axis]));
            const max = Math.max(...boxes.map(box => box.max[axis]));
            target = (min + max) / 2;
        }

        return this._move(bricks, axis, mode, target);
    }

    alignLeft(reference = null) {
        return this.align('x', 'min', reference);
    }

    alignRight(reference = null) {
        return this.align('x', 'max', reference);
    }

    alignBottom(reference = null) {
        return this.align('y', 'min', reference);
    }

    alignTop(reference = null) {
        return this.align('y', 'max', reference);
    }

    alignFront(reference = null) {
        return this.align('z', 'min', reference);
    }

    alignBack(reference = null) {
        return this.align('z', 'max', reference);
    }

    alignCenterX(reference = null) {
        return this.align('x', 'center', reference);
    }

    alignCenterY(reference = null) {
        return this.align('y', 'center', reference);
    }

    alignCenterZ(reference = null) {
        return this.align('z', 'center', reference);
    }
}
