
export class ModelSnapshot {

    /**
     * @param {object}  library
     * @param {object}  connectionManager
     * @param {import('../editor/GroupManager.js').GroupManager | null} [groupManager]
     */
    static capture(library, connectionManager, groupManager = null) {
        return {
            bricks:      library.getAllData(),
            connections: connectionManager.toData(),
            groups:      groupManager ? groupManager.toData() : [],
        };
    }

    static clone(snapshot) {
        return JSON.parse(JSON.stringify(snapshot));
    }

    /**
     * @param {object}  snapshot
     * @param {object}  library
     * @param {object}  connectionManager
     * @param {import('../editor/GroupManager.js').GroupManager | null} [groupManager]
     */
    static restore(snapshot, library, connectionManager, groupManager = null) {
        const data = ModelSnapshot.clone(snapshot);

        library.clear();
        connectionManager.clear();
        groupManager?.clear();

        for (const brickData of data.bricks) {
            library.addBrickFromData(brickData);
        }

        connectionManager.loadFromData(data.connections, library);

        if (groupManager && Array.isArray(data.groups)) {
            groupManager.loadFromData(data.groups, library);
        }
    }
}
