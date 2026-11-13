import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';


/**
 * Prüft Bauteil-, Gruppen- und Materialreferenzen,
 * ohne das Modell zu verändern.
 */
export class ReferenceValidator {

    constructor({
        library,
        groupManager,
        materialLibrary
    } = {}) {

        this.library = library;
        this.groupManager = groupManager;
        this.materialLibrary = materialLibrary;
    }


    validate() {

        const bricks = this.library?.getAll?.() ?? [];

        const findings = [];
        const idOwners = new Map();


        // --------------------------------------------------
        // Bauteile überprüfen
        // --------------------------------------------------

        for (const brick of bricks) {

            if (!brick || typeof brick !== 'object') continue;

            const id = brick.id;


            // Bauteil-ID

            if (
                typeof id !== 'string' ||
                !id.trim()
            ) {

                findings.push(
                    this._finding(
                        `brick-id-missing:${findings.length}`,
                        'BRICK_ID_MISSING',
                        'error',
                        'Bauteil-ID fehlt',
                        'Ein Bauteil besitzt keine gültige ID.',
                        []
                    )
                );

            } else if (idOwners.has(id)) {

                findings.push(
                    this._finding(
                        `brick-id-duplicate:${id}`,
                        'BRICK_ID_DUPLICATE',
                        'error',
                        'Doppelte Bauteil-ID',
                        `Die Bauteil-ID ${id} kommt mehrfach vor.`,
                        [id]
                    )
                );

            } else {

                idOwners.set(id, brick);
            }


            // Bauteildefinition

            if (
                !brick.type ||
                !Object.prototype.hasOwnProperty.call(
                    PART_DEFINITIONS,
                    brick.type
                )
            ) {

                findings.push(
                    this._finding(
                        `brick-type:${id ?? findings.length}`,
                        'PART_DEFINITION_MISSING',
                        'error',
                        'Bauteildefinition fehlt',
                        `Für den Bauteiltyp „${String(brick.type ?? 'unbekannt')}“ existiert keine Definition.`,
                        [id]
                    )
                );
            }


            // Position und Rotation

            const position = brick.group?.position;
            const rotation = brick.group?.rotation;

            const transformValues = [
                position?.x,
                position?.y,
                position?.z,
                rotation?.x,
                rotation?.y,
                rotation?.z
            ];

            if (
                !position ||
                !rotation ||
                !transformValues.every(Number.isFinite)
            ) {

                findings.push(
                    this._finding(
                        `brick-transform:${id ?? findings.length}`,
                        'BRICK_TRANSFORM_INVALID',
                        'error',
                        'Ungültige Bauteiltransformation',
                        `Position oder Rotation des Bauteils ${id ?? '(ohne ID)'} enthält fehlende oder ungültige Werte.`,
                        [id]
                    )
                );
            }


            // Farbe

            if (!Number.isFinite(Number(brick.color))) {

                findings.push(
                    this._finding(
                        `brick-color:${id ?? findings.length}`,
                        'BRICK_COLOR_INVALID',
                        'error',
                        'Ungültige Bauteilfarbe',
                        `Das Bauteil ${id ?? '(ohne ID)'} besitzt keine gültige numerische Farbe.`,
                        [id]
                    )
                );
            }
        }


        findings.push(
            ...this._validateGroups(bricks)
        );

        findings.push(
            ...this._validateUnusedMaterials(bricks)
        );

        return findings;
    }


    // --------------------------------------------------
    // Baugruppen prüfen
    // --------------------------------------------------

