
import { PartCatalog } from './PartCatalog.js';

// =====================================================================
// PartSearch
//
// Suche und Filterung im Bauteilkatalog.
//
// Regeln:
//   - Groß-/Kleinschreibung wird ignoriert (Suche immer lowercase).
//   - Leerzeichen am Rand werden entfernt.
//   - Teilbegriffe werden gefunden.
//   - Leere Suche liefert alle Ergebnisse (nach optionalen Filtern).
//   - Filter können kombiniert werden.
// =====================================================================

export class PartSearch {

    constructor(catalog = null) {
        // Erlaubt den Einsatz eines anderen Katalogs (z. B. in Tests)
        this._catalog = catalog ?? PartCatalog.instance();
    }


    // ----------------------------------------------------------------
    // Volltextsuche
    // ----------------------------------------------------------------

    /**
     * Sucht Bauteile nach einem Textbegriff.
     * Durchsucht id, name und tags.
     *
     * @param {string}   query   – Suchbegriff
     * @param {object[]} [pool]  – Optional: Teilmenge der Bauteile
     * @returns {object[]}
     */
    search(query, pool = null) {

        const parts = pool ?? this._catalog.getAllParts();

        const term = (query ?? '').trim().toLowerCase();

        if (!term) return parts;

        return parts.filter(part => this._matchesTerm(part, term));
    }

    _matchesTerm(part, term) {

        if (part.id.toLowerCase().includes(term))   return true;
        if (part.name.toLowerCase().includes(term)) return true;

        if (Array.isArray(part.tags)) {
            for (const tag of part.tags) {
                if (tag.toLowerCase().includes(term)) return true;
            }
        }

        if (part.description &&
            part.description.toLowerCase().includes(term)) {
            return true;
        }

        return false;
    }


    // ----------------------------------------------------------------
    // Einzelne Filter
    // ----------------------------------------------------------------

    /**
     * Filtert Bauteile nach Kategorie.
     *
     * @param {object[]} parts
     * @param {string}   category  – z. B. "bricks", "" oder null = alle
     * @returns {object[]}
     */
    filterByCategory(parts, category) {

        if (!category) return parts;

        return parts.filter(p => p.category === category);
    }

    /**
     * Filtert Bauteile nach Abmessungen.
     *
     * width und/oder depth können null sein – dann wird diese Dimension
     * nicht eingeschränkt.
     *
     * @param {object[]}    parts
     * @param {number|null} width
     * @param {number|null} depth
     * @returns {object[]}
     */
    filterBySize(parts, width, depth) {

        return parts.filter(p => {
            const wOk = width == null || p.width === width || p.depth === width;
            const dOk = depth == null || p.depth === depth || p.width === depth;
            return wOk && dOk;
        });
    }

    /**
     * Filtert Bauteile nach Geometrietyp.
     *
     * @param {object[]} parts
     * @param {string}   geometry  – z. B. "brick", "plate", "tile", "slope"
     * @returns {object[]}
     */
    filterByGeometry(parts, geometry) {

        if (!geometry) return parts;

        return parts.filter(p => p.geometry === geometry);
    }


    // ----------------------------------------------------------------
    // Kombinierter Filter (alle Kriterien auf einmal anwenden)
    // ----------------------------------------------------------------

    /**
     * Wendet Suche und alle optionalen Filter in einem Aufruf an.
     *
     * @param {object} options
     * @param {string}      [options.query]    – Textsuche
     * @param {string}      [options.category] – Kategorie-ID
     * @param {number|null} [options.width]    – Breite in Noppen
     * @param {number|null} [options.depth]    – Tiefe in Noppen
     * @param {string}      [options.geometry] – Geometrietyp
     * @returns {object[]}
     */
    filter({ query = '', category = '', width = null,
              depth = null, geometry = '' } = {}) {

        let results = this._catalog.getAllParts();

        if (category) {
            results = this.filterByCategory(results, category);
        }

        if (query) {
            results = this.search(query, results);
        }

        if (width != null || depth != null) {
            results = this.filterBySize(results, width, depth);
        }

        if (geometry) {
            results = this.filterByGeometry(results, geometry);
        }

        return results;
    }
}
