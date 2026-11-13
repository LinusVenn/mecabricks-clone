/**
 * Tests für CloudErrorHandler (Phase 9.8)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudErrorHandler } from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';
import { AuthError }                   from '../src/auth/AuthService.js';


// navigator.onLine Polyfill für Node.js-Testumgebung
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}


describe('CloudErrorHandler', () => {

    let handler;

    beforeEach(() => {
        globalThis.navigator.onLine = true;
        handler = new CloudErrorHandler();
    });


    // ------------------------------------------------------------------
    // Initialisierung
    // ------------------------------------------------------------------

    it('hat initial leeres Fehlerprotokoll', () => {
        assert.strictEqual(handler.getLog().length, 0);
    });

    it('errorCount ist initial 0', () => {
        assert.strictEqual(handler.errorCount, 0);
    });

    it('getLastError gibt null zurück wenn kein Fehler', () => {
        assert.strictEqual(handler.getLastError(), null);
    });


    // ------------------------------------------------------------------
    // Fehlerklassifizierung
    // ------------------------------------------------------------------

    it('klassifiziert CONFLICT-Fehler korrekt', () => {
        const err = new CloudError('Konflikt', CloudErrorCodes.CONFLICT);
        const entry = handler.handle(err, 'test');
        assert.strictEqual(entry.code, CloudErrorCodes.CONFLICT);
    });

    it('klassifiziert NOT_FOUND-Fehler korrekt', () => {
        const err = new CloudError('Nicht gefunden', CloudErrorCodes.NOT_FOUND);
        const entry = handler.handle(err, 'test');
        assert.strictEqual(entry.code, CloudErrorCodes.NOT_FOUND);
    });

    it('klassifiziert 401-Fehler als AUTH', () => {
        const err = new AuthError('Nicht autorisiert', 'UNAUTHORIZED', 401);
        const entry = handler.handle(err, 'test');
        assert.strictEqual(entry.code, CloudErrorCodes.AUTH);
    });

    it('klassifiziert 403-Fehler als FORBIDDEN', () => {
        const err = { message: 'Forbidden', status: 403 };
        const entry = handler.handle(err, 'test');
        assert.strictEqual(entry.code, CloudErrorCodes.FORBIDDEN);
    });

    it('gibt userMessage für CONFLICT zurück', () => {
        const err = new CloudError('Konflikt', CloudErrorCodes.CONFLICT);
        const entry = handler.handle(err, 'test');
        assert.ok(typeof entry.userMessage === 'string' && entry.userMessage.length > 0);
    });

    it('gibt userMessage für OFFLINE zurück', () => {
        globalThis.navigator.onLine = false;
        const err = new Error('Network failure');
        const entry = handler.handle(err, 'test');
        assert.strictEqual(entry.code, CloudErrorCodes.OFFLINE);
    });

    it('isConflictError gibt true für CONFLICT-Fehler zurück', () => {
        const err = new CloudError('Konflikt', CloudErrorCodes.CONFLICT);
        assert.ok(handler.isConflictError(err));
    });

    it('isAuthError gibt true für AuthError zurück', () => {
        const err = new AuthError('Nicht autorisiert', 'UNAUTHORIZED', 401);
        assert.ok(handler.isAuthError(err));
    });


    // ------------------------------------------------------------------
    // Protokoll
    // ------------------------------------------------------------------

    it('fügt Fehler zum Protokoll hinzu', () => {
        handler.handle(new Error('Test'), 'test');
        assert.strictEqual(handler.errorCount, 1);
    });

    it('getLastError gibt letzten Fehler zurück', () => {
        handler.handle(new Error('erster'), 'a');
        handler.handle(new Error('zweiter'), 'b');
        assert.strictEqual(handler.getLastError()?.context, 'b');
    });

    it('clearLog leert das Protokoll', () => {
        handler.handle(new Error('Test'), 'test');
        handler.clearLog();
        assert.strictEqual(handler.errorCount, 0);
    });

    it('Protokoll-Größe ist begrenzt', () => {
        const smallHandler = new CloudErrorHandler({ maxErrors: 3 });
        for (let i = 0; i < 5; i++) {
            smallHandler.handle(new Error(`err ${i}`), 'ctx');
        }
        assert.ok(smallHandler.errorCount <= 3);
    });


    // ------------------------------------------------------------------
    // onError-Callback
    // ------------------------------------------------------------------

    it('onError-Callback wird bei Fehler aufgerufen', () => {
        let received = null;
        const h = new CloudErrorHandler({ onError: entry => { received = entry; } });
        h.handle(new Error('test'), 'ctx');
        assert.ok(received !== null);
    });

});
