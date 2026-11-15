import { Command } from './Command.js';

export class TransformCommand extends Command {
    constructor({ bricks, transformFn, beforeStates, afterStates, description = 'Transform' }) {
        super(description);
        this.bricks = bricks;
        this.transformFn = transformFn;
        this.beforeStates = beforeStates;
        this.afterStates = afterStates;
    }

    async execute() { this._apply(this.afterStates); }
    async undo() { this._apply(this.beforeStates); }

    _apply(states) {
        for (const brick of this.bricks) {
            const state = states.get(brick.id);
            if (state) this.transformFn(brick, state);
        }
    }

    toOperation() { return this._operation(this.afterStates); }
    toUndoOperation() { return this._operation(this.beforeStates); }

    _operation(states) {
        return {
            type: 'PART_TRANSFORMED',
            payload: {
                entries: [...states].map(([instanceId, matrix]) => ({ instanceId, matrix }))
            }
        };
    }
}
