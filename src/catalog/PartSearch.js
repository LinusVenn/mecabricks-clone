import { PartCatalog } from './PartCatalog.js';

// ─── Hilfsfunktion für Tag-Vergleich ─────────────────────────────────────────

/**
 * Prüft, ob ein Teil mindestens einen der angegebenen Tags trägt (case-insensitiv).
 * @param {object}   part
 * @param {string[]} tags
 * @returns {boolean}
 */
function partHasAnyTag(part, tags) {
    if (!Array.isArray(part.tags) || part.tags.length === 0) return false;

    const lowerTags = tags.map(t => t.toLowerCase());

    return part.tags.some(
        t => lowerTags.includes(String(t).toLowerCase())
    );
}

function normalize(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}

function matchesText(part, query) {
    if (!query) return true;

    const searchableValues = [
        part.id,
        part.name,
        part.description,
        part.category,
        part.brickLinkId,
        part.ldrawPartNumber,
        part.geometryType,
        ...(part.aliases || []),
        ...(part.tags || [])
    ];

    return searchableValues.some(value =>
        normalize(value).includes(query)
    );
}

function matchesDimension(value, expected, tolerance = 0) {
    if (expected === undefined || expected === null || expected === '') {
        return true;
    }

    if (value === null || value === undefined) {
        return false;
    }

    const target = Number(expected);

    if (!Number.isFinite(target)) {
        return true;
    }

    return Math.abs(Number(value) - target) <= tolerance;
}

export class PartSearch {
    constructor(catalog = null) {
        this.catalog        = catalog || PartCatalog.instance();
        this._variantManager = null;
    }

    // ─── Variant-Manager ──────────────────────────────────────────────────────

    /**
     * Setzt den VariantManager für die Variantenfilterung (Phase E.5).
     * @param {object} variantManager
     */
    setVariantManager(variantManager) {
        this._variantManager = variantManager;
    }

    search(query, pool = null) {
        const normalizedQuery = normalize(query);

        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!normalizedQuery) {
            return [...parts];
        }

        return parts.filter(part =>
            matchesText(part, normalizedQuery)
        );
    }

    filterByCategory(category, pool = null) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!category || category === 'all') {
            return [...parts];
        }

        return parts.filter(
            part => part.category === category
        );
    }

    filterBySize(width, depth, pool = null, options = {}) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        const allowRotation = options.allowRotation !== false;
        const tolerance = Number(options.tolerance ?? 0);

        return parts.filter(part => {
            const directMatch =
                matchesDimension(
                    part.width,
                    width,
                    tolerance
                ) &&
                matchesDimension(
                    part.depth,
                    depth,
                    tolerance
                );

            if (directMatch) return true;

            if (!allowRotation) return false;

            return (
                matchesDimension(
                    part.width,
                    depth,
                    tolerance
                ) &&
                matchesDimension(
                    part.depth,
                    width,
                    tolerance
                )
            );
        });
    }

    filterByGeometry(geometry, pool = null) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!geometry || geometry === 'all') {
            return [...parts];
        }

        const normalizedGeometry = normalize(geometry);

        return parts.filter(part =>
            normalize(part.geometryType) === normalizedGeometry ||
            normalize(part.geometry) === normalizedGeometry
        );
    }

    filterByPhysical(pool = null, physicalOnly = true) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!physicalOnly) {
            return [...parts];
        }

        return parts.filter(part =>
            part.isPhysical !== false
        );
    }

    filterByVerification(pool = null, verifiedOnly = false) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!verifiedOnly) {
            return [...parts];
        }

        return parts.filter(part =>
            part.isVerified === true
        );
    }

    filterByPlacement(pool = null, placeableOnly = false) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!placeableOnly) {
            return [...parts];
        }

        return parts.filter(part =>
            part.placementSupported === true
        );
    }

    // ─── Neue Filter (Phase E.3 / E.5) ───────────────────────────────────────

    /**
     * (E.3) Filtert Teile, die in der angegebenen LDraw-Farb-ID verfügbar sind.
     *
     * Derzeit: alle Teile passieren diesen Filter, da jedes Teil in jeder Farbe
     * verwendet werden kann. Der Hook existiert für zukünftige Farbverfügbarkeits-
     * Metadaten.
     *
     * @param {object[]|null} pool     - Teilemenge oder null für alle Teile
     * @param {number|null}   colorId  - LDraw-Farb-ID; null = kein Filter
     * @returns {object[]}
     */
    filterByColor(pool = null, colorId = null) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        // Hook für zukünftige Farbverfügbarkeit:
        // Im Moment passieren alle Teile diesen Filter.
        if (colorId === null || colorId === undefined) {
            return [...parts];
        }

        // TODO (Phase E.3+): Prüfen ob part.availableColorIds?.includes(colorId)
        // sobald Farbverfügbarkeits-Metadaten vorhanden sind.
        return [...parts];
    }

    /**
     * (E.5) Filtert Teile, die eine registrierte Variante mit der angegebenen ID haben.
     * Benötigt einen gesetzten variantManager.
     *
     * @param {object[]|null} pool       - Teilemenge oder null für alle Teile
     * @param {string|null}   variantId  - Varianten-ID; null = kein Filter
     * @returns {object[]}
     */
    filterByVariant(pool = null, variantId = null) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!variantId || !this._variantManager) {
            return [...parts];
        }

        return parts.filter(part =>
            this._variantManager.hasVariant(part.id, variantId)
        );
    }

    /**
     * Filtert Teile, die eine LDraw-Teilenummer haben (ldrawPartNumber !== null).
     *
     * @param {object[]|null} pool       - Teilemenge oder null für alle Teile
     * @param {boolean}       ldrawOnly  - true = nur LDraw-Teile
     * @returns {object[]}
     */
    filterByLDrawAvailability(pool = null, ldrawOnly = false) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!ldrawOnly) {
            return [...parts];
        }

        return parts.filter(part =>
            part.ldrawPartNumber !== null &&
            part.ldrawPartNumber !== undefined
        );
    }

    /**
     * Filtert Teile, bei denen Geometrie verfügbar ist
     * (geometryStatus !== 'unavailable').
     *
     * @param {object[]|null} pool         - Teilemenge oder null für alle Teile
     * @param {boolean}       hasGeometry  - true = nur Teile mit Geometrie
     * @returns {object[]}
     */
    filterByGeometryAvailability(pool = null, hasGeometry = false) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!hasGeometry) {
            return [...parts];
        }

        return parts.filter(part =>
            part.geometryStatus !== 'unavailable'
        );
    }

    /**
     * Filtert Teile, die mindestens einen der angegebenen Tags enthalten
     * (case-insensitiv).
     *
     * @param {string[]}      tags  - Gesuche Tags (mindestens einer muss übereinstimmen)
     * @param {object[]|null} pool  - Teilemenge oder null für alle Teile
     * @returns {object[]}
     */
    filterByTags(tags, pool = null) {
        const parts = Array.isArray(pool)
            ? pool
            : this.catalog.getAllParts();

        if (!Array.isArray(tags) || tags.length === 0) {
            return [...parts];
        }

        return parts.filter(part => partHasAnyTag(part, tags));
    }

    filter(options = {}) {
        const {
            query = '',
            category = 'all',

            width = null,
            depth = null,
            height = null,

            geometry = 'all',

            physicalOnly  = true,
            verifiedOnly  = false,
            placeableOnly = false,

            allowRotation = true,
            tolerance     = 0,

            // ── Neue Filter (Phase E.3 / E.5) ──────────────────────────────
            /** @type {number|null} LDraw-Farb-ID; null = kein Filter (E.3) */
            colorId = null,

            /** @type {string|null} Varianten-ID; null = kein Filter (E.5) */
            variantId = null,

            /** @type {boolean} true = nur Teile mit ldrawPartNumber */
            ldrawOnly = false,

            /** @type {boolean} true = nur Teile mit geometryStatus !== 'unavailable' */
            hasGeometry = false,

            /** @type {string[]} Mindestens ein Tag muss übereinstimmen */
            tags = [],
        } = options;

        let result = this.catalog.getAllParts();

        result = this.filterByPhysical(
            result,
            physicalOnly
        );

        result = this.filterByVerification(
            result,
            verifiedOnly
        );

        result = this.filterByPlacement(
            result,
            placeableOnly
        );

        result = this.search(
            query,
            result
        );

        result = this.filterByCategory(
            category,
            result
        );

        result = this.filterByGeometry(
            geometry,
            result
        );

        if (width !== null || depth !== null) {
            result = this.filterBySize(
                width,
                depth,
                result,
                {
                    allowRotation,
                    tolerance
                }
            );
        }

        if (height !== null) {
            result = result.filter(part =>
                matchesDimension(
                    part.height,
                    height,
                    tolerance
                )
            );
        }

        // ── Neue Filter ────────────────────────────────────────────────────

        result = this.filterByColor(result, colorId);

        result = this.filterByVariant(result, variantId);

        result = this.filterByLDrawAvailability(result, ldrawOnly);

        result = this.filterByGeometryAvailability(result, hasGeometry);

        if (Array.isArray(tags) && tags.length > 0) {
            result = this.filterByTags(tags, result);
        }

        return result;
    }

    getSuggestions(query, limit = 8) {
        const normalizedQuery = normalize(query);

        if (!normalizedQuery) return [];

        return this.search(normalizedQuery)
            .slice(0, Math.max(0, limit))
            .map(part => ({
                id: part.id,
                name: part.name,
                category: part.category
            }));
    }
}