
function generateConnectionId() {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return `connection-${crypto.randomUUID()}`;
    }

    return `connection-${Date.now()}-${Math.random()
        .toString(36).slice(2, 10)}`;
}

export class ConnectionManager {

    constructor() {
        this.connections = [];
    }

    // Neue Verbindung erstellen
    createConnection(
        sourceBrickId,
        targetBrickId,
        position = null,
        type = 'stud-to-bottom'
    ) {
        if (!sourceBrickId || !targetBrickId) {
            throw new Error(
                'Beide Stein-IDs müssen angegeben werden.'
            );
        }

        if (sourceBrickId === targetBrickId) {
            throw new Error(
                'Ein Stein kann nicht mit sich selbst verbunden werden.'
            );
        }

        // Doppelte Verbindung verhindern
        const existing = this.connections.find(connection =>
            connection.sourceBrickId === sourceBrickId &&
            connection.targetBrickId === targetBrickId &&
            connection.type === type
        );

        if (existing) {
            return existing;
        }

        const connection = {
            id: generateConnectionId(),

            sourceBrickId,
            targetBrickId,

            type,

            position: position
                ? {
                    x: position.x,
                    y: position.y,
                    z: position.z
                }
                : null
        };

        this.connections.push(connection);

        return connection;
    }

    // Alle Verbindungen zurückgeben
    getConnections() {
        return [...this.connections];
    }

    // Verbindungen als speicherbare Daten zurückgeben
    toData() {
        return this.connections.map(connection => ({
            id: connection.id,
            sourceBrickId: connection.sourceBrickId,
            targetBrickId: connection.targetBrickId,
            type: connection.type,

            position: connection.position
                ? { ...connection.position }
                : null
        }));
    }

    // Verbindungen aus gespeicherten Daten wiederherstellen
    loadFromData(data, library) {
        if (!Array.isArray(data)) {
            throw new Error(
                'Die Verbindungsdaten müssen ein Array sein.'
            );
        }

        const restoredConnections = [];

        for (const connection of data) {
            if (
                !connection.id ||
                !connection.sourceBrickId ||
                !connection.targetBrickId ||
                !connection.type
            ) {
                throw new Error(
                    'Ungültige Verbindungsdaten.'
                );
            }

            if (
                !library.hasId(connection.sourceBrickId) ||
                !library.hasId(connection.targetBrickId)
            ) {
                throw new Error(
                    'Eine Verbindung verweist auf einen nicht vorhandenen Stein.'
                );
            }

            if (
                connection.sourceBrickId ===
                connection.targetBrickId
            ) {
                throw new Error(
                    'Ungültige Selbstverbindung.'
                );
            }

            restoredConnections.push({
                id: connection.id,
                sourceBrickId: connection.sourceBrickId,
                targetBrickId: connection.targetBrickId,
                type: connection.type,

                position: connection.position
                    ? {
                        x: connection.position.x,
                        y: connection.position.y,
                        z: connection.position.z
                    }
                    : null
            });
        }

        this.connections = restoredConnections;
    }

    // Prüfen, ob zwei Steine verbunden sind
    areConnected(brickIdA, brickIdB) {
        return this.connections.some(connection =>
            (
                connection.sourceBrickId === brickIdA &&
                connection.targetBrickId === brickIdB
            ) ||
            (
                connection.sourceBrickId === brickIdB &&
                connection.targetBrickId === brickIdA
            )
        );
    }

    // Alle Verbindungen eines Steins entfernen
    removeConnections(brickId) {
        this.connections = this.connections.filter(
            connection =>
                connection.sourceBrickId !== brickId &&
                connection.targetBrickId !== brickId
        );
    }

    // Alle Verbindungen entfernen
    clear() {
        this.connections = [];
    }

    // Anzahl der Verbindungen zurückgeben
    getCount() {
        return this.connections.length;
    }
}
