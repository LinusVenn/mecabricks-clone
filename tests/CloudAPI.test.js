/**
 * Tests für CloudAPI (Phase I.6)
 *
 * Abdeckung:
 *  - Konstruktor-Validierung
 *  - isLoggedIn / currentUser delegieren an AuthManager
 *  - getProjects(), createProject(), loadProject(), saveProject()
 *  - renameProject(), deleteProject()
 *  - currentCloudProjectId, isDirty, lastSyncedVersion (delegiert an CloudSyncManager)
 *  - markDirty(), reset() delegieren korrekt
 *  - Fehlerweiterleitung
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { CloudAPI }              from '../src/cloud/CloudAPI.js';
import { CloudProjectManager }   from '../src/cloud/CloudProjectManager.js';
import { CloudSyncManager }      from '../src/cloud/CloudSyncManager.js';
import { SyncStatusManager }     from '../src/cloud/SyncStatusManager.js';
import { CloudErrorHandler }     from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';


// navigator.onLine Polyfill für Node.js
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}


// ─── Mock-Infrastruktur ───────────────────────────────────────────────────────

function makeMockCloudService(overrides = {}) {
    const projects = new Map();
    let nextId = 1;
    return {
        _projects: projects,
        getCurrentUserId: () => 'u1',
        async listProjects()                         { return [...projects.values()]; },
        async getProject(id) {
            const p = projects.get(id);
            if (!p) throw new CloudError('Not found', CloudErrorCodes.NOT_FOUND);
            return p;
        },
        async createProject({ name, data }) {
            const id = `p${nextId++}`;
            const p  = { id, name, data, projectVersion: 1, ownerId: 'u1',
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
        ...overrides,
    };
}

function makeProjectManager() {
    return {
        getProjectJSON:  mock.fn(() => JSON.stringify({ name: 'Test', version: 1, bricks: [] })),
        loadProjectJSON: mock.fn(),
        getProjectInfo:  mock.fn(() => ({ id: 'local-1', name: 'Test', updatedAt: new Date().toISOString() })),
    };
}

function makeAuthManager(loggedIn = true) {
    return {
        isLoggedIn:  loggedIn,
        currentUser: loggedIn ? { id: 'u1', email: 'test@test.de' } : null,
    };
}

function makeSetup(options = {}) {
    const cloudService   = makeMockCloudService(options.serviceOverrides ?? {});
    const cpm            = new CloudProjectManager(cloudService);
    const statusManager  = new SyncStatusManager();
    const errorHandler   = new CloudErrorHandler();
    const projectManager = makeProjectManager();
    const authManager    = makeAuthManager(options.loggedIn ?? true);

    const sync = new CloudSyncManager({
        projectManager,
        cloudProjectManager: cpm,
        syncStatusManager:   statusManager,
        authManager,
        cloudErrorHandler:   errorHandler,
        autosaveDelay:       60_000,  // langen Delay damit Autosave nicht stört
    });

    const api = new CloudAPI({ cloudProjectManager: cpm, cloudSyncManager: sync, authManager });

    return { api, sync, cpm, cloudService, projectManager, authManager, statusManager };
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CloudAPI', () => {

    beforeEach(() => {
        globalThis.navigator.onLine = true;
    });


    // ── Konstruktor ──────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('wirft wenn cloudProjectManager fehlt', () => {
            const { sync, authManager } = makeSetup();
            assert.throws(
                () => new CloudAPI({ cloudProjectManager: null, cloudSyncManager: sync, authManager }),
                /cloudProjectManager/
            );
        });

        it('wirft wenn cloudSyncManager fehlt', () => {
            const { cpm, authManager } = makeSetup();
            assert.throws(
                () => new CloudAPI({ cloudProjectManager: cpm, cloudSyncManager: null, authManager }),
                /cloudSyncManager/
            );
        });

        it('wirft wenn authManager fehlt', () => {
            const { cpm, sync } = makeSetup();
            assert.throws(
                () => new CloudAPI({ cloudProjectManager: cpm, cloudSyncManager: sync, authManager: null }),
                /authManager/
            );
        });

    });


    // ── Authentifizierungsstatus ─────────────────────────────────────────────

    describe('isLoggedIn / currentUser', () => {

        it('isLoggedIn delegiert an authManager (angemeldet)', () => {
            const { api } = makeSetup({ loggedIn: true });
            assert.strictEqual(api.isLoggedIn, true);
        });

        it('isLoggedIn delegiert an authManager (abgemeldet)', () => {
            const { api } = makeSetup({ loggedIn: false });
            assert.strictEqual(api.isLoggedIn, false);
        });

        it('currentUser gibt Benutzerobjekt zurück wenn angemeldet', () => {
            const { api } = makeSetup({ loggedIn: true });
            assert.strictEqual(api.currentUser?.email, 'test@test.de');
        });

        it('currentUser gibt null zurück wenn nicht angemeldet', () => {
            const { api } = makeSetup({ loggedIn: false });
            assert.strictEqual(api.currentUser, null);
        });

    });


    // ── getProjects ──────────────────────────────────────────────────────────

    describe('getProjects()', () => {

        it('gibt leere Liste zurück wenn keine Projekte vorhanden', async () => {
            const { api } = makeSetup();
            const projects = await api.getProjects();
            assert.deepEqual(projects, []);
        });

        it('gibt alle Cloud-Projekte zurück', async () => {
            const { api, cpm } = makeSetup();
            await cpm.createProject('Projekt A', JSON.stringify({ bricks: [] }));
            await cpm.createProject('Projekt B', JSON.stringify({ bricks: [] }));
            const projects = await api.getProjects();
            assert.strictEqual(projects.length, 2);
        });

    });


    // ── createProject ────────────────────────────────────────────────────────

    describe('createProject()', () => {

        it('legt neues Projekt an und gibt es zurück', async () => {
            const { api } = makeSetup();
            const p = await api.createProject('Mein Modell', JSON.stringify({ bricks: [] }));
            assert.strictEqual(p.name, 'Mein Modell');
            assert.ok(p.id);
        });

        it('wirft bei leerem Projektnamen', async () => {
            const { api } = makeSetup();
            await assert.rejects(
                () => api.createProject('', JSON.stringify({ bricks: [] })),
                CloudError
            );
        });

        it('wirft bei ungültigem JSON', async () => {
            const { api } = makeSetup();
            await assert.rejects(
                () => api.createProject('Test', 'kein-json'),
                CloudError
            );
        });

    });


    // ── loadProject ──────────────────────────────────────────────────────────

    describe('loadProject()', () => {

        it('lädt Projekt und übergibt JSON an ProjectManager', async () => {
            const { api, cpm, projectManager } = makeSetup();
            const p = await cpm.createProject('Test', JSON.stringify({ name: 'T', bricks: [] }));
            await api.loadProject(p.id);
            assert.strictEqual(projectManager.loadProjectJSON.mock.callCount(), 1);
        });

        it('setzt currentCloudProjectId nach dem Laden', async () => {
            const { api, cpm } = makeSetup();
            const p = await cpm.createProject('Test', JSON.stringify({ name: 'T', bricks: [] }));
            await api.loadProject(p.id);
            assert.strictEqual(api.currentCloudProjectId, p.id);
        });

        it('wirft bei nicht vorhandenem Projekt', async () => {
            const { api } = makeSetup();
            await assert.rejects(
                () => api.loadProject('nicht-existent'),
                CloudError
            );
        });

    });


    // ── saveProject ──────────────────────────────────────────────────────────

    describe('saveProject()', () => {

        it('speichert aktuellen Editor-Zustand als neues Projekt', async () => {
            const { api, cloudService } = makeSetup();
            await api.saveProject();
            assert.strictEqual(cloudService._projects.size, 1);
        });

        it('aktualisiert bestehendes Projekt', async () => {
            const { api, cloudService } = makeSetup();
            await api.saveProject();
            await api.saveProject();
            assert.strictEqual(cloudService._projects.size, 1);
        });

        it('setzt isDirty auf false nach Erfolg', async () => {
            const { api, sync } = makeSetup();
            sync.markDirty();
            await api.saveProject();
            assert.strictEqual(api.isDirty, false);
        });

    });


    // ── renameProject ────────────────────────────────────────────────────────

    describe('renameProject()', () => {

        it('benennt Projekt um', async () => {
            const { api, cpm } = makeSetup();
            const p = await cpm.createProject('Alt', JSON.stringify({ bricks: [] }));
            const renamed = await api.renameProject(p.id, 'Neu');
            assert.strictEqual(renamed.name, 'Neu');
        });

        it('wirft bei leerem neuem Namen', async () => {
            const { api, cpm } = makeSetup();
            const p = await cpm.createProject('Test', JSON.stringify({ bricks: [] }));
            await assert.rejects(
                () => api.renameProject(p.id, ''),
                CloudError
            );
        });

    });


    // ── deleteProject ────────────────────────────────────────────────────────

    describe('deleteProject()', () => {

        it('löscht Projekt', async () => {
            const { api, cpm, cloudService } = makeSetup();
            const p = await cpm.createProject('Test', JSON.stringify({ bricks: [] }));
            await api.deleteProject(p.id);
            assert.strictEqual(cloudService._projects.size, 0);
        });

        it('wirft wenn keine Projekt-ID übergeben', async () => {
            const { api } = makeSetup();
            await assert.rejects(() => api.deleteProject(''), CloudError);
        });

    });


    // ── Sync-Zustand ─────────────────────────────────────────────────────────

    describe('Synchronisierungszustand', () => {

        it('currentCloudProjectId ist initial null', () => {
            const { api } = makeSetup();
            assert.strictEqual(api.currentCloudProjectId, null);
        });

        it('currentCloudProjectId wird nach saveProject gesetzt', async () => {
            const { api } = makeSetup();
            await api.saveProject();
            assert.ok(api.currentCloudProjectId !== null);
        });

        it('isDirty ist initial false', () => {
            const { api } = makeSetup();
            assert.strictEqual(api.isDirty, false);
        });

        it('markDirty() setzt isDirty auf true', () => {
            const { api } = makeSetup();
            api.markDirty();
            assert.strictEqual(api.isDirty, true);
        });

        it('reset() setzt currentCloudProjectId zurück', async () => {
            const { api } = makeSetup();
            await api.saveProject();
            api.reset();
            assert.strictEqual(api.currentCloudProjectId, null);
        });

        it('reset() setzt isDirty auf false', () => {
            const { api } = makeSetup();
            api.markDirty();
            api.reset();
            assert.strictEqual(api.isDirty, false);
        });

        it('lastSyncedVersion ist nach saveProject gesetzt', async () => {
            const { api } = makeSetup();
            await api.saveProject();
            assert.ok(api.lastSyncedVersion !== null);
        });

    });

});
