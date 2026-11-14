/**
 * Erweiterte Tests für CloudSyncManager – online-Event-Handler
 *
 * Abdeckung von Lücken:
 *  - online-Event → MODIFIED wenn dirty + Cloud-Projekt + angemeldet
 *  - online-Event → kein Statuswechsel wenn nicht dirty
 *  - online-Event → kein Statuswechsel wenn kein Cloud-Projekt verknüpft
 *  - online-Event → kein Statuswechsel wenn nicht angemeldet
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudSyncManager }              from '../src/cloud/CloudSyncManager.js';
import { CloudProjectManager }           from '../src/cloud/CloudProjectManager.js';
import { SyncStatusManager, SyncStatus } from '../src/cloud/SyncStatusManager.js';
import { CloudErrorHandler }             from '../src/cloud/CloudErrorHandler.js';
import { CloudError, CloudErrorCodes }   from '../src/cloud/CloudService.js';


// navigator.onLine Polyfill
if (typeof globalThis.navigator === 'undefined') {
    globalThis.navigator = { onLine: true };
}


// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

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
        async deleteProject(id) { projects.delete(id); }
    };
}

function makeSetup(loggedIn = true) {
    const cloudService    = makeMockCloudService();
    const cpm             = new CloudProjectManager(cloudService);
    const statusManager   = new SyncStatusManager();
    const errorHandler    = new CloudErrorHandler();
    const projectManager  = {
        getProjectJSON:  () => JSON.stringify({ name: 'Test', version: 1, bricks: [] }),
        loadProjectJSON: () => {},
        getProjectInfo:  () => ({ id: 'local-1', name: 'Test', updatedAt: new Date().toISOString() })
    };
    const authManager = { isLoggedIn: loggedIn };

    const sync = new CloudSyncManager({
        projectManager,
        cloudProjectManager: cpm,
        syncStatusManager:   statusManager,
        authManager,
        cloudErrorHandler:   errorHandler
    });

    return { sync, statusManager, authManager };
}


// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CloudSyncManager – online-Event-Handler', () => {

    let savedWindow;

    beforeEach(() => {
        // window-Mock setzen damit der Konstruktor _onOnline registriert
        savedWindow = globalThis.window;
        globalThis.window = {
            addEventListener:    () => {},
            removeEventListener: () => {}
        };
        globalThis.navigator.onLine = true;
    });

    afterEach(() => {
        globalThis.window = savedWindow;
    });


    it('setzt Status auf MODIFIED wenn dirty + Cloud-Projekt + angemeldet', () => {
        const { sync, statusManager } = makeSetup(true);

        // Vorbereitung: dirty markieren und Cloud-Projekt-ID simulieren
        sync.markDirty();
        sync._currentCloudProjectId = 'cloud-project-123';

        // _onOnline direkt aufrufen (simuliert das window.online-Event)
        assert.ok(typeof sync._onOnline === 'function', '_onOnline muss gesetzt sein');
        sync._onOnline();

        assert.strictEqual(
            statusManager.status,
            SyncStatus.MODIFIED,
            'Status muss MODIFIED sein nach online-Event'
        );
    });

    it('ändert Status NICHT wenn nicht dirty', () => {
        const { sync, statusManager } = makeSetup(true);

        // Nicht dirty (Standard)
        sync._currentCloudProjectId = 'cloud-project-123';
        const statusBefore = statusManager.status;

        sync._onOnline?.();

        assert.strictEqual(statusManager.status, statusBefore,
            'Status darf sich nicht ändern wenn nicht dirty');
    });

    it('ändert Status NICHT wenn kein Cloud-Projekt verknüpft', () => {
        const { sync, statusManager } = makeSetup(true);

        sync.markDirty();
        // _currentCloudProjectId bleibt null

        const statusBefore = statusManager.status;
        sync._onOnline?.();

        assert.strictEqual(statusManager.status, statusBefore,
            'Status darf sich nicht ändern ohne Cloud-Projekt');
    });

    it('ändert Status NICHT wenn nicht angemeldet', () => {
        const { sync, statusManager } = makeSetup(false); // loggedIn = false

        sync.markDirty();
        sync._currentCloudProjectId = 'cloud-project-123';

        const statusBefore = statusManager.status;
        sync._onOnline?.();

        assert.strictEqual(statusManager.status, statusBefore,
            'Status darf sich nicht ändern wenn nicht angemeldet');
    });
});


describe('CloudSyncManager – Konstruktor ohne window', () => {

    it('_onOnline ist undefined wenn window nicht vorhanden', () => {
        // Window entfernen
        const savedWindow = globalThis.window;
        delete globalThis.window;

        const { sync } = makeSetup(true);

        // _onOnline darf nicht gesetzt sein
        assert.strictEqual(sync._onOnline, undefined,
            '_onOnline darf nicht gesetzt sein ohne window');

        globalThis.window = savedWindow;
    });
});
