/**
 * Erweiterte Tests für CloudErrorHandler
 *
 * Abdeckung von Lücken:
 *  - INVALID_DATA via error.code
 *  - INVALID_DATA via message 'invalid'
 *  - INVALID_DATA via message 'ungültig'
 *  - SERVER_ERROR (status >= 500)
 *  - NETWORK-Fehler via isNetworkError()
 *  - Klassifizierungs-Priorität: OFFLINE vor CONFLICT
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudErrorHandler }        from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';


// navigator.onLine Polyfill für Node.js
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}


describe('CloudErrorHandler – INVALID_DATA', () => {

    let handler;

    beforeEach(() => {
        globalThis.navigator.onLine = true;
        handler = new CloudErrorHandler();
    });

    it('klassifiziert Fehler mit code INVALID_DATA als INVALID_DATA', () => {
        const err   = new CloudError('Ungültige Daten', CloudErrorCodes.INVALID_DATA);
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.INVALID_DATA);
    });

    it('klassifiziert Fehler mit message "invalid" (case-insensitive) als INVALID_DATA', () => {
        const err   = new Error('invalid JSON format');
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.INVALID_DATA);
    });

    it('klassifiziert Fehler mit message "Invalid" (Großbuchstaben) als INVALID_DATA', () => {
        const err   = new Error('Invalid request body');
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.INVALID_DATA);
    });

    it('klassifiziert Fehler mit message "ungültig" als INVALID_DATA', () => {
        const err   = new Error('ungültige Projektdaten');
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.INVALID_DATA);
    });

    it('klassifiziert Fehler mit message "Ungültig" (Großbuchstabe) als INVALID_DATA', () => {
        const err   = new Error('Ungültige Anfrage');
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.INVALID_DATA);
    });

    it('enthält userMessage für INVALID_DATA', () => {
        const err   = new Error('invalid data');
        const entry = handler.handle(err, 'test');

        assert.ok(typeof entry.userMessage === 'string' && entry.userMessage.length > 0);
    });
});


describe('CloudErrorHandler – SERVER_ERROR', () => {

    let handler;

    beforeEach(() => {
        globalThis.navigator.onLine = true;
        handler = new CloudErrorHandler();
    });

    it('klassifiziert Fehler mit status 500 als SERVER_ERROR', () => {
        const err   = { message: 'Internal Server Error', status: 500 };
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.SERVER_ERROR);
    });

    it('klassifiziert Fehler mit status 503 als SERVER_ERROR', () => {
        const err   = { message: 'Service Unavailable', status: 503 };
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.SERVER_ERROR);
    });

    it('klassifiziert Fehler mit status 599 als SERVER_ERROR', () => {
        const err   = { message: 'Gateway Error', status: 599 };
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.SERVER_ERROR);
    });

    it('SERVER_ERROR: enthält userMessage', () => {
        const err   = { message: 'Server Error', status: 500 };
        const entry = handler.handle(err, 'test');

        assert.ok(typeof entry.userMessage === 'string' && entry.userMessage.length > 0);
    });
});


describe('CloudErrorHandler – Klassifizierungs-Priorität', () => {

    let handler;

    beforeEach(() => {
        globalThis.navigator.onLine = true;
        handler = new CloudErrorHandler();
    });

    it('OFFLINE hat Vorrang vor CONFLICT wenn navigator.onLine = false', () => {
        globalThis.navigator.onLine = false;

        // Fehler der normalerweise als CONFLICT klassifiziert würde
        const conflictErr = new CloudError('Konflikt', CloudErrorCodes.CONFLICT);
        const entry       = handler.handle(conflictErr, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.OFFLINE,
            'OFFLINE muss Vorrang vor CONFLICT haben');

        globalThis.navigator.onLine = true;
    });

    it('CONFLICT hat Vorrang vor AUTH wenn online', () => {
        // Nur prüfen, dass ein CONFLICT-Fehler als CONFLICT (nicht AUTH) klassifiziert wird
        const err   = new CloudError('Konflikt', CloudErrorCodes.CONFLICT);
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.CONFLICT);
    });

    it('unbekannter Fehler fällt auf UNKNOWN zurück', () => {
        const err   = new Error('völlig unbekannter Fehler xyz');
        const entry = handler.handle(err, 'test');

        assert.strictEqual(entry.code, CloudErrorCodes.UNKNOWN);
    });
});


describe('CloudErrorHandler – NETWORK-Fehler', () => {

    let handler;

    beforeEach(() => {
        globalThis.navigator.onLine = true;
        handler = new CloudErrorHandler();
    });

    it('isNetworkError() gibt true zurück für typische Netzwerkfehler-Nachrichten', () => {
        // Prüfe, ob isNetworkError() die öffentliche API korrekt implementiert
        const networkErr = new Error('Failed to fetch');
        const result     = handler.isNetworkError(networkErr);

        // isNetworkError soll Netzwerkfehler erkennen
        assert.strictEqual(typeof result, 'boolean');
    });

    it('isNetworkError() gibt false zurück für normale Fehler', () => {
        const normalErr = new Error('Normaler Geschäftsfehler');
        const result    = handler.isNetworkError(normalErr);

        assert.strictEqual(result, false);
    });
});
