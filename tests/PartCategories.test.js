import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PART_CATEGORIES } from '../src/objects/PartCategories.js';

describe('PartCategories', () => {

    // ── Grundstruktur ─────────────────────────────────────────────────

    it('exportiert PART_CATEGORIES als Objekt', () => {
        assert.strictEqual(typeof PART_CATEGORIES, 'object');
        assert.ok(PART_CATEGORIES !== null);
    });

    it('enthält genau 6 Kategorien', () => {
        assert.strictEqual(Object.keys(PART_CATEGORIES).length, 6);
    });

    it('enthält die sechs erwarteten Schlüssel', () => {
        const expected = ['bricks', 'plates', 'tiles', 'slopes', 'technic', 'windows'];
        for (const key of expected) {
            assert.ok(key in PART_CATEGORIES, `Schlüssel "${key}" fehlt`);
        }
    });

    // ── Pflichtfelder ─────────────────────────────────────────────────

    it('jede Kategorie hat id, name, icon, description', () => {
        for (const cat of Object.values(PART_CATEGORIES)) {
            assert.ok(typeof cat.id          === 'string' && cat.id,          `id fehlt / leer in ${JSON.stringify(cat)}`);
            assert.ok(typeof cat.name        === 'string' && cat.name,        `name fehlt in ${cat.id}`);
            assert.ok(typeof cat.icon        === 'string' && cat.icon,        `icon fehlt in ${cat.id}`);
            assert.ok(typeof cat.description === 'string' && cat.description, `description fehlt in ${cat.id}`);
        }
    });

    it('id stimmt mit dem Schlüssel überein', () => {
        for (const [key, cat] of Object.entries(PART_CATEGORIES)) {
            assert.strictEqual(cat.id, key, `Schlüssel "${key}" ≠ id "${cat.id}"`);
        }
    });

    // ── Einzelne Kategorien ───────────────────────────────────────────

    it('bricks-Kategorie hat name "Steine"', () => {
        assert.strictEqual(PART_CATEGORIES.bricks.name, 'Steine');
    });

    it('plates-Kategorie erwähnt "Platt" in der Beschreibung', () => {
        assert.ok(PART_CATEGORIES.plates.description.toLowerCase().includes('platt'));
    });

    it('tiles-Kategorie erwähnt "Noppen" in der Beschreibung', () => {
        assert.ok(PART_CATEGORIES.tiles.description.toLowerCase().includes('noppen'));
    });

    it('slopes-Kategorie hat id "slopes"', () => {
        assert.strictEqual(PART_CATEGORIES.slopes.id, 'slopes');
    });

    it('technic-Kategorie hat id "technic"', () => {
        assert.strictEqual(PART_CATEGORIES.technic.id, 'technic');
    });

    it('windows-Kategorie hat id "windows"', () => {
        assert.strictEqual(PART_CATEGORIES.windows.id, 'windows');
    });

    // ── Unveränderlichkeit (PART_CATEGORIES ist ein Plain-Object) ─────

    it('PART_CATEGORIES ist ein Plain-Object (kein Array)', () => {
        assert.ok(!Array.isArray(PART_CATEGORIES));
    });
});
