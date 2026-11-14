/**
 * Tests for PartVariantDefinition (Phase E.5)
 *
 * Coverage:
 *  - Constructor: all required fields, optional defaults
 *  - Getters: basePartId, variantId, name, isDefault, ldrawPartNumber, overrides, tags, description
 *  - matches(criteria): by variantId, by tags, by ldrawPartNumber, AND logic, empty criteria
 *  - applyToPartDefinition(basePart): merge, overrides win, isVariant:true, tag union, ldrawPartNumber, variantDescription
 *  - toData() / static fromData() roundtrip
 *  - Error: missing basePartId, variantId, name
 *  - Immutability: frozen object cannot be mutated
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartVariantDefinition } from '../src/catalog/variants/PartVariantDefinition.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Minimal valid definition */
const MINIMAL = {
    basePartId: 'brick_2x4',
    variantId:  'with-logo',
    name:       'Stein 2×4 mit Logo',
};

/** Full definition with all optional fields */
const FULL = {
    basePartId:       'brick_2x4',
    variantId:        'smooth',
    name:             'Stein 2×4 glatt',
    description:      'Ohne Noppen, glätte Oberseite',
    ldrawPartNumber:  '3001s',
    tags:             ['smooth', 'logo', 'standard'],
    overrides:        { width: 2, depth: 4, geometry: { studs: false } },
    isDefault:        true,
};

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('PartVariantDefinition – Constructor', () => {

    it('creates instance with minimal required fields', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.ok(v instanceof PartVariantDefinition);
    });

    it('creates instance with all fields provided', () => {
        const v = new PartVariantDefinition(FULL);
        assert.ok(v instanceof PartVariantDefinition);
    });

    it('applies default values for optional fields', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.strictEqual(v.ldrawPartNumber, null);
        assert.deepEqual([...v.tags], []);
        assert.deepEqual({ ...v.overrides }, {});
        assert.strictEqual(v.isDefault, false);
        assert.strictEqual(v.description, '');
    });

    it('throws TypeError when config is not an object', () => {
        assert.throws(() => new PartVariantDefinition(null), TypeError);
        assert.throws(() => new PartVariantDefinition('string'), TypeError);
        assert.throws(() => new PartVariantDefinition(42), TypeError);
    });

    it('throws TypeError when basePartId is missing', () => {
        assert.throws(
            () => new PartVariantDefinition({ variantId: 'v', name: 'N' }),
            TypeError
        );
    });

    it('throws TypeError when basePartId is empty string', () => {
        assert.throws(
            () => new PartVariantDefinition({ basePartId: '  ', variantId: 'v', name: 'N' }),
            TypeError
        );
    });

    it('throws TypeError when variantId is missing', () => {
        assert.throws(
            () => new PartVariantDefinition({ basePartId: 'bp', name: 'N' }),
            TypeError
        );
    });

    it('throws TypeError when variantId is empty string', () => {
        assert.throws(
            () => new PartVariantDefinition({ basePartId: 'bp', variantId: '', name: 'N' }),
            TypeError
        );
    });

    it('throws TypeError when name is missing', () => {
        assert.throws(
            () => new PartVariantDefinition({ basePartId: 'bp', variantId: 'v' }),
            TypeError
        );
    });

    it('throws TypeError when name is whitespace-only', () => {
        assert.throws(
            () => new PartVariantDefinition({ basePartId: 'bp', variantId: 'v', name: '   ' }),
            TypeError
        );
    });

    it('throws TypeError when ldrawPartNumber is non-null non-string', () => {
        assert.throws(
            () => new PartVariantDefinition({ ...MINIMAL, ldrawPartNumber: 42 }),
            TypeError
        );
    });

    it('throws TypeError when tags is not an array', () => {
        assert.throws(
            () => new PartVariantDefinition({ ...MINIMAL, tags: 'smooth' }),
            TypeError
        );
    });

    it('throws TypeError when overrides is an array', () => {
        assert.throws(
            () => new PartVariantDefinition({ ...MINIMAL, overrides: [] }),
            TypeError
        );
    });

    it('trims whitespace from basePartId, variantId and name', () => {
        const v = new PartVariantDefinition({
            basePartId: '  brick_1x1  ',
            variantId:  '  round  ',
            name:       '  Runder Stein  ',
        });
        assert.strictEqual(v.basePartId, 'brick_1x1');
        assert.strictEqual(v.variantId,  'round');
        assert.strictEqual(v.name,       'Runder Stein');
    });
});

