
import { Brick } from './Brick.js';

export class PartLibrary {

    constructor(scene) {
        this.scene = scene;
        this.parts = [];
    }

    // Neuen Stein erstellen
    addBrick(
        x,
        y,
        z,
        color,
        type = 'brick_2x4'
    ) {
        const brick = new Brick(
            this.scene,
            x,
            y,
            z,
            color,
            type
        );

        this.parts.push(brick);

        return brick;
    }

    // Stein aus gespeicherten Daten wiederherstellen
    addBrickFromData(data) {
        if (!data || !data.id || !data.type) {
            throw new Error('Ungültige Steindaten.');
        }

        if (this.hasId(data.id)) {
            throw new Error(
                `Die Stein-ID ${data.id} existiert bereits.`
            );
        }

        if (!data.position || !data.rotation) {
            throw new Error(
                'Position oder Rotation fehlt.'
            );
        }

        const brick = new Brick(
            this.scene,
            data.position.x,
            data.position.y,
            data.position.z,
            data.color,
            data.type,
            data.id
        );

        brick.setTransform(
            data.position,
            data.rotation
        );

        this.parts.push(brick);

        return brick;
    }

    // Stein anhand seiner ID suchen
    getById(id) {
        return this.parts.find(
            brick => brick.id === id
        ) || null;
    }

    // Prüfen, ob eine ID bereits existiert
    hasId(id) {
        return this.parts.some(
            brick => brick.id === id
        );
    }

    // Alle Steine zurückgeben
    getAll() {
        return [...this.parts];
    }

    // Alle Steine als einfache Daten zurückgeben
    getAllData() {
        return this.parts.map(
            brick => brick.toData()
        );
    }

    // Stein entfernen
    removeBrick(brick) {
        const index = this.parts.indexOf(brick);

        if (index === -1) {
            return false;
        }

        brick.dispose();

        this.parts.splice(index, 1);

        return true;
    }

    // Alle Steine entfernen
    clear() {
        for (const brick of this.parts) {
            brick.dispose();
        }

        this.parts = [];
    }

    // Anzahl der Steine zurückgeben
    getCount() {
        return this.parts.length;
    }
}
