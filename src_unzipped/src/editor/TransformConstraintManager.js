
export class TransformConstraintManager {

    constructor(snapSystem, collisionManager, library) {
        this.snapSystem = snapSystem;
        this.collisionManager = collisionManager;
        this.library = library;

        this.snapEnabled = true;
        this.collisionEnabled = true;
    }

    setSnapEnabled(enabled) {
        this.snapEnabled = Boolean(enabled);
    }

    setCollisionEnabled(enabled) {
        this.collisionEnabled = Boolean(enabled);
    }

    snapPosition(position) {
        if (!this.snapEnabled) {
            return {
                x: position.x,
                y: position.y,
                z: position.z
            };
        }

        return this.snapSystem.snapPosition(position);
    }

    isBrickValid(brick, position = brick.group.position,
                 rotationY = brick.group.rotation.y,
                 excludedIds = []) {

        if (!brick) return false;

        if (!this.collisionEnabled) return true;

        const excluded = new Set([
            brick.id,
            ...excludedIds
        ]);

        const otherBricks = this.library
            .getAll()
            .filter(other => !excluded.has(other.id));

        return !this.collisionManager.checkCollision(
            brick.type,
            {
                x: position.x,
                y: position.y,
                z: position.z
            },
            rotationY,
            otherBricks
        );
    }

    isSelectionValid(bricks) {
        if (!Array.isArray(bricks) || bricks.length === 0) {
            return false;
        }

        if (!this.collisionEnabled) return true;

        const selectedIds = new Set(bricks.map(brick => brick.id));

        const otherBricks = this.library
            .getAll()
            .filter(brick => !selectedIds.has(brick.id));

        for (const brick of bricks) {
            const valid = !this.collisionManager.checkCollision(
                brick.type,
                {
                    x: brick.group.position.x,
                    y: brick.group.position.y,
                    z: brick.group.position.z
                },
                brick.group.rotation.y,
                otherBricks
            );

            if (!valid) return false;
        }

        return true;
    }
}
