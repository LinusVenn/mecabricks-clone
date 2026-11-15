export class ModelSnapshot {

    static capture(
        library,
        connectionManager,
        groupManager = null,
        componentLibrary = null,
        mechanicalManager = null
    ) {
        return {
            bricks: library.getAllData(),
            connections: connectionManager.toData(),
            groups: groupManager ? groupManager.toData() : [],
            components: componentLibrary ? componentLibrary.toData() : [],
            mechanicalConnections: mechanicalManager?.toData()?.mechanicalConnections ?? []
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
        componentLibrary = null,
        mechanicalManager = null
    ) {
        const data = ModelSnapshot.clone(snapshot);

        library.clear();
        connectionManager.clear();
        groupManager?.clear();
        componentLibrary?.clear();

        if (mechanicalManager) {
            mechanicalManager.clear();
            if (snapshot.mechanicalConnections?.length) {
                const ids = new Set(snapshot.bricks?.map(b => b.id) ?? []);
                mechanicalManager.loadFromData(snapshot.mechanicalConnections, ids);
            }
        }

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