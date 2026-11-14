// ======================================================
// PartAutoMapper – Schritt C.3
//
// Automatische Zuordnung von Katalog-Einträgen zu
// LDraw-Teilenummern und BrickLink-IDs, basierend auf:
//
//   1. Exakten Übereinstimmungen bekannter Teilenummern
//   2. Bekannten Aliasen
//   3. Priorisierung manueller Zuordnungen
//   4. Unsichere Treffer werden NICHT automatisch bestätigt
//
// API:
//   autoMapper.suggestMappings(catalog, ldrawIndex, options?)
//       → liefert Vorschläge ohne den Manager zu verändern
//
//   autoMapper.applyAutoMappings(catalog, ldrawIndex, mappingManager, options?)
//       → übernimmt nicht-konfliktierende Vorschläge in den Manager
// ======================================================

import { PartMappingValidator } from './PartMappingValidator.js';


export class PartAutoMapper {

    /**
     * @param {object} [options]
     * @param {Map<string, string>} [options.knownAliases]
     *   Bekannte Aliase: Map<alternativerName, ldrawPartNumber>.
     *   Wird bei der Suche nach Catalog-Aliasen berücksichtigt.
     */
    constructor(options = {}) {
        /**
         * Bekannte Aliase (alternativer Name → LDraw-Teilenummer).
         * Beispiel: new Map([['LEGO Stein 2x4', '3001'], ['3001', '3001']])
         *
         * @type {Map<string, string>}
         */
        this.knownAliases = options.knownAliases instanceof Map
            ? options.knownAliases
            : new Map();
    }


    // --------------------------------------------------
    // Vorschläge ermitteln (ohne Manager zu verändern)
    // --------------------------------------------------

    /**
     * Untersucht alle Einträge des Katalogs und liefert Zuordnungsvorschläge.
     *
     * Quellen der Übereinstimmung:
     *  - `exact`  : ldrawPartNumber des Katalogeintrags stimmt exakt mit dem
     *               normalisierten LDraw-Index überein.
     *  - `alias`  : Ein Alias oder die ID des Katalogeintrags entspricht einem
     *               bekannten Alias → liefert eine LDraw-Teilenummer.
     *
     * Manuelle Zuordnungen (verified: true) werden IMMER übersprungen.
     * Alle Vorschläge erhalten verified: false (ungeprüft).
     *
     * @param {import('../PartCatalog.js').PartCatalog} catalog
     * @param {import('./LDrawPartIndex.js').LDrawPartIndex} ldrawIndex
     * @param {{
     *   skipExisting?:    boolean,   // Bestehende (auch unverified) Mappings überspringen (default: false)
     *   existingMappings?: Map       // brickLinkId → mapping (für Konfliktprüfung)
     * }} [options]
     * @returns {{
     *   suggestions:     PartAutoMappingSuggestion[],
     *   skippedManual:   number,
     *   skippedNoLDraw:  number
     * }}
     */
    suggestMappings(catalog, ldrawIndex, options = {}) {
        const suggestions   = [];
        let skippedManual   = 0;
        let skippedNoLDraw  = 0;

        if (!catalog || !ldrawIndex) {
            return { suggestions, skippedManual, skippedNoLDraw };
        }

        const parts = catalog.getAllParts();

        for (const part of parts) {
            const result = this.#evaluatePart(
                part,
                ldrawIndex,
                options
            );

            if (result === 'manual')  { skippedManual++;  continue; }
            if (result === 'no-ldraw') { skippedNoLDraw++; continue; }
            if (result)               { suggestions.push(result); }
        }

