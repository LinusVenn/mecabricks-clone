import * as THREE from 'three';
export class TransformInputManager {

    constructor(editor, constraintManager) {
        this.editor = editor;
        this.constraints = constraintManager;
    }

    getSelectedBricks() {
        return this.editor._getActiveSelection();
    }

    setPosition(axis, value) {
        if (!['x', 'y', 'z'].includes(axis)) {
            throw new Error('Ungültige Positionsachse.');
        }

        const numericValue = Number(value);

        if (!Number.isFinite(numericValue)) {
            throw new Error('Position muss eine gültige Zahl sein.');
        }

        const bricks = this.getSelectedBricks();

        if (bricks.length === 0) return false;

        const originals = bricks.map(brick => ({
            brick,
            position: brick.group.position.clone()
        }));

        if (bricks.length === 1) {
            const brick = bricks[0];

            const position = this.constraints.snapPosition({
                x: brick.group.position.x,
                y: brick.group.position.y,
                z: brick.group.position.z
            });

            position[axis] = numericValue;

            const snapped = this.constraints.snapPosition(position);

            brick.group.position.set(
                snapped.x,
                snapped.y,
                snapped.z
            );

        } else {
            const center = this.getCenter(bricks);
            const delta = numericValue - center[axis];

            for (const brick of bricks) {
                const position = {
                    x: brick.group.position.x,
                    y: brick.group.position.y,
                    z: brick.group.position.z
                };

                position[axis] += delta;

                const snapped = this.constraints.snapPosition(position);

                brick.group.position.set(
                    snapped.x,
                    snapped.y,
                    snapped.z
                );
            }
        }

        if (!this.constraints.isSelectionValid(bricks)) {
            this.restorePositions(originals);
            return false;
        }

        this.saveHistory();
        return true;
    }

    
    setRotationY(degrees) {
        const numericValue = Number(degrees);

        if (!Number.isFinite(numericValue)) {
            throw new Error('Rotation muss eine gültige Zahl sein.');
        }

        const bricks = this.getSelectedBricks();

        if (bricks.length === 0) return false;

        const radians = numericValue * Math.PI / 180;

        const originals = bricks.map(brick => ({
            brick,
            position: brick.group.position.clone(),
            rotation: brick.group.rotation.clone()
        }));

        if (bricks.length === 1) {
            bricks[0].group.rotation.y = radians;
        } else {
            const center = this.getCenter(bricks);

            // Alle Bauteile erhalten denselben Drehwinkel.
            // Dadurch bleiben ihre relativen Positionen erhalten.
            const delta = radians - bricks[0].group.rotation.y;
            const axis = new THREE.Vector3(0, 1, 0);

            for (const brick of bricks) {
                const offset = brick.group.position.clone().sub(
                    new THREE.Vector3(center.x, center.y, center.z)
                );

                offset.applyAxisAngle(axis, delta);

                brick.group.position.set(
                    center.x + offset.x,
                    center.y + offset.y,
                    center.z + offset.z
                );

                brick.group.rotation.y += delta;
            }
        }

        if (!this.constraints.isSelectionValid(bricks)) {
            this.restoreTransforms(originals);
            return false;
        }

        this.saveHistory();
        return true;
    }


    getCenter(bricks) {
        const center = { x: 0, y: 0, z: 0 };

        if (bricks.length === 0) return center;

        for (const brick of bricks) {
            center.x += brick.group.position.x;
            center.y += brick.group.position.y;
            center.z += brick.group.position.z;
        }

        center.x /= bricks.length;
        center.y /= bricks.length;
        center.z /= bricks.length;

        return center;
    }

    restorePositions(originals) {
        for (const item of originals) {
            item.brick.group.position.copy(item.position);
            item.brick.group.updateMatrixWorld(true);
        }
    }

    restoreTransforms(originals) {
        for (const item of originals) {
            item.brick.group.position.copy(item.position);
            item.brick.group.rotation.copy(item.rotation);
            item.brick.group.updateMatrixWorld(true);
        }
    }

    saveHistory() {
        this.editor.historyManager?.saveState();
    }
}
