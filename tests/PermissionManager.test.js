/**
 * Tests für PermissionManager (Phase J – Kollaboration)
 *
 * PermissionManager cached die Rolle des aktuellen Benutzers für ein
 * Projekt und stellt Berechtigungsflags bereit.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionManager } from '../src/collaboration/PermissionManager.js';


// -----------------------------------------------------------------------
// Mock-Supabase-Client
// -----------------------------------------------------------------------

function makeMockSupabase(memberRow = null) {
    return {
        _memberRow: memberRow,
        from(table) {
            return {
                select: () => this,
                eq:     () => this,
                single: async () => ({
                    data:  this._memberRow,
                    error: this._memberRow ? null : { message: 'Not found' },
                }),
                maybeSingle: async () => ({
                    data:  this._memberRow,
                    error: null,
                }),
            };
        },
    };
}

function makeAuthManager(userId = 'user-1') {
    return {
        currentUser: { id: userId },
        isLoggedIn:  true,
    };
}


// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('PermissionManager', () => {

    let manager;
    let supabase;
    let auth;

    beforeEach(() => {
        supabase = makeMockSupabase(null);
        auth     = makeAuthManager();
        manager  = new PermissionManager({ supabaseClient: supabase, authManager: auth });
    });


    // ------------------------------------------------------------------
    // Initialzustand
    // ------------------------------------------------------------------

    it('hat initial keine Rolle', () => {
        assert.strictEqual(manager.role, null);
    });

    it('canEdit ist initial false', () => {
        assert.strictEqual(manager.canEdit, false);
    });

    it('canManage ist initial false', () => {
        assert.strictEqual(manager.canManage, false);
    });

    it('canRestoreVersion ist initial false', () => {
        assert.strictEqual(manager.canRestoreVersion, false);
    });

    it('canView ist initial false (kein Projekt geladen)', () => {
        assert.strictEqual(manager.canView, false);
    });


    // ------------------------------------------------------------------
    // loadRole – Eigentümer
    // ------------------------------------------------------------------

    it('loadRole setzt role=owner wenn Mitglied owner ist', async () => {
        supabase._memberRow = { role: 'owner', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.role, 'owner');
    });

    it('loadRole setzt canEdit=true für owner', async () => {
        supabase._memberRow = { role: 'owner', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canEdit, true);
    });

    it('loadRole setzt canManage=true für owner', async () => {
        supabase._memberRow = { role: 'owner', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canManage, true);
    });

    it('loadRole setzt canRestoreVersion=true für owner', async () => {
        supabase._memberRow = { role: 'owner', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canRestoreVersion, true);
    });

    it('loadRole setzt canView=true für owner', async () => {
        supabase._memberRow = { role: 'owner', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canView, true);
    });


    // ------------------------------------------------------------------
    // loadRole – Bearbeiter
    // ------------------------------------------------------------------

    it('loadRole setzt role=editor für editor-Mitglied', async () => {
        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.role, 'editor');
    });

    it('loadRole setzt canEdit=true für editor', async () => {
        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canEdit, true);
    });

    it('loadRole setzt canManage=false für editor', async () => {
        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canManage, false);
    });

    it('loadRole setzt canRestoreVersion=false für editor', async () => {
        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canRestoreVersion, false);
    });


    // ------------------------------------------------------------------
    // loadRole – Betrachter
    // ------------------------------------------------------------------

    it('loadRole setzt role=viewer für viewer-Mitglied', async () => {
        supabase._memberRow = { role: 'viewer', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.role, 'viewer');
    });

    it('loadRole setzt canEdit=false für viewer', async () => {
        supabase._memberRow = { role: 'viewer', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canEdit, false);
    });

    it('loadRole setzt canView=true für viewer', async () => {
        supabase._memberRow = { role: 'viewer', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canView, true);
    });


    // ------------------------------------------------------------------
    // loadRole – kein Mitglied
    // ------------------------------------------------------------------

    it('loadRole setzt role=null wenn Benutzer kein Mitglied ist', async () => {
        supabase._memberRow = null;
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.role, null);
    });

    it('loadRole setzt alle Flags auf false wenn kein Mitglied', async () => {
        supabase._memberRow = null;
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.canEdit,           false);
        assert.strictEqual(manager.canManage,         false);
        assert.strictEqual(manager.canRestoreVersion, false);
        assert.strictEqual(manager.canView,           false);
    });


    // ------------------------------------------------------------------
    // clearRole
    // ------------------------------------------------------------------

    it('clearRole setzt role auf null zurück', async () => {
        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.role, 'editor');
        manager.clearRole();
        assert.strictEqual(manager.role, null);
    });

    it('clearRole setzt alle Flags auf false zurück', async () => {
        supabase._memberRow = { role: 'owner', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        manager.clearRole();
        assert.strictEqual(manager.canEdit,           false);
        assert.strictEqual(manager.canManage,         false);
        assert.strictEqual(manager.canRestoreVersion, false);
        assert.strictEqual(manager.canView,           false);
    });


    // ------------------------------------------------------------------
    // subscribe
    // ------------------------------------------------------------------

    it('subscribe wird aufgerufen wenn sich die Rolle ändert', async () => {
        let callCount = 0;
        manager.subscribe(() => { callCount++; });

        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');

        assert.ok(callCount >= 1, `Callback wurde ${callCount} mal aufgerufen, erwartet ≥1`);
    });

    it('subscribe-Callback erhält die neue Rolle', async () => {
        let lastRole = undefined;
        manager.subscribe((role) => { lastRole = role; });

        supabase._memberRow = { role: 'owner', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');

        assert.strictEqual(lastRole, 'owner');
    });

    it('Unsubscribe stoppt weitere Callbacks', async () => {
        let callCount = 0;
        const unsub = manager.subscribe(() => { callCount++; });

        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');

        const countAfterFirst = callCount;
        unsub?.();

        supabase._memberRow = { role: 'viewer', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');

        assert.strictEqual(callCount, countAfterFirst,
            'Nach Unsubscribe darf kein weiterer Callback ausgelöst werden');
    });


    // ------------------------------------------------------------------
    // Mehrfach-Lade-Szenario
    // ------------------------------------------------------------------

    it('loadRole überschreibt eine vorherige Rolle korrekt', async () => {
        supabase._memberRow = { role: 'editor', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.role, 'editor');

        supabase._memberRow = { role: 'viewer', user_id: 'user-1', project_id: 'proj-1' };
        await manager.loadRole('proj-1');
        assert.strictEqual(manager.role, 'viewer');
    });

});
