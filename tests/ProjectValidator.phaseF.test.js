/**
 * ProjectValidator – Phase F tests
 *
 * Coverage:
 *  - Valid project with mechanicalConnections: [] → valid
 *  - Valid project with one valid mechanical connection → valid
 *  - mechanicalConnections is not an array → throws
 *  - Entry without id → throws
 *  - Entry with duplicate id → throws
 *  - Entry without type → throws
 *  - Entry without partA → throws
 *  - Entry without partB → throws
 *  - Valid v4 project without mechanicalConnections field → still valid (optional)
 *  - safeValidate() reflects validity correctly
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProjectValidator } from '../src/project/ProjectValidator.js';

// ─── Shared validator instance ────────────────────────────────────────────────

const validator = new ProjectValidator();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a minimal valid v4 project.
 * mechanicalConnections can be passed or omitted (optional field).
 */
function makeValidV4Project(overrides = {}) {
    return {
        format:  'mecabricks-clone',
        version: 4,
        project: {
            id:        'proj-1',
            name:      'Phase-F-Test',
            createdAt: '2024-11-01T00:00:00.000Z',
            updatedAt: '2024-11-01T00:00:00.000Z',
        },
        bricks:      [],
        connections: [],
        groups:      [],
        components:  [],
        ...overrides,
    };
}

/** Returns a minimal valid mechanical connection entry. */
function makeMechConn(overrides = {}) {
    return {
        id:    'mc-1',
        type:  'rigid',
        partA: 'brick-a',
        partB: 'brick-b',
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectValidator – Phase F (mechanicalConnections)', () => {


    // ── Positiv-Fälle ────────────────────────────────────────────────────────

    describe('gültige mechanicalConnections', () => {

        it('v4-Projekt ohne mechanicalConnections-Feld → gültig (Feld ist optional)', () => {
            const data = makeValidV4Project();
            // mechanicalConnections deliberately omitted
            assert.strictEqual(validator.validate(data), true);
        });

        it('v4-Projekt mit mechanicalConnections: [] → gültig', () => {
            const data = makeValidV4Project({ mechanicalConnections: [] });
            assert.strictEqual(validator.validate(data), true);
        });

        it('v4-Projekt mit einer gültigen mechanischen Verbindung → gültig', () => {
            const data = makeValidV4Project({
                mechanicalConnections: [makeMechConn()],
            });
            assert.strictEqual(validator.validate(data), true);
        });

        it('v4-Projekt mit mehreren gültigen mechanischen Verbindungen → gültig', () => {
            const data = makeValidV4Project({
                mechanicalConnections: [
                    makeMechConn({ id: 'mc-1', partA: 'p1', partB: 'p2' }),
                    makeMechConn({ id: 'mc-2', type: 'revolute', partA: 'p3', partB: 'p4' }),
                    makeMechConn({ id: 'mc-3', type: 'prismatic', partA: 'p5', partB: 'p6' }),
                ],
            });
            assert.strictEqual(validator.validate(data), true);
        });

        it('safeValidate() gibt { valid: true } für gültiges Projekt zurück', () => {
            const data = makeValidV4Project({ mechanicalConnections: [makeMechConn()] });
            const result = validator.safeValidate(data);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.error, null);
        });

    });


    // ── mechanicalConnections ist kein Array ──────────────────────────────────

    describe('mechanicalConnections ist kein Array → wirft', () => {

        it('mechanicalConnections: null → wirft', () => {
            const data = makeValidV4Project({ mechanicalConnections: null });
            assert.throws(
                () => validator.validate(data),
                /mechanicalConnections/
            );
        });

        it('mechanicalConnections: {} → wirft', () => {
            const data = makeValidV4Project({ mechanicalConnections: {} });
            assert.throws(
                () => validator.validate(data),
                /mechanicalConnections/
            );
        });

        it('mechanicalConnections: "string" → wirft', () => {
            const data = makeValidV4Project({ mechanicalConnections: 'string' });
            assert.throws(
                () => validator.validate(data),
                /mechanicalConnections/
            );
        });

        it('safeValidate() gibt { valid: false } zurück wenn mechanicalConnections kein Array ist', () => {
            const data = makeValidV4Project({ mechanicalConnections: 42 });
            const result = validator.safeValidate(data);
            assert.strictEqual(result.valid, false);
            assert.ok(typeof result.error === 'string', 'error soll ein String sein');
        });

    });


    // ── Fehlende Pflichtfelder in Einträgen ───────────────────────────────────

    describe('Pflichtfelder in Einträgen', () => {

        it('Eintrag ohne id → wirft', () => {
            const mc = makeMechConn();
            delete mc.id;
            const data = makeValidV4Project({ mechanicalConnections: [mc] });
            assert.throws(
                () => validator.validate(data),
                /id/
            );
        });

        it('Eintrag mit id: "" → wirft', () => {
            const data = makeValidV4Project({
                mechanicalConnections: [makeMechConn({ id: '' })],
            });
            assert.throws(
                () => validator.validate(data),
                /id/
            );
        });

        it('Eintrag ohne type → wirft', () => {
            const mc = makeMechConn();
            delete mc.type;
            const data = makeValidV4Project({ mechanicalConnections: [mc] });
            assert.throws(
                () => validator.validate(data),
                /type/
            );
        });

        it('Eintrag mit type: "" → wirft', () => {
            const data = makeValidV4Project({
                mechanicalConnections: [makeMechConn({ type: '' })],
            });
            assert.throws(
                () => validator.validate(data),
                /type/
            );
        });

        it('Eintrag ohne partA → wirft', () => {
            const mc = makeMechConn();
            delete mc.partA;
            const data = makeValidV4Project({ mechanicalConnections: [mc] });
            assert.throws(
                () => validator.validate(data),
                /partA/
            );
        });

        it('Eintrag mit partA: "" → wirft', () => {
            const data = makeValidV4Project({
                mechanicalConnections: [makeMechConn({ partA: '' })],
            });
            assert.throws(
                () => validator.validate(data),
                /partA/
            );
        });

        it('Eintrag ohne partB → wirft', () => {
            const mc = makeMechConn();
            delete mc.partB;
            const data = makeValidV4Project({ mechanicalConnections: [mc] });
            assert.throws(
                () => validator.validate(data),
                /partB/
            );
        });

        it('Eintrag mit partB: "" → wirft', () => {
            const data = makeValidV4Project({
                mechanicalConnections: [makeMechConn({ partB: '' })],
            });
            assert.throws(
                () => validator.validate(data),
                /partB/
            );
        });

    });


    // ── Doppelte IDs ──────────────────────────────────────────────────────────

    describe('doppelte id in mechanicalConnections', () => {

        it('zwei Einträge mit gleicher id → wirft', () => {
            const data = makeValidV4Project({
                mechanicalConnections: [
                    makeMechConn({ id: 'same-id', partA: 'p1', partB: 'p2' }),
                    makeMechConn({ id: 'same-id', partA: 'p3', partB: 'p4' }),
                ],
            });
            assert.throws(
                () => validator.validate(data),
                /same-id/
            );
        });

    });


    // ── Rückwärtskompatibilität (v3-Projekt ohne mechanicalConnections) ───────

    describe('Rückwärtskompatibilität', () => {

        it('v3-Projekt ohne mechanicalConnections-Feld → wirft nicht', () => {
            const data = {
                format:  'mecabricks-clone',
                version: 3,
                project: {
                    id:        'proj-v3',
                    name:      'Altes Projekt',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                bricks:      [],
                connections: [],
                groups:      [],
                components:  [],
                // intentionally NO mechanicalConnections field
            };
            assert.doesNotThrow(() => validator.validate(data));
            assert.strictEqual(validator.validate(data), true);
        });

        it('v1-Projekt ohne mechanicalConnections-Feld → wirft nicht', () => {
            const data = {
                format:  'mecabricks-clone',
                version: 1,
                project: {
                    id:        'proj-v1',
                    name:      'Sehr altes Projekt',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                bricks:      [],
                connections: [],
                // NO groups, components or mechanicalConnections
            };
            assert.doesNotThrow(() => validator.validate(data));
        });

    });

});
