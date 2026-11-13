import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { EditorErrorHandler } from '../src/core/EditorErrorHandler.js';


describe('EditorErrorHandler', () => {

    let handler;

    beforeEach(() => {
        handler = new EditorErrorHandler({ silent: true });
    });


    // ------------------------------------------------------------------
    // Grundzustand
    // ------------------------------------------------------------------

    it('errorCount ist initial 0', () => {
        assert.strictEqual(handler.errorCount, 0);
    });

    it('getErrors gibt leeres Array zurück', () => {
        assert.deepEqual(handler.getErrors(), []);
    });

    it('getLastError gibt null zurück wenn kein Fehler vorhanden', () => {
        assert.strictEqual(handler.getLastError(), null);
    });


    // ------------------------------------------------------------------
    // handleError
    // ------------------------------------------------------------------

    it('handleError protokolliert Fehler', () => {
        handler.handleError(new Error('Testfehler'), 'test');
        assert.strictEqual(handler.errorCount, 1);
    });

    it('handleError speichert message und context', () => {
        handler.handleError(new Error('msg'), 'ctx');
        const entry = handler.getLastError();
        assert.strictEqual(entry.message, 'msg');
        assert.strictEqual(entry.context, 'ctx');
    });

    it('handleError speichert Zeitstempel', () => {
        const before = Date.now();
        handler.handleError(new Error('t'), '');
        const after = Date.now();
        const entry = handler.getLastError();
        assert.ok(entry.time >= before && entry.time <= after);
    });

    it('handleError toleriert Nicht-Error-Werte', () => {
        assert.doesNotThrow(() => handler.handleError('string-error', 'ctx'));
        assert.doesNotThrow(() => handler.handleError(42, 'ctx'));
        assert.doesNotThrow(() => handler.handleError(null, 'ctx'));
    });

    it('handleError ruft onError-Callback auf', () => {
        let received = null;
        const h = new EditorErrorHandler({ silent: true, onError: e => { received = e; } });
        h.handleError(new Error('cb'), 'callbackTest');
        assert.ok(received !== null);
        assert.strictEqual(received.message, 'cb');
    });

    it('Fehler im onError-Callback wird still ignoriert', () => {
        const h = new EditorErrorHandler({
            silent: true,
            onError: () => { throw new Error('callback error'); }
        });
        assert.doesNotThrow(() => h.handleError(new Error('x'), ''));
    });


    // ------------------------------------------------------------------
    // try()
    // ------------------------------------------------------------------

    it('try gibt Rückgabewert von fn zurück', () => {
        const result = handler.try(() => 42, 'ctx');
        assert.strictEqual(result, 42);
    });

    it('try gibt null zurück wenn fn wirft', () => {
        const result = handler.try(() => { throw new Error('fail'); }, 'ctx');
        assert.strictEqual(result, null);
    });

    it('try protokolliert den Fehler', () => {
        handler.try(() => { throw new Error('boom'); }, 'tryCtx');
        assert.strictEqual(handler.errorCount, 1);
        assert.strictEqual(handler.getLastError()?.context, 'tryCtx');
    });

    it('try lässt fehlerfreie Funktionen unbehelligt durch', () => {
        assert.doesNotThrow(() => handler.try(() => 'ok', ''));
        assert.strictEqual(handler.errorCount, 0);
    });


    // ------------------------------------------------------------------
    // tryAsync()
    // ------------------------------------------------------------------

    it('tryAsync gibt aufgelösten Wert zurück', async () => {
        const result = await handler.tryAsync(async () => 99, 'asyncCtx');
        assert.strictEqual(result, 99);
    });

    it('tryAsync gibt null zurück bei abgelehntem Promise', async () => {
        const result = await handler.tryAsync(
            async () => { throw new Error('async fail'); },
            'asyncCtx'
        );
        assert.strictEqual(result, null);
        assert.strictEqual(handler.errorCount, 1);
    });


    // ------------------------------------------------------------------
    // initPanel()
    // ------------------------------------------------------------------

    it('initPanel führt die Funktion aus und gibt Ergebnis zurück', () => {
        const result = handler.initPanel('myPanel', () => ({ initialized: true }));
        assert.deepEqual(result, { initialized: true });
    });

    it('initPanel gibt null zurück wenn fn wirft', () => {
        const result = handler.initPanel('failPanel', () => { throw new Error('init fail'); });
        assert.strictEqual(result, null);
    });

    it('initPanel verwendet panel:<id> als Kontext', () => {
        handler.initPanel('myPanel', () => { throw new Error('x'); });
        assert.strictEqual(handler.getLastError()?.context, 'panel:myPanel');
    });


    // ------------------------------------------------------------------
    // Protokoll-Verwaltung
    // ------------------------------------------------------------------

    it('clearErrors leert das Protokoll', () => {
        handler.handleError(new Error('e1'), '');
        handler.handleError(new Error('e2'), '');
        handler.clearErrors();
        assert.strictEqual(handler.errorCount, 0);
        assert.deepEqual(handler.getErrors(), []);
    });

    it('getErrors gibt eine Kopie zurück (keine direkte Referenz)', () => {
        handler.handleError(new Error('x'), '');
        const errors = handler.getErrors();
        errors.length = 0;  // Kopie leeren
        assert.strictEqual(handler.errorCount, 1);  // Original unverändert
    });

    it('maximale Protokollgröße wird eingehalten', () => {
        const h = new EditorErrorHandler({ silent: true, maxErrors: 3 });
        for (let i = 0; i < 5; i++) h.handleError(new Error(`e${i}`), '');
        assert.strictEqual(h.errorCount, 3);
    });

    it('ältester Fehler fliegt raus wenn Protokoll voll ist', () => {
        const h = new EditorErrorHandler({ silent: true, maxErrors: 2 });
        h.handleError(new Error('first'), '');
        h.handleError(new Error('second'), '');
        h.handleError(new Error('third'), '');
        const msgs = h.getErrors().map(e => e.message);
        assert.ok(!msgs.includes('first'));
        assert.ok(msgs.includes('third'));
    });
});
