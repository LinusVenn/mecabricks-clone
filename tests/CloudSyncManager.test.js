/**
 * Tests für CloudSyncManager (Phase 9.5)
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncManager }         from '../src/cloud/CloudSyncManager.js';
import { CloudProjectManager }      from '../src/cloud/CloudProjectManager.js';
import { SyncStatusManager, SyncStatus } from '../src/cloud/SyncStatusManager.js';
import { CloudErrorHandler }        from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';


// navigator.onLine Polyfill
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}


// -----------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------

function makeMockCloudService(options = {}) {
    const projects = new Map();
    let nextId = 1;
    return {
        _projects: projects,
        getCurrentUserId: () => 'u1',
        async listProjects() { return [...projects.values()]; },
        async getProject(id) {
            const p = projects.get(id);
            if (!p) throw new CloudError('Not found', CloudErrorCodes.NOT_FOUND);
            return p;
        },
        async createProject({ name, data }) {
            const id = `p${nextId++}`;
            const p = { id, name, data, projectVersion: 1, ownerId: 'u1',
                        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            projects.set(id, p);
            return p;
        },
        async updateProject(id, { name, data, expectedVersion }) {
            const p = projects.get(id);
            if (!p) throw new CloudError('Not found', CloudErrorCodes.NOT_FOUND);
            if (expectedVersion !== undefined && p.projectVersion !== expectedVersion)
                throw new CloudError('Conflict', CloudErrorCodes.CONFLICT);
            const updated = { ...p, name: name ?? p.name, data,
                               projectVersion: p.projectVersion + 1,
                               updatedAt: new Date().toISOString() };
            projects.set(id, updated);
            return updated;
        },
        async deleteProject(id) { projects.delete(id); },
        ...options
    };
}

function makeProjectManager(jsonStr) {
    return {
        getProjectJSON: mock.fn(() => jsonStr ?? JSON.stringify({ name: 'Test', version: 1, bricks: [] })),
        loadProjectJSON: mock.fn(),
        getProjectInfo:  mock.fn(() => ({ id: 'local-1', name: 'Test', updatedAt: new Date().toISOString() }))
    };
}

function makeAuthManager(loggedIn = true) {
    return { isLoggedIn: loggedIn };
}

function makeSetup(options = {}) {
    const cloudService    = makeMockCloudService();
    const cpm             = new CloudProjectManager(cloudService);
    const statusManager   = new SyncStatusManager();
    const errorHandler    = new CloudErrorHandler();
    const projectManager  = makeProjectManager(options.json);
    const authManager     = makeAuthManager(options.loggedIn ?? true);

    const sync = new CloudSyncManager({
        projectManager,
        cloudProjectManager: cpm,
        syncStatusManager:   statusManager,
        authManager,
        cloudErrorHandler:   errorHandler
    });

    return { sync, cloudService, cpm, statusManager, projectManager };
}


describe('CloudSyncManager', () => {

    beforeEach(() => {
        globalThis.navigator.onLine = true;
    });


    // ------------------------------------------------------------------
    // Initialisierung
    // ------------------------------------------------------------------

    it('currentCloudProjectId ist initial null', () => {
        const { sync } = makeSetup();
        assert.strictEqual(sync.currentCloudProjectId, null);
    });

    it('isDirty ist initial false', () => {
        const { sync } = makeSetup();
        assert.strictEqual(sync.isDirty, false);
    });


    // ------------------------------------------------------------------
    // markDirty
    // ------------------------------------------------------------------

    it('markDirty setzt isDirty auf true', () => {
        const { sync } = makeSetup();
        sync.markDirty();
        assert.strictEqual(sync.isDirty, true);
    });

    it('markDirty setzt Status auf LOCAL_ONLY wenn kein Cloud-Projekt verknüpft', () => {
        const { sync, statusManager } = makeSetup();
        sync.markDirty();
        assert.strictEqual(statusManager.status, SyncStatus.LOCAL_ONLY);
    });


    // ------------------------------------------------------------------
    // saveToCloud – neues Projekt
    // ------------------------------------------------------------------

    it('saveToCloud erstellt neues Cloud-Projekt wenn kein ID vorhanden', async () => {
        const { sync, cloudService } = makeSetup();
        await sync.saveToCloud();
        assert.strictEqual(cloudService._projects.size, 1);
    });

    it('saveToCloud setzt currentCloudProjectId nach Erfolg', async () => {
        const { sync } = makeSetup();
        await sync.saveToCloud();
        assert.ok(sync.currentCloudProjectId !== null);
    });

    it('saveToCloud setzt Status auf SYNCED nach Erfolg', async () => {
        const { sync, statusManager } = makeSetup();
        await sync.saveToCloud();
        assert.strictEqual(statusManager.status, SyncStatus.SYNCED);
    });

    it('saveToCloud setzt isDirty auf false nach Erfolg', async () => {
        const { sync } = makeSetup();
        sync.markDirty();
        await sync.saveToCloud();
        assert.strictEqual(sync.isDirty, false);
    });


    // ------------------------------------------------------------------
    // saveToCloud – Update
    // ------------------------------------------------------------------

    it('saveToCloud aktualisiert bestehendes Projekt', async () => {
        const { sync, cloudService } = makeSetup();
        await sync.saveToCloud();
        await sync.saveToCloud();
        assert.strictEqual(cloudService._projects.size, 1);
    });


    // ------------------------------------------------------------------
    // saveToCloud – Auth-Fehler
    // ------------------------------------------------------------------

    it('saveToCloud wirft wenn nicht angemeldet', async () => {
        const { sync } = makeSetup({ loggedIn: false });
        await assert.rejects(() => sync.saveToCloud(), CloudError);
    });


    // ------------------------------------------------------------------
    // saveToCloud – Offline
    // ------------------------------------------------------------------

    it('saveToCloud wirft wenn offline', async () => {
        const { sync } = makeSetup();
        globalThis.navigator.onLine = false;
        await assert.rejects(() => sync.saveToCloud(), CloudError);
    });

    it('Status wird OFFLINE gesetzt wenn offline', async () => {
        const { sync, statusManager } = makeSetup();
        globalThis.navigator.onLine = false;
        try { await sync.saveToCloud(); } catch {}
        assert.strictEqual(statusManager.status, SyncStatus.OFFLINE);
    });


    // ------------------------------------------------------------------
    // loadFromCloud
    // ------------------------------------------------------------------

    it('loadFromCloud lädt Projekt in ProjectManager', async () => {
        const { sync, cpm, projectManager } = makeSetup();
        const p = await cpm.createProject('Test', JSON.stringify({ name: 'T', bricks: [] }));
        await sync.loadFromCloud(p.id);
        assert.strictEqual(projectManager.loadProjectJSON.mock.callCount(), 1);
    });

    it('loadFromCloud setzt Status auf SYNCED', async () => {
        const { sync, cpm, statusManager } = makeSetup();
        const p = await cpm.createProject('T', JSON.stringify({ name: 'T', bricks: [] }));
        await sync.loadFromCloud(p.id);
        assert.strictEqual(statusManager.status, SyncStatus.SYNCED);
    });

    it('loadFromCloud setzt currentCloudProjectId', async () => {
        const { sync, cpm } = makeSetup();
        const p = await cpm.createProject('T', JSON.stringify({ name: 'T', bricks: [] }));
        await sync.loadFromCloud(p.id);
        assert.strictEqual(sync.currentCloudProjectId, p.id);
    });


    // ------------------------------------------------------------------
    // reset
    // ------------------------------------------------------------------

    it('reset löscht currentCloudProjectId', async () => {
        const { sync } = makeSetup();
        await sync.saveToCloud();
        sync.reset();
        assert.strictEqual(sync.currentCloudProjectId, null);
    });

    it('reset setzt Status auf LOCAL_ONLY', async () => {
        const { sync, statusManager } = makeSetup();
        await sync.saveToCloud();
        sync.reset();
        assert.strictEqual(statusManager.status, SyncStatus.LOCAL_ONLY);
    });

});
