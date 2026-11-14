import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';

let catalogInstance = null;

const VALID_CATEGORIES = new Set([
    'bricks',
    'plates',
    'tiles',
    'slopes',
    'technic',
    'windows',
    'other'    // Fallback für unbekannte / zukünftige Kategorien
]);

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];

    return [...new Set(
        value
            .filter(item => typeof item === 'string')
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

function normalizeOptionalPartNumber(value) {
    const normalized = normalizeString(value);

    return normalized || null;
}

function normalizePart(definition, options = {}) {
    if (!definition || typeof definition !== 'object') {
        // Meldung enthält "id" damit Tests auf /id/ prüfen können.
        throw new TypeError('Bauteildefinition muss ein Objekt mit einer id sein.');
    }

    const id = normalizeString(definition.id);
    const name = normalizeString(definition.name);

    if (!id) {
        throw new Error('Eine Bauteildefinition benötigt eine id.');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw new Error(`Ungültige Bauteil-ID: ${id}`);
    }

    if (!name) {
        throw new Error(`Bauteil ${id} benötigt einen Namen.`);
    }

    const category = normalizeString(definition.category) || 'other';

    if (!VALID_CATEGORIES.has(category)) {
        throw new Error(
            `Ungültige Kategorie "${category}" für Bauteil ${id}.`
        );
    }

    // Dimensionen sind optional – Standardwert null wenn nicht angegeben.
    const rawWidth  = definition.width  !== undefined ? Number(definition.width)  : null;
    const rawDepth  = definition.depth  !== undefined ? Number(definition.depth)  : null;
    const rawHeight = definition.height !== undefined ? Number(definition.height) : null;

    const width  = (rawWidth  !== null && Number.isFinite(rawWidth)  && rawWidth  > 0) ? rawWidth  : null;
    const depth  = (rawDepth  !== null && Number.isFinite(rawDepth)  && rawDepth  > 0) ? rawDepth  : null;
    const height = (rawHeight !== null && Number.isFinite(rawHeight) && rawHeight > 0) ? rawHeight : null;

    const isPhysical = definition.isPhysical !== false;

    if (!isPhysical && options.requirePhysical !== false) {
        throw new Error(
            `Bauteil ${id} ist kein physisches Bauteil.`
        );
    }

    const ldrawPartNumber = normalizeOptionalPartNumber(
        definition.ldrawPartNumber
    );

    const brickLinkId = normalizeOptionalPartNumber(
        definition.brickLinkId
    );

    return {
        id,
        name,
        category,

        width,
        depth,
        height,

        geometry: normalizeString(definition.geometry) || 'brick',
        geometryType: normalizeString(
            definition.geometryType ?? definition.geometry
        ) || 'brick',

        studs: typeof definition.studs === 'boolean'
            ? definition.studs
            : null,

        description: normalizeString(definition.description),

        tags: normalizeStringArray(definition.tags),
        aliases: normalizeStringArray(definition.aliases),

        // Unterschiedliche Nummernsysteme bleiben getrennt.
        brickLinkId,
        ldrawPartNumber,

        // Ein Katalogeintrag ist nicht automatisch platzierbar.
        placementSupported:
            definition.placementSupported === true,

        isPhysical,
        isVerified: definition.isVerified === true,

        source: normalizeString(definition.source) || 'local',

        // Optionale Zusatzinformationen für spätere Importer.
        sourceUrl: normalizeString(definition.sourceUrl) || null,
        updatedAt: normalizeString(definition.updatedAt) || null
    };
}

export class PartCatalog {

    constructor() {
        this._parts = new Map();
        this._listeners = new Set();

        this._registerBuiltInParts();
    }

    // ---------------------------------------------------------
    // Singleton
    // ---------------------------------------------------------

    static instance() {
        if (!catalogInstance) {
            catalogInstance = new PartCatalog();
        }

        return catalogInstance;
    }

    // ---------------------------------------------------------
    // Initialer lokaler Katalog
    // ---------------------------------------------------------

    _registerBuiltInParts() {
        for (const definition of Object.values(PART_DEFINITIONS)) {
            const part = normalizePart({
                ...definition,

                isPhysical: true,

                // Die vorhandenen Brick-Definitionen sind lokal
                // implementiert und können von Brick.js erzeugt werden.
                placementSupported: true,

                // Keine externe Verifikation behaupten.
                isVerified: false,

                source: 'built-in'
            });

            this._parts.set(part.id, part);
        }

        // Nur explizit bekannte Zuordnungen eintragen.
        // BrickLink-IDs werden hier bewusst nicht erfunden.
        this._setLDrawMapping('brick_2x4', '3001');
        this._setLDrawMapping('plate_2x4', '3020');
        this._setLDrawMapping('tile_1x2', '3069');
    }

    _setLDrawMapping(id, ldrawPartNumber) {
        const part = this._parts.get(id);

        if (!part) return;

        part.ldrawPartNumber = ldrawPartNumber;
    }

    // ---------------------------------------------------------
    // Abfragen
    // ---------------------------------------------------------

    getAllParts() {
        return [...this._parts.values()];
    }

    getPartById(id) {
        // Rückgabe undefined (nicht null) für unbekannte IDs –
        // konsistent mit Map.get()-Semantik.
        return this._parts.get(String(id));
    }

    getPartsByCategory(category) {
        return this.getAllParts().filter(
            part => part.category === category
        );
    }

    getCategories() {
        // Gibt ein Array von Kategorie-Objekten { id, name } zurück.
        // Nur tatsächlich im Katalog vorhandene Kategorien werden aufgeführt.
        const CATEGORY_NAMES = {
            bricks:  'Steine',
            plates:  'Platten',
            tiles:   'Fliesen',
            slopes:  'Schrägsteine',
            technic: 'Technic',
            windows: 'Fenster & Türen',
            other:   'Sonstiges'
        };

        const usedIds = new Set(
            this.getAllParts().map(part => part.category)
        );

        return [...usedIds]
            .filter(id => VALID_CATEGORIES.has(id))
            .map(id => ({ id, name: CATEGORY_NAMES[id] ?? id }));
    }

    hasPart(id) {
        return this._parts.has(String(id));
    }

    getPartCount() {
        return this._parts.size;
    }

    // ---------------------------------------------------------
    // Registrierung
    // ---------------------------------------------------------

    addPart(definition, options = {}) {
        const part = normalizePart(definition, options);

        // Standardverhalten: vorhandene Bauteile werden überschrieben.
        // Nur mit options.overwrite === false wird ein Fehler geworfen.
        if (this._parts.has(part.id) && options.overwrite === false) {
            throw new Error(
                `Das Bauteil "${part.id}" ist bereits vorhanden.`
            );
        }

        this._parts.set(part.id, part);

        this._notify({
            type: 'add',
            part
        });

        return part;
    }

    addParts(definitions, options = {}) {
        if (!Array.isArray(definitions)) {
            throw new TypeError(
                'addParts erwartet ein Array von Bauteildefinitionen.'
            );
        }

        const results = {
            added: [],
            updated: [],
            skipped: [],
            errors: []
        };

        for (let index = 0; index < definitions.length; index++) {
            const definition = definitions[index];

            try {
                const normalized = normalizePart(definition, options);
                const existed = this._parts.has(normalized.id);

                if (existed && options.overwrite !== true) {
                    results.skipped.push({
                        id: normalized.id,
                        reason: 'ID bereits vorhanden'
                    });

                    continue;
                }

                this._parts.set(normalized.id, normalized);

                if (existed) {
                    results.updated.push(normalized);
                } else {
                    results.added.push(normalized);
                }

            } catch (error) {
                results.errors.push({
                    index,
                    id: definition?.id ?? null,
                    message: error.message
                });
            }
        }

        if (
            results.added.length > 0 ||
            results.updated.length > 0
        ) {
            this._notify({
                type: 'bulk-import',
                results
            });
        }

        return results;
    }

    // ---------------------------------------------------------
    // Aktualisieren und Löschen
    // ---------------------------------------------------------

    updatePart(id, changes) {
        const existing = this.getPartById(id);

        if (!existing) {
            throw new Error(`Bauteil "${id}" wurde nicht gefunden.`);
        }

        if (!changes || typeof changes !== 'object') {
            throw new TypeError('Änderungen müssen ein Objekt sein.');
        }

        if (changes.id !== undefined && changes.id !== existing.id) {
            throw new Error(
                'Die ID eines bestehenden Bauteils darf nicht geändert werden.'
            );
        }

        const updated = normalizePart({
            ...existing,
            ...changes,
            id: existing.id
        });

        this._parts.set(existing.id, updated);

        this._notify({
            type: 'update',
            part: updated
        });

        return updated;
    }

    removePart(id) {
        const part = this.getPartById(id);

        if (!part) return false;

        // Die eingebauten Definitionen dürfen nicht entfernt werden.
        if (part.source === 'built-in') {
            throw new Error(
                `Das eingebaute Bauteil "${id}" kann nicht entfernt werden.`
            );
        }

        this._parts.delete(id);

        this._notify({
            type: 'remove',
            part
        });

        return true;
    }

    // ---------------------------------------------------------
    // Import
    // ---------------------------------------------------------

    importJSON(input, options = {}) {
        let parsed = input;

        if (typeof input === 'string') {
            try {
                parsed = JSON.parse(input);
            } catch (error) {
                throw new Error(
                    `JSON konnte nicht gelesen werden: ${error.message}`
                );
            }
        }

        const definitions = Array.isArray(parsed)
            ? parsed
            : parsed?.parts;

        if (!Array.isArray(definitions)) {
            throw new Error(
                'JSON muss ein Array oder ein Objekt mit dem Feld "parts" enthalten.'
            );
        }

        return this.addParts(definitions, options);
    }

    importCSV(input, options = {}) {
        // Der Importer wird separat gehalten, damit das Katalogmodell
        // nicht selbst für CSV-Parsing verantwortlich ist.
        return importCSVIntoCatalog(this, input, options);
    }

    // ---------------------------------------------------------
    // Export
    // ---------------------------------------------------------

    exportJSON(options = {}) {
        const parts = this.getAllParts().filter(part => {
            if (options.physicalOnly && !part.isPhysical) {
                return false;
            }

            return true;
        });

        return JSON.stringify(
            { version: 1, parts },
            null,
            2
        );
    }

    // ---------------------------------------------------------
    // Events
    // ---------------------------------------------------------

    subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('Listener muss eine Funktion sein.');
        }

        this._listeners.add(callback);

        return () => {
            this._listeners.delete(callback);
        };
    }

    _notify(event) {
        for (const listener of this._listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error(
                    'PartCatalog: Listener-Fehler:',
                    error
                );
            }
        }
    }
}

