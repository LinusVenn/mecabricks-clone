import { PatternCommand } from '../commands/DuplicateCommand.js';
import { createCloneData, addClonedPartFromData, removeClonedPart } from './PartCloneFactory.js';

function newId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `part-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
const AXES = ['x', 'y', 'z'];

export class PatternManager {
    constructor({ library, commandHistory, assemblyEditingManager = null }) {
        if (!library || !commandHistory) throw new Error('PatternManager benötigt library und commandHistory.');
        this._library = library;
        this._history = commandHistory;
        this._assemblyEditing = assemblyEditingManager;
    }

    _assertInputs(objects, count) {
        if (!Array.isArray(objects) || objects.length === 0) throw new Error('Mindestens ein Ausgangsbauteil auswählen.');
        if (!Number.isInteger(count) || count < 1 || count > 1000) throw new RangeError('count muss eine ganze Zahl zwischen 1 und 1000 sein.');
        for (const brick of objects) {
            if (!brick?.group || (this._assemblyEditing && !this._assemblyEditing.canTransform(brick))) {
                throw new Error(`Bauteil ${brick?.id ?? '?'} kann nicht kopiert werden.`);
            }
        }
    }

    _copy(brick, position, rotation = null) {
        return createCloneData(brick, position, rotation);
    }

    _execute(createdBricks, patternConfig) {
        const command = new PatternCommand({
            createdBricks,
            removeFn: id => removeClonedPart(this._library, id),
            addFn: data => addClonedPartFromData(this._library, data),
            patternConfig,
            description: `Muster erstellen (${patternConfig.type})`
        });
        return this._history.execute(command).then(() => createdBricks.map(data => this._library.getById(data.id)).filter(Boolean));
    }

    async createLinearPattern({ objects, axis = 'x', count, spacing }) {
        this._assertInputs(objects, count);
        if (!AXES.includes(axis) || !Number.isFinite(spacing) || spacing <= 0) throw new RangeError('Ungültige Achse oder spacing.');
        const created = [];
        for (const brick of objects) {
            const p = brick.group.position;
            for (let i = 1; i <= count; i++) {
                const position = { x: p.x, y: p.y, z: p.z };
                position[axis] += i * spacing;
                created.push(this._copy(brick, position));
            }
        }
        return this._execute(created, { type: 'linear', axis, count, spacing });
    }

    async createCircularPattern({ objects, axis = 'y', count, angle = Math.PI * 2 }) {
        this._assertInputs(objects, count);
        if (!AXES.includes(axis) || !Number.isFinite(angle) || angle <= 0 || angle > Math.PI * 2 + 1e-8) throw new RangeError('Ungültige Kreisachse oder Winkel.');
        const center = objects.reduce((acc, brick) => ({
            x: acc.x + brick.group.position.x / objects.length,
            y: acc.y + brick.group.position.y / objects.length,
            z: acc.z + brick.group.position.z / objects.length
        }), { x: 0, y: 0, z: 0 });
        const created = [];
        const step = angle / (count + 1);
        for (const brick of objects) {
            const p = brick.group.position;
            const r = brick.group.rotation;
            for (let i = 1; i <= count; i++) {
                const theta = step * i;
                const c = Math.cos(theta), s = Math.sin(theta);
                let position = { x: p.x, y: p.y, z: p.z };
                const rotation = { x: r.x, y: r.y, z: r.z };
                if (axis === 'x') {
                    const dy = p.y - center.y, dz = p.z - center.z;
                    position.y = center.y + dy * c - dz * s;
                    position.z = center.z + dy * s + dz * c;
                    rotation.x += theta;
                } else if (axis === 'y') {
                    const dx = p.x - center.x, dz = p.z - center.z;
                    position.x = center.x + dx * c + dz * s;
                    position.z = center.z - dx * s + dz * c;
                    rotation.y += theta;
                } else {
                    const dx = p.x - center.x, dy = p.y - center.y;
                    position.x = center.x + dx * c - dy * s;
                    position.y = center.y + dx * s + dy * c;
                    rotation.z += theta;
                }
                created.push(this._copy(brick, position, rotation));
            }
        }
        return this._execute(created, { type: 'circular', axis, count, angle, center });
    }

    async createGridPattern({ objects, countX, countY, spacingX, spacingY, plane = 'xy' }) {
        this._assertInputs(objects, countX);
        if (!Number.isInteger(countY) || countY < 1 || countY > 1000) throw new RangeError('countY muss zwischen 1 und 1000 liegen.');
        if (!Number.isFinite(spacingX) || !Number.isFinite(spacingY) || spacingX <= 0 || spacingY <= 0) throw new RangeError('Rasterabstände müssen positiv sein.');
        if (!['xy', 'xz', 'yz'].includes(plane)) throw new TypeError('plane muss xy, xz oder yz sein.');
        const [axisA, axisB] = plane.split('');
        const created = [];
        for (const brick of objects) {
            const p = brick.group.position;
            for (let ix = 0; ix < countX; ix++) for (let iy = 0; iy < countY; iy++) {
                if (ix === 0 && iy === 0) continue;
                const position = { x: p.x, y: p.y, z: p.z };
                position[axisA] += ix * spacingX;
                position[axisB] += iy * spacingY;
                created.push(this._copy(brick, position));
            }
        }
        return this._execute(created, { type: 'grid', countX, countY, spacingX, spacingY, plane });
    }
}
