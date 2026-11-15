/**
 * Tests für AuthManager – Phase-I-Erweiterungen
 *
 * Abdeckung:
 *  - register(email, password, { displayName }) gibt Options korrekt weiter
 *  - deleteAccount() delegiert an den AuthService und löst auf
 *  - deleteAccount() propagiert Fehler aus dem Service
 *  - NullAuthService.deleteAccount() wirft AuthError
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { AuthManager }                    from '../src/auth/AuthManager.js';
import { AuthError, NullAuthService }     from '../src/auth/AuthService.js';


// ─── Mock-AuthService ────────────────────────────────────────────────────────

class MockAuthServicePhaseI {
    constructor() {
        this._user     = null;
        this._handlers = [];

        // Spy-Felder
        this.lastRegisterOptions = null;
        this.deleteAccountCalled = false;
        this.deleteAccountError  = null;
    }

    async register(email, password, options = {}) {
        if (!email) throw new AuthError('E-Mail fehlt.', 'MISSING_FIELDS');
        this.lastRegisterOptions = options;
        this._user = { id: 'u1', email };
        this._notify('SIGNED_IN', { user: this._user });
        return this._user;
    }

    async login(email, password) {
        this._user = { id: 'u1', email };
        this._notify('SIGNED_IN', { user: this._user });
        return this._user;
    }

    async logout() {
        this._user = null;
        this._notify('SIGNED_OUT', null);
    }

    async getSession() {
        return this._user ? { user: this._user } : null;
    }

    async resetPassword() {}

    async deleteAccount() {
        this.deleteAccountCalled = true;
        if (this.deleteAccountError) throw this.deleteAccountError;
    }

    onAuthStateChange(cb) {
        this._handlers.push(cb);
        return () => { this._handlers = this._handlers.filter(h => h !== cb); };
    }

    _notify(event, session) {
        for (const h of this._handlers) h(event, session);
    }
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthManager – Phase I', () => {

    let service, manager;

    beforeEach(() => {
        service = new MockAuthServicePhaseI();
        manager = new AuthManager(service);
    });


    // ── register mit displayName ─────────────────────────────────────────────

    describe('register() mit displayName-Option', () => {

        it('übergibt leeres options-Objekt wenn kein displayName angegeben', async () => {
            await manager.register('user@test.de', 'pass123');
            assert.deepEqual(service.lastRegisterOptions, {});
        });

        it('übergibt displayName im options-Objekt', async () => {
            await manager.register('user@test.de', 'pass123', { displayName: 'Max Muster' });
            assert.strictEqual(service.lastRegisterOptions?.displayName, 'Max Muster');
        });

        it('übergibt undefined displayName wenn nicht gesetzt', async () => {
            await manager.register('user@test.de', 'pass123', { displayName: undefined });
            assert.strictEqual(service.lastRegisterOptions?.displayName, undefined);
        });

        it('ignoriert unbekannte Optionen nicht – leitet alle weiter', async () => {
            await manager.register('user@test.de', 'pass123', { displayName: 'A', extra: true });
            assert.strictEqual(service.lastRegisterOptions?.extra, true);
        });

        it('wirft AuthError bei ungültiger E-Mail (unabhängig von Options)', async () => {
            await assert.rejects(
                () => manager.register('', 'pass123', { displayName: 'Test' }),
                AuthError
            );
        });

        it('wirft AuthError bei zu kurzem Passwort', async () => {
            await assert.rejects(
                () => manager.register('user@test.de', 'abc', { displayName: 'Test' }),
                AuthError
            );
        });

    });


    // ── deleteAccount ────────────────────────────────────────────────────────

    describe('deleteAccount()', () => {

        it('ruft deleteAccount() im Service auf', async () => {
            await manager.deleteAccount();
            assert.strictEqual(service.deleteAccountCalled, true);
        });

        it('löst auf ohne Fehler wenn Service erfolgreich ist', async () => {
            await assert.doesNotReject(() => manager.deleteAccount());
        });

        it('propagiert AuthError aus dem Service', async () => {
            service.deleteAccountError = new AuthError('Konto nicht gefunden.', 'NOT_FOUND');
            await assert.rejects(
                () => manager.deleteAccount(),
                e => e instanceof AuthError && e.code === 'NOT_FOUND'
            );
        });

        it('propagiert generische Fehler aus dem Service', async () => {
            service.deleteAccountError = new Error('Netzwerkfehler');
            await assert.rejects(
                () => manager.deleteAccount(),
                e => e.message === 'Netzwerkfehler'
            );
        });

    });


    // ── NullAuthService.deleteAccount ────────────────────────────────────────

    describe('NullAuthService.deleteAccount()', () => {

        it('wirft AuthError', async () => {
            const nullManager = new AuthManager(new NullAuthService());
            await assert.rejects(
                () => nullManager.deleteAccount(),
                AuthError
            );
        });

    });

});
