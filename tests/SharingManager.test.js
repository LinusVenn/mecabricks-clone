/**
 * Tests für SharingManager (Phase J – Kollaboration)
 *
 * SharingManager verwaltet Mitglieder, Einladungen und das Teilen
 * von Projekten zwischen Benutzern.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SharingManager } from '../src/collaboration/SharingManager.js';


// -----------------------------------------------------------------------
// Mock-Supabase-Datenbank
// -----------------------------------------------------------------------

/**
 * Minimaler, in-memory Supabase-Mock.
 * Jede Tabelle ist eine einfache Map.
 */
class MockSupabase {
    constructor() {
        this._tables = {
            project_members:     [],
            project_invitations: [],
            projects:            [],
        };
        this._nextId = 1;
    }

    from(table) {
        const rows    = this._tables[table] ?? [];
        const self    = this;
        const builder = {
            _table:   table,
            _filters: [],
            _data:    null,
            _single:  false,

            select(cols) { return this; },

            eq(col, val) {
                this._filters.push({ col, val, op: 'eq' });
                return this;
            },

            neq(col, val) {
                this._filters.push({ col, val, op: 'neq' });
                return this;
            },

            insert(data) {
                const row = Array.isArray(data) ? data[0] : data;
                if (!row.id) row.id = `id-${self._nextId++}`;
                self._tables[table].push(row);
                return { data: row, error: null, then: (fn) => Promise.resolve().then(() => fn({ data: [row], error: null })) };
            },

            update(data) {
                this._updateData = data;
                return this;
            },

            delete() {
                this._isDelete = true;
                return this;
            },

            single() {
                this._single = true;
                return this;
            },

            async then(resolve) {
                // Execute the query
                let result = [...(self._tables[table] ?? [])];

                // Apply filters
                for (const f of this._filters) {
                    if (f.op === 'eq')  result = result.filter(r => r[f.col] === f.val);
                    if (f.op === 'neq') result = result.filter(r => r[f.col] !== f.val);
                }

                if (this._isDelete) {
                    for (const f of this._filters) {
                        if (f.op === 'eq') {
                            self._tables[table] = self._tables[table].filter(r => r[f.col] !== f.val);
                        }
                    }
                    return resolve({ data: result, error: null });
                }

                if (this._updateData) {
                    const updated = [];
                    for (const f of this._filters) {
                        if (f.op === 'eq') {
                            self._tables[table] = self._tables[table].map(r => {
                                if (r[f.col] === f.val) {
                                    const u = { ...r, ...this._updateData };
                                    updated.push(u);
                                    return u;
                                }
                                return r;
                            });
                        }
                    }
                    return resolve({ data: updated, error: null });
                }

                if (this._single) {
                    return resolve({ data: result[0] ?? null, error: result[0] ? null : { message: 'Not found' } });
                }

                return resolve({ data: result, error: null });
            },
        };
        return builder;
    }
}

function makeAuthManager(userId = 'user-1') {
    return {
        currentUser: { id: userId, email: 'user1@example.com' },
        isLoggedIn:  true,
    };
}


// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('SharingManager', () => {

    let db, auth, manager;

    beforeEach(() => {
        db      = new MockSupabase();
        auth    = makeAuthManager('user-1');
        manager = new SharingManager({ supabaseClient: db, authManager: auth });
    });


    // ------------------------------------------------------------------
    // getMembers
    // ------------------------------------------------------------------

    it('getMembers gibt leere Liste zurück wenn keine Mitglieder vorhanden', async () => {
        const list = await manager.getMembers('proj-1');
        assert.strictEqual(list.length, 0);
    });

    it('getMembers gibt formatierte Mitgliederliste zurück', async () => {
        db._tables.project_members.push({
            id: 'm1', project_id: 'proj-1', user_id: 'user-1',
            role: 'owner', display_name: 'Alice', email: 'alice@example.com',
        });
        db._tables.project_members.push({
            id: 'm2', project_id: 'proj-1', user_id: 'user-2',
            role: 'editor', display_name: 'Bob', email: 'bob@example.com',
        });
        const list = await manager.getMembers('proj-1');
        assert.strictEqual(list.length, 2);
    });

    it('getMembers gibt nur Mitglieder des angegebenen Projekts zurück', async () => {
        db._tables.project_members.push({ id: 'm1', project_id: 'proj-1', user_id: 'user-1', role: 'owner' });
        db._tables.project_members.push({ id: 'm2', project_id: 'proj-2', user_id: 'user-2', role: 'editor' });
        const list = await manager.getMembers('proj-1');
        assert.strictEqual(list.length, 1);
        assert.ok(list.every(m => m.projectId === 'proj-1' || m.project_id === 'proj-1'));
    });


    // ------------------------------------------------------------------
    // inviteUser
    // ------------------------------------------------------------------

    it('inviteUser fügt eine Einladung ein', async () => {
        await manager.inviteUser('proj-1', 'bob@example.com', 'editor');
        const invs = db._tables.project_invitations.filter(i => i.project_id === 'proj-1');
        assert.strictEqual(invs.length, 1);
    });

    it('inviteUser setzt die E-Mail korrekt', async () => {
        await manager.inviteUser('proj-1', 'charlie@example.com', 'viewer');
        const inv = db._tables.project_invitations.find(i => i.email === 'charlie@example.com');
        assert.ok(inv, 'Einladung mit korrekter E-Mail nicht gefunden');
    });

    it('inviteUser setzt die Rolle korrekt', async () => {
        await manager.inviteUser('proj-1', 'dave@example.com', 'viewer');
        const inv = db._tables.project_invitations.find(i => i.email === 'dave@example.com');
        assert.strictEqual(inv?.role, 'viewer');
    });

    it('inviteUser setzt Status auf pending', async () => {
        await manager.inviteUser('proj-1', 'eve@example.com', 'editor');
        const inv = db._tables.project_invitations.find(i => i.email === 'eve@example.com');
        assert.strictEqual(inv?.status, 'pending');
    });


    // ------------------------------------------------------------------
    // getUserInvitations
    // ------------------------------------------------------------------

    it('getUserInvitations gibt ausstehende Einladungen zurück', async () => {
        db._tables.project_invitations.push({
            id: 'inv-1', project_id: 'proj-1', email: 'user1@example.com',
            role: 'editor', status: 'pending', invited_by: 'user-2',
        });
        const list = await manager.getUserInvitations();
        assert.ok(list.length >= 1);
    });

    it('getUserInvitations gibt keine angenommenen Einladungen zurück', async () => {
        db._tables.project_invitations.push({
            id: 'inv-1', project_id: 'proj-1', email: 'user1@example.com',
            role: 'editor', status: 'accepted', invited_by: 'user-2',
        });
        const list = await manager.getUserInvitations();
        // Accepted-Einladungen sollten herausgefiltert werden
        const accepted = list.filter(i => i.status === 'accepted');
        assert.strictEqual(accepted.length, 0);
    });


    // ------------------------------------------------------------------
    // acceptInvitation
    // ------------------------------------------------------------------

    it('acceptInvitation setzt Status auf accepted', async () => {
        db._tables.project_invitations.push({
            id: 'inv-1', project_id: 'proj-1', email: 'user1@example.com',
            role: 'editor', status: 'pending',
        });
        await manager.acceptInvitation('inv-1');
        const inv = db._tables.project_invitations.find(i => i.id === 'inv-1');
        assert.strictEqual(inv?.status, 'accepted');
    });

    it('acceptInvitation fügt Benutzer zu project_members hinzu', async () => {
        db._tables.project_invitations.push({
            id: 'inv-2', project_id: 'proj-1', email: 'user1@example.com',
            role: 'editor', status: 'pending',
        });
        await manager.acceptInvitation('inv-2');
        const member = db._tables.project_members.find(
            m => m.project_id === 'proj-1' && m.user_id === 'user-1'
        );
        assert.ok(member, 'Mitglied wurde nicht angelegt');
    });


    // ------------------------------------------------------------------
    // declineInvitation
    // ------------------------------------------------------------------

    it('declineInvitation setzt Status auf declined', async () => {
        db._tables.project_invitations.push({
            id: 'inv-3', project_id: 'proj-1', email: 'user1@example.com',
            role: 'viewer', status: 'pending',
        });
        await manager.declineInvitation('inv-3');
        const inv = db._tables.project_invitations.find(i => i.id === 'inv-3');
        assert.strictEqual(inv?.status, 'declined');
    });


    // ------------------------------------------------------------------
    // revokeInvitation
    // ------------------------------------------------------------------

    it('revokeInvitation setzt Status auf revoked', async () => {
        db._tables.project_invitations.push({
            id: 'inv-4', project_id: 'proj-1', email: 'bob@example.com',
            role: 'editor', status: 'pending', invited_by: 'user-1',
        });
        await manager.revokeInvitation('inv-4');
        const inv = db._tables.project_invitations.find(i => i.id === 'inv-4');
        assert.strictEqual(inv?.status, 'revoked');
    });


    // ------------------------------------------------------------------
    // removeMember
    // ------------------------------------------------------------------

    it('removeMember löscht Mitglied aus project_members', async () => {
        db._tables.project_members.push({
            id: 'mem-1', project_id: 'proj-1', user_id: 'user-2', role: 'editor',
        });
        await manager.removeMember('proj-1', 'user-2');
        const remaining = db._tables.project_members.filter(
            m => m.project_id === 'proj-1' && m.user_id === 'user-2'
        );
        assert.strictEqual(remaining.length, 0);
    });

    it('removeMember löscht nur das angegebene Mitglied', async () => {
        db._tables.project_members.push({ id: 'mem-2', project_id: 'proj-1', user_id: 'user-2', role: 'editor' });
        db._tables.project_members.push({ id: 'mem-3', project_id: 'proj-1', user_id: 'user-3', role: 'viewer' });
        await manager.removeMember('proj-1', 'user-2');
        const remaining = db._tables.project_members.filter(m => m.project_id === 'proj-1');
        assert.strictEqual(remaining.length, 1);
        assert.strictEqual(remaining[0].user_id, 'user-3');
    });


    // ------------------------------------------------------------------
    // getSharedProjects
    // ------------------------------------------------------------------

    it('getSharedProjects gibt Projekte zurück bei denen Benutzer Mitglied ist', async () => {
        db._tables.project_members.push({
            id: 'mem-4', project_id: 'proj-2', user_id: 'user-1', role: 'editor',
        });
        db._tables.projects.push({ id: 'proj-2', name: 'Geteiltes Projekt', owner_id: 'user-99' });

        const list = await manager.getSharedProjects();
        assert.ok(list.length >= 1);
    });


    // ------------------------------------------------------------------
    // inviteUser – Randfälle
    // ------------------------------------------------------------------

    it('inviteUser mit "editor"-Rolle legt Einladung mit role=editor an', async () => {
        await manager.inviteUser('proj-1', 'editor@test.de', 'editor');
        const inv = db._tables.project_invitations.find(i => i.email === 'editor@test.de');
        assert.ok(inv, 'Einladung sollte existieren');
        assert.strictEqual(inv.role, 'editor');
    });

    it('inviteUser mit "viewer"-Rolle legt Einladung mit role=viewer an', async () => {
        await manager.inviteUser('proj-1', 'viewer@test.de', 'viewer');
        const inv = db._tables.project_invitations.find(i => i.email === 'viewer@test.de');
        assert.ok(inv, 'Einladung sollte existieren');
        assert.strictEqual(inv.role, 'viewer');
    });

    it('getUserInvitations gibt nur Einladungen für aktuellen Benutzer zurück', async () => {
        db._tables.project_invitations.push(
            { id: 'inv-10', project_id: 'proj-1', email: 'user@test.de', role: 'viewer', status: 'pending' },
            { id: 'inv-11', project_id: 'proj-1', email: 'other@test.de', role: 'editor', status: 'pending' },
        );
        const list = await manager.getUserInvitations('user@test.de');
        assert.ok(Array.isArray(list), 'Rückgabe muss ein Array sein');
        const emails = list.map(i => i.email ?? i.invitee_email);
        const hasOther = emails.some(e => e === 'other@test.de');
        assert.strictEqual(hasOther, false, 'Nur eigene Einladungen zurückgeben');
    });

});
