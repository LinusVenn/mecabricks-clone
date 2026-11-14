import { PartCatalog } from './PartCatalog.js';
import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';

export class PartSearch {

    constructor(catalog = PartCatalog.instance()) {
        this.catalog = catalog;
    }

    // ---------------------------------------------------------
    // Textsuche
    // ---------------------------------------------------------

    search(query, pool = this.catalog.getAllParts()) {
        const normalizedQuery = this._normalize(query);

        if (!normalizedQuery) {
            return [...pool];
        }

        const terms = normalizedQuery
            .split(/\s+/)
            .filter(Boolean);

        return pool.filter(part => {
            const searchable = this._getSearchText(part);

            return terms.every(term =>
                searchable.includes(term)
            );
        });
    }

    _getSearchText(part) {
        return [
            part.id,
            part.name,
            part.description,
            part.brickLinkId,
            part.ldrawPartNumber,
            part.category,
            part.geometry,
            part.geometryType,
            ...(part.tags ?? []),
            ...(part.aliases ?? [])
        ]
            .filter(value => value !== null && value !== undefined)
            .join(' ')
            .toLowerCase();
    }

    _normalize(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    // ---------------------------------------------------------
    // Kategorie
    // ---------------------------------------------------------

    // Pool kommt als erstes Argument, damit man die Methoden
    // mit einem vorher gefilterten Pool verketten kann.

    filterByCategory(pool = this.catalog.getAllParts(), category) {
        if (!category) return [...pool];

        return pool.filter(part =>
            part.category === category
        );
    }

    // ---------------------------------------------------------
    // Abmessungen
    // ---------------------------------------------------------

    filterBySize(
        pool = this.catalog.getAllParts(),
        width,
        depth,
        allowRotation = true
    ) {
        // null / undefined → Wildcard (Dimension wird nicht gefiltert)
        const hasWidth = width !== null && width !== undefined;
        const hasDepth = depth !== null && depth !== undefined;

        if (!hasWidth && !hasDepth) {
            return [...pool];
        }

        const targetWidth = hasWidth ? Number(width) : null;
        const targetDepth = hasDepth ? Number(depth) : null;

        // Ungültige numerische Werte → kein Ergebnis
        if (hasWidth && !Number.isFinite(targetWidth)) return [];
        if (hasDepth && !Number.isFinite(targetDepth)) return [];

        return pool.filter(part => {
            const matchWidth  = !hasWidth  || part.width === targetWidth;
            const matchDepth  = !hasDepth  || part.depth === targetDepth;

            const directMatch = matchWidth && matchDepth;

            const rotatedMatch =
                allowRotation &&
                hasWidth && hasDepth &&
                part.width === targetDepth &&
                part.depth === targetWidth;

            return directMatch || rotatedMatch;
        });
    }

    // ---------------------------------------------------------
    // Geometrie
    // ---------------------------------------------------------

    filterByGeometry(
        pool = this.catalog.getAllParts(),
        geometry
    ) {
        if (!geometry) return [...pool];

        return pool.filter(part =>
            part.geometry === geometry ||
            part.geometryType === geometry
        );
    }

    // ---------------------------------------------------------
    // Platzierbarkeit
    // ---------------------------------------------------------

    isPlaceable(part) {
        if (!part || part.placementSupported !== true) {
            return false;
        }

        // Brick.js kann nur interne Definitionen erzeugen.
        return Object.prototype.hasOwnProperty.call(
            PART_DEFINITIONS,
            part.id
        );
    }

    // ---------------------------------------------------------
    // Kombinierte Filterung
    // ---------------------------------------------------------

    filter(options = {}) {
        const {
            query = '',
            category = '',
            width = null,
            depth = null,
            geometry = '',

            physicalOnly = false,
            verifiedOnly = false,
            placeableOnly = false
        } = options;

        let results = this.catalog.getAllParts();

        results = this.search(query, results);

        results = this.filterByCategory(results, category);

        if (width !== null && depth !== null) {
            results = this.filterBySize(results, width, depth);
        }

        results = this.filterByGeometry(results, geometry);

        if (physicalOnly) {
            results = results.filter(part =>
                part.isPhysical === true
            );
        }

        if (verifiedOnly) {
            results = results.filter(part =>
                part.isVerified === true
            );
        }

        if (placeableOnly) {
            results = results.filter(part =>
                this.isPlaceable(part)
            );
        }

        return results;
    }
}