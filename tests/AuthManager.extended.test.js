/**
 * Erweiterte Tests für AuthManager (Phase 9.2)
 *
 * Abdeckung von Lücken:
 *  - getCurrentUser() – Methoden-Form, Gleichheit mit currentUser-Getter
 *  - getCurrentUser() – gibt Kopie zurück (Mutation beeinflusst nicht den internen Zustand)
 *  - getCurrentUser() – gibt null zurück wenn nicht angemeldet
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager } from '../src/auth/AuthManager.js';
import { AuthError }   from '../src/auth/AuthService.js';


// ─── Mock-AuthService ─────────────────────────────────────────────────────────

class MockAuthService {
    constructor() {
        this._user     = null;
        this._handlers = [];
    }

    async login(email, _password) {
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

    async register(email, _password) {
        this._user = { id: 'u1', email };
        this._notify('SIGNED_IN', { user: this._user });
        return this._user;
    }

    async resetPassword(_email) {}

    onAuthStateChange(cb) {
        this._handlers.push(cb);
        return () => { this._handlers = this._handlers.filter(h => h !== cb); };
    }

    _notify(event, session) {
        for (const h of this._handlers) h(event, session);
    }
}


// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuthManager – getCurrentUser()', () => {

    let manager, service;

    beforeEach(() => {
        service = new MockAuthService();
        manager = new AuthManager(service);
    });


    it('gibt null zurück wenn nicht angemeldet', () => {
        assert.strictEqual(manager.getCurrentUser(), null);
    });

    it('gibt nach Login dasselbe Objekt zurück wie der currentUser-Getter', async () => {
        await manager.login('user@test.de', 'passwort');

        const viaGetter = manager.currentUser;
        const viaMethod = manager.getCurrentUser();

        assert.ok(viaGetter !== null);
        assert.ok(viaMethod !== null);
        assert.strictEqual(viaGetter.email, viaMethod.email);
        assert.strictEqual(viaGetter.id,    viaMethod.id);
    });

    it('gibt eine Kopie zurück – Mutation beeinflusst nicht den internen Zustand', async () => {
        await manager.login('user@test.de', 'passwort');

        const copy = manager.getCurrentUser();
        copy.email = 'manipuliert@test.de';
        copy.id    = 'manipuliert-id';

        // Interner Zustand unverändert
        assert.strictEqual(manager.getCurrentUser().email, 'user@test.de');
        assert.strictEqual(manager.getCurrentUser().id,    'u1');
    });

    it('gibt null zurück nach Abmeldung', async () => {
        await manager.login('user@test.de', 'passwort');
        await manager.logout();

        assert.strictEqual(manager.getCurrentUser(), null);
    });

    it('ist funktional äquivalent zum currentUser-Getter', async () => {
        await manager.login('user@test.de', 'passwort');

        // Beide müssen denselben Snapshot liefern
        assert.deepStrictEqual(
            manager.getCurrentUser(),
            manager.currentUser
        );
    });

    it('gibt null zurück – nicht undefined', () => {
        const result = manager.getCurrentUser();
        assert.strictEqual(result, null);  // null, nicht undefined
    });
});