// Dynamischer Import wird vermieden: Der Importer wird am Dateiende
// über eine kleine, lokale CSV-Implementierung angebunden.
function importCSVIntoCatalog(catalog, input, options) {
    if (typeof input !== 'string' || !input.trim()) {
        throw new Error('CSV-Datei ist leer oder ungültig.');
    }

    const rows = parseCSV(input);

    if (rows.length < 2) {
        throw new Error(
            'CSV muss eine Kopfzeile und mindestens einen Datensatz enthalten.'
        );
    }

    const normalizeHeader = value => String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

    const headers = rows[0].map(normalizeHeader);

    const getValue = (record, ...keys) => {
        for (const key of keys) {
            const value = record[normalizeHeader(key)];

            if (value !== undefined && value !== '') {
                return value;
            }
        }

        return '';
    };

    const definitions = [];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];

        if (row.every(value => !String(value).trim())) {
            continue;
        }

        const record = {};

        headers.forEach((header, index) => {
            record[header] = row[index] ?? '';
        });

        const parseNumber = value => {
            if (value === '' || value == null) return NaN;
            return Number(String(value).replace(',', '.'));
        };

        const parseBoolean = (value, fallback = false) => {
            if (value === '' || value == null) return fallback;

            return [
                'true',
                '1',
                'yes',
                'ja',
                'y'
            ].includes(String(value).trim().toLowerCase());
        };

        definitions.push({
            id: record.id,
            name: record.name,
            category: record.category,

            width: parseNumber(record.width),
            depth: parseNumber(record.depth),
            height: parseNumber(record.height),

            geometry: record.geometry || 'brick',
            geometryType: record.geometrytype || record.geometry || 'brick',

            studs: record.studs === ''
                ? null
                : parseBoolean(record.studs),

            description: record.description || '',

            tags: record.tags
                ? String(record.tags).split(/[;,]/).map(s => s.trim())
                : [],

            aliases: record.aliases
                ? String(record.aliases).split(/[;,]/).map(s => s.trim())
                : [],

            brickLinkId: record.bricklinkid || null,
            ldrawPartNumber: record.ldrawpartnumber || null,

            isPhysical: parseBoolean(record.isphysical, true),
            isVerified: parseBoolean(record.isverified, false),

            // Externe Importe sind nicht automatisch platzierbar.
            placementSupported: false,

            source: record.source || options.source || 'csv-import'
        });
    }

    return catalog.addParts(definitions, options);
}

function parseCSV(text) {
    const detectDelimiter = input => {
        const firstLine = input.split(/\r?\n/, 1)[0] ?? '';

        const count = delimiter => {
            let result = 0;
            let quoted = false;

            for (let i = 0; i < firstLine.length; i++) {
                const char = firstLine[i];

                if (char === '"') {
                    quoted = !quoted;
                } else if (char === delimiter && !quoted) {
                    result++;
                }
            }

            return result;
        };

        return count(';') > count(',') ? ';' : ',';
    };

    const delimiter = detectDelimiter(text);
    const rows = [];

    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (quoted) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }

            continue;
        }

        if (char === '"') {
            quoted = true;
        } else if (char === delimiter) {
            row.push(field);
            field = '';
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);

            row = [];
            field = '';
        } else if (char !== '\r') {
            field += char;
        }
    }

    if (quoted) {
        throw new Error(
            'CSV enthält ein nicht geschlossenes Anführungszeichen.'
        );
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}