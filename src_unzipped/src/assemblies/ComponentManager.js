export class ComponentManager {

    constructor(componentLibrary, library, connectionManager, groupManager, historyManager = null) {
        this.componentLibrary = componentLibrary;
        this.library = library;
        this.connectionManager = connectionManager;
        this.groupManager = groupManager;
        this.historyManager = historyManager;
    }

    saveGroup(groupId, name = null) {
        const component = this.componentLibrary.createFromGroup(
            groupId,
            this.groupManager,
            this.library,
            this.connectionManager,
            name
        );

        this.historyManager?.saveState();

        return component;
    }

    insert(componentId, position = { x: 0, y: 0, z: 0 }) {
        const component = this.componentLibrary.get(componentId);

        if (!component) {
            throw new Error('Komponente wurde nicht gefunden.');
        }

        if (
            !Number.isFinite(position.x) ||
            !Number.isFinite(position.y) ||
            !Number.isFinite(position.z)
        ) {
            throw new Error('Die Einfügeposition ist ungültig.');
        }

        const createdBricks = [];
        const idMap = new Map();
        let createdGroup = null;

        try {
            // -------------------------------------------------
            // 1. Bauteile mit neuen IDs erzeugen
            // -------------------------------------------------

            for (const brickData of component.bricks) {
                const worldPosition = {
                    x: position.x + brickData.position.x,
                    y: position.y + brickData.position.y,
                    z: position.z + brickData.position.z
                };

                const brick = this.library.addBrick(
                    worldPosition.x,
                    worldPosition.y,
                    worldPosition.z,
                    brickData.color,
                    brickData.type
                );

                brick.setTransform(
                    worldPosition,
                    brickData.rotation
                );

                createdBricks.push(brick);
                idMap.set(brickData.id, brick.id);
            }

            // -------------------------------------------------
            // 2. Interne Verbindungen wiederherstellen
            // -------------------------------------------------

            for (const connection of component.connections) {
                const newSourceId = idMap.get(connection.sourceBrickId);
                const newTargetId = idMap.get(connection.targetBrickId);

                if (!newSourceId || !newTargetId) {
                    throw new Error(
                        'Eine Komponentenverbindung verweist auf ein unbekanntes Bauteil.'
                    );
                }

                const worldConnectionPosition = connection.position
                    ? {
                        x: position.x + connection.position.x,
                        y: position.y + connection.position.y,
                        z: position.z + connection.position.z
                    }
                    : null;

                this.connectionManager.createConnection(
                    newSourceId,
                    newTargetId,
                    worldConnectionPosition,
                    connection.type
                );
            }

            // -------------------------------------------------
            // 3. Neue logische Baugruppe erstellen
            // -------------------------------------------------

            if (createdBricks.length > 0) {
                createdGroup = this.groupManager.createGroup(
                    createdBricks,
                    component.name
                );
            }

            // Erst nach vollständigem Einsetzen speichern.
            this.historyManager?.saveState();

            return {
                bricks: createdBricks,
                group: createdGroup
            };

        } catch (error) {
            // Rollback: keine teilweise eingefügte Komponente behalten.
            for (const brick of createdBricks) {
                this.connectionManager.removeConnections(brick.id);
            }

            if (createdGroup) {
                this.groupManager.deleteGroup(createdGroup.id);
            }

            for (const brick of createdBricks) {
                this.library.removeBrick(brick);
            }

            throw error;
        }
    }

    rename(componentId, newName) {
        const success = this.componentLibrary.rename(componentId, newName);

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    delete(componentId) {
        const success = this.componentLibrary.delete(componentId);

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    getAll() {
        return this.componentLibrary.getAll();
    }
}