/**
 * PartCatalogImporter – Importiert Bauteildaten in den PartCatalog (Phase E.1)
 *
 * Unterstützt drei Importquellen:
 *  1. JSON-Dateien / JSON-Objekte (importFromJSON)
 *  2. LDraw-Indexes (importFromLDrawIndex)
 *  3. Rohe Metadaten-Arrays (importFromMetadata)
 *
 * Alle Importmethoden liefern ein standardisiertes ImportResult-Objekt:
 *   { imported: number, skipped: number, errors: Error[] }
 *
 * Optionaler PartMetadataResolver reichert fehlende Metadaten automatisch an.
 */

import { PartMappingValidator } from '../mapping/PartMappingValidator.js';

// ─── Hilfskonstanten ───────────────────────────────────────────────────────────

/** Standard-Quellenbezeichner für LDraw-Imports */
const DEFAULT_LDRAW_SOURCE = 'ldraw-index';

/** Standard-Quellenbezeichner für Metadaten-Imports */
const DEFAULT_META_SOURCE = 'metadata';

// ─── Klasse ────────────────────────────────────────────────────────────────────

export class PartCatalogImporter {

    /**
     * Erstellt einen neuen PartCatalogImporter.
     *
     * @param {object}                  options
     * @param {object}                  options.catalog           PartCatalog-Instanz
     * @param {object|null}             [options.metadataResolver] Optionaler PartMetadataResolver
     */
    constructor({ catalog, metadataResolver = null } = {}) {
        if (!catalog) {
            throw new Error('PartCatalogImporter: "catalog" ist ein Pflichtparameter.');
        }

        /** @type {object} Referenz auf den PartCatalog */
        this._catalog = catalog;

        /**
         * Optionaler Metadaten-Resolver zur Anreicherung fehlender Informationen.
         * @type {object|null}
         */
        this._metadataResolver = metadataResolver;

        /**
         * Validator für Bauteil-Mapping-Daten.
         * Wird genutzt, um importierte Einträge vor dem Speichern zu prüfen.
         * @type {PartMappingValidator}
         */
        this._validator = new PartMappingValidator();
    }

    // ─── Öffentliche Importmethoden ──────────────────────────────────────────────

    /**
     * Importiert alle Bauteile aus einem LDrawPartIndex in den Katalog.
     *
     * Der LDrawPartIndex wird als iterierbares Objekt erwartet, das Einträge
     * mit mindestens `partNumber` und `description` liefert.
     *
     * @param {object}  ldrawIndex             LDrawPartIndex-Instanz
     * @param {object}  [options]              Importoptionen
     * @param {string}  [options.source]       Quellenbezeichner (Standard: 'ldraw-index')
     * @param {boolean} [options.overwrite]    Vorhandene Einträge überschreiben (Standard: false)
     * @param {Map<string, string>} [options.categoryMap]
     *   Optionale Zuordnung: LDraw-Teilenummer → Kategorie-ID
     * @returns {Promise<{imported: number, skipped: number, errors: Error[]}>}
     */
    async importFromLDrawIndex(ldrawIndex, options = {}) {
        const {
            source    = DEFAULT_LDRAW_SOURCE,
            overwrite = false,
            categoryMap = null
        } = options;

        // Ergebniszähler initialisieren
        const result = this._createResult();

        if (!ldrawIndex) {
            result.errors.push(new Error('importFromLDrawIndex: ldrawIndex ist null oder undefined.'));
            return result;
        }

        // Alle Teile aus dem LDraw-Index holen (Methode getParts() oder getAll() je nach Interface)
        let parts;
        try {
            if (typeof ldrawIndex.getParts === 'function') {
                parts = await ldrawIndex.getParts();
            } else if (typeof ldrawIndex.getAll === 'function') {
                parts = ldrawIndex.getAll();
            } else if (typeof ldrawIndex[Symbol.iterator] === 'function') {
                parts = Array.from(ldrawIndex);
            } else {
                throw new Error('LDrawPartIndex hat keine unterstützte Iterationsmethode (getParts/getAll/iterator).');
            }
        } catch (err) {
            result.errors.push(new Error(`importFromLDrawIndex: Fehler beim Abrufen der Teile: ${err.message}`));
            return result;
        }

        // Jeden Eintrag in eine Metadaten-Struktur umwandeln und importieren
        for (const entry of parts) {
            try {
                // LDraw-Teilenummer normalisieren
                const ldrawPartNumber = this._normalizeLDrawNumber(
                    entry.partNumber ?? entry.number ?? entry.id ?? ''
                );

                if (!ldrawPartNumber) {
                    result.skipped++;
                    continue;
                }

                // Kategorie bestimmen: zuerst aus categoryMap, dann aus Metadaten-Resolver
                const category = this._resolveCategory(ldrawPartNumber, entry, categoryMap);

                // Einheitliches Metadaten-Objekt zusammenbauen
                const meta = {
                    id:               `ldraw-${ldrawPartNumber}`,
                    name:             entry.description ?? entry.name ?? ldrawPartNumber,
                    ldrawPartNumber,
                    category:         category ?? 'other',
                    source,
                    placementSupported: true,
                    isPhysical:         true,
                    width:            entry.width  ?? null,
                    depth:            entry.depth  ?? null,
                    height:           entry.height ?? null,
                    description:      entry.description ?? '',
                    tags:             entry.tags ?? []
                };

                // An importFromMetadata delegieren (einzelner Eintrag)
                const sub = this.importFromMetadata([meta], { source, overwrite });
                result.imported += sub.imported;
                result.skipped  += sub.skipped;
                result.errors.push(...sub.errors);

            } catch (err) {
                // Einzelfehler sammeln, Schleife nicht abbrechen
                result.errors.push(new Error(
                    `importFromLDrawIndex: Fehler beim Verarbeiten von "${entry?.partNumber}": ${err.message}`
                ));
            }
        }

        return result;
    }

    /**
     * Importiert ein Array von Bauteil-Metadaten-Objekten in den Katalog.
     *
     * Jedes Objekt muss mindestens `id` und `name` enthalten.
     * Optionale Felder: ldrawPartNumber, category, width, depth, height,
     *                   placementSupported, isPhysical, description, tags
     *
     * @param {Array<object>} partDataArray  Array von Metadaten-Objekten
     * @param {object}        [options]
     * @param {string}        [options.source]    Quellenbezeichner
     * @param {boolean}       [options.overwrite] Vorhandene Einträge ersetzen (Standard: false)
     * @returns {{ imported: number, skipped: number, errors: Error[] }}
     */
    importFromMetadata(partDataArray, options = {}) {
        const { source = DEFAULT_META_SOURCE, overwrite = false } = options;
        const result = this._createResult();

        if (!Array.isArray(partDataArray)) {
            result.errors.push(new Error('importFromMetadata: Erwartet ein Array von Metadaten-Objekten.'));
            return result;
        }

        for (const entry of partDataArray) {
            try {
                // Pflichtfelder prüfen
                if (!entry?.id || !entry?.name) {
                    result.skipped++;
                    continue;
                }

                // Prüfen ob das Teil bereits im Katalog vorhanden ist
                const alreadyExists = typeof this._catalog.hasPart === 'function'
                    ? this._catalog.hasPart(entry.id)
                    : false;

                if (alreadyExists && !overwrite) {
                    result.skipped++;
                    continue;
                }

                // Optionale Metadaten-Anreicherung via PartMetadataResolver
                const enriched = this._enrich(entry);

                // Bauteil in den Katalog eintragen
                const partDef = {
                    id:                  enriched.id,
                    name:                enriched.name,
                    category:            enriched.category      ?? 'other',
                    ldrawPartNumber:     enriched.ldrawPartNumber ?? null,
                    width:               enriched.width          ?? null,
                    depth:               enriched.depth          ?? null,
                    height:              enriched.height         ?? null,
                    placementSupported:  enriched.placementSupported !== false,
                    isPhysical:          enriched.isPhysical         !== false,
                    source:              source,
                    description:         enriched.description    ?? '',
                    tags:                enriched.tags           ?? []
                };

                // Katalog-Methode: addPart oder registerPart (je nach Interface)
                if (typeof this._catalog.addPart === 'function') {
                    this._catalog.addPart(partDef);
                } else if (typeof this._catalog.registerPart === 'function') {
                    this._catalog.registerPart(partDef);
                } else {
                    throw new Error('PartCatalog hat keine unterstützte Einfügemethode (addPart/registerPart).');
                }

                result.imported++;

            } catch (err) {
                result.errors.push(new Error(
                    `importFromMetadata: Fehler bei Eintrag "${entry?.id ?? '?'}": ${err.message}`
                ));
            }
        }

        return result;
    }

