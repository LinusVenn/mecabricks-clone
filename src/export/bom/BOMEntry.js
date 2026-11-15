/**
 * BOMEntry – Einzelner Eintrag in der technischen Stückliste (Phase H.4)
 *
 * Unveränderliches Datenobjekt. Repräsentiert eine Gruppe gleichartiger Bauteile.
 */

export class BOMEntry {
    /**
     * @param {object} def
     * @param {string}      def.partId              – required
     * @param {string|null} def.ldrawPartNumber
     * @param {string|null} def.name
     * @param {number|null} def.colorId
     * @param {string|null} def.colorName
     * @param {string|null} def.colorHex
     * @param {string|null} def.variantId
     * @param {number}      def.quantity            – required, > 0
     * @param {'local'|'ldraw'|null} def.source
     * @param {string|null} def.category
     * @param {string[]}    def.instanceIds         – actual instance IDs in this group
     */
    constructor(def) {
        if (!def || typeof def.partId !== 'string' || def.partId.trim() === '') {
            throw new TypeError('BOMEntry: partId must be a non-empty string');
        }
        if (typeof def.quantity !== 'number' || def.quantity <= 0 || !Number.isFinite(def.quantity)) {
            throw new TypeError(`BOMEntry: quantity must be a finite number > 0, got ${def.quantity}`);
        }

        // Store all fields frozen so they cannot be mutated after construction.
        this._partId           = def.partId;
        this._ldrawPartNumber  = def.ldrawPartNumber  ?? null;
        this._name             = def.name             ?? null;
        this._colorId          = def.colorId          ?? null;
        this._colorName        = def.colorName        ?? null;
        this._colorHex         = def.colorHex         ?? null;
        this._variantId        = def.variantId        ?? null;
        this._quantity         = def.quantity;
        this._source           = def.source           ?? null;
        this._category         = def.category         ?? null;
        this._instanceIds      = Object.freeze(Array.isArray(def.instanceIds) ? [...def.instanceIds] : []);

        Object.freeze(this);
    }

    // ── Getters ────────────────────────────────────────────────────────────────

    /** @returns {string} */
    get partId()          { return this._partId; }

    /** @returns {string|null} */
    get ldrawPartNumber() { return this._ldrawPartNumber; }

    /** @returns {string|null} */
    get name()            { return this._name; }

    /** @returns {number|null} */
    get colorId()         { return this._colorId; }

    /** @returns {string|null} */
    get colorName()       { return this._colorName; }

    /** @returns {string|null} */
    get colorHex()        { return this._colorHex; }

    /** @returns {string|null} */
    get variantId()       { return this._variantId; }

    /** @returns {number} */
    get quantity()        { return this._quantity; }

    /** @returns {'local'|'ldraw'|null} */
    get source()          { return this._source; }

    /** @returns {string|null} */
    get category()        { return this._category; }

    /** @returns {readonly string[]} */
    get instanceIds()     { return this._instanceIds; }

    // ── Computed ───────────────────────────────────────────────────────────────

    /**
     * Stable group key used to merge identical parts.
     * Format: "<partId>|<variantId or ''>|<colorId or color>"
     *
     * @returns {string}
     */
    get groupKey() {
        const colorPart = this._colorId ?? this._colorName ?? '';
        return `${this._partId}|${this._variantId ?? ''}|${colorPart}`;
    }

    // ── Serialisation ──────────────────────────────────────────────────────────

    /**
     * Returns a plain-object representation suitable for JSON serialisation.
     * @returns {object}
     */
    toData() {
        return {
            partId:           this._partId,
            ldrawPartNumber:  this._ldrawPartNumber,
            name:             this._name,
            colorId:          this._colorId,
            colorName:        this._colorName,
            colorHex:         this._colorHex,
            variantId:        this._variantId,
            quantity:         this._quantity,
            source:           this._source,
            category:         this._category,
            instanceIds:      [...this._instanceIds],
        };
    }

    /**
     * Reconstructs a BOMEntry from a plain data object (e.g. parsed JSON).
     * @param {object} obj
     * @returns {BOMEntry}
     */
    static fromData(obj) {
        return new BOMEntry(obj);
    }
}
