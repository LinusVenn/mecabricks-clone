import { Command } from './Command.js';

export class AlignmentCommand extends Command {
    constructor({ bricks, beforePositions, afterPositions, description = 'Align' }) {
        super(description);
        this.bricks = bricks;
        this.beforePositions = beforePositions instanceof Map
            ? beforePositions : new Map(Object.entries(beforePositions ?? {}));
        this.afterPositions = afterPositions instanceof Map
            ? afterPositions : new Map(Object.entries(afterPositions ?? {}));
    }

    async execute() { this._apply(this.afterPositions); }
    async undo() { this._apply(this.beforePositions); }

    _apply(positions) {
        for (const brick of this.bricks) {
            const position = positions.get(brick.id);
            if (position) brick.group.position.set(position.x, position.y, position.z);
            brick.group.updateMatrixWorld?.(true);
        }
    }

    toOperation() { return this._operation(this.afterPositions); }
    toUndoOperation() { return this._operation(this.beforePositions); }

    _operation(positions) {
        return {
            type: 'PARTS_ALIGNED',
            payload: { entries: [...positions].map(([instanceId, position]) => ({ instanceId, position })) }
        };
    }
}