    _validateGroups(bricks) {

        const groups =
            this.groupManager?.getAllGroups?.() ??
            this.groupManager?.getAll?.() ??
            [];

        const brickIds = new Set(
            bricks.map(brick => brick?.id).filter(Boolean)
        );

        const findings = [];
        const membership = new Map();


        for (const group of groups) {

            if (!group?.id) {

                findings.push(
                    this._finding(
                        `group-id:${findings.length}`,
                        'GROUP_ID_MISSING',
                        'error',
                        'Baugruppen-ID fehlt',
                        'Eine Baugruppe besitzt keine gültige ID.',
                        group?.brickIds ?? []
                    )
                );

                continue;
            }


            const ids = Array.isArray(group.brickIds)
                ? group.brickIds
                : [];


            for (const brickId of ids) {

                if (!brickIds.has(brickId)) continue;

                if (!membership.has(brickId)) {
                    membership.set(brickId, []);
                }

                membership.get(brickId).push(group.id);
            }


            // Leere Baugruppe

            if (ids.length === 0) {

                findings.push(
                    this._finding(
                        `group-empty:${group.id}`,
                        'GROUP_EMPTY',
                        'warning',
                        'Leere Baugruppe',
                        `Die Baugruppe „${group.name ?? group.id}“ enthält keine Bauteile.`,
                        []
                    )
                );

                continue;
            }


            // Fehlende Bauteilreferenzen

            const missing = ids.filter(
                id => !brickIds.has(id)
            );

            if (missing.length > 0) {

                findings.push(
                    this._finding(
                        `group-missing:${group.id}`,
                        'GROUP_BRICK_MISSING',
                        'error',
                        'Baugruppe enthält ungültige Referenzen',
                        `Die Baugruppe „${group.name ?? group.id}“ verweist auf fehlende Bauteile: ${missing.join(', ')}.`,
                        ids.filter(id => brickIds.has(id))
                    )
                );
            }


            // Doppelte Bauteilreferenzen

            if (new Set(ids).size !== ids.length) {

                findings.push(
                    this._finding(
                        `group-duplicate:${group.id}`,
                        'GROUP_BRICK_DUPLICATE',
                        'warning',
                        'Doppelte Bauteilreferenz in Baugruppe',
                        `Die Baugruppe „${group.name ?? group.id}“ enthält dieselbe Bauteil-ID mehrfach.`,
                        ids.filter(id => brickIds.has(id))
                    )
                );
            }
        }


        // Bauteil in mehreren Gruppen

        for (const [brickId, groupIds] of membership) {

            if (groupIds.length > 1) {

                findings.push(
                    this._finding(
                        `brick-multiple-groups:${brickId}`,
                        'BRICK_IN_MULTIPLE_GROUPS',
                        'warning',
                        'Bauteil in mehreren Baugruppen',
                        `Das Bauteil ${brickId} ist gleichzeitig Mitglied in ${groupIds.length} Baugruppen.`,
                        [brickId]
                    )
                );
            }
        }

        return findings;
    }


    // --------------------------------------------------
    // Ungenutzte Materialien prüfen
    // --------------------------------------------------

    _validateUnusedMaterials(bricks) {

        const entries = this._getMaterialEntries();

        if (!entries.length) return [];


        const usedKeys = new Set();


        for (const brick of bricks) {

            brick?.group?.traverse?.(object => {

                if (!object?.isMesh) return;

                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];


                for (const material of materials) {

                    if (!material) continue;

                    const key =
                        material.userData?.materialId ??
                        material.userData?.presetId ??
                        material.name;

                    if (
                        typeof key === 'string' &&
                        key.trim()
                    ) {
                        usedKeys.add(key);
                    }
                }
            });
        }


        const keyedEntries = entries.map(entry => ({

            entry,

            key:
                entry?.id ??
                entry?.key ??
                entry?.name

        })).filter(item =>
            typeof item.key === 'string' &&
            item.key.trim()
        );


        // Ohne eindeutige IDs/Namen ist keine verlässliche
        // Zuordnung zwischen Bibliothek und Mesh möglich.

        if (
            !keyedEntries.length ||
            !usedKeys.size
        ) {
            return [];
        }


        const unused = keyedEntries.filter(
            item => !usedKeys.has(item.key)
        );

        if (!unused.length) return [];


        return [{

            id: 'materials-unused',

            code: 'MATERIAL_UNUSED',

            severity: 'warning',

            title: 'Ungenutzte Materialien',

            message:
                `${unused.length} Materialeintrag(e) der Materialbibliothek ` +
                'werden von keinem Bauteil-Mesh referenziert.',

            brickIds: [],

            details: unused.map(
                item => String(item.entry.name ?? item.key)
            ),

            suggestion:
                'Prüfe, ob diese Materialien noch benötigt werden, bevor du sie aus der Materialbibliothek entfernst.'
        }];
    }


    // --------------------------------------------------
    // Materialbibliothek auslesen
    // --------------------------------------------------

    _getMaterialEntries() {

        const source = this.materialLibrary;

        if (!source) return [];


        const getters = [
            'getAllMaterials',
            'getAll',
            'toData'
        ];


        for (const getter of getters) {

            if (typeof source[getter] !== 'function') continue;

            try {

                const candidate = source[getter]();

                const entries =
                    this._normalizeMaterialEntries(candidate);

                if (entries.length) return entries;

            } catch {

                // Eine nicht unterstützte optionale API
                // wird übersprungen.
            }
        }


        return [
            ...this._normalizeMaterialEntries(source.materials),
            ...this._normalizeMaterialEntries(source.presets)
        ];
    }


    _normalizeMaterialEntries(candidate) {

        if (Array.isArray(candidate)) {
            return candidate;
        }

        if (candidate instanceof Map) {

            return [...candidate.entries()].map(
                ([key, value]) => ({
                    key,
                    ...(value ?? {})
                })
            );
        }

        if (
            candidate &&
            typeof candidate === 'object'
        ) {

            return Object.entries(candidate).map(
                ([key, value]) => ({
                    key,
                    ...(value ?? {})
                })
            );
        }

        return [];
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
                ...new Set(
                    (brickIds ?? []).filter(Boolean)
                )
            ],

            suggestion:
                'Prüfe die betroffenen Modellreferenzen.'
        };
    }
}