export class ModelSnapshot {

    static capture(
        library,
        connectionManager,
        groupManager = null,
        componentLibrary = null
    ) {
        return {
            bricks: library.getAllData(),
            connections: connectionManager.toData(),
            groups: groupManager ? groupManager.toData() : [],
            components: componentLibrary ? componentLibrary.toData() : []
        };
    }

    static clone(snapshot) {
        return JSON.parse(JSON.stringify(snapshot));
    }

    static restore(
        snapshot,
        library,
        connectionManager,
        groupManager = null,
        componentLibrary = null
    ) {
        const data = ModelSnapshot.clone(snapshot);

        library.clear();
        connectionManager.clear();
        groupManager?.clear();
        componentLibrary?.clear();

        for (const brickData of data.bricks) {
            library.addBrickFromData(brickData);
        }

        connectionManager.loadFromData(
            data.connections,
            library
        );

        if (groupManager && Array.isArray(data.groups)) {
            groupManager.loadFromData(
                data.groups,
                library
            );
        }

        if (componentLibrary) {
            componentLibrary.loadFromData(
                data.components ?? []
            );
        }
    }
}