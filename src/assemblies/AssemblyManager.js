export class AssemblyManager {

    constructor(groupManager, library, connectionManager, historyManager = null) {
        this.groupManager = groupManager;
        this.library = library;
        this.connectionManager = connectionManager;
        this.historyManager = historyManager;
    }

    getAll() {
        return this.groupManager.getAllGroups();
    }

    get(groupId) {
        return this.groupManager.getGroup(groupId);
    }

    rename(groupId, name) {
        const success = this.groupManager.renameGroup(groupId, name);

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    addBrick(groupId, brickId) {
        const brick = this.library.getById(brickId);

        if (!brick) {
            throw new Error('Bauteil wurde nicht gefunden.');
        }

        const existingGroup = this.groupManager.getGroupByBrickId(brickId);

        if (existingGroup?.id === groupId) {
            return false;
        }

        // Ein Bauteil darf nur einer Gruppe angehören.
        if (existingGroup) {
            this.groupManager.removeBrickFromGroup(
                existingGroup.id,
                brickId
            );
        }

        const success = this.groupManager.addBrickToGroup(
            groupId,
            brickId
        );

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    removeBrick(groupId, brickId) {
        const success = this.groupManager.removeBrickFromGroup(
            groupId,
            brickId
        );

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    dissolve(groupId) {
        const result = this.groupManager.ungroup(groupId);

        if (result !== null) {
            this.historyManager?.saveState();
        }

        return result;
    }

    duplicate(groupId, offset = { x: 1, y: 0, z: 1 }) {
        const group = this.groupManager.getGroup(groupId);

        if (!group) {
            throw new Error('Baugruppe wurde nicht gefunden.');
        }

        const sourceBricks = group.brickIds
            .map(id => this.library.getById(id))
            .filter(Boolean);

        if (sourceBricks.length !== group.brickIds.length) {
            throw new Error('Die Baugruppe enthält ungültige Bauteile.');
        }

        const sourceIds = new Set(sourceBricks.map(brick => brick.id));
        const createdBricks = [];
        const idMap = new Map();
        let newGroup = null;

        try {
            for (const source of sourceBricks) {
                const position = {
                    x: source.group.position.x + offset.x,
                    y: source.group.position.y + offset.y,
                    z: source.group.position.z + offset.z
                };

                const clone = this.library.addBrick(
                    position.x,
                    position.y,
                    position.z,
                    source.color,
                    source.type
                );

                clone.setTransform(position, {
                    x: source.group.rotation.x,
                    y: source.group.rotation.y,
                    z: source.group.rotation.z
                });

                createdBricks.push(clone);
                idMap.set(source.id, clone.id);
            }

            const internalConnections = this.connectionManager
                .getConnections()
                .filter(connection =>
                    sourceIds.has(connection.sourceBrickId) &&
                    sourceIds.has(connection.targetBrickId)
                );

            for (const connection of internalConnections) {
                const position = connection.position
                    ? {
                        x: connection.position.x + offset.x,
                        y: connection.position.y + offset.y,
                        z: connection.position.z + offset.z
                    }
                    : null;

                this.connectionManager.createConnection(
                    idMap.get(connection.sourceBrickId),
                    idMap.get(connection.targetBrickId),
                    position,
                    connection.type
                );
            }

            newGroup = this.groupManager.createGroup(
                createdBricks,
                `${group.name} (Kopie)`
            );

            this.historyManager?.saveState();

            return {
                group: newGroup,
                bricks: createdBricks
            };

        } catch (error) {
            for (const brick of createdBricks) {
                this.connectionManager.removeConnections(brick.id);
            }

            if (newGroup) {
                this.groupManager.deleteGroup(newGroup.id);
            }

            for (const brick of createdBricks) {
                this.library.removeBrick(brick);
            }

            throw error;
        }
    }
}