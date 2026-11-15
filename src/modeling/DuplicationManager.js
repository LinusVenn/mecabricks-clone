import { DuplicateCommand } from '../commands/DuplicateCommand.js';
import { createCloneData, addClonedPartFromData, removeClonedPart } from './PartCloneFactory.js';

const DEFAULT_OFFSET = Object.freeze({ x: 0, y: 2, z: 0 });

function newId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `part-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class DuplicationManager {
    constructor({ library, commandHistory, assemblyEditingManager = null }) {
        if (!library || !commandHistory) throw new Error('DuplicationManager benötigt library und commandHistory.');
        this.library = library;
        this.commandHistory = commandHistory;
        this.assemblyEditingManager = assemblyEditingManager;
    }

    _serialize(brick, offset = DEFAULT_OFFSET) {
        if (this.assemblyEditingManager && !this.assemblyEditingManager.canTransform(brick)) {
            throw new Error(`Bauteil ${brick.id} gehört zu einer gesperrten Baugruppe.`);
        }
        const p = brick.group.position;
        return createCloneData(brick, {
            x: p.x + (offset.x ?? 0),
            y: p.y + (offset.y ?? 0),
            z: p.z + (offset.z ?? 0)
        });
    }

    _command(createdBricks, description) {
        return new DuplicateCommand({
            createdBricks,
            removeFn: id => removeClonedPart(this.library, id),
            addFn: data => addClonedPartFromData(this.library, data),
            description
        });
    }

    async duplicate(brick, options = {}) {
        const data = this._serialize(brick, options.offset ?? DEFAULT_OFFSET);
        await this.commandHistory.execute(this._command([data], `Bauteil ${brick.id} duplizieren`));
        return this.library.getById(data.id);
    }

    async duplicateSelection(bricks, options = {}) {
        return this.duplicateWithOffset(bricks, options.offset ?? DEFAULT_OFFSET);
    }

    async duplicateWithOffset(bricks, offset = DEFAULT_OFFSET) {
        if (!Array.isArray(bricks) || bricks.length === 0) return [];
        const createdBricks = bricks.map(brick => this._serialize(brick, offset));
        await this.commandHistory.execute(this._command(createdBricks, `${createdBricks.length} Bauteile duplizieren`));
        return createdBricks.map(data => this.library.getById(data.id)).filter(Boolean);
    }
}
