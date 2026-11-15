/**
 * Tests für SessionManager (Phase I.3 / I.9)
 *
 * Abdeckung:
 *  - Konstruktor-Validierung
 *  - isLoggedIn / currentUser delegieren an AuthManager
 *  - projectState: { source, projectId, revision, dirty } — korrekte Werte
 *  - isCloudProject / isLocalProject
 *  - canSafelyLeave
 *  - logout() ruft auth.logout() und sync.reset() auf
 *  - restoreSession() delegiert an AuthManager
 *  - subscribe() delegiert an AuthManager
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { SessionManager, ProjectSource } from '../src/cloud/SessionManager.js';
import { CloudProjectManager }           from '../src/cloud/CloudProjectManager.js';
import { CloudSyncManager }              from '../src/cloud/CloudSyncManager.js';
import { SyncStatusManager }             from '../src/cloud/SyncStatusManager.js';
import { CloudErrorHandler }             from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes }   from '../src/cloud/CloudService.js';


// navigator.onLine Polyfill
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}


// ─── Mock-Infrastruktur ───────────────────────────────────────────────────────

function makeMockCloudService() {
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
    };
}

function makeMockAuthManager(loggedIn = true) {
    const listeners = new Set();
    return {
        isLoggedIn:  loggedIn,
        currentUser: loggedIn ? { id: 'u1', email: 'test@test.de' } : null,
        logout: mock.fn(async function () {
            this.isLoggedIn  = false;
            this.currentUser = null;
            for (const fn of listeners) fn('SIGNED_OUT', null);
        }),
        restoreSession: mock.fn(async () => loggedIn ? { id: 'u1', email: 'test@test.de' } : null),
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}

function makeSetup(loggedIn = true) {
    const cloudService   = makeMockCloudService();
    const cpm            = new CloudProjectManager(cloudService);
    const statusManager  = new SyncStatusManager();
    const errorHandler   = new CloudErrorHandler();
    const projectManager = {
        getProjectJSON:  () => JSON.stringify({ name: 'Test', bricks: [] }),
        loadProjectJSON: () => {},
        getProjectInfo:  () => ({ id: 'local-1', name: 'Test', updatedAt: new Date().toISOString() }),
    };
    const authManager = makeMockAuthManager(loggedIn);

    const sync = new CloudSyncManager({
        projectManager,
        cloudProjectManager: cpm,
        syncStatusManager:   statusManager,
        authManager,
        cloudErrorHandler:   errorHandler,
        autosaveDelay:       60_000,
    });

    const session = new SessionManager({ authManager, cloudSyncManager: sync });

    return { session, sync, cpm, authManager };
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SessionManager', () => {

    beforeEach(() => {
        globalThis.navigator.onLine = true;
    });


    // ── Konstruktor ──────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('wirft wenn authManager fehlt', () => {
            const { sync } = makeSetup();
            assert.throws(
                () => new SessionManager({ authManager: null, cloudSyncManager: sync }),
                /authManager/
            );
        });

        it('wirft wenn cloudSyncManager fehlt', () => {
            const { authManager } = makeSetup();
            assert.throws(
                () => new SessionManager({ authManager, cloudSyncManager: null }),
                /cloudSyncManager/
            );
        });

    });


    // ── ProjectSource-Konstante ──────────────────────────────────────────────

    describe('ProjectSource', () => {

        it('ProjectSource.LOCAL ist "local"', () => {
            assert.strictEqual(ProjectSource.LOCAL, 'local');
        });

        it('ProjectSource.CLOUD ist "cloud"', () => {
            assert.strictEqual(ProjectSource.CLOUD, 'cloud');
        });

    });


    // ── Authentifizierungsstatus ─────────────────────────────────────────────

    describe('isLoggedIn / currentUser', () => {

        it('isLoggedIn delegiert an authManager (angemeldet)', () => {
            const { session } = makeSetup(true);
            assert.strictEqual(session.isLoggedIn, true);
        });

        it('isLoggedIn delegiert an authManager (abgemeldet)', () => {
            const { session } = makeSetup(false);
            assert.strictEqual(session.isLoggedIn, false);
        });

        it('currentUser gibt Benutzerobjekt zurück', () => {
            const { session } = makeSetup(true);
            assert.strictEqual(session.currentUser?.email, 'test@test.de');
        });

        it('currentUser gibt null zurück wenn abgemeldet', () => {
            const { session } = makeSetup(false);
            assert.strictEqual(session.currentUser, null);
        });

    });


    // ── projectState ─────────────────────────────────────────────────────────

    describe('projectState', () => {

        it('gibt lokalen Zustand zurück wenn kein Cloud-Projekt', () => {
            const { session } = makeSetup();
            const state = session.projectState;
            assert.strictEqual(state.source,    ProjectSource.LOCAL);
            assert.strictEqual(state.projectId, null);
            assert.strictEqual(state.revision,  null);
            assert.strictEqual(state.dirty,     false);
        });

        it('gibt Cloud-Zustand zurück nach saveToCloud', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            const state = session.projectState;
            assert.strictEqual(state.source, ProjectSource.CLOUD);
            assert.ok(state.projectId !== null);
            assert.ok(state.revision !== null);
            assert.strictEqual(state.dirty, false);
        });

        it('dirty ist true nach markDirty', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            sync.markDirty();
            assert.strictEqual(session.projectState.dirty, true);
        });

    });


    // ── isCloudProject / isLocalProject ──────────────────────────────────────

    describe('isCloudProject / isLocalProject', () => {

        it('isCloudProject ist false initial', () => {
            const { session } = makeSetup();
            assert.strictEqual(session.isCloudProject, false);
        });

        it('isLocalProject ist true initial', () => {
            const { session } = makeSetup();
            assert.strictEqual(session.isLocalProject, true);
        });

        it('isCloudProject ist true nach saveToCloud', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            assert.strictEqual(session.isCloudProject, true);
        });

        it('isLocalProject ist false nach saveToCloud', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            assert.strictEqual(session.isLocalProject, false);
        });

        it('isCloudProject kehrt nach reset() zurück zu false', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            sync.reset();
            assert.strictEqual(session.isCloudProject, false);
        });

    });


    // ── canSafelyLeave ───────────────────────────────────────────────────────

    describe('canSafelyLeave', () => {

        it('ist true wenn kein Cloud-Projekt geöffnet', () => {
            const { session } = makeSetup();
            assert.strictEqual(session.canSafelyLeave, true);
        });

        it('ist true wenn Cloud-Projekt geöffnet aber kein dirty-Flag', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            assert.strictEqual(session.canSafelyLeave, true);
        });

        it('ist false wenn Cloud-Projekt offen und Änderungen vorhanden', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            sync.markDirty();
            assert.strictEqual(session.canSafelyLeave, false);
        });

        it('ist wieder true nach erneutem Speichern', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            sync.markDirty();
            await sync.saveToCloud();
            assert.strictEqual(session.canSafelyLeave, true);
        });

    });


    // ── logout ───────────────────────────────────────────────────────────────

    describe('logout()', () => {

        it('ruft authManager.logout() auf', async () => {
            const { session, authManager } = makeSetup();
            await session.logout();
            assert.strictEqual(authManager.logout.mock.callCount(), 1);
        });

        it('setzt Cloud-Zustand zurück nach Abmeldung', async () => {
            const { session, sync } = makeSetup();
            await sync.saveToCloud();
            await session.logout();
            assert.strictEqual(session.isCloudProject, false);
        });

        it('lokaler Projektzustand bleibt nach Abmeldung erhalten (kein Datenverlust)', async () => {
            // Projektzustand ist local → nach logout immer noch local
            const { session } = makeSetup();
            await session.logout();
            assert.strictEqual(session.projectState.source, ProjectSource.LOCAL);
        });

    });


    // ── restoreSession ───────────────────────────────────────────────────────

    describe('restoreSession()', () => {

        it('delegiert an authManager.restoreSession()', async () => {
            const { session, authManager } = makeSetup(true);
            await session.restoreSession();
            assert.strictEqual(authManager.restoreSession.mock.callCount(), 1);
        });

        it('gibt Benutzerobjekt zurück wenn Sitzung vorhanden', async () => {
            const { session } = makeSetup(true);
            const user = await session.restoreSession();
            assert.strictEqual(user?.email, 'test@test.de');
        });

        it('gibt null zurück wenn keine Sitzung', async () => {
            const { session } = makeSetup(false);
            const user = await session.restoreSession();
            assert.strictEqual(user, null);
        });

    });


    // ── subscribe ────────────────────────────────────────────────────────────

    describe('subscribe()', () => {

        it('delegiert an authManager.subscribe()', async () => {
            const { session, authManager } = makeSetup();
            let called = false;
            session.subscribe(() => { called = true; });
            await authManager.logout();
            assert.strictEqual(called, true);
        });

        it('Unsubscribe stoppt Benachrichtigungen', async () => {
            const { session, authManager } = makeSetup();
            let callCount = 0;
            const unsub = session.subscribe(() => callCount++);
            unsub();
            await authManager.logout();
            assert.strictEqual(callCount, 0);
        });

    });

});
