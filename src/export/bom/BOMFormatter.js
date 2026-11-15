/**
 * BOMFormatter – Formatiert Stücklistendaten für die Ausgabe (Phase H)
 *
 * Rein statische Hilfsklasse. Keine Instanz nötig.
 */

/** @typedef {import('./BOMEntry.js').BOMEntry} BOMEntry */

export class BOMFormatter {

    // ── Display helpers ────────────────────────────────────────────────────────

    /**
     * Returns the best human-readable color label for an entry.
     *
     * Priority: colorName → #colorHex → "Color <colorId>" → "Unbekannt"
     *
     * @param {BOMEntry} entry
     * @returns {string}
     */
    static formatColorDisplay(entry) {
        if (entry.colorName) {
            return entry.colorName;
        }
        if (entry.colorHex) {
            // Normalise hex – strip leading '#' then re-add for consistency.
            const hex = entry.colorHex.startsWith('#')
                ? entry.colorHex
                : `#${entry.colorHex}`;
            return hex;
        }
        if (entry.colorId !== null && entry.colorId !== undefined) {
            return `Color ${entry.colorId}`;
        }
        return 'Unbekannt';
    }

    /**
     * Returns the best human-readable part name for an entry.
     *
     * Priority: name → partId
     *
     * @param {BOMEntry} entry
     * @returns {string}
     */
    static formatPartName(entry) {
        return entry.name || entry.partId;
    }

    // ── Sorting ────────────────────────────────────────────────────────────────

    /**
     * Returns a **new** array of entries sorted by the given criterion.
     *
     * 'quantity' – descending (highest first), then partId ascending as tiebreaker
     * 'partId'   – ascending, numeric-aware, then colorName ascending
     * 'color'    – ascending by colorName/colorId, then partId ascending
     *
     * The original array is not mutated.
     *
     * @param {BOMEntry[]} entries
     * @param {'quantity'|'partId'|'color'} [sortBy='partId']
     * @returns {BOMEntry[]}
     */
    static sortEntries(entries, sortBy = 'partId') {
        const copy = [...entries];

        switch (sortBy) {
            case 'quantity':
                copy.sort((a, b) => {
                    const qDiff = b.quantity - a.quantity;   // descending
                    if (qDiff !== 0) return qDiff;
                    return a.partId.localeCompare(b.partId, undefined, { numeric: true });
                });
                break;

            case 'color':
                copy.sort((a, b) => {
                    const aColor = BOMFormatter.formatColorDisplay(a);
                    const bColor = BOMFormatter.formatColorDisplay(b);
                    const colorCmp = aColor.localeCompare(bColor);
                    if (colorCmp !== 0) return colorCmp;
                    return a.partId.localeCompare(b.partId, undefined, { numeric: true });
                });
                break;

            case 'partId':
            default:
                copy.sort((a, b) => {
                    const pidCmp = a.partId.localeCompare(b.partId, undefined, { numeric: true });
                    if (pidCmp !== 0) return pidCmp;
                    const aColor = BOMFormatter.formatColorDisplay(a);
                    const bColor = BOMFormatter.formatColorDisplay(b);
                    return aColor.localeCompare(bColor);
                });
                break;
        }

        return copy;
    }

    // ── Grouping ───────────────────────────────────────────────────────────────

    /**
     * Groups entries by category.
     *
     * Entries without a category are placed under the key `'other'`.
     *
     * @param {BOMEntry[]} entries
     * @returns {Map<string, BOMEntry[]>}
     */
    static groupByCategory(entries) {
        /** @type {Map<string, BOMEntry[]>} */
        const map = new Map();

        for (const entry of entries) {
            const key = entry.category ?? 'other';
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key).push(entry);
        }

        return map;
    }
}
