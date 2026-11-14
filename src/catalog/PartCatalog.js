
import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';
import { PART_CATEGORIES } from '../objects/PartCategories.js';

const BUILTIN_LDRAW_MAPPING = {
    brick_2x4: '3001',
    plate_2x4: '3020',
    tile_1x2: '3069'
};

let catalogInstance = null;


// ======================================================
// HILFSFUNKTIONEN
// ======================================================

function normalizeString(value) {
    return typeof value === 'string'
        ? value.trim()
        : '';
}


function normalizeAliases(value) {
    if (Array.isArray(value)) {
        return [...new Set(
            value
                .map(normalizeString)
                .filter(Boolean)
        )];
    }

    if (typeof value === 'string' && value.trim()) {
        return [...new Set(
            value
                .split(/[;,|]/)
                .map(item => item.trim())
                .filter(Boolean)
        )];
    }

    return [];
}


function normalizeTags(value) {
    return normalizeAliases(value);
}


function normalizeDimensions(definition) {
    const width = Number(definition.width);
    const depth = Number(definition.depth);
    const height = Number(definition.height);

    return {
        width: Number.isFinite(width) && width > 0
            ? width
            : null,

        depth: Number.isFinite(depth) && depth > 0
            ? depth
            : null,

        height: Number.isFinite(height) && height > 0
            ? height
            : null
    };
}


function parseNumber(value) {
    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ''
    ) {
        return null;
    }

    const normalized = String(value)
        .trim()
        .replace(',', '.');

    const number = Number(normalized);

    return Number.isFinite(number)
        ? number
        : null;
}


function parseBoolean(value, defaultValue = false) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        if (
            ['true', '1', 'yes', 'ja', 'y'].includes(normalized)
        ) {
            return true;
        }

        if (
            ['false', '0', 'no', 'nein', 'n'].includes(normalized)
        ) {
            return false;
        }
    }

    return defaultValue;
}


// ======================================================
// BAUTEIL NORMALISIEREN
// ======================================================

function normalizePart(definition, options = {}) {
    if (!definition || typeof definition !== 'object') {
        throw new Error(
            'Ein Bauteileintrag muss ein Objekt sein.'
        );
    }

    const id = normalizeString(definition.id);
    const name = normalizeString(definition.name);

    if (!id) {
        throw new Error(
            'Ein Bauteileintrag benötigt eine ID.'
        );
    }

    if (!name) {
        throw new Error(
            `Das Bauteil "${id}" benötigt einen Namen.`
        );
    }

    const category = normalizeString(
        definition.category
    );

    if (
        category &&
        !PART_CATEGORIES[category] &&
        options.allowUnknownCategory !== true
    ) {
        throw new Error(
            `Unbekannte Bauteilkategorie "${category}" bei "${id}".`
        );
    }

    const dimensions = normalizeDimensions(definition);

    const aliases = normalizeAliases(
        definition.aliases
    );

    const tags = normalizeTags(
        definition.tags
    );

    const ldrawPartNumber =
        normalizeString(definition.ldrawPartNumber) ||
        normalizeString(definition.ldrawNumber) ||
        null;

    const brickLinkId =
        normalizeString(definition.brickLinkId) ||
        normalizeString(definition.bricklinkId) ||
        null;

    const geometryType =
        normalizeString(definition.geometryType) ||
        normalizeString(definition.geometry) ||
        null;

    const isPhysical =
        definition.isPhysical !== false;

    const isVerified =
        definition.isVerified === true;

    const placementSupported =
        definition.placementSupported === true;

    return {
        ...definition,

        id,
        name,

        category: category || 'other',

        ...dimensions,

        aliases,
        tags,

        description: normalizeString(
            definition.description
        ),

        brickLinkId,
        ldrawPartNumber,

        geometryType,

        isPhysical,
        isVerified,
        placementSupported,

        geometryStatus:
            normalizeString(definition.geometryStatus) ||
            (
                placementSupported
                    ? 'builtin'
                    : ldrawPartNumber
                        ? 'ldraw-available'
                        : 'unavailable'
            ),

        source:
            normalizeString(definition.source) ||
            options.source ||
            'unknown'
    };
}


// ======================================================
// CSV-HEADER NORMALISIEREN
// ======================================================

function normalizeHeader(header) {
    return String(header)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}


function getValue(record, ...keys) {
    for (const key of keys) {
        const normalizedKey = normalizeHeader(key);

        if (
            Object.prototype.hasOwnProperty.call(
                record,
                normalizedKey
            )
        ) {
            return record[normalizedKey];
        }
    }

    return '';
}


// ======================================================
// CSV PARSEN
// ======================================================

function parseCsvLine(line, delimiter) {
    const result = [];

    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (
                inQuotes &&
                line[i + 1] === '"'
            ) {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (
            char === delimiter &&
            !inQuotes
        ) {
            result.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current.trim());

    return result;
}


function detectCsvDelimiter(headerLine) {
    const candidates = [',', ';', '\t'];

    let bestDelimiter = ',';
    let bestCount = -1;

    for (const delimiter of candidates) {
        const count = parseCsvLine(
            headerLine,
            delimiter
        ).length;

        if (count > bestCount) {
            bestCount = count;
            bestDelimiter = delimiter;
        }
    }

    return bestDelimiter;
}


function parseCsv(text) {
    const content = String(text)
        .replace(/^\uFEFF/, '');

    if (!content.trim()) {
        return [];
    }

    const firstLine = content.split(/\r?\n/, 1)[0];

    const delimiter = detectCsvDelimiter(firstLine);

    const rows = [];

    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];

        if (char === '"') {
            if (
                inQuotes &&
                nextChar === '"'
            ) {
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (
            char === delimiter &&
            !inQuotes
        ) {
            row.push(field.trim());
            field = '';
            continue;
        }

        if (
            (char === '\n' || char === '\r') &&
            !inQuotes
        ) {
            if (
                char === '\r' &&
                nextChar === '\n'
            ) {
                i++;
            }

            row.push(field.trim());

            if (row.some(value => value !== '')) {
                rows.push(row);
            }

            row = [];
            field = '';

            continue;
        }

        field += char;
    }

    row.push(field.trim());

    if (row.some(value => value !== '')) {
        rows.push(row);
    }

    if (rows.length < 2) {
        return [];
    }

    const headers = rows[0].map(
        normalizeHeader
    );

    return rows.slice(1).map(values => {
        const record = {};

        headers.forEach((header, index) => {
            if (!header) return;

            record[header] = values[index] ?? '';
        });

        return record;
    });
}


// ======================================================
// IMPORTIERTE DATENSÄTZE NORMALISIEREN
// ======================================================

function normalizeImportedRecord(record) {
    const result = { ...record };

    if (!result.id) {
        result.id =
            result.internalId ||
            result.internal_id ||
            result.partId ||
            result.part_id;
    }

    if (!result.name) {
        result.name =
            result.partName ||
            result.part_name ||
            result.description;
    }

    if (!result.category) {
        result.category =
            result.categoryId ||
            result.category_id;
    }

    if (!result.ldrawPartNumber) {
        result.ldrawPartNumber =
            result.ldrawNumber ||
            result.ldraw_number ||
            result.ldraw;
    }

    if (!result.brickLinkId) {
        result.brickLinkId =
            result.bricklinkId ||
            result.bricklink_id ||
            result.bricklink;
    }

    result.isPhysical = parseBoolean(
        result.isPhysical ?? result.is_physical,
        true
    );

    result.isVerified = parseBoolean(
        result.isVerified ?? result.is_verified,
        false
    );

    result.placementSupported = parseBoolean(
        result.placementSupported ??
        result.placement_supported,
        false
    );

    return result;
}


// ======================================================
// PART CATALOG
// ======================================================

export class PartCatalog {

    constructor(options = {}) {
        this._parts = new Map();
        this._categories = PART_CATEGORIES;

        this._registerBuiltInDefinitions();

        if (Array.isArray(options.parts)) {
            this.importParts(options.parts, {
                overwrite: false,
                source: options.source || 'custom'
            });
        }
    }


    // --------------------------------------------------
    // SINGLETON
    // --------------------------------------------------

    static instance() {
        if (!catalogInstance) {
            catalogInstance = new PartCatalog();
        }

        return catalogInstance;
    }


    static resetInstance() {
        catalogInstance = null;
    }


    // --------------------------------------------------
    // BUILT-IN BAUTEILE REGISTRIEREN
    // --------------------------------------------------

    _registerBuiltInDefinitions() {
        for (const definition of Object.values(PART_DEFINITIONS)) {
            const ldrawPartNumber =
                BUILTIN_LDRAW_MAPPING[definition.id] ?? null;

            const normalized = normalizePart(
                {
                    ...definition,

                    ldrawPartNumber,

                    isPhysical: true,
                    isVerified: false,

                    placementSupported: true,
                    geometryStatus: 'builtin',

                    source: 'builtin'
                },
                {
                    source: 'builtin'
                }
            );

            this._parts.set(
                normalized.id,
                normalized
            );
        }
    }


    // --------------------------------------------------
    // ABFRAGEN
    // --------------------------------------------------

    getAllParts() {
        return [...this._parts.values()];
    }


    getPartById(id) {
        return this._parts.get(String(id)) ?? null;
    }


    getPartsByCategory(category) {
        return this.getAllParts().filter(
            part => part.category === category
        );
    }


    getCategories() {
        return this._categories;
    }


    hasPart(id) {
        return this._parts.has(String(id));
    }


    getCount() {
        return this._parts.size;
    }


    // --------------------------------------------------
    // BAUTEILE HINZUFÜGEN
    // --------------------------------------------------

    addPart(definition, options = {}) {
        const normalized = normalizePart(
            definition,
            {
                source: options.source || 'custom',

                allowUnknownCategory:
                    options.allowUnknownCategory === true
            }
        );

        const exists = this._parts.has(
            normalized.id
        );

        if (
            exists &&
            options.overwrite !== true
        ) {
            throw new Error(
                `Das Bauteil "${normalized.id}" existiert bereits.`
            );
        }

        this._parts.set(
            normalized.id,
            normalized
        );

        return normalized;
    }


    // --------------------------------------------------
    // BAUTEILE ENTFERNEN
    // --------------------------------------------------

    removePart(id) {
        const part = this._parts.get(String(id));

        if (!part || part.source === 'builtin') {
            return false;
        }

        return this._parts.delete(String(id));
    }


    clearImportedParts() {
        for (const [id, part] of this._parts.entries()) {
            if (part.source !== 'builtin') {
                this._parts.delete(id);
            }
        }
    }


    // --------------------------------------------------
    // MEHRERE BAUTEILE IMPORTIEREN
    // --------------------------------------------------

    importParts(records, options = {}) {
        if (!Array.isArray(records)) {
            throw new Error(
                'Der Katalogimport erwartet ein Array.'
            );
        }

        const overwrite = options.overwrite === true;
        const source = options.source || 'import';

        const imported = [];
        const errors = [];

        for (let index = 0; index < records.length; index++) {
            try {
                const record = normalizeImportedRecord(
                    records[index]
                );

                const part = this.addPart(
                    {
                        ...record,

                        source: record.source || source
                    },
                    {
                        overwrite,
                        source,

                        allowUnknownCategory:
                            options.allowUnknownCategory === true
                    }
                );

                imported.push(part);

            } catch (error) {
                errors.push({
                    index,
                    id: records[index]?.id ?? null,
                    message: error.message
                });
            }
        }

        return {
            imported,
            errors,

            importedCount: imported.length,
            errorCount: errors.length
        };
    }


    // --------------------------------------------------
    // JSON IMPORT
    // --------------------------------------------------

    importJSON(json, options = {}) {
        let parsed;

        try {
            parsed = typeof json === 'string'
                ? JSON.parse(json)
                : json;

        } catch (error) {
            throw new Error(
                `JSON konnte nicht gelesen werden: ${error.message}`
            );
        }

        const records = Array.isArray(parsed)
            ? parsed
            : parsed?.parts;

        if (!Array.isArray(records)) {
            throw new Error(
                'Die JSON-Datei muss ein Array oder ein Objekt mit "parts" enthalten.'
            );
        }

        return this.importParts(records, {
            ...options,

            source: options.source || 'json-import'
        });
    }


    // --------------------------------------------------
    // CSV IMPORT
    // --------------------------------------------------

    importCSV(csvText, options = {}) {
        const records = parseCsv(csvText).map(record => ({
            id: getValue(
                record,
                'id',
                'internalId',
                'partId'
            ),

            name: getValue(
                record,
                'name',
                'partName'
            ),

            category: getValue(
                record,
                'category',
                'categoryId'
            ),

            width: parseNumber(
                getValue(record, 'width')
            ),

            depth: parseNumber(
                getValue(record, 'depth')
            ),

            height: parseNumber(
                getValue(record, 'height')
            ),

            geometry:
                getValue(record, 'geometry') || 'brick',

            studs: getValue(record, 'studs') === ''
                ? null
                : parseBoolean(
                    getValue(record, 'studs')
                ),

            description: getValue(
                record,
                'description'
            ),

            tags: getValue(record, 'tags')
                ? String(
                    getValue(record, 'tags')
                )
                    .split(/[;,]/)
                    .map(value => value.trim())
                    .filter(Boolean)
                : [],

            aliases: getValue(record, 'aliases')
                ? String(
                    getValue(record, 'aliases')
                )
                    .split(/[;,]/)
                    .map(value => value.trim())
                    .filter(Boolean)
                : [],

            brickLinkId: getValue(
                record,
                'brickLinkId',
                'bricklink_id'
            ) || null,

            ldrawPartNumber: getValue(
                record,
                'ldrawPartNumber',
                'ldraw_part_number'
            ) || null,

            isPhysical: parseBoolean(
                getValue(record, 'isPhysical'),
                true
            ),

            isVerified: parseBoolean(
                getValue(record, 'isVerified'),
                false
            ),

            placementSupported: false,

            source: options.source || 'csv-import'
        }));

        return this.importParts(records, {
            ...options,

            source: options.source || 'csv-import'
        });
    }


    // --------------------------------------------------
    // JSON EXPORT
    // --------------------------------------------------

    exportJSON(options = {}) {
        const parts = this.getAllParts();

        const exported = options.includeBuiltIn === false
            ? parts.filter(
                part => part.source !== 'builtin'
            )
            : parts;

        return JSON.stringify(
            {
                version: 1,
                parts: exported
            },
            null,
            2
        );
    }


    // --------------------------------------------------
    // MAPPING-INTEGRATION (Schritt C.4)
    // --------------------------------------------------

    /**
     * Verknüpft die Katalogeinträge mit Daten aus einem PartMappingManager.
     *
     * Für jeden Katalogeintrag wird gesucht:
     *   1. Nach einem Mapping mit `internalPartId === part.id`
     *   2. Falls kein treffer: Mapping mit gleicher `ldrawPartNumber`
     *
     * Dabei werden folgende Felder an den Eintrag geschrieben:
     *   - `brickLinkId`     – aus dem Mapping (überschreibt vorhandenen Wert)
     *   - `ldrawPartNumber` – aus dem Mapping (falls dort gesetzt und im Katalog fehlt)
     *   - `mappingStatus`   – abgeleitet aus Mapping-Verifizierungsstatus
     *
     * `mappingStatus`-Werte:
     *   - `'verified'`   – Zuordnung manuell bestätigt (verified: true)
     *   - `'unverified'` – Zuordnung vorhanden, aber nicht bestätigt
     *   - `'auto'`       – Automatisch ermittelt (source: 'auto')
     *   - `'unmapped'`   – Kein Mapping vorhanden
     *
     * Die konkreten Werte stammen stets aus tatsächlichen Mapping-Daten –
     * es werden keine Beispiel- oder Platzhalterwerte eingesetzt.
     *
     * @param {import('./mapping/PartMappingManager.js').PartMappingManager} mappingManager
     * @returns {{ applied: number, unchanged: number }}
     */
    applyMappings(mappingManager) {
        if (!mappingManager) {
            throw new Error(
                'applyMappings erwartet einen PartMappingManager.'
            );
        }

        const allMappings = mappingManager.getAllMappings();

        // Schnelle Lookup-Maps aufbauen
        const byInternalId   = new Map(); // internalPartId → mapping
        const byLDrawNumber  = new Map(); // ldrawPartNumber → mapping[]

        for (const mapping of allMappings) {
            if (mapping.internalPartId) {
                byInternalId.set(mapping.internalPartId, mapping);
            }

            if (mapping.ldrawPartNumber) {
                const key = mapping.ldrawPartNumber;
                if (!byLDrawNumber.has(key)) {
                    byLDrawNumber.set(key, []);
                }
                byLDrawNumber.get(key).push(mapping);
            }
        }

        let applied   = 0;
        let unchanged = 0;

        for (const [id, part] of this._parts.entries()) {
            // 1. Suche per interner Bauteil-ID
            let mapping = byInternalId.get(id) ?? null;

            // 2. Fallback: Suche per LDraw-Teilenummer (nimmt ersten Treffer)
            if (!mapping && part.ldrawPartNumber) {
                const candidates = byLDrawNumber.get(part.ldrawPartNumber);
                mapping = candidates?.[0] ?? null;
            }

            // Mapping-Status ableiten
            let mappingStatus;
            let newBrickLinkId     = part.brickLinkId;
            let newLDrawPartNumber = part.ldrawPartNumber;

            if (mapping) {
                newBrickLinkId     = mapping.brickLinkId ?? null;
                newLDrawPartNumber = mapping.ldrawPartNumber ?? part.ldrawPartNumber;

                if (mapping.verified === true) {
                    mappingStatus = 'verified';
                } else if (mapping.source === 'auto') {
                    mappingStatus = 'auto';
                } else {
                    mappingStatus = 'unverified';
                }

                applied++;
            } else {
                mappingStatus = 'unmapped';
                unchanged++;
            }

            // Eintrag in-place aktualisieren
            this._parts.set(id, {
                ...part,
                brickLinkId:     newBrickLinkId,
                ldrawPartNumber: newLDrawPartNumber,
                mappingStatus
            });
        }

        return { applied, unchanged };
    }


    // --------------------------------------------------
    // STATISTIKEN
    // --------------------------------------------------

    getStatistics() {
        const parts = this.getAllParts();

        return {
            total: parts.length,

            physical: parts.filter(
                part => part.isPhysical
            ).length,

            verified: parts.filter(
                part => part.isVerified
            ).length,

            withLDraw: parts.filter(
                part => Boolean(part.ldrawPartNumber)
            ).length,

            withBrickLink: parts.filter(
                part => Boolean(part.brickLinkId)
            ).length,

            placeable: parts.filter(
                part => part.placementSupported
            ).length,

            byCategory: parts.reduce((result, part) => {
                result[part.category] =
                    (result[part.category] || 0) + 1;

                return result;
            }, {})
        };
    }
}
