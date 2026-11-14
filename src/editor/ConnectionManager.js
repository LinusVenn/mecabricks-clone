
import { CONNECTION_TYPES, isValidConnectionType, getLegacyType } from '../connections/ConnectionTypes.js';
import { ConnectionCompatibility } from '../connections/ConnectionCompatibility.js';

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

    _compatibility = new ConnectionCompatibility();

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
    // NEW: validates type against CONNECTION_TYPES before serialising;
    //      unknown types are resolved via getLegacyType() or kept as-is.
    toData() {
        return this.connections.map(connection => {
            let type = connection.type;

            if (!isValidConnectionType(type)) {
                type = getLegacyType(type) ?? type;
            }

            const entry = {
                id: connection.id,
                sourceBrickId: connection.sourceBrickId,
                targetBrickId: connection.targetBrickId,
                type,

                position: connection.position
                    ? { ...connection.position }
                    : null
            };

            // Persist mechanical-only fields when present
            if (connection.connectionPointA !== undefined) {
                entry.connectionPointA = connection.connectionPointA;
            }

            if (connection.connectionPointB !== undefined) {
                entry.connectionPointB = connection.connectionPointB;
            }

            if (connection.confidence !== undefined) {
                entry.confidence = connection.confidence;
            }

            return entry;
        });
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

            // Migrate legacy type strings before storing
            const migrated = this.migrateOldConnection(connection);

            const restored = {
                id: migrated.id,
                sourceBrickId: migrated.sourceBrickId,
                targetBrickId: migrated.targetBrickId,
                type: migrated.type,

                position: migrated.position
                    ? {
                        x: migrated.position.x,
                        y: migrated.position.y,
                        z: migrated.position.z
                    }
                    : null
            };

            // Preserve mechanical fields when present
            if (migrated.connectionPointA !== undefined) {
                restored.connectionPointA = migrated.connectionPointA;
            }

            if (migrated.connectionPointB !== undefined) {
                restored.connectionPointB = migrated.connectionPointB;
            }

            if (migrated.confidence !== undefined) {
                restored.confidence = migrated.confidence;
            }

            restoredConnections.push(restored);
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

    // ─── NEW METHODS ────────────────────────────────────────────────────────────

    /**
     * createMechanicalConnection(sourceBrickId, targetBrickId, options)
     *
     * Like createConnection(), but intended for mechanical connection types
     * (pin, axle, hinge, …).  The options bag adds three optional fields:
     *   • connectionPointA  – identifier of the connection point on sourceBrick
     *   • connectionPointB  – identifier of the connection point on targetBrick
     *   • confidence        – number 0–1 representing detection confidence
     *
     * Falls back to CONNECTION_TYPES.STUD_TO_BOTTOM when no type is supplied.
     * Returns the connection object (existing one if a duplicate is detected).
     */
    createMechanicalConnection(
        sourceBrickId,
        targetBrickId,
        {
            type = CONNECTION_TYPES.STUD_TO_BOTTOM,
            position = null,
            connectionPointA = undefined,
            connectionPointB = undefined,
            confidence = undefined
        } = {}
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

        // Deduplicate on (source, target, type, pointA, pointB)
        const existing = this.connections.find(connection =>
            connection.sourceBrickId === sourceBrickId &&
            connection.targetBrickId === targetBrickId &&
            connection.type === type &&
            connection.connectionPointA === connectionPointA &&
            connection.connectionPointB === connectionPointB
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
                ? { x: position.x, y: position.y, z: position.z }
                : null
        };

        if (connectionPointA !== undefined) {
            connection.connectionPointA = connectionPointA;
        }

        if (connectionPointB !== undefined) {
            connection.connectionPointB = connectionPointB;
        }

        if (confidence !== undefined) {
            connection.confidence = confidence;
        }

        this.connections.push(connection);

        return connection;
    }

    /**
     * getConnectionsByType(type)
     * Returns a shallow copy of all connections whose type matches the given
     * value.  Use CONNECTION_TYPES constants for reliable lookups.
     *
     * @param  {string} type
     * @returns {object[]}
     */
    getConnectionsByType(type) {
        return this.connections.filter(
            connection => connection.type === type
        );
    }

    /**
     * getConnectionsForBrick(brickId)
     * Returns all connections in which brickId appears as either source or
     * target – a convenient alias for the common "give me everything touching
     * this brick" query.
     *
     * @param  {string} brickId
     * @returns {object[]}
     */
    getConnectionsForBrick(brickId) {
        return this.connections.filter(
            connection =>
                connection.sourceBrickId === brickId ||
                connection.targetBrickId === brickId
        );
    }

    /**
     * findCompatiblePoints(brickA, brickB, connectionPointManager)
     *
     * Iterates over every combination of connection points exposed by the two
     * bricks and returns those pairs for which ConnectionCompatibility reports
     * compatibility === true.
     *
     * @param  {object} brickA
     * @param  {object} brickB
     * @param  {object} connectionPointManager  – must expose getPointsForBrick(brick)
     * @returns {{ pointA: object, pointB: object, compatibility: object }[]}
     */
    findCompatiblePoints(brickA, brickB, connectionPointManager) {
        const pointsA = connectionPointManager.getPointsForBrick(brickA);
        const pointsB = connectionPointManager.getPointsForBrick(brickB);

        const results = [];

        for (const pointA of pointsA) {
            for (const pointB of pointsB) {
                const compatibility =
                    this._compatibility.check(pointA, pointB);

                if (compatibility.compatible) {
                    results.push({ pointA, pointB, compatibility });
                }
            }
        }

        return results;
    }

    /**
     * suggestConnections(newBrick, existingBricks, connectionPointManager, radius)
     *
     * For a newly placed brick, scans all existing bricks within `radius` (in
     * world units) and collects compatible point pairs.  Each suggestion is
     * annotated with a `confidence` score taken from the compatibility result,
     * or 1.0 when the compatibility check does not supply one.
     *
     * @param  {object}   newBrick
     * @param  {object[]} existingBricks
     * @param  {object}   connectionPointManager
     * @param  {number}   [radius=2.0]
     * @returns {{ brickId: string, pointA: object, pointB: object, confidence: number }[]}
     */
    suggestConnections(
        newBrick,
        existingBricks,
        connectionPointManager,
        radius = 2.0
    ) {
        const suggestions = [];

        for (const brick of existingBricks) {
            // Skip if the same brick somehow ends up in the existing list
            if (brick.id === newBrick.id) {
                continue;
            }

            // Coarse spatial proximity check (works when bricks expose a
            // position property; falls back to always-include when absent)
            if (newBrick.position && brick.position) {
                const dx = newBrick.position.x - brick.position.x;
                const dy = newBrick.position.y - brick.position.y;
                const dz = newBrick.position.z - brick.position.z;
                const distanceSq = dx * dx + dy * dy + dz * dz;

                if (distanceSq > radius * radius) {
                    continue;
                }
            }

            const compatiblePairs = this.findCompatiblePoints(
                newBrick,
                brick,
                connectionPointManager
            );

            for (const { pointA, pointB, compatibility } of compatiblePairs) {
                suggestions.push({
                    brickId: brick.id,
                    pointA,
                    pointB,
                    confidence: compatibility.confidence ?? 1.0
                });
            }
        }

        return suggestions;
    }

    /**
     * migrateOldConnection(connection)
     *
     * Converts legacy connection objects to use canonical CONNECTION_TYPES
     * constants.  Currently handles the 'stud-to-bottom' string that predates
     * the constants module; any unknown type is passed through getLegacyType()
     * which either returns the canonical constant or undefined (in which case
     * the original string is preserved).
     *
     * The input object is never mutated; a new object (or the same reference
     * when no migration is needed) is returned.
     *
     * @param  {object} connection
     * @returns {object}
     */
    migrateOldConnection(connection) {
        if (isValidConnectionType(connection.type)) {
            // Already uses a known canonical type – nothing to do
            return connection;
        }

        const canonical = getLegacyType(connection.type);

        if (canonical === undefined) {
            // Unknown type with no legacy mapping – keep as-is
            return connection;
        }

        // Return a shallow copy so the original data is never mutated
        return { ...connection, type: canonical };
    }

    /**
     * getStats()
     * Returns a summary of the current connection store: the total count and a
     * breakdown by type.
     *
     * @returns {{ total: number, byType: Record<string, number> }}
     */
    getStats() {
        const byType = {};

        for (const connection of this.connections) {
            byType[connection.type] =
                (byType[connection.type] ?? 0) + 1;
        }

        return {
            total: this.connections.length,
            byType
        };
    }
}