// ─── Getters ─────────────────────────────────────────────────────────────────

describe('PartVariantDefinition – Getters', () => {

    it('basePartId returns the part id', () => {
        const v = new PartVariantDefinition(FULL);
        assert.strictEqual(v.basePartId, 'brick_2x4');
    });

    it('variantId returns the variant id', () => {
        const v = new PartVariantDefinition(FULL);
        assert.strictEqual(v.variantId, 'smooth');
    });

    it('name returns the display name', () => {
        const v = new PartVariantDefinition(FULL);
        assert.strictEqual(v.name, 'Stein 2×4 glatt');
    });

    it('description returns the description string', () => {
        const v = new PartVariantDefinition(FULL);
        assert.strictEqual(v.description, 'Ohne Noppen, glätte Oberseite');
    });

    it('ldrawPartNumber returns null when not set', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.strictEqual(v.ldrawPartNumber, null);
    });

    it('ldrawPartNumber returns the LDraw number when set', () => {
        const v = new PartVariantDefinition(FULL);
        assert.strictEqual(v.ldrawPartNumber, '3001s');
    });

    it('isDefault returns false when not set', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.strictEqual(v.isDefault, false);
    });

    it('isDefault returns true when set', () => {
        const v = new PartVariantDefinition(FULL);
        assert.strictEqual(v.isDefault, true);
    });

    it('overrides returns the overrides object', () => {
        const v = new PartVariantDefinition(FULL);
        assert.strictEqual(v.overrides.width, 2);
        assert.strictEqual(v.overrides.depth, 4);
    });

    it('overrides returns empty object when not set', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.deepEqual({ ...v.overrides }, {});
    });

    it('tags returns frozen array of trimmed strings', () => {
        const v = new PartVariantDefinition(FULL);
        assert.deepEqual([...v.tags], ['smooth', 'logo', 'standard']);
    });

    it('tags filters out empty strings', () => {
        const v = new PartVariantDefinition({ ...MINIMAL, tags: ['a', '', '  ', 'b'] });
        assert.deepEqual([...v.tags], ['a', 'b']);
    });
});

// ─── matches() ───────────────────────────────────────────────────────────────

describe('PartVariantDefinition – matches(criteria)', () => {

    const v = new PartVariantDefinition({
        basePartId:      'brick_2x4',
        variantId:       'smooth',
        name:            'Glatt',
        ldrawPartNumber: '3001s',
        tags:            ['smooth', 'classic'],
    });

    it('empty criteria object returns true', () => {
        assert.strictEqual(v.matches({}), true);
    });

    it('matches by exact variantId', () => {
        assert.strictEqual(v.matches({ variantId: 'smooth' }), true);
    });

    it('does not match wrong variantId', () => {
        assert.strictEqual(v.matches({ variantId: 'logo' }), false);
    });

    it('matches by ldrawPartNumber', () => {
        assert.strictEqual(v.matches({ ldrawPartNumber: '3001s' }), true);
    });

    it('does not match wrong ldrawPartNumber', () => {
        assert.strictEqual(v.matches({ ldrawPartNumber: '9999' }), false);
    });

    it('matches by single tag (OR semantics)', () => {
        assert.strictEqual(v.matches({ tags: ['smooth'] }), true);
    });

    it('matches when at least one of multiple tags is present', () => {
        assert.strictEqual(v.matches({ tags: ['nope', 'classic'] }), true);
    });

    it('does not match when no tags overlap', () => {
        assert.strictEqual(v.matches({ tags: ['logo', 'technic'] }), false);
    });

    it('empty tags array returns false', () => {
        assert.strictEqual(v.matches({ tags: [] }), false);
    });

    it('multiple criteria: AND logic – all must match', () => {
        assert.strictEqual(v.matches({ variantId: 'smooth', ldrawPartNumber: '3001s' }), true);
    });

    it('multiple criteria: AND logic – fails when one does not match', () => {
        assert.strictEqual(v.matches({ variantId: 'smooth', ldrawPartNumber: 'WRONG' }), false);
    });

    it('multiple criteria: variantId + tags', () => {
        assert.strictEqual(v.matches({ variantId: 'smooth', tags: ['smooth'] }), true);
    });

    it('returns false for non-object criteria', () => {
        assert.strictEqual(v.matches(null), false);
        assert.strictEqual(v.matches('string'), false);
    });
});

// ─── applyToPartDefinition() ─────────────────────────────────────────────────

describe('PartVariantDefinition – applyToPartDefinition(basePart)', () => {

    const basePart = {
        id:     'brick_2x4',
        name:   'Stein 2×4',
        width:  2,
        depth:  4,
        height: 1,
        tags:   ['basic', 'brick'],
    };

    it('returns a new object (does not mutate basePart)', () => {
        const v = new PartVariantDefinition(MINIMAL);
        const merged = v.applyToPartDefinition(basePart);
        assert.notStrictEqual(merged, basePart);
        assert.strictEqual(basePart.name, 'Stein 2×4'); // unchanged
    });

    it('merges basePart fields into the result', () => {
        const v = new PartVariantDefinition(MINIMAL);
        const merged = v.applyToPartDefinition(basePart);
        assert.strictEqual(merged.id, 'brick_2x4');
        assert.strictEqual(merged.height, 1);
    });

    it('sets isVariant: true on merged result', () => {
        const v = new PartVariantDefinition(MINIMAL);
        const merged = v.applyToPartDefinition(basePart);
        assert.strictEqual(merged.isVariant, true);
    });

    it('sets variantId and variantName on merged result', () => {
        const v = new PartVariantDefinition(MINIMAL);
        const merged = v.applyToPartDefinition(basePart);
        assert.strictEqual(merged.variantId, 'with-logo');
        assert.strictEqual(merged.variantName, 'Stein 2×4 mit Logo');
    });

    it('overrides win over basePart fields', () => {
        const v = new PartVariantDefinition({ ...MINIMAL, overrides: { width: 99 } });
        const merged = v.applyToPartDefinition(basePart);
        assert.strictEqual(merged.width, 99);
    });

    it('sets ldrawPartNumber when present in variant', () => {
        const v = new PartVariantDefinition({ ...MINIMAL, ldrawPartNumber: '3001s' });
        const merged = v.applyToPartDefinition(basePart);
        assert.strictEqual(merged.ldrawPartNumber, '3001s');
    });

    it('does not set ldrawPartNumber when null', () => {
        const v = new PartVariantDefinition(MINIMAL);
        const merged = v.applyToPartDefinition(basePart);
        // ldrawPartNumber should not appear or remain as basePart had it
        assert.ok(!('ldrawPartNumber' in merged) || merged.ldrawPartNumber === undefined);
    });

    it('sets variantDescription when description is non-empty', () => {
        const v = new PartVariantDefinition({ ...MINIMAL, description: 'Beschreibung' });
        const merged = v.applyToPartDefinition(basePart);
        assert.strictEqual(merged.variantDescription, 'Beschreibung');
    });

    it('does not set variantDescription when description is empty', () => {
        const v = new PartVariantDefinition(MINIMAL);
        const merged = v.applyToPartDefinition(basePart);
        assert.ok(!merged.variantDescription);
    });

    it('merges tags without duplicates', () => {
        const v = new PartVariantDefinition({ ...MINIMAL, tags: ['logo', 'basic'] }); // 'basic' is duplicate
        const merged = v.applyToPartDefinition(basePart);
        const tagSet = new Set(merged.tags);
        assert.ok(tagSet.has('basic'));
        assert.ok(tagSet.has('brick'));
        assert.ok(tagSet.has('logo'));
        assert.strictEqual(merged.tags.filter(t => t === 'basic').length, 1);
    });

    it('keeps basePart tags when variant has no tags', () => {
        const v = new PartVariantDefinition(MINIMAL);
        const merged = v.applyToPartDefinition(basePart);
        // tags should not be on merged (unchanged path) OR equal basePart's tags
        if ('tags' in merged) {
            assert.deepEqual(merged.tags, basePart.tags);
        }
    });

    it('throws TypeError when basePart is null', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.throws(() => v.applyToPartDefinition(null), TypeError);
    });

    it('throws TypeError when basePart is a string', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.throws(() => v.applyToPartDefinition('not-an-object'), TypeError);
    });
});

// ─── toData() / fromData() ────────────────────────────────────────────────────

describe('PartVariantDefinition – toData() / fromData() roundtrip', () => {

    it('toData() returns a plain JSON-compatible object', () => {
        const v = new PartVariantDefinition(FULL);
        const data = v.toData();
        assert.strictEqual(typeof data, 'object');
        assert.ok(data !== null);
        assert.ok(!(data instanceof PartVariantDefinition));
    });

    it('toData() contains all expected keys', () => {
        const v = new PartVariantDefinition(FULL);
        const data = v.toData();
        const expected = ['basePartId','variantId','name','description',
                          'ldrawPartNumber','tags','overrides','isDefault'];
        for (const key of expected) {
            assert.ok(key in data, `key "${key}" missing from toData()`);
        }
    });

    it('fromData() creates an equivalent instance', () => {
        const v = new PartVariantDefinition(FULL);
        const v2 = PartVariantDefinition.fromData(v.toData());
        assert.ok(v2 instanceof PartVariantDefinition);
        assert.strictEqual(v2.basePartId, v.basePartId);
        assert.strictEqual(v2.variantId, v.variantId);
        assert.strictEqual(v2.name, v.name);
        assert.strictEqual(v2.ldrawPartNumber, v.ldrawPartNumber);
        assert.strictEqual(v2.isDefault, v.isDefault);
        assert.deepEqual([...v2.tags], [...v.tags]);
        assert.deepEqual({ ...v2.overrides }, { ...v.overrides });
    });

    it('JSON.stringify + fromData() roundtrip works', () => {
        const v = new PartVariantDefinition(FULL);
        const json = JSON.stringify(v.toData());
        const v2 = PartVariantDefinition.fromData(JSON.parse(json));
        assert.strictEqual(v2.variantId, 'smooth');
        assert.strictEqual(v2.isDefault, true);
    });

    it('fromData() throws TypeError for null input', () => {
        assert.throws(() => PartVariantDefinition.fromData(null), TypeError);
    });

    it('fromData() throws TypeError for string input', () => {
        assert.throws(() => PartVariantDefinition.fromData('not-an-object'), TypeError);
    });

    it('toData() tags array is a fresh copy (not same reference)', () => {
        const v = new PartVariantDefinition(FULL);
        const data = v.toData();
        data.tags.push('extra');
        // original variant tags should be unaffected
        assert.strictEqual(v.tags.length, 3);
    });
});

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('PartVariantDefinition – Immutability (Object.freeze)', () => {

    it('instance is frozen', () => {
        const v = new PartVariantDefinition(MINIMAL);
        assert.ok(Object.isFrozen(v));
    });

    it('cannot reassign _basePartId (strict mode – silently fails or throws)', () => {
        const v = new PartVariantDefinition(MINIMAL);
        // In strict mode (ESM) this throws; otherwise it's a no-op.
        // Either way, the value must not change.
        try { v._basePartId = 'MUTATED'; } catch { /* expected in strict mode */ }
        assert.strictEqual(v.basePartId, 'brick_2x4');
    });

    it('cannot reassign _variantId', () => {
        const v = new PartVariantDefinition(MINIMAL);
        try { v._variantId = 'MUTATED'; } catch { /* ok */ }
        assert.strictEqual(v.variantId, 'with-logo');
    });

    it('overrides object is frozen', () => {
        const v = new PartVariantDefinition(FULL);
        assert.ok(Object.isFrozen(v.overrides));
    });

    it('tags array is frozen', () => {
        const v = new PartVariantDefinition(FULL);
        assert.ok(Object.isFrozen(v.tags));
    });
});
