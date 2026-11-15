/**
 * Prüft räumliche Überschneidungen zwischen platzierten Bauteilen.
 * Verwendet denselben AABB-Algorithmus wie der vorhandene CollisionManager.
 * Die Prüfung verändert weder Szene noch Bauteile.
 */
export class CollisionValidator {

    constructor({
        library,
        collisionManager,
        connectionManager
    } = {}) {

        this.library = library;
        this.collisionManager = collisionManager;
        this.connectionManager = connectionManager;
    }


    validate() {

        const bricks = this.library?.getAll?.() ?? [];
        const findings = [];

        if (
            !this.collisionManager?.getBrickBounds ||
            !this.collisionManager?.hasVolumeOverlap
        ) {

            return [{
                id: 'collision-validator-unavailable',
                code: 'COLLISION_CHECK_UNAVAILABLE',
                severity: 'warning',
                title: 'Kollisionsprüfung nicht verfügbar',
                message:
                    'Der CollisionManager stellt die benötigten AABB-Methoden nicht bereit.',
                brickIds: [],
                suggestion:
                    'Prüfe die Initialisierung des CollisionManagers.'
            }];
        }


        for (let i = 0; i < bricks.length; i++) {

            const brickA = bricks[i];

            if (!brickA?.id) continue;

            let boundsA;

            try {

                boundsA =
                    this.collisionManager.getBrickBounds(brickA);

            } catch {

                continue;
            }

            if (!this._validBounds(boundsA)) continue;


            for (let j = i + 1; j < bricks.length; j++) {

                const brickB = bricks[j];

                if (!brickB?.id) continue;

                let boundsB;

                try {

                    boundsB =
                        this.collisionManager.getBrickBounds(brickB);

                } catch {

                    continue;
                }

                if (!this._validBounds(boundsB)) continue;


                const overlapping =
                    this.collisionManager.hasVolumeOverlap(
                        boundsA,
                        boundsB
                    );


                if (!overlapping) continue;


                findings.push({

                    id: `overlap:${brickA.id}:${brickB.id}`,

                    code: 'BRICK_OVERLAP',

                    severity: 'error',

                    title: 'Bauteile überlappen sich',

                    message:
                        `Die Bauteile ${brickA.id} und ${brickB.id} ` +
                        'überschneiden sich räumlich.',

                    brickIds: [
                        brickA.id,
                        brickB.id
                    ],

                    suggestion:
                        'Prüfe Position, Rotation und Bauweise der beiden Bauteile.'
                });
            }
        }

        return findings;
    }


    _validBounds(bounds) {

        if (!bounds) return false;

        const keys = [
            'minX',
            'maxX',
            'minY',
            'maxY',
            'minZ',
            'maxZ'
        ];

        return keys.every(key =>
            Number.isFinite(bounds[key])
        );
    }
}