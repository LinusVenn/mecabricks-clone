import { CollisionValidator }
    from './CollisionValidator.js';

import { ConnectionValidator }
    from './connectionValidator.js';

import { ReferenceValidator }
    from './ReferenceValidator.js';

import { ModelStatistics }
    from './ModelStatistics.js';


/**
 * Zentrale, nicht-destruktive Modellprüfung.
 *
 * validate() führt alle Einzelprüfungen aus und liefert
 * ein einheitliches Prüfprotokoll.
 */
class ModelValidator {

    constructor({
        library,
        collisionManager,
        connectionManager,
        groupManager,
        materialLibrary,
        componentLibrary
    } = {}) {

        if (!library) {

            throw new Error(
                'ModelValidator benötigt eine PartLibrary.'
            );
        }


        this.library = library;


        this.validators = [

            new CollisionValidator({
                library,
                collisionManager,
                connectionManager
            }),

            new ConnectionValidator({
                library,
                connectionManager
            }),

            new ReferenceValidator({
                library,
                groupManager,
                materialLibrary
            })
        ];


        this.statistics = new ModelStatistics({

            library,
            connectionManager,
            groupManager,
            componentLibrary,
            collisionManager
        });


        this.lastReport = null;
    }


    // --------------------------------------------------
    // Prüfung durchführen
    // --------------------------------------------------

    validate() {

        const startedAt = Date.now();

        const findings = [];


        for (const validator of this.validators) {

            try {

                findings.push(
                    ...validator.validate()
                );

            } catch (error) {

                findings.push({

                    id:
                        `validator-exception:${validator.constructor.name}`,

                    code: 'VALIDATOR_FAILED',

                    severity: 'error',

                    title:
                        'Prüfung konnte nicht abgeschlossen werden',

                    message:
                        `${validator.constructor.name}: ` +
                        `${error?.message ?? String(error)}`,

                    brickIds: [],

                    suggestion:
                        'Prüfe die Konfiguration und die Daten des betreffenden Managers.'
                });
            }
        }


        // --------------------------------------------------
        // Ergebnisse vereinheitlichen
        // --------------------------------------------------

        const normalized = findings.map(
            (finding, index) => ({

                id:
                    finding.id ??
                    `finding-${index}`,

                code:
                    finding.code ??
                    'MODEL_ISSUE',

                severity:
                    finding.severity === 'error'
                        ? 'error'
                        : 'warning',

                title:
                    finding.title ??
                    'Modellhinweis',

                message:
                    finding.message ??
                    '',

                brickIds: [
                    ...new Set(
                        (finding.brickIds ?? []).filter(Boolean)
                    )
                ],

                groupIds: [
                    ...new Set(
                        (finding.groupIds ?? []).filter(Boolean)
                    )
                ],

                suggestion:
                    finding.suggestion ??
                    '',

                details:
                    finding.details ??
                    []
            })
        );


        // --------------------------------------------------
        // Prüfbericht erstellen
        // --------------------------------------------------

        const report = {

            createdAt: new Date().toISOString(),

            durationMs: Date.now() - startedAt,

            findings: normalized,

            statistics:
                this.statistics.calculate(),

            summary: {

                errors: normalized.filter(
                    item => item.severity === 'error'
                ).length,

                warnings: normalized.filter(
                    item => item.severity === 'warning'
                ).length,

                total: normalized.length
            }
        };


        this.lastReport = report;

        return report;
    }


    // --------------------------------------------------
    // Letzten Bericht zurückgeben
    // --------------------------------------------------

    getLastReport() {

        return this.lastReport;
    }
}

export { ModelValidator };
export default ModelValidator;