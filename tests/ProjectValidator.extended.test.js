import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectValidator } from '../src/project/ProjectValidator.js';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeValidBrick(overrides = {}) {
    return {
        id:       'b1',
        type:     'brick_2x4',
        color:    0xff0000,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        ...overrides,
    };
}

function makeValidProject(bricks = []) {
    return {
        format:      'mecabricks-clone',
        version:     3,
        project:     { id: 'p1', name: 'Test', createdAt: '', updatedAt: '' },
        bricks,
        connections: [],
    };
}

const validator = new ProjectValidator();


// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProjectValidator – LDraw-Validierungen', () => {

    // 1. Gültiger lokaler Stein ohne source-Feld
    it('gültiger lokaler Stein ohne source-Feld validiert ohne Fehler', () => {
        const data = makeValidProject([makeValidBrick()]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    // 2. Lokaler Stein mit explizitem source: 'local'
    it('lokaler Stein mit source: "local" validiert ohne Fehler', () => {
        const data = makeValidProject([makeValidBrick({ source: 'local' })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    // 3. LDraw-Stein mit source: 'ldraw' und gültiger ldrawPartNumber
    it('LDraw-Stein mit source: "ldraw" und gültiger ldrawPartNumber validiert ohne Fehler', () => {
        const data = makeValidProject([
            makeValidBrick({ source: 'ldraw', ldrawPartNumber: '3001' }),
        ]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    // 4. source: 'ldraw' ohne ldrawPartNumber wirft
    it('source: "ldraw" ohne ldrawPartNumber wirft einen Fehler', () => {
        const data = makeValidProject([
            makeValidBrick({ source: 'ldraw' }),   // kein ldrawPartNumber
        ]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    /ldrawPartNumber/i.test(err.message) || /ldraw/i.test(err.message),
                    `Fehlermeldung erwartet einen Hinweis auf ldrawPartNumber, war: "${err.message}"`
                );
                return true;
            }
        );
    });

    // 5. source: 'ldraw' mit leerer ldrawPartNumber wirft
    it('source: "ldraw" mit leerer ldrawPartNumber wirft einen Fehler', () => {
        const data = makeValidProject([
            makeValidBrick({ source: 'ldraw', ldrawPartNumber: '   ' }),
        ]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    /ldrawPartNumber/i.test(err.message) || /ldraw/i.test(err.message),
                    `Fehlermeldung erwartet einen Hinweis auf ldrawPartNumber, war: "${err.message}"`
                );
                return true;
            }
        );
    });

    // 6. source: 'ldraw' mit nicht-string ldrawPartNumber wirft
    it('source: "ldraw" mit nicht-string ldrawPartNumber wirft einen Fehler', () => {
        const data = makeValidProject([
            makeValidBrick({ source: 'ldraw', ldrawPartNumber: 3001 }),
        ]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    /ldrawPartNumber/i.test(err.message) || /ldraw/i.test(err.message),
                    `Fehlermeldung erwartet einen Hinweis auf ldrawPartNumber, war: "${err.message}"`
                );
                return true;
            }
        );
    });

    // 7. Ungültiger source-Wert wirft
    it('source: "unknown_source" wirft einen Fehler (ungültiger Quellwert)', () => {
        const data = makeValidProject([
            makeValidBrick({ source: 'unknown_source' }),
        ]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                assert.ok(
                    /unknown_source/i.test(err.message) || /quelle/i.test(err.message) || /source/i.test(err.message),
                    `Fehlermeldung sollte den ungültigen Quellwert nennen, war: "${err.message}"`
                );
                return true;
            }
        );
    });

    // 8. source: 'local' mit gültigem Stein validiert
    it('source: "local" mit gültigem Stein validiert ohne Fehler', () => {
        const data = makeValidProject([
            makeValidBrick({ id: 'b2', source: 'local' }),
        ]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    // 9. Mehrere Steine mit lokaler und LDraw-Quelle gleichzeitig
    it('Mischung aus lokalen und LDraw-Steinen validiert ohne Fehler', () => {
        const data = makeValidProject([
            makeValidBrick({ id: 'b1', source: 'local' }),
            makeValidBrick({ id: 'b2', source: 'ldraw', ldrawPartNumber: '3001' }),
        ]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    // 10. safeValidate mit LDraw-Stein ohne ldrawPartNumber gibt { valid: false }
    it('safeValidate() – LDraw-Stein ohne ldrawPartNumber gibt { valid: false, error: ... }', () => {
        const data   = makeValidProject([makeValidBrick({ source: 'ldraw' })]);
        const result = validator.safeValidate(data);
        assert.strictEqual(result.valid, false);
        assert.ok(typeof result.error === 'string', 'error soll ein String sein');
        assert.ok(result.error.length > 0, 'error darf nicht leer sein');
    });

    // 11. safeValidate mit gültigem LDraw-Stein gibt { valid: true }
    it('safeValidate() – gültiger LDraw-Stein gibt { valid: true, error: null }', () => {
        const data   = makeValidProject([
            makeValidBrick({ source: 'ldraw', ldrawPartNumber: '3001' }),
        ]);
        const result = validator.safeValidate(data);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.error, null);
    });

    // 12. source: undefined (Feld fehlt) – Abwärtskompatibilität
    it('Stein mit source: undefined (Feld fehlt) validiert (Abwärtskompatibilität)', () => {
        const brick = makeValidBrick();
        delete brick.source;   // explizit entfernen
        const data = makeValidProject([brick]);
        assert.doesNotThrow(() => validator.validate(data));
    });

});
