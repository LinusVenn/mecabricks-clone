function generateComponentId() {
    if (typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function') {
        return `component-${crypto.randomUUID()}`;
    }

    return `component-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class ComponentLibrary {

    constructor() {
        this.components = new Map();
    }

    createFromGroup(groupId, groupManager, library, connectionManager, name = null) {
        const group = groupManager.getGroup(groupId);

        if (!group) {
            throw new Error('Die ausgewählte Baugruppe existiert nicht.');
        }

        const bricks = group.brickIds
            .map(id => library.getById(id))
            .filter(Boolean);

        if (bricks.length !== group.brickIds.length || bricks.length === 0) {
            throw new Error('Die Baugruppe enthält ungültige Bauteilreferenzen.');
        }

        // Mittelpunkt als lokaler Ursprung der Komponente.
        const anchor = {
            x: bricks.reduce((sum, b) => sum + b.group.position.x, 0) / bricks.length,
            y: bricks.reduce((sum, b) => sum + b.group.position.y, 0) / bricks.length,
            z: bricks.reduce((sum, b) => sum + b.group.position.z, 0) / bricks.length
        };

        const brickIds = new Set(bricks.map(brick => brick.id));

        const componentBricks = bricks.map(brick => {
            const data = brick.toData();

            return {
                id: data.id,
                type: data.type,
                color: data.color,
                position: {
                    x: data.position.x - anchor.x,
                    y: data.position.y - anchor.y,
                    z: data.position.z - anchor.z
                },
                rotation: { ...data.rotation }
            };
        });

        // Nur Verbindungen übernehmen, deren beide Endpunkte
        // innerhalb der Baugruppe liegen.
        const componentConnections = connectionManager
            .getConnections()
            .filter(connection =>
                brickIds.has(connection.sourceBrickId) &&
                brickIds.has(connection.targetBrickId)
            )
            .map(connection => ({
                id: connection.id,
                sourceBrickId: connection.sourceBrickId,
                targetBrickId: connection.targetBrickId,
                type: connection.type,
                position: connection.position
                    ? {
                        x: connection.position.x - anchor.x,
                        y: connection.position.y - anchor.y,
                        z: connection.position.z - anchor.z
                    }
                    : null
            }));

        const component = {
            id: generateComponentId(),
            name: (name || group.name || 'Komponente').trim(),
            createdAt: new Date().toISOString(),
            bricks: componentBricks,
            connections: componentConnections
        };

        this.components.set(component.id, component);

        return this._clone(component);
    }

    get(id) {
        const component = this.components.get(id);
        return component ? this._clone(component) : null;
    }

    getAll() {
        return [...this.components.values()].map(component =>
            this._clone(component)
        );
    }

    rename(id, newName) {
        const component = this.components.get(id);

        if (!component || typeof newName !== 'string' || !newName.trim()) {
            return false;
        }

        component.name = newName.trim();
        return true;
    }

    delete(id) {
        return this.components.delete(id);
    }

    toData() {
        return this.getAll();
    }

    loadFromData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Die Komponentenbibliothek muss ein Array sein.');
        }

        const restored = new Map();

        for (const component of data) {
            if (
                !component ||
                typeof component.id !== 'string' ||
                typeof component.name !== 'string' ||
                !Array.isArray(component.bricks) ||
                !Array.isArray(component.connections)
            ) {
                throw new Error('Ungültige Komponentendaten.');
            }

            if (restored.has(component.id)) {
                throw new Error(`Doppelte Komponenten-ID: ${component.id}`);
            }

            restored.set(component.id, this._clone(component));
        }

        this.components = restored;
    }

    clear() {
        this.components.clear();
    }

    getCount() {
        return this.components.size;
    }

    _clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}