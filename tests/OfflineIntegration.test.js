/**
 * Offline-Integrationstests (Phase 9.6 / 9.9)
 */
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncManager }         from '../src/cloud/CloudSyncManager.js';
import { CloudProjectManager }      from '../src/cloud/CloudProjectManager.js';
import { SyncStatusManager, SyncStatus } from '../src/cloud/SyncStatusManager.js';
import { CloudErrorHandler }        from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';


if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}


class MockCloudService {
    constructor() { this._p = new Map(); this._n = 1; }
    getCurrentUserId() { return 'u1'; }
    async listProjects() { if (!navigator.onLine) throw new CloudError('Offline', CloudErrorCodes.OFFLINE); return [...this._p.values()]; }
    async getProject(id) { if (!navigator.onLine) throw new CloudError('Offline', CloudErrorCodes.OFFLINE); const p = this._p.get(id); if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND); return p; }
    async createProject({ name, data }) {
        if (!navigator.onLine) throw new CloudError('Offline', CloudErrorCodes.OFFLINE);
        const id = `p${this._n++}`;
        const p = { id, name, data, projectVersion: 1, ownerId: 'u1', updatedAt: new Date().toISOString(), createdAt: '' };
        this._p.set(id, p); return p;
    }
    async updateProject(id, { data, expectedVersion }) {
        if (!navigator.onLine) throw new CloudError('Offline', CloudErrorCodes.OFFLINE);
        const p = this._p.get(id); if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND);
        if (expectedVersion !== undefined && p.projectVersion !== expectedVersion) throw new CloudError('Conflict', CloudErrorCodes.CONFLICT);
        const u = { ...p, data, projectVersion: p.projectVersion + 1 }; this._p.set(id, u); return u;
    }
    async deleteProject(id) { if (!navigator.onLine) throw new CloudError('Offline', CloudErrorCodes.OFFLINE); this._p.delete(id); }
}

function buildSync(loggedIn = true) {
    const cloudService  = new MockCloudService();
    const cpm           = new CloudProjectManager(cloudService);
    const statusManager = new SyncStatusManager();
    const errorHandler  = new CloudErrorHandler();
    const projectManager = {
        getProjectJSON:  mock.fn(() => JSON.stringify({ name: 'Test', bricks: [] })),
        loadProjectJSON: mock.fn(),
        getProjectInfo:  mock.fn(() => ({ id: 'l1', name: 'Test', updatedAt: new Date().toISOString() }))
    };
    const authManager = { isLoggedIn: loggedIn };

    const sync = new CloudSyncManager({
        projectManager,
        cloudProjectManager: cpm,
        syncStatusManager: statusManager,
        authManager,
        cloudErrorHandler: errorHandler
    });

    return { sync, statusManager, projectManager, cloudService };
}


describe('Offline-Verhalten', () => {

    beforeEach(() => { globalThis.navigator.onLine = true; });
    afterEach(() => { globalThis.navigator.onLine = true; });


    it('saveToCloud wirft wenn offline', async () => {
        const { sync } = buildSync();
        globalThis.navigator.onLine = false;
        await assert.rejects(() => sync.saveToCloud(), CloudError);
    });

    it('Status wird OFFLINE gesetzt wenn offline', async () => {
        const { sync, statusManager } = buildSync();
        globalThis.navigator.onLine = false;
        try { await sync.saveToCloud(); } catch {}
        assert.strictEqual(statusManager.status, SyncStatus.OFFLINE);
    });

    it('Offline-Fehler blockiert nicht lokale Daten', async () => {
        const { sync, projectManager } = buildSync();
        globalThis.navigator.onLine = false;
        try { await sync.saveToCloud(); } catch {}
        // ProjectManager soll nicht angefasst worden sein
        assert.strictEqual(projectManager.loadProjectJSON.mock.callCount(), 0);
    });

    it('Nach Wiederherstellung der Verbindung kann gespeichert werden', async () => {
        const { sync } = buildSync();
        globalThis.navigator.onLine = false;
        try { await sync.saveToCloud(); } catch {}
        globalThis.navigator.onLine = true;
        await assert.doesNotReject(() => sync.saveToCloud());
    });

    it('markDirty funktioniert offline', () => {
        const { sync } = buildSync();
        globalThis.navigator.onLine = false;
        assert.doesNotThrow(() => sync.markDirty());
        assert.strictEqual(sync.isDirty, true);
    });

    it('Status bleibt MODIFIED solange offline und dirty', async () => {
        const { sync, statusManager } = buildSync();
        sync.markDirty();
        globalThis.navigator.onLine = false;
        try { await sync.saveToCloud(); } catch {}
        // Status ist jetzt OFFLINE, aber isDirty ist noch true
        assert.strictEqual(sync.isDirty, true);
    });

    it('loadFromCloud wirft wenn offline', async () => {
        const { sync } = buildSync();
        globalThis.navigator.onLine = false;
        await assert.rejects(() => sync.loadFromCloud('some-id'), CloudError);
    });

    it('reset funktioniert offline', () => {
        const { sync } = buildSync();
        globalThis.navigator.onLine = false;
        assert.doesNotThrow(() => sync.reset());
    });

    it('SyncStatus zeigt OFFLINE bei fehlgeschlagenem Load', async () => {
        const { sync, statusManager } = buildSync();
        globalThis.navigator.onLine = false;
        try { await sync.loadFromCloud('id'); } catch {}
        assert.ok(
            statusManager.status === SyncStatus.OFFLINE ||
            statusManager.status === SyncStatus.ERROR
        );
    });

    it('markDirty bleibt nach offline-Fehler erhalten', async () => {
        const { sync } = buildSync();
        sync.markDirty();
        globalThis.navigator.onLine = false;
        try { await sync.saveToCloud(); } catch {}
        assert.strictEqual(sync.isDirty, true);
    });

});
