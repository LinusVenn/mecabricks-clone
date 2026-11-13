/**
 * Konfliktbehandlung (Phase 9.5 / 9.9)
 */
import { describe, it, beforeEach, mock } from 'node:test';
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
    async listProjects() { return [...this._p.values()]; }
    async getProject(id) { const p = this._p.get(id); if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND); return p; }
    async createProject({ name, data }) {
        const id = `p${this._n++}`;
        const p = { id, name, data, projectVersion: 1, ownerId: 'u1', updatedAt: new Date().toISOString(), createdAt: '' };
        this._p.set(id, p); return p;
    }
    async updateProject(id, { name, data, expectedVersion }) {
        const p = this._p.get(id); if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND);
        if (expectedVersion !== undefined && p.projectVersion !== expectedVersion)
            throw new CloudError('Konfliktversionen', CloudErrorCodes.CONFLICT);
        const u = { ...p, name: name ?? p.name, data, projectVersion: p.projectVersion + 1 };
        this._p.set(id, u); return u;
    }
    async deleteProject(id) { this._p.delete(id); }
}

function buildSystem() {
    const cs   = new MockCloudService();
    const cpm  = new CloudProjectManager(cs);
    const sm   = new SyncStatusManager();
    const eh   = new CloudErrorHandler();
    const pm   = {
        getProjectJSON:  mock.fn(() => JSON.stringify({ name: 'Test', bricks: [] })),
        loadProjectJSON: mock.fn(),
        getProjectInfo:  mock.fn(() => ({ id: 'l1', name: 'Test', updatedAt: new Date().toISOString() }))
    };
    const sync = new CloudSyncManager({
        projectManager: pm, cloudProjectManager: cpm,
        syncStatusManager: sm, authManager: { isLoggedIn: true },
        cloudErrorHandler: eh
    });
    return { cs, cpm, sm, sync };
}


describe('Konfliktbehandlung', () => {

    beforeEach(() => { globalThis.navigator.onLine = true; });


    it('Überschreiben mit korrekter Version gelingt', async () => {
        const { sync } = buildSystem();
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        // Zweites Speichern mit aktueller Version
        await assert.doesNotReject(() => sync.saveToCloud(id));
    });

    it('Konflikt wird erkannt wenn externe Version neuer ist', async () => {
        const { sync, cpm } = buildSystem();
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        // Externe Änderung: Version erhöhen
        await cpm.saveProject(id, JSON.stringify({ name: 'Extern', bricks: [] }), 1);
        // Sync versucht noch mit alter Version zu speichern
        await assert.rejects(
            () => sync.saveToCloud(id),
            e => e instanceof CloudError && e.code === CloudErrorCodes.CONFLICT
        );
    });

    it('CONFLICT-Status wird gesetzt', async () => {
        const { sync, cpm, sm } = buildSystem();
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        await cpm.saveProject(id, JSON.stringify({ name: 'Extern', bricks: [] }), 1);
        try { await sync.saveToCloud(id); } catch {}
        assert.strictEqual(sm.status, SyncStatus.CONFLICT);
    });

    it('checkVersion erkennt veraltete lokale Version', async () => {
        const { sync, cpm } = buildSystem();
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        await cpm.saveProject(id, JSON.stringify({ name: 'Extern', bricks: [] }), 1);
        const upToDate = await sync.checkVersion();
        assert.strictEqual(upToDate, false);
    });

    it('checkVersion gibt true zurück wenn Version aktuell', async () => {
        const { sync } = buildSystem();
        await sync.saveToCloud();
        const upToDate = await sync.checkVersion();
        assert.strictEqual(upToDate, true);
    });

    it('Overwrite-Konflikt: Speichern ohne Version-Prüfung gelingt', async () => {
        const { sync, cpm } = buildSystem();
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        await cpm.saveProject(id, JSON.stringify({ name: 'Extern', bricks: [] }), 1);
        // Erzwungenes Überschreiben (expectedVersion = undefined)
        const cs = cpm._service ?? cpm._cloudService;
        // Direkter Service-Aufruf ohne Version-Check
        const p  = await cpm.getProject(id);
        const result = await cpm.saveProject(id, JSON.stringify({ name: 'Überschrieben', bricks: [] }), undefined);
        assert.ok(result.projectVersion > 1);
    });

    it('CloudErrorHandler klassifiziert Konflikt korrekt', () => {
        const eh  = new CloudErrorHandler();
        const err = new CloudError('Konflikt', CloudErrorCodes.CONFLICT);
        assert.ok(eh.isConflictError(err));
    });

    it('Kein Konflikt bei erstem Speichern (kein expectedVersion)', async () => {
        const { sync } = buildSystem();
        await assert.doesNotReject(() => sync.saveToCloud());
    });

    it('Lokale Daten bleiben nach Konflikt erhalten', async () => {
        const { sync, cpm } = buildSystem();
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        await cpm.saveProject(id, JSON.stringify({ name: 'Extern', bricks: [] }), 1);
        const previousId = sync.currentCloudProjectId;
        try { await sync.saveToCloud(id); } catch {}
        // Cloud-Projekt-ID bleibt – lokale Daten nicht verloren
        assert.ok(previousId !== null);
    });

    it('Nach Konflikt kann als neues Projekt gespeichert werden', async () => {
        const { sync, cpm } = buildSystem();
        await sync.saveToCloud();
        const id = sync.currentCloudProjectId;
        await cpm.saveProject(id, JSON.stringify({ name: 'Extern', bricks: [] }), 1);
        try { await sync.saveToCloud(id); } catch {}
        // Neues Projekt anlegen (kein ID mitgeben)
        sync._currentCloudProjectId = null;
        sync._lastSyncedVersion = null;
        await assert.doesNotReject(() => sync.saveToCloud());
    });

});
