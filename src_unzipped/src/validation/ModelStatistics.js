/**
 * Ermittelt Modellstatistiken für das Prüfpanel.
 */
export class ModelStatistics {

    constructor({
        library,
        connectionManager,
        groupManager,
        componentLibrary,
        collisionManager
    } = {}) {

        this.library = library;
        this.connectionManager = connectionManager;
        this.groupManager = groupManager;
        this.componentLibrary = componentLibrary;
        this.collisionManager = collisionManager;
    }


    calculate() {

        const bricks =
            this.library?.getAll?.() ?? [];

        const groups =
            this.groupManager?.getAllGroups?.() ??
            this.groupManager?.getAll?.() ??
            [];

        const connections =
            this.connectionManager?.getConnections?.() ?? [];


        const types = new Map();
        const colors = new Set();
        const bounds = [];


        for (const brick of bricks) {

            if (brick?.type) {

                types.set(
                    brick.type,
                    (types.get(brick.type) ?? 0) + 1
                );
            }

            if (brick?.color !== undefined) {
                colors.add(String(brick.color));
            }


            try {

                const box =
                    this.collisionManager?.getBrickBounds?.(brick);

                if (
                    box &&
                    Object.values(box).every(Number.isFinite)
                ) {
                    bounds.push(box);
                }

            } catch {

                // Ungültige Boxen werden separat vom Validator gemeldet.
            }
        }


        let dimensions = {
            width: 0,
            height: 0,
            depth: 0
        };


        if (bounds.length > 0) {

            dimensions = {

                width: this._round(
                    Math.max(...bounds.map(box => box.maxX)) -
                    Math.min(...bounds.map(box => box.minX))
                ),

                height: this._round(
                    Math.max(...bounds.map(box => box.maxY)) -
                    Math.min(...bounds.map(box => box.minY))
                ),

                depth: this._round(
                    Math.max(...bounds.map(box => box.maxZ)) -
                    Math.min(...bounds.map(box => box.minZ))
                )
            };
        }


        const componentCount =
            this.componentLibrary?.getAll?.()?.length ??
            this.componentLibrary?.toData?.()?.length ??
            0;


        return {

            brickCount: bricks.length,

            groupCount: groups.length,

            connectionCount: connections.length,

            componentCount,

            typeCount: types.size,

            colorCount: colors.size,

            types: [...types.entries()]
                .map(([type, count]) => ({
                    type,
                    count
                }))
                .sort((a, b) => b.count - a.count),

            dimensions
        };
    }


    _round(value) {

        return Math.round(value * 1000) / 1000;
    }
}