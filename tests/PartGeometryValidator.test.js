import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartGeometryValidator } from '../src/catalog/geometry/PartGeometryValidator.js';

// ---------------------------------------------------------------------------
// Gültiges Ergebnis-Objekt, das als Basis für die Tests verwendet wird.
// Einzelne Felder werden in den Tests gezielt überschrieben oder entfernt.
// ---------------------------------------------------------------------------
function makeValid() {
    return {
        partId:     'brick_2x4',
        source:     'local',
        object3D:   { isObject3D: true },
        dimensions: { width: 4, depth: 2, height: 1.2 },
        release:    () => {},
    };
}

describe('PartGeometryValidator', () => {

    // -----------------------------------------------------------------------
    // validate() – ungültige Eingaben → Fehler
    // -----------------------------------------------------------------------

    it('validate(null) wirft einen Fehler', () => {
        assert.throws(
            () => PartGeometryValidator.validate(null),
            { message: /Ungültiges Geometrie-Ergebnis/ }
        );
    });

    it('validate({}) wirft einen Fehler weil partId fehlt', () => {
        assert.throws(
            () => PartGeometryValidator.validate({}),
            { message: /partId/ }
        );
    });

    it('validate() wirft einen Fehler wenn partId ein leerer String ist', () => {
        const result = makeValid();
        result.partId = '';
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /partId/ }
        );
    });

    it('validate() wirft einen Fehler wenn source unbekannt ist', () => {
        const result = makeValid();
        result.source = 'unknown';
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /source/ }
        );
    });

    it('validate() wirft einen Fehler wenn object3D null ist', () => {
        const result = makeValid();
        result.object3D = null;
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /object3D/ }
        );
    });

    it('validate() wirft einen Fehler wenn dimensions null ist', () => {
        const result = makeValid();
        result.dimensions = null;
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /dimensions/ }
        );
    });

    it('validate() wirft einen Fehler wenn eine Dimension kein endlicher Zahlenwert ist (width ist String)', () => {
        const result = makeValid();
        result.dimensions = { width: 'a', depth: 1, height: 1 };
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /dimensions/ }
        );
    });

    it('validate() wirft einen Fehler wenn release keine Funktion ist', () => {
        const result = makeValid();
        result.release = 'nichtEineFunktion';
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /release/ }
        );
    });

    // -----------------------------------------------------------------------
    // validate() – gültiges Objekt → gibt true zurück
    // -----------------------------------------------------------------------

    it('validate(gültigesObjekt) gibt true zurück', () => {
        assert.strictEqual(PartGeometryValidator.validate(makeValid()), true);
    });

    // -----------------------------------------------------------------------
    // isValid() – ungültige Eingaben
    // -----------------------------------------------------------------------

    it('isValid(null) gibt false zurück', () => {
        assert.strictEqual(PartGeometryValidator.isValid(null), false);
    });

    // -----------------------------------------------------------------------
    // isValid() – gültiges Objekt
    // -----------------------------------------------------------------------

    it('isValid(gültigesObjekt) gibt true zurück', () => {
        assert.strictEqual(PartGeometryValidator.isValid(makeValid()), true);
    });

    // -----------------------------------------------------------------------
    // validate() – source 'ldraw' ist ebenfalls gültig
    // -----------------------------------------------------------------------

    it('validate() akzeptiert source "ldraw" als gültig', () => {
        const result = makeValid();
        result.source = 'ldraw';
        assert.strictEqual(PartGeometryValidator.validate(result), true);
    });

    // -----------------------------------------------------------------------
    // validate() – nicht-endliche Höhe wirft Fehler
    // -----------------------------------------------------------------------

    it('validate() wirft einen Fehler wenn height nicht endlich ist (Infinity)', () => {
        const result = makeValid();
        result.dimensions = { width: 1, depth: 1, height: Infinity };
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /dimensions/ }
        );
    });

    // -----------------------------------------------------------------------
    // validate() – fehlendes release-Feld wirft Fehler
    // -----------------------------------------------------------------------

    it('validate() wirft einen Fehler wenn release fehlt (undefined)', () => {
        const result = makeValid();
        delete result.release;
        assert.throws(
            () => PartGeometryValidator.validate(result),
            { message: /release/ }
        );
    });
});
