/**
 * BillOfMaterialsBuilder – Erstellt eine technische Stückliste (Phase H.4)
 *
 * Gruppiert gleiche Bauteile anhand:
 *  - partId
 *  - variantId (falls vorhanden)
 *  - colorId (bevorzugt) oder color (Fallback)
 *
 * Abnahmekriterium:
 *  Die Summe aller BOMEntry.quantity muss exakt der Anzahl der Bauteile
 *  im Snapshot entsprechen (nach Filterung ausgeschlossener Bauteile).
 */

import { BOMEntry } from './BOMEntry.js';

/**
 * @typedef {object} ExportPart
 * @property {string}           instanceId
 * @property {string}           partId
 * @property {string|null}      [ldrawPartNumber]
 * @property {string|null}      [name]
 * @property {number|null}      [colorId]
 * @property {string|null}      [colorName]
 * @property {string|null}      [colorHex]
 * @property {string|null}      [variantId]
 * @property {'local'|'ldraw'|null} [source]
 * @property {string|null}      [category]
 * @property {string|null}      [color]   – legacy fallback if colorId absent
 */

/**
 * @typedef {object} ExportSnapshot
 * @property {ExportPart[]} parts
 * @property {string}       [projectName]
 * @property {number}       [formatVersion]
 */

/**
 * @typedef {object} BOMSummary
 * @property {number} totalParts
 * @property {number} uniqueTypes
 * @property {number} uniqueColors
 * @property {number} uniqueVariants
 * @property {number} unknownParts
 * @property {number} localParts
 * @property {number} ldrawParts
 */

/**
 * @typedef {object} BOM
 * @property {BOMEntry[]}  entries
 * @property {BOMSummary}  summary
 * @property {object}      metadata
 */

export class BillOfMaterialsBuilder {
    /**
     * @param {object}  [options]
     * @param {boolean} [options.includeLocal=true]  – include parts with source === 'local'
     * @param {boolean} [options.includeLDraw=true]  – include parts with source === 'ldraw'
     */
    constructor(options = {}) {
        this._includeLocal  = options.includeLocal  !== false;   // default true
        this._includeLDraw  = options.includeLDraw  !== false;   // default true
    }

    // ── Public ─────────────────────────────────────────────────────────────────

    /**
     * Builds a full BOM from an export snapshot.
     *
     * @param {ExportSnapshot} snapshot
     * @returns {BOM}
     */
    build(snapshot) {
        if (!snapshot || !Array.isArray(snapshot.parts)) {
            throw new TypeError('BillOfMaterialsBuilder.build: snapshot.parts must be an array');
        }

        // ── 1. Filter parts according to source options ──────────────────────
        const filtered = snapshot.parts.filter(part => this._shouldInclude(part));

        // ── 2. Group into accumulator map ────────────────────────────────────
        /** @type {Map<string, {acc: object, instanceIds: string[]}>} */
        const groups = new Map();

        for (const part of filtered) {
            const key = this._groupKey(part);

            if (!groups.has(key)) {
                groups.set(key, {
                    acc: {
                        partId:          part.partId,
                        ldrawPartNumber: part.ldrawPartNumber ?? null,
                        name:            part.name            ?? null,
                        colorId:         part.colorId         ?? null,
                        colorName:       part.colorName       ?? null,
                        colorHex:        part.colorHex        ?? null,
                        variantId:       part.variantId       ?? null,
                        quantity:        0,
                        source:          part.source          ?? null,
                        category:        part.category        ?? null,
                    },
                    instanceIds: [],
                });
            }

            const group = groups.get(key);
            group.acc.quantity++;
            group.instanceIds.push(part.instanceId);
        }

        // ── 3. Convert map to BOMEntry[] ─────────────────────────────────────
        const entries = [];
        for (const { acc, instanceIds } of groups.values()) {
            entries.push(new BOMEntry({ ...acc, instanceIds }));
        }

        // ── 4. Sort: primary by partId, secondary by colorName ?? colorId ?? color ──
        entries.sort((a, b) => {
            const pidCmp = a.partId.localeCompare(b.partId, undefined, { numeric: true });
            if (pidCmp !== 0) return pidCmp;

            const aColor = a.colorName ?? String(a.colorId ?? '');
            const bColor = b.colorName ?? String(b.colorId ?? '');
            return aColor.localeCompare(bColor);
        });

        // ── 5. Build summary ─────────────────────────────────────────────────
        const summary = this._buildSummary(entries);

        // ── 6. Acceptance criterion: totalParts === filtered.length ──────────
        if (summary.totalParts !== filtered.length) {
            throw new Error(
                `BillOfMaterialsBuilder: quantity mismatch — ` +
                `sum of entry quantities (${summary.totalParts}) ` +
                `does not match filtered part count (${filtered.length})`
            );
        }

        // ── 7. Metadata ──────────────────────────────────────────────────────
        const metadata = {
            projectName:           snapshot.projectName          ?? 'Unbenannt',
            builtAt:               new Date().toISOString(),
            snapshotFormatVersion: snapshot.formatVersion        ?? 1,
        };

        return { entries, summary, metadata };
    }

    // ── Private ────────────────────────────────────────────────────────────────

    /**
     * Decides whether a part should be included based on builder options.
     * Parts with source === null are always included (unknown provenance).
     *
     * @param {ExportPart} part
     * @returns {boolean}
     */
    _shouldInclude(part) {
        if (part.source === 'local'  && !this._includeLocal)  return false;
        if (part.source === 'ldraw'  && !this._includeLDraw)  return false;
        return true;
    }

    /**
     * Computes the stable group key for a part.
     * Mirrors BOMEntry.groupKey so keys are consistent.
     *
     * @param {ExportPart} part
     * @returns {string}
     */
    _groupKey(part) {
        const colorPart = part.colorId ?? part.color ?? '';
        return `${part.partId}|${part.variantId ?? ''}|${colorPart}`;
    }

    /**
     * Derives aggregated statistics from a finished entry list.
     *
     * @param {BOMEntry[]} entries
     * @returns {BOMSummary}
     */
    _buildSummary(entries) {
        const partIds    = new Set();
        const colorKeys  = new Set();
        const variantIds = new Set();
        let totalParts   = 0;
        let unknownParts = 0;
        let localParts   = 0;
        let ldrawParts   = 0;

        for (const entry of entries) {
            totalParts   += entry.quantity;
            partIds.add(entry.partId);

            const colorKey = entry.colorId ?? entry.colorName ?? null;
            if (colorKey !== null) colorKeys.add(colorKey);

            if (entry.variantId !== null) variantIds.add(entry.variantId);
            if (!entry.name)              unknownParts++;
            if (entry.source === 'local') localParts++;
            if (entry.source === 'ldraw') ldrawParts++;
        }

        return {
            totalParts,
            uniqueTypes:    partIds.size,
            uniqueColors:   colorKeys.size,
            uniqueVariants: variantIds.size,
            unknownParts,
            localParts,
            ldrawParts,
        };
    }
}
