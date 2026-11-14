/**
 * Tests for PartCategoryManager (Phase E.2)
 *
 * Coverage:
 *  - Constructor: loads all 16 default categories (6 original + 10 Phase E)
 *  - getAll(): returns all 16 categories as public objects (no BUILTIN_FLAG symbol)
 *  - getById('bricks'): returns bricks category
 *  - getById('wheels'): returns wheels category (new Phase E)
 *  - getById('nonexistent'): returns null
 *  - hasCategory(id): true/false
 *  - getIds(): array contains all 16 category IDs
 *  - isBuiltin('bricks'): returns true
 *  - isBuiltin('custom-x'): returns false
 *  - addCategory(def): adds custom category successfully
 *  - addCategory with duplicate id → throws
 *  - addCategory with builtin id → throws (even with overwrite:true)
 *  - removeCategory('bricks'): throws (builtin protection)
 *  - removeCategory('custom-id'): removes successfully
 *  - removeCategory nonexistent custom: returns false
 *  - getForFilter(): returns [{id, name}] array sorted alphabetically
 *  - getCategoryTree(): returns array with children property
 *  - static fromJSON(json): creates manager with extra custom categories
 *  - static fromJSON skips entries without id/name
 *  - static fromJSON ignores builtin IDs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartCategoryManager } from '../src/catalog/PartCategoryManager.js';

// ─── Known constants ──────────────────────────────────────────────────────────

const EXPECTED_BUILTIN_IDS = [
    // Original 6
    'bricks', 'plates', 'tiles', 'slopes', 'technic', 'windows',
    // Phase E new 10
    'doors', 'wheels', 'tires', 'axles', 'pins',
    'hinges', 'panels', 'minifigures', 'accessories', 'other',
];

const TOTAL_BUILTIN = EXPECTED_BUILTIN_IDS.length; // 16

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('PartCategoryManager – Constructor', () => {

    it('creates an instance of PartCategoryManager', () => {
        const m = new PartCategoryManager();
        assert.ok(m instanceof PartCategoryManager);
    });

    it('loads all 16 built-in categories by default', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });

    it('accepts null customCategories without error', () => {
        assert.doesNotThrow(() => new PartCategoryManager(null));
    });

    it('accepts an empty array for customCategories', () => {
        const m = new PartCategoryManager([]);
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });

    it('loads custom categories passed to constructor', () => {
        const m = new PartCategoryManager([{ id: 'my-cat', name: 'Meine Kat.' }]);
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN + 1);
    });

    it('skips custom categories with missing id', () => {
        const m = new PartCategoryManager([{ name: 'No ID' }]);
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });

    it('skips custom categories that clash with builtins', () => {
        const m = new PartCategoryManager([{ id: 'bricks', name: 'Duplicate Bricks' }]);
        // Should not add a second bricks
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });
});

// ─── getAll() ────────────────────────────────────────────────────────────────

describe('PartCategoryManager – getAll()', () => {

    it('returns an array', () => {
        const m = new PartCategoryManager();
        assert.ok(Array.isArray(m.getAll()));
    });

    it('returns exactly 16 categories', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });

    it('each category has id, name, icon, description keys', () => {
        const m = new PartCategoryManager();
        for (const cat of m.getAll()) {
            assert.ok('id' in cat, `"id" missing from ${JSON.stringify(cat)}`);
            assert.ok('name' in cat, `"name" missing from ${cat.id}`);
            assert.ok('icon' in cat, `"icon" missing from ${cat.id}`);
            assert.ok('description' in cat, `"description" missing from ${cat.id}`);
        }
    });

    it('does not expose the internal BUILTIN_FLAG Symbol', () => {
        const m = new PartCategoryManager();
        for (const cat of m.getAll()) {
            // Symbol keys should not be present on public objects
            const symKeys = Object.getOwnPropertySymbols(cat);
            assert.strictEqual(symKeys.length, 0);
        }
    });

    it('includes all expected builtin category IDs', () => {
        const m = new PartCategoryManager();
        const ids = m.getAll().map(c => c.id);
        for (const expected of EXPECTED_BUILTIN_IDS) {
            assert.ok(ids.includes(expected), `Expected ID "${expected}" not found`);
        }
    });
});

// ─── getById() ───────────────────────────────────────────────────────────────

describe('PartCategoryManager – getById()', () => {

    it('returns the bricks category', () => {
        const m = new PartCategoryManager();
        const cat = m.getById('bricks');
        assert.ok(cat !== null);
        assert.strictEqual(cat.id, 'bricks');
        assert.strictEqual(cat.name, 'Steine');
    });

    it('returns the wheels category (Phase E new)', () => {
        const m = new PartCategoryManager();
        const cat = m.getById('wheels');
        assert.ok(cat !== null);
        assert.strictEqual(cat.id, 'wheels');
    });

    it('returns the doors category (Phase E new)', () => {
        const m = new PartCategoryManager();
        const cat = m.getById('doors');
        assert.ok(cat !== null);
        assert.strictEqual(cat.id, 'doors');
    });

    it('returns the minifigures category (Phase E new)', () => {
        const m = new PartCategoryManager();
        const cat = m.getById('minifigures');
        assert.ok(cat !== null);
    });

    it('returns null for nonexistent id', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.getById('nonexistent'), null);
    });

    it('returns null for empty string', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.getById(''), null);
    });

    it('coerces numeric input to string (category stored under string key)', () => {
        const m = new PartCategoryManager();
        // No numeric categories exist, so should return null without throwing
        assert.strictEqual(m.getById(42), null);
    });
});

// ─── hasCategory() ───────────────────────────────────────────────────────────

describe('PartCategoryManager – hasCategory()', () => {

    it('returns true for a builtin category', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.hasCategory('bricks'), true);
    });

    it('returns true for wheels (Phase E)', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.hasCategory('wheels'), true);
    });

    it('returns false for nonexistent id', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.hasCategory('nonexistent'), false);
    });

    it('returns false for empty string', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.hasCategory(''), false);
    });

    it('returns true for custom category after addCategory', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'custom-x', name: 'Custom X' });
        assert.strictEqual(m.hasCategory('custom-x'), true);
    });
});

// ─── getIds() ────────────────────────────────────────────────────────────────

describe('PartCategoryManager – getIds()', () => {

    it('returns an array', () => {
        const m = new PartCategoryManager();
        assert.ok(Array.isArray(m.getIds()));
    });

    it('contains exactly 16 IDs for a fresh manager', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.getIds().length, TOTAL_BUILTIN);
    });

    it('contains all expected builtin IDs', () => {
        const m = new PartCategoryManager();
        const ids = m.getIds();
        for (const expected of EXPECTED_BUILTIN_IDS) {
            assert.ok(ids.includes(expected), `Expected "${expected}" in getIds()`);
        }
    });

    it('grows when custom category added', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'extra', name: 'Extra' });
        assert.strictEqual(m.getIds().length, TOTAL_BUILTIN + 1);
    });

    it('all items are strings', () => {
        const m = new PartCategoryManager();
        for (const id of m.getIds()) {
            assert.strictEqual(typeof id, 'string');
        }
    });
});

// ─── isBuiltin() ─────────────────────────────────────────────────────────────

describe('PartCategoryManager – isBuiltin()', () => {

    it('returns true for bricks (original builtin)', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.isBuiltin('bricks'), true);
    });

    it('returns true for wheels (Phase E builtin)', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.isBuiltin('wheels'), true);
    });

    it('returns true for all 16 builtin IDs', () => {
        const m = new PartCategoryManager();
        for (const id of EXPECTED_BUILTIN_IDS) {
            assert.strictEqual(m.isBuiltin(id), true, `"${id}" should be builtin`);
        }
    });

    it('returns false for custom category', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'my-custom', name: 'My Custom' });
        assert.strictEqual(m.isBuiltin('my-custom'), false);
    });

    it('returns false for nonexistent id', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.isBuiltin('nonexistent'), false);
    });
});

// ─── addCategory() ───────────────────────────────────────────────────────────

describe('PartCategoryManager – addCategory()', () => {

    it('adds a new custom category successfully', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'my-cat', name: 'My Cat' });
        assert.strictEqual(m.hasCategory('my-cat'), true);
    });

    it('new category is retrievable via getById', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'my-cat', name: 'My Cat', icon: '🐱', description: 'Cool' });
        const cat = m.getById('my-cat');
        assert.ok(cat !== null);
        assert.strictEqual(cat.id, 'my-cat');
        assert.strictEqual(cat.name, 'My Cat');
        assert.strictEqual(cat.icon, '🐱');
    });

    it('throws Error when id is missing', () => {
        const m = new PartCategoryManager();
        assert.throws(() => m.addCategory({ name: 'No ID' }), Error);
    });

    it('throws Error when name is missing', () => {
        const m = new PartCategoryManager();
        assert.throws(() => m.addCategory({ id: 'no-name' }), Error);
    });

    it('throws Error on duplicate id without overwrite', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'dup', name: 'First' });
        assert.throws(() => m.addCategory({ id: 'dup', name: 'Second' }), Error);
    });

    it('allows overwrite of custom duplicate with overwrite: true', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'dup', name: 'First' });
        assert.doesNotThrow(() => m.addCategory({ id: 'dup', name: 'Second', overwrite: true }));
        assert.strictEqual(m.getById('dup').name, 'Second');
    });

    it('throws Error when trying to overwrite a builtin category', () => {
        const m = new PartCategoryManager();
        assert.throws(
            () => m.addCategory({ id: 'bricks', name: 'Override Bricks', overwrite: true }),
            Error
        );
    });

    it('throws Error when trying to add with builtin id (no overwrite)', () => {
        const m = new PartCategoryManager();
        assert.throws(
            () => m.addCategory({ id: 'wheels', name: 'Override Wheels' }),
            Error
        );
    });

    it('increases total count by 1', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'extra', name: 'Extra' });
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN + 1);
    });

    it('custom category isBuiltin returns false', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'custom-z', name: 'Custom Z' });
        assert.strictEqual(m.isBuiltin('custom-z'), false);
    });
});

// ─── removeCategory() ────────────────────────────────────────────────────────

describe('PartCategoryManager – removeCategory()', () => {

    it('throws Error when trying to remove a builtin category', () => {
        const m = new PartCategoryManager();
        assert.throws(() => m.removeCategory('bricks'), Error);
    });

    it('throws Error for all builtin categories', () => {
        const m = new PartCategoryManager();
        for (const id of EXPECTED_BUILTIN_IDS) {
            assert.throws(() => m.removeCategory(id), Error, `removeCategory("${id}") should throw`);
        }
    });

    it('removes a custom category and returns true', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'removable', name: 'Removable' });
        const result = m.removeCategory('removable');
        assert.strictEqual(result, true);
        assert.strictEqual(m.hasCategory('removable'), false);
    });

    it('count decreases after removing custom category', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'temp', name: 'Temp' });
        m.removeCategory('temp');
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });

    it('returns false for nonexistent custom id', () => {
        const m = new PartCategoryManager();
        const result = m.removeCategory('no-such-custom-cat');
        assert.strictEqual(result, false);
    });
});

// ─── getForFilter() ───────────────────────────────────────────────────────────

describe('PartCategoryManager – getForFilter()', () => {

    it('returns an array', () => {
        const m = new PartCategoryManager();
        assert.ok(Array.isArray(m.getForFilter()));
    });

    it('returns 16 entries for fresh manager', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.getForFilter().length, TOTAL_BUILTIN);
    });

    it('each entry has id and name properties', () => {
        const m = new PartCategoryManager();
        for (const entry of m.getForFilter()) {
            assert.ok('id' in entry, `"id" missing from ${JSON.stringify(entry)}`);
            assert.ok('name' in entry, `"name" missing from ${JSON.stringify(entry)}`);
        }
    });

    it('is sorted alphabetically by name', () => {
        const m = new PartCategoryManager();
        const filter = m.getForFilter();
        for (let i = 1; i < filter.length; i++) {
            const cmp = filter[i - 1].name.localeCompare(filter[i].name, 'de');
            assert.ok(cmp <= 0,
                `"${filter[i - 1].name}" should come before or equal "${filter[i].name}"`
            );
        }
    });

    it('includes custom category after addCategory', () => {
        const m = new PartCategoryManager();
        m.addCategory({ id: 'zzz-cat', name: 'Zzz Kategorie' });
        const filter = m.getForFilter();
        assert.strictEqual(filter.length, TOTAL_BUILTIN + 1);
        assert.ok(filter.some(e => e.id === 'zzz-cat'));
    });
});

// ─── getCategoryTree() ────────────────────────────────────────────────────────

describe('PartCategoryManager – getCategoryTree()', () => {

    it('returns an array', () => {
        const m = new PartCategoryManager();
        assert.ok(Array.isArray(m.getCategoryTree()));
    });

    it('returns 16 entries for fresh manager', () => {
        const m = new PartCategoryManager();
        assert.strictEqual(m.getCategoryTree().length, TOTAL_BUILTIN);
    });

    it('each entry has a children array', () => {
        const m = new PartCategoryManager();
        for (const node of m.getCategoryTree()) {
            assert.ok('children' in node, `"children" missing from node ${node.id}`);
            assert.ok(Array.isArray(node.children), `"children" should be array for ${node.id}`);
        }
    });

    it('children array is currently empty (flat tree placeholder)', () => {
        const m = new PartCategoryManager();
        for (const node of m.getCategoryTree()) {
            assert.strictEqual(node.children.length, 0);
        }
    });

    it('each tree node has id, name, icon, description, children', () => {
        const m = new PartCategoryManager();
        for (const node of m.getCategoryTree()) {
            assert.ok('id' in node);
            assert.ok('name' in node);
            assert.ok('icon' in node);
            assert.ok('description' in node);
            assert.ok('children' in node);
        }
    });
});

// ─── static fromJSON() ───────────────────────────────────────────────────────

describe('PartCategoryManager – static fromJSON()', () => {

    it('creates a PartCategoryManager instance', () => {
        const m = PartCategoryManager.fromJSON({ categories: [] });
        assert.ok(m instanceof PartCategoryManager);
    });

    it('includes all 16 builtin categories', () => {
        const m = PartCategoryManager.fromJSON({ categories: [] });
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });

    it('adds extra custom categories from JSON', () => {
        const m = PartCategoryManager.fromJSON({
            categories: [
                { id: 'json-cat-1', name: 'JSON Cat 1' },
                { id: 'json-cat-2', name: 'JSON Cat 2' },
            ],
        });
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN + 2);
        assert.ok(m.hasCategory('json-cat-1'));
        assert.ok(m.hasCategory('json-cat-2'));
    });

    it('skips entries without id', () => {
        const m = PartCategoryManager.fromJSON({
            categories: [
                { name: 'No ID Entry' },
                { id: 'valid-one', name: 'Valid' },
            ],
        });
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN + 1);
    });

    it('skips entries without name', () => {
        const m = PartCategoryManager.fromJSON({
            categories: [
                { id: 'no-name-entry' },
                { id: 'valid-two', name: 'Valid Two' },
            ],
        });
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN + 1);
    });

    it('silently ignores entries that try to re-add builtin IDs', () => {
        const m = PartCategoryManager.fromJSON({
            categories: [
                { id: 'bricks', name: 'Override Bricks' },
            ],
        });
        // bricks should still exist and be builtin
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
        assert.strictEqual(m.isBuiltin('bricks'), true);
    });

    it('throws Error for invalid (non-object) input', () => {
        assert.throws(() => PartCategoryManager.fromJSON(null), Error);
        assert.throws(() => PartCategoryManager.fromJSON('string'), Error);
    });

    it('treats missing categories key as empty array', () => {
        const m = PartCategoryManager.fromJSON({});
        assert.strictEqual(m.getAll().length, TOTAL_BUILTIN);
    });

    it('custom categories loaded via fromJSON are not builtin', () => {
        const m = PartCategoryManager.fromJSON({
            categories: [{ id: 'from-json', name: 'From JSON' }],
        });
        assert.strictEqual(m.isBuiltin('from-json'), false);
    });
});
