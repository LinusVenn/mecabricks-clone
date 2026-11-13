/**
 * Tests für AuthManager (Phase 9.2)
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager } from '../src/auth/AuthManager.js';
import { AuthError }   from '../src/auth/AuthService.js';


// -----------------------------------------------------------------------
// Mock-AuthService
// -----------------------------------------------------------------------

class MockAuthService {
    constructor() {
        this._user = null;
        this._handlers = [];
    }

    async register(email, password) {
        if (!email || !password) throw new AuthError('E-Mail und Passwort erforderlich.', 'MISSING_FIELDS');
        if (email === 'taken@test.de') throw new AuthError('E-Mail bereits registriert.', 'EMAIL_TAKEN');
        this._user = { id: 'u1', email };
        this._notify('SIGNED_IN', { user: this._user });
        return this._user;
    }

    async login(email, password) {
        if (password === 'wrongp') throw new AuthError('Ungültige Zugangsdaten.', 'INVALID_CREDENTIALS');
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

    async resetPassword(email) {
        if (!email) throw new AuthError('E-Mail erforderlich.', 'MISSING_FIELDS');
    }

    onAuthStateChange(cb) {
        this._handlers.push(cb);
        return () => { this._handlers = this._handlers.filter(h => h !== cb); };
    }

    _notify(event, session) {
        for (const h of this._handlers) h(event, session);
    }
}


describe('AuthManager', () => {

    let manager, service;

    beforeEach(() => {
        service = new MockAuthService();
        manager = new AuthManager(service);
    });


    // ------------------------------------------------------------------
    // Initialisierung
    // ------------------------------------------------------------------

    it('ist initial nicht angemeldet', () => {
        assert.strictEqual(manager.isLoggedIn, false);
        assert.strictEqual(manager.currentUser, null);
    });


    // ------------------------------------------------------------------
    // Registrierung
    // ------------------------------------------------------------------

    it('register setzt currentUser nach Erfolg', async () => {
        await manager.register('new@test.de', 'pass123');
        assert.ok(manager.isLoggedIn);
        assert.strictEqual(manager.currentUser?.email, 'new@test.de');
    });

    it('register wirft AuthError bei doppelter E-Mail', async () => {
        await assert.rejects(
            () => manager.register('taken@test.de', 'pass123'),
            e => e instanceof AuthError && e.code === 'EMAIL_TAKEN'
        );
    });

    it('register wirft bei fehlenden Feldern', async () => {
        await assert.rejects(
            () => manager.register('', 'pass'),
            AuthError
        );
    });


    // ------------------------------------------------------------------
    // Anmeldung
    // ------------------------------------------------------------------

    it('login setzt currentUser', async () => {
        await manager.login('user@test.de', 'password');
        assert.ok(manager.isLoggedIn);
        assert.strictEqual(manager.currentUser?.email, 'user@test.de');
    });

    it('login wirft bei falschem Passwort', async () => {
        await assert.rejects(
            () => manager.login('user@test.de', 'wrongp'),
            e => e instanceof AuthError && e.code === 'INVALID_CREDENTIALS'
        );
    });

    it('isLoggedIn bleibt false nach fehlgeschlagenem Login', async () => {
        try { await manager.login('user@test.de', 'wrongp'); } catch {}
        assert.strictEqual(manager.isLoggedIn, false);
    });


    // ------------------------------------------------------------------
    // Abmeldung
    // ------------------------------------------------------------------

    it('logout setzt currentUser auf null', async () => {
        await manager.login('user@test.de', 'password');
        await manager.logout();
        assert.strictEqual(manager.isLoggedIn, false);
        assert.strictEqual(manager.currentUser, null);
    });


    // ------------------------------------------------------------------
    // Passwort-Zurücksetzen
    // ------------------------------------------------------------------

    it('resetPassword wirft nicht bei gültiger E-Mail', async () => {
        await assert.doesNotReject(() => manager.resetPassword('user@test.de'));
    });


    // ------------------------------------------------------------------
    // Callbacks
    // ------------------------------------------------------------------

    it('subscribe wird bei Anmeldung aufgerufen', async () => {
        let callCount = 0;
        manager.subscribe(() => callCount++);
        await manager.login('user@test.de', 'password');
        assert.ok(callCount >= 1);
    });

    it('Unsubscribe stoppt Benachrichtigungen', async () => {
        let callCount = 0;
        const unsub = manager.subscribe(() => callCount++);
        unsub();
        await manager.login('user@test.de', 'password');
        assert.strictEqual(callCount, 0);
    });

    it('mehrere Subscriber werden alle benachrichtigt', async () => {
        let a = 0, b = 0;
        manager.subscribe(() => a++);
        manager.subscribe(() => b++);
        await manager.login('user@test.de', 'password');
        assert.ok(a >= 1);
        assert.ok(b >= 1);
    });


    // ------------------------------------------------------------------
    // Session-Wiederherstellung
    // ------------------------------------------------------------------

    it('restoreSession stellt Benutzer wieder her', async () => {
        // Direkt im Service setzen
        service._user = { id: 'u1', email: 'saved@test.de' };
        await manager.restoreSession();
        assert.ok(manager.isLoggedIn);
    });

    it('restoreSession ohne gespeicherte Session bleibt nicht angemeldet', async () => {
        await manager.restoreSession();
        assert.strictEqual(manager.isLoggedIn, false);
    });

});