        return { suggestions, skippedManual, skippedNoLDraw };
    }


    // --------------------------------------------------
    // Vorschläge in den Manager übernehmen
    // --------------------------------------------------

    /**
     * Bewertet alle Katalogeinträge und fügt nicht-konfliktierende Vorschläge
     * in den `PartMappingManager` ein.
     *
     * Regeln:
     *  - Bereits vorhandene, **verifizierte** (manuelle) Zuordnungen werden
     *    niemals überschrieben.
     *  - Bereits vorhandene, unverifizierte Zuordnungen werden nur bei
     *    `overwrite: true` ersetzt.
     *  - Alle automatisch gesetzten Zuordnungen erhalten `verified: false`.
     *
     * @param {import('../PartCatalog.js').PartCatalog} catalog
     * @param {import('./LDrawPartIndex.js').LDrawPartIndex} ldrawIndex
     * @param {import('./PartMappingManager.js').PartMappingManager} mappingManager
     * @param {{ overwrite?: boolean }} [options]
     * @returns {{
     *   applied:       PartAutoMappingSuggestion[],
     *   skippedManual: number,
     *   conflicts:     { partId: string, reason: string }[]
     * }}
     */
    applyAutoMappings(catalog, ldrawIndex, mappingManager, options = {}) {
        const { suggestions } = this.suggestMappings(catalog, ldrawIndex);

        const applied    = [];
        const conflicts  = [];
        let   skippedManual = 0;

        for (const suggestion of suggestions) {
            // Vorhandene verifizierte Zuordnung → niemals überschreiben
            const existing = mappingManager.getMappingForInternalPart(
                suggestion.internalPartId
            );

            if (existing?.verified === true) {
                skippedManual++;
                continue;
            }

            // Optionale BrickLink-ID: Wenn der Eintrag keine BrickLink-ID hat,
            // legen wir KEINE Mapping-Zeile an – dafür fehlt die brickLinkId.
            if (!suggestion.brickLinkId) {
                conflicts.push({
                    partId: suggestion.internalPartId,
                    reason:
                        'Automatische Zuordnung nicht möglich: ' +
                        'keine BrickLink-ID bekannt.'
                });
                continue;
            }

            try {
                mappingManager.addMapping(
                    {
                        brickLinkId:     suggestion.brickLinkId,
                        ldrawPartNumber: suggestion.ldrawPartNumber,
                        internalPartId:  suggestion.internalPartId,
                        verified:        false,
                        source:          'auto'
                    },
                    { overwrite: options.overwrite === true }
                );

                applied.push(suggestion);

            } catch (error) {
                conflicts.push({
                    partId: suggestion.internalPartId,
                    reason: error.message
                });
            }
        }

        return { applied, skippedManual, conflicts };
    }


    // --------------------------------------------------
    // Privat: Einzelnen Katalogeintrag bewerten
    // --------------------------------------------------

    /**
     * @param {object}  part
     * @param {import('./LDrawPartIndex.js').LDrawPartIndex} ldrawIndex
     * @param {object}  options
     * @returns {'manual'|'no-ldraw'|PartAutoMappingSuggestion|null}
     */
    #evaluatePart(part, ldrawIndex, options) {
        // Exakte Übereinstimmung: ldrawPartNumber aus dem Katalog
        const ldrawFromCatalog = part.ldrawPartNumber
            ? PartMappingValidator.normalizeLDrawPartNumber(
                part.ldrawPartNumber
              )
            : null;

        if (ldrawFromCatalog) {
            // Prüfen ob die Datei tatsächlich im Index vorhanden ist
            const exists = ldrawIndex.hasIndexedPart?.(ldrawFromCatalog)
                ?? ldrawIndex.parts?.has(ldrawFromCatalog)
                ?? false;

            if (exists) {
                return {
                    internalPartId:  part.id,
                    ldrawPartNumber: ldrawFromCatalog,
                    brickLinkId:     part.brickLinkId ?? null,
                    matchType:       'exact',
                    confidence:      'high',
                    verified:        false
                };
            }
        }

        // Alias-Suche: Bekannte Aliase des Teils prüfen
        const candidates = [
            part.id,
            ...(Array.isArray(part.aliases) ? part.aliases : [])
        ];

        for (const candidate of candidates) {
            const aliasLdraw = this.knownAliases.get(
                String(candidate).toLowerCase()
            );

            if (!aliasLdraw) continue;

            const normalizedAlias = PartMappingValidator.normalizeLDrawPartNumber(
                aliasLdraw
            );

            if (!normalizedAlias) continue;

            const exists = ldrawIndex.hasIndexedPart?.(normalizedAlias)
                ?? ldrawIndex.parts?.has(normalizedAlias)
                ?? false;

            if (exists) {
                return {
                    internalPartId:  part.id,
                    ldrawPartNumber: normalizedAlias,
                    brickLinkId:     part.brickLinkId ?? null,
                    matchType:       'alias',
                    confidence:      'medium',
                    verified:        false
                };
            }
        }

        // Kein LDraw-Treffer gefunden
        return 'no-ldraw';
    }
}


// ======================================================
// Typdefinitionen (JSDoc)
// ======================================================

/**
 * @typedef {object} PartAutoMappingSuggestion
 * @property {string}       internalPartId   - Interne Bauteil-ID aus dem Katalog
 * @property {string}       ldrawPartNumber  - Normalisierte LDraw-Teilenummer
 * @property {string|null}  brickLinkId      - BrickLink-ID (wenn bekannt, sonst null)
 * @property {'exact'|'alias'} matchType     - Art der Übereinstimmung
 * @property {'high'|'medium'|'low'} confidence - Konfidenz des Vorschlags
 * @property {false}        verified         - Immer false (nie automatisch bestätigt)
 */
