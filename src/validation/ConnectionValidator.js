/**
 * Prüft Verbindungsreferenzen und die Erreichbarkeit
 * der Bauteile im Verbindungsgraphen.
 */
export class ConnectionValidator {

    constructor({
        library,
        connectionManager
    } = {}) {

        this.library = library;
        this.connectionManager = connectionManager;
    }


    validate() {

        const bricks = this.library?.getAll?.() ?? [];

        const connections =
            this.connectionManager?.getConnections?.() ?? [];

        const brickIds = new Set(
            bricks.map(brick => brick?.id).filter(Boolean)
        );

        const findings = [];

        const seenIds = new Set();
        const seenPairs = new Set();

        const adjacency = new Map(
            [...brickIds].map(id => [id, new Set()])
        );


        // --------------------------------------------------
        // Einzelne Verbindungen überprüfen
        // --------------------------------------------------

        for (let index = 0; index < connections.length; index++) {

            const connection = connections[index] ?? {};

            const ids = [
                connection.sourceBrickId,
                connection.targetBrickId
            ];

            const validId =
                typeof connection.id === 'string' &&
                connection.id.length > 0;


            // Fehlende Verbindungs-ID

            if (!validId) {

                findings.push(
                    this._finding(
                        `connection-id:${index}`,
                        'CONNECTION_ID_MISSING',
                        'error',
                        'Verbindung ohne ID',
                        'Eine Verbindung besitzt keine gültige ID.',
                        ids
                    )
                );

            } else if (seenIds.has(connection.id)) {

                findings.push(
                    this._finding(
                        `connection-id-duplicate:${connection.id}:${index}`,
                        'CONNECTION_ID_DUPLICATE',
                        'error',
                        'Doppelte Verbindungs-ID',
                        `Die Verbindungs-ID ${connection.id} kommt mehrfach vor.`,
                        ids
                    )
                );

            } else {

                seenIds.add(connection.id);
            }


            // Fehlende Endpunkte

            if (
                !connection.sourceBrickId ||
                !connection.targetBrickId
            ) {

                findings.push(
                    this._finding(
                        `connection-endpoint:${index}`,
                        'CONNECTION_ENDPOINT_MISSING',
                        'error',
                        'Verbindungsendpunkt fehlt',
                        'Eine Verbindung besitzt keinen vollständigen Start- oder Zielendpunkt.',
                        ids
                    )
                );

                continue;
            }


            // Selbstverbindung

            if (
                connection.sourceBrickId ===
                connection.targetBrickId
            ) {

                findings.push(
                    this._finding(
                        `connection-self:${index}`,
                        'CONNECTION_SELF_REFERENCE',
                        'error',
                        'Ungültige Selbstverbindung',
                        'Ein Bauteil verweist in einer Verbindung auf sich selbst.',
                        ids
                    )
                );

                continue;
            }


            // Referenzen auf nicht vorhandene Bauteile

            const missing = ids.filter(
                id => !brickIds.has(id)
            );

            if (missing.length > 0) {

                findings.push(
                    this._finding(
                        `connection-missing:${index}`,
                        'CONNECTION_BRICK_MISSING',
                        'error',
                        'Verbindung verweist auf fehlendes Bauteil',
                        `Die Verbindung verweist auf nicht vorhandene Bauteil-ID(s): ${missing.join(', ')}.`,
                        ids.filter(Boolean)
                    )
                );

                continue;
            }


            // Fehlender Verbindungstyp

            if (
                typeof connection.type !== 'string' ||
                !connection.type.trim()
            ) {

                findings.push(
                    this._finding(
                        `connection-type:${index}`,
                        'CONNECTION_TYPE_MISSING',
                        'warning',
                        'Verbindungstyp fehlt',
                        'Eine Verbindung besitzt keinen Verbindungstyp.',
                        ids
                    )
                );
            }


            // Doppelte Verbindung zwischen denselben Bauteilen

            const pair = [
                String(ids[0]),
                String(ids[1])
            ].sort().join('::');

            if (seenPairs.has(pair)) {

                findings.push(
                    this._finding(
                        `connection-duplicate:${index}`,
                        'CONNECTION_DUPLICATE',
                        'warning',
                        'Doppelte Bauteilverbindung',
                        'Zwischen denselben beiden Bauteilen existieren mehrere Verbindungen.',
                        ids
                    )
                );
            }

            seenPairs.add(pair);


            // Graph aufbauen

            adjacency.get(ids[0])?.add(ids[1]);
            adjacency.get(ids[1])?.add(ids[0]);
        }


        // --------------------------------------------------
        // Getrennte Modellbereiche ermitteln
        // --------------------------------------------------

        if (brickIds.size > 1) {

            const components =
                this._connectedComponents(adjacency);

            if (components.length > 1) {

                const sorted = [...components].sort(
                    (a, b) => b.length - a.length
                );

                const largest = sorted[0] ?? [];

                const disconnected = components
                    .filter(component => component !== largest)
                    .flat();


                findings.push({

                    id: 'model-disconnected-components',

                    code: 'MODEL_NOT_FULLY_CONNECTED',

                    severity: 'warning',

                    title: 'Modell besteht aus mehreren getrennten Teilen',

                    message:
                        `${components.length} voneinander getrennte ` +
                        'Verbindungsbereiche gefunden. ' +
                        `${disconnected.length} Bauteil(e) liegen außerhalb ` +
                        'des größten Bereichs.',

                    brickIds: disconnected,

                    suggestion:
                        'Prüfe, ob die getrennten Bauteile absichtlich lose oder als separate Baugruppen vorhanden sind.'
                });
            }
        }

        return findings;
    }


    // --------------------------------------------------
    // Zusammenhangskomponenten berechnen
    // --------------------------------------------------

    _connectedComponents(adjacency) {

        const visited = new Set();
        const components = [];


        for (const start of adjacency.keys()) {

            if (visited.has(start)) continue;

            const stack = [start];
            const component = [];

            visited.add(start);


            while (stack.length > 0) {

                const current = stack.pop();

                component.push(current);


                for (
                    const neighbour of
                    adjacency.get(current) ?? []
                ) {

                    if (visited.has(neighbour)) continue;

                    visited.add(neighbour);
                    stack.push(neighbour);
                }
            }

            components.push(component);
        }

        return components;
    }


    // --------------------------------------------------
    // Einheitlichen Fehler erzeugen
    // --------------------------------------------------

    _finding(
        id,
        code,
        severity,
        title,
        message,
        brickIds
    ) {

        return {

            id,
            code,
            severity,
            title,
            message,

            brickIds: [
                ...new Set(brickIds.filter(Boolean))
            ],

            suggestion:
                'Prüfe die Verbindungsdaten und die betroffenen Bauteile.'
        };
    }
}