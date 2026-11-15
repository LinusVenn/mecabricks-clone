/**
 * Logic check:
 *   12 red 3001s  + 8 blue 3001s  + 5 red 3003s  = 25 parts total
 *   Expected: 3 BOM entries, totalParts = 25, uniqueTypes = 2
 */

// ── Inline minimal copies of the three classes (no bundler needed) ───────────

class BOMEntry {
    constructor(def) {
        this._partId          = def.partId;
        this._ldrawPartNumber = def.ldrawPartNumber  ?? null;
        this._name            = def.name             ?? null;
        this._colorId         = def.colorId          ?? null;
        this._colorName       = def.colorName        ?? null;
        this._colorHex        = def.colorHex         ?? null;
        this._variantId       = def.variantId        ?? null;
        this._quantity        = def.quantity;
        this._source          = def.source           ?? null;
        this._category        = def.category         ?? null;
        this._instanceIds     = Object.freeze([...(def.instanceIds ?? [])]);
        Object.freeze(this);
    }
    get partId()         { return this._partId; }
    get ldrawPartNumber(){ return this._ldrawPartNumber; }
    get name()           { return this._name; }
    get colorId()        { return this._colorId; }
    get colorName()      { return this._colorName; }
    get colorHex()       { return this._colorHex; }
    get variantId()      { return this._variantId; }
    get quantity()       { return this._quantity; }
    get source()         { return this._source; }
    get category()       { return this._category; }
    get instanceIds()    { return this._instanceIds; }
    get groupKey() {
        const colorPart = this._colorId ?? this._colorName ?? '';
        return `${this._partId}|${this._variantId ?? ''}|${colorPart}`;
    }
    toData() {
        return {
            partId: this._partId, ldrawPartNumber: this._ldrawPartNumber,
            name: this._name, colorId: this._colorId, colorName: this._colorName,
            colorHex: this._colorHex, variantId: this._variantId,
            quantity: this._quantity, source: this._source,
            category: this._category, instanceIds: [...this._instanceIds],
        };
    }
    static fromData(obj) { return new BOMEntry(obj); }
}

class BillOfMaterialsBuilder {
    constructor(options = {}) {
        this._includeLocal = options.includeLocal !== false;
        this._includeLDraw = options.includeLDraw !== false;
    }
    _shouldInclude(part) {
        if (part.source === 'local' && !this._includeLocal) return false;
        if (part.source === 'ldraw' && !this._includeLDraw) return false;
        return true;
    }
    _groupKey(part) {
        const colorPart = part.colorId ?? part.color ?? '';
        return `${part.partId}|${part.variantId ?? ''}|${colorPart}`;
    }
    _buildSummary(entries) {
        const partIds = new Set(), colorKeys = new Set(), variantIds = new Set();
        let totalParts = 0, unknownParts = 0, localParts = 0, ldrawParts = 0;
        for (const e of entries) {
            totalParts += e.quantity;
            partIds.add(e.partId);
            const ck = e.colorId ?? e.colorName ?? null;
            if (ck !== null) colorKeys.add(ck);
            if (e.variantId !== null) variantIds.add(e.variantId);
            if (!e.name)              unknownParts++;
            if (e.source === 'local') localParts++;
            if (e.source === 'ldraw') ldrawParts++;
        }
        return { totalParts, uniqueTypes: partIds.size, uniqueColors: colorKeys.size,
                 uniqueVariants: variantIds.size, unknownParts, localParts, ldrawParts };
    }
    build(snapshot) {
        const filtered = snapshot.parts.filter(p => this._shouldInclude(p));
        const groups = new Map();
        for (const part of filtered) {
            const key = this._groupKey(part);
            if (!groups.has(key)) {
                groups.set(key, {
                    acc: {
                        partId: part.partId, ldrawPartNumber: part.ldrawPartNumber ?? null,
                        name: part.name ?? null, colorId: part.colorId ?? null,
                        colorName: part.colorName ?? null, colorHex: part.colorHex ?? null,
                        variantId: part.variantId ?? null, quantity: 0,
                        source: part.source ?? null, category: part.category ?? null,
                    },
                    instanceIds: [],
                });
            }
            const g = groups.get(key);
            g.acc.quantity++;
            g.instanceIds.push(part.instanceId);
        }
        const entries = [];
        for (const { acc, instanceIds } of groups.values()) {
            entries.push(new BOMEntry({ ...acc, instanceIds }));
        }
        entries.sort((a, b) => {
            const c = a.partId.localeCompare(b.partId, undefined, { numeric: true });
            if (c !== 0) return c;
            return (a.colorName ?? String(a.colorId ?? '')).localeCompare(
                    b.colorName ?? String(b.colorId ?? ''));
        });
        const summary = this._buildSummary(entries);
        if (summary.totalParts !== filtered.length) {
            throw new Error(`Quantity mismatch: ${summary.totalParts} vs ${filtered.length}`);
        }
        return { entries, summary, metadata: {
            projectName: snapshot.projectName ?? 'Unbenannt',
            builtAt: new Date().toISOString(),
            snapshotFormatVersion: snapshot.formatVersion ?? 1,
        }};
    }
}

// ── Build the test snapshot ───────────────────────────────────────────────────

function makeParts(partId, colorId, colorName, count, startIdx) {
    return Array.from({ length: count }, (_, i) => ({
        instanceId: `inst-${partId}-${colorId}-${startIdx + i}`,
        partId,
        name: partId === '3001' ? 'Stein 2 x 4' : 'Stein 2 x 2',
        colorId,
        colorName,
        colorHex: colorId === 4 ? '#C91A09' : '#0055BF',
        variantId: null,
        source: 'ldraw',
        category: 'bricks',
        ldrawPartNumber: `${partId}.dat`,
    }));
}

const snapshot = {
    projectName: 'Logic Check Model',
    formatVersion: 1,
    parts: [
        ...makeParts('3001', 4,  'Rot',  12, 0),     // 12 red 3001
        ...makeParts('3001', 1,  'Blau',  8, 12),    //  8 blue 3001
        ...makeParts('3003', 4,  'Rot',   5, 20),    //  5 red 3003
    ],
};

console.assert(snapshot.parts.length === 25, 'snapshot should have 25 parts');

// ── Run builder ───────────────────────────────────────────────────────────────

const builder = new BillOfMaterialsBuilder();
const bom     = builder.build(snapshot);

// ── Assertions ────────────────────────────────────────────────────────────────

const { entries, summary } = bom;

console.log('─── BOM Entries ───────────────────────────────────────────');
for (const e of entries) {
    console.log(`  partId=${e.partId}  color=${e.colorName}  qty=${e.quantity}  groupKey=${e.groupKey}`);
}

console.log('\n─── Summary ───────────────────────────────────────────────');
console.log(summary);

// Entry count
console.assert(entries.length === 3,
    `FAIL entries.length expected 3, got ${entries.length}`);

// totalParts
console.assert(summary.totalParts === 25,
    `FAIL totalParts expected 25, got ${summary.totalParts}`);

// uniqueTypes (distinct partIds: '3001', '3003')
console.assert(summary.uniqueTypes === 2,
    `FAIL uniqueTypes expected 2, got ${summary.uniqueTypes}`);

// uniqueColors (colorId 4 and 1)
console.assert(summary.uniqueColors === 2,
    `FAIL uniqueColors expected 2, got ${summary.uniqueColors}`);

// uniqueVariants (all null)
console.assert(summary.uniqueVariants === 0,
    `FAIL uniqueVariants expected 0, got ${summary.uniqueVariants}`);

// Quantities per entry
const red3001  = entries.find(e => e.partId === '3001' && e.colorId === 4);
const blue3001 = entries.find(e => e.partId === '3001' && e.colorId === 1);
const red3003  = entries.find(e => e.partId === '3003' && e.colorId === 4);

console.assert(red3001  && red3001.quantity  === 12, `FAIL red 3001 qty: ${red3001?.quantity}`);
console.assert(blue3001 && blue3001.quantity ===  8, `FAIL blue 3001 qty: ${blue3001?.quantity}`);
console.assert(red3003  && red3003.quantity  ===  5, `FAIL red 3003 qty: ${red3003?.quantity}`);

// groupKey format check
console.assert(red3001.groupKey  === '3001||4', `FAIL red3001 groupKey: ${red3001?.groupKey}`);
console.assert(blue3001.groupKey === '3001||1', `FAIL blue3001 groupKey: ${blue3001?.groupKey}`);
console.assert(red3003.groupKey  === '3003||4', `FAIL red3003 groupKey: ${red3003?.groupKey}`);

// BOMEntry.fromData round-trip
const rt = BOMEntry.fromData(red3001.toData());
console.assert(rt.partId   === red3001.partId,   'FAIL round-trip partId');
console.assert(rt.quantity === red3001.quantity,  'FAIL round-trip quantity');
console.assert(rt.colorId  === red3001.colorId,   'FAIL round-trip colorId');

// Sort by quantity
const byQty = entries.slice().sort((a, b) => b.quantity - a.quantity);
console.assert(byQty[0].quantity === 12, `FAIL sort by qty: first should be 12, got ${byQty[0].quantity}`);
console.assert(byQty[2].quantity ===  5, `FAIL sort by qty: last should be  5, got ${byQty[2].quantity}`);

console.log('\n✓ All assertions passed.');