    /**
     * Importiert Bauteile aus einem JSON-String oder -Objekt.
     *
     * Erwartetes Format:
     * ```json
     * {
     *   "schemaVersion": 1,
     *   "parts": [ { "id": "...", "name": "...", ... } ]
     * }
     * ```
     *
     * Alternativ auch ein reines Array von Bauteil-Objekten.
     *
     * @param {string|object} jsonData   JSON-String oder bereits gepartes Objekt
     * @param {object}        [options]  Optionen wie bei importFromMetadata
     * @returns {Promise<{imported: number, skipped: number, errors: Error[]}>}
     */
    async importFromJSON(jsonData, options = {}) {
        const result = this._createResult();

        // JSON-String parsen, falls nötig
        let parsed;
        try {
            if (typeof jsonData === 'string') {
                parsed = JSON.parse(jsonData);
            } else if (jsonData && typeof jsonData === 'object') {
                parsed = jsonData;
            } else {
                throw new TypeError('jsonData muss ein String oder ein Objekt sein.');
            }
        } catch (err) {
            result.errors.push(new Error(`importFromJSON: JSON-Parsing fehlgeschlagen: ${err.message}`));
            return result;
        }

        // Bauteil-Array aus dem geparsten Objekt extrahieren
        let partsArray;
        if (Array.isArray(parsed)) {
            // Direktes Array
            partsArray = parsed;
        } else if (Array.isArray(parsed.parts)) {
            // Objekt mit "parts"-Schlüssel (Standardformat)
            partsArray = parsed.parts;
        } else {
            result.errors.push(new Error(
                'importFromJSON: JSON enthält kein "parts"-Array und ist kein direktes Array.'
            ));
            return result;
        }

        // An importFromMetadata delegieren
        const sub = this.importFromMetadata(partsArray, options);
        result.imported += sub.imported;
        result.skipped  += sub.skipped;
        result.errors.push(...sub.errors);

        return result;
    }

    // ─── Private Hilfsmethoden ───────────────────────────────────────────────────

    /**
     * Erstellt ein leeres ImportResult-Objekt.
     *
     * @returns {{ imported: number, skipped: number, errors: Error[] }}
     * @private
     */
    _createResult() {
        return { imported: 0, skipped: 0, errors: [] };
    }

    /**
     * Normalisiert eine LDraw-Teilenummer:
     *  - entfernt optionale ".dat"-Erweiterung
     *  - wandelt in Kleinbuchstaben um
     *  - entfernt führende/nachfolgende Leerzeichen
     *
     * @param {string} value
     * @returns {string}
     * @private
     */
    _normalizeLDrawNumber(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\.dat$/i, '');
    }

    /**
     * Bestimmt die Kategorie eines Bauteils.
     * Reihenfolge: categoryMap → LDraw-Eintrag.category → MetadataResolver → null
     *
     * @param {string} ldrawPartNumber
     * @param {object} entry
     * @param {Map<string, string>|null} categoryMap
     * @returns {string|null}
     * @private
     */
    _resolveCategory(ldrawPartNumber, entry, categoryMap) {
        // 1. Explizite Zuordnung aus categoryMap
        if (categoryMap instanceof Map && categoryMap.has(ldrawPartNumber)) {
            return categoryMap.get(ldrawPartNumber);
        }

        // 2. Kategorie direkt im Eintrag vorhanden
        if (entry.category) {
            return entry.category;
        }

        // 3. Metadaten-Resolver befragen
        if (this._metadataResolver) {
            const resolved = this._metadataResolver.resolve(ldrawPartNumber);
            if (resolved?.category) {
                return resolved.category;
            }
        }

        return null;
    }

    /**
     * Reichert einen Bauteil-Eintrag mit Daten aus dem PartMetadataResolver an.
     * Felder aus dem Resolver überschreiben NICHT bereits vorhandene Werte.
     *
     * @param {object} entry  Ursprünglicher Bauteil-Eintrag
     * @returns {object}      Angereicherter Eintrag (flache Kopie)
     * @private
     */
    _enrich(entry) {
        // Ohne Resolver: Eintrag unverändert zurückgeben
        if (!this._metadataResolver || !entry.ldrawPartNumber) {
            return entry;
        }

        const extra = this._metadataResolver.resolve(
            this._normalizeLDrawNumber(entry.ldrawPartNumber)
        );

        if (!extra) {
            return entry;
        }

        // Nur fehlende Felder ergänzen (vorhandene Werte bleiben erhalten)
        return {
            ...extra,    // Resolver-Daten als Basis (niedrigere Priorität)
            ...entry     // Original-Eintrag überschreibt (höhere Priorität)
        };
    }
}
