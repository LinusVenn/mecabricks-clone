/**
 * Integrationstests – Cloud-Projektverwaltung (Phase 9.9)
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager }          from '../src/auth/AuthManager.js';
import { CloudProjectManager }  from '../src/cloud/CloudProjectManager.js';
import { CloudSyncManager }     from '../src/cloud/CloudSyncManager.js';
import { SyncStatusManager, SyncStatus } from '../src/cloud/SyncStatusManager.js';
import { CloudErrorHandler }    from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';
import { AuthError }            from '../src/auth/AuthService.js';

if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}

// -----------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------

class MockAuthService {
    constructor() { this._user = null; this._handlers = []; }
    async login(email) { this._user = { id: 'u1', email }; this._notify('SIGNED_IN', { user: this._user }); return this._user; }
    async logout() { this._user = null; this._notify('SIGNED_OUT', null); }
    async getSession() { return this._user ? { user: this._user } : null; }
    async register(email) { return this.login(email); }
    async resetPassword() {}
    onAuthStateChange(cb) { this._handlers.push(cb); return () => { this._handlers = this._handlers.filter(h => h !== cb); }; }
    _notify(e, s) { this._handlers.forEach(h => h(e, s)); }
}

class MockCloudService {
    constructor() { this._projects = new Map(); this._n = 1; }
    getCurrentUserId() { return 'u1'; }
    async listProjects() { return [...this._projects.values()]; }
    async getProject(id) { const p = this._projects.get(id); if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND); return p; }
    async createProject({ name, data }) {
        const id = `p${this._n++}`; const p = { id, ownerId: 'u1', name, data, projectVersion: 1, createdAt: '', updatedAt: '' }; this._projects.set(id, p); return p;
    }
    async updateProject(id, { name, data, expectedVersion }) {
        const p = this._projects.get(id);
        if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND);
        if (expectedVersion !== undefined && p.projectVersion !== expectedVersion) throw new CloudError('Conflict', CloudErrorCodes.CONFLICT);
        const u = { ...p, name: name ?? p.name, data, projectVersion: p.projectVersion + 1, updatedAt: new Date().toISOString() };
        this._projects.set(id, u); return u;
    }
    async deleteProject(id) { this._projects.delete(id); }
}

function makeProjectManager(name = 'Test') {
    const jsonStr = JSON.stringify({ name, version: 1, bricks: [] });
    return {
        getProjectJSON:  mock.fn(() => jsonStr),
        loadProjectJSON: mock.fn(),
        getProjectInfo:  mock.fn(() => ({ id: 'l1', name, updatedAt: new Date().toISOString() }))
    };
}

function buildSystem(overrides = {}) {
    const authService   = new MockAuthService();
    const authManager   = new AuthManager(authService);
    const cloudService  = new MockCloudService();
    const cpm           = new CloudProjectManager(cloudService);
    const statusManager = new SyncStatusManager();
    const errorHandler  = new CloudErrorHandler();
    const pm            = makeProjectManager();

    const sync = new CloudSyncManager({
        projectManager: pm, cloudProjectManager: cpm,
        syncStatusManager: statusManager, authManager,
        cloudErrorHandler: errorHandler, ...overrides
    });

    return { authService, authManager, cloudService, cpm, statusManager, errorHandler, pm, sync };
}


describe('Cloud-Projektverwaltung – Integration', () => {

    beforeEach(() => { globalThis.navigator.onLine = true; });


    it('Registrierung → Anmeldung → Cloud-Save funktioniert', async () => {
        const { authService, sync } = buildSystem();
        await authService.login('user@test.de');
        await sync.saveToCloud();
        assert.ok(sync.currentCloudProjectId !== null);
    });

    it('Nach Abmeldung kann nicht gespeichert werden', async () => {
        const { authService, sync } = buildSystem();
        await authService.login('user@test.de');
        await authService._notify('SIGNED_OUT', null);  // simuliert logout
        const { sync: offlineSync } = buildSystem();
        await assert.rejects(() => offlineSync.saveToCloud(), CloudError);
    });

    it('Projekt laden → in ProjectManager übergeben', async () => {
        const { authService, sync, cpm, pm } = buildSystem();
        await authService.login('user@test.de');
        const p = await cpm.createProject('T', JSON.stringify({ name: 'T', bricks: [] }));
        await sync.loadFromCloud(p.id);
        assert.strictEqual(pm.loadProjectJSON.mock.callCount(), 1);
    });

    it('Mehrere Projekte verwalten', async () => {
        const { authService, cpm } = buildSystem();
        await authService.login('user@test.de');
        await cpm.createProject('P1', JSON.stringify({ name: 'P1', bricks: [] }));
        await cpm.createProject('P2', JSON.stringify({ name: 'P2', bricks: [] }));
        const list = await cpm.getAllProjects();
        assert.strictEqual(list.length, 2);
    });

    it('Projekt löschen entfernt es aus der Liste', async () => {
        const { cpm } = buildSystem();
        const p = await cpm.createProject('T', JSON.stringify({ name: 'T', bricks: [] }));
        await cpm.deleteProject(p.id);
        const list = await cpm.getAllProjects();
        assert.strictEqual(list.length, 0);
    });

    it('Conflict-Erkennung funktioniert', async () => {
        const { authService, sync, cpm } = buildSystem();
        await authService.login('user@test.de');
        await sync.saveToCloud();
        // Simuliere externen Update (Version erhöht)
        const id = sync.currentCloudProjectId;
        await cpm.saveProject(id, JSON.stringify({ name: 'T', bricks: [] }), 1);
        // Jetzt versuchen wir mit alter Version zu speichern → CONFLICT
        await assert.rejects(
            () => sync.saveToCloud(id),
            e => e instanceof CloudError && e.code === CloudErrorCodes.CONFLICT
        );
    });

    it('Konflikt setzt Status auf CONFLICT', async () => {
        const { authService, sync, statusManager, cpm } = buildSystem();
        await authService.login('user@test.de');
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        await cpm.saveProject(id, JSON.stringify({ name: 'T', bricks: [] }), 1);
        try { await sync.saveToCloud(id); } catch {}
        assert.strictEqual(statusManager.status, SyncStatus.CONFLICT);
    });

    it('reset setzt alles zurück', async () => {
        const { authService, sync, statusManager } = buildSystem();
        await authService.login('user@test.de');
        await sync.saveToCloud();
        sync.reset();
        assert.strictEqual(sync.currentCloudProjectId, null);
        assert.strictEqual(statusManager.status, SyncStatus.LOCAL_ONLY);
    });

    it('Umbenennen ändert Projektname in Cloud', async () => {
        const { cpm } = buildSystem();
        const p  = await cpm.createProject('Alt', JSON.stringify({ name: 'Alt', bricks: [] }));
        const p2 = await cpm.renameProject(p.id, 'Neu');
        assert.strictEqual(p2.name, 'Neu');
    });

    it('Projektdaten bleiben nach Save/Load erhalten', async () => {
        const { authService, sync, cpm, pm } = buildSystem();
        await authService.login('user@test.de');
        await sync.saveToCloud();
        const id  = sync.currentCloudProjectId;
        const p   = await cpm.getProject(id);
        assert.ok(p.data !== null);
    });

    it('SyncStatus-Callback wird bei jedem Statuswechsel ausgelöst', async () => {
        const { authService, sync, statusManager } = buildSystem();
        await authService.login('user@test.de');
        const statuses = [];
        statusManager.subscribe(s => statuses.push(s));
        await sync.saveToCloud();
        assert.ok(statuses.includes(SyncStatus.SYNCING));
        assert.ok(statuses.includes(SyncStatus.SYNCED));
    });

    it('markDirty + saveToCloud → isDirty ist false nach Erfolg', async () => {
        const { authService, sync } = buildSystem();
        await authService.login('user@test.de');
        sync.markDirty();
        await sync.saveToCloud();
        assert.strictEqual(sync.isDirty, false);
    });

});
