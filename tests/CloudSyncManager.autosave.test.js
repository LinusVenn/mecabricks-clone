/**
 * Tests für CloudSyncManager – Debounced Autosave (Phase I.7)
 *
 * Abdeckung:
 *  - scheduleAutoSave() tut nichts wenn nicht angemeldet
 *  - scheduleAutoSave() tut nichts wenn kein Cloud-Projekt verknüpft
 *  - scheduleAutoSave() setzt _autosaveTimer auf einen Wert
 *  - Mehrfache scheduleAutoSave()-Aufrufe → nur ein Timer aktiv (Debounce)
 *  - cancelAutoSave() löscht den Timer
 *  - Timer feuert saveToCloud() nach Ablauf der Wartezeit
 *  - _isSaving-Flag verhindert parallele Autosave-Aufrufe
 *  - markDirty() löst scheduleAutoSave() aus wenn Cloud-Projekt verknüpft
 *  - markDirty() löst KEIN scheduleAutoSave() aus wenn kein Cloud-Projekt
 *  - reset() bricht laufenden Autosave-Timer ab
 *  - dispose() bricht laufenden Autosave-Timer ab
 */

import { describe, it, beforeEach } from 'node:test';
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


// ─── Mock-Infrastruktur ───────────────────────────────────────────────────────

const SHORT_DELAY = 20;   // ms – kurze Wartezeit für Tests (viel kürzer als der echte Default von 3 s)
const WAIT        = 60;   // ms – länger als SHORT_DELAY, damit der Timer sicher gefeuert hat

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeMockCloudService(overrides = {}) {
    const projects = new Map();
    let nextId = 1;
    return {
        _projects:          projects,
        _saveCallCount:     0,
        getCurrentUserId:   () => 'u1',
        async listProjects()   { return [...projects.values()]; },
        async getProject(id) {
            const p = projects.get(id);
            if (!p) throw new CloudError('Not found', CloudErrorCodes.NOT_FOUND);
            return p;
        },
        async createProject({ name, data }) {
            this._saveCallCount++;
            const id = `p${nextId++}`;
            const p  = { id, name, data, projectVersion: 1, ownerId: 'u1',
                          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            projects.set(id, p);
            return p;
        },
        async updateProject(id, { name, data, expectedVersion }) {
            this._saveCallCount++;
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

function makeSetup(options = {}) {
    const cloudService   = makeMockCloudService(options.serviceOverrides ?? {});
    const cpm            = new CloudProjectManager(cloudService);
    const statusManager  = new SyncStatusManager();
    const errorHandler   = new CloudErrorHandler();
    const projectManager = {
        getProjectJSON:  () => JSON.stringify({ name: 'Test', version: 1, bricks: [] }),
        loadProjectJSON: () => {},
        getProjectInfo:  () => ({ id: 'local-1', name: 'Test', updatedAt: new Date().toISOString() }),
    };
    const authManager = { isLoggedIn: options.loggedIn ?? true };

    const sync = new CloudSyncManager({
        projectManager,
        cloudProjectManager: cpm,
        syncStatusManager:   statusManager,
        authManager,
        cloudErrorHandler:   errorHandler,
        autosaveDelay:       options.delay ?? SHORT_DELAY,
    });

    return { sync, cpm, cloudService, statusManager, authManager };
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CloudSyncManager – Debounced Autosave', () => {

    beforeEach(() => {
        globalThis.navigator.onLine = true;
    });


    // ── scheduleAutoSave() – Guard-Bedingungen ────────────────────────────────

    describe('scheduleAutoSave() Guard-Bedingungen', () => {

        it('tut nichts wenn nicht angemeldet', async () => {
            const { sync, cloudService } = makeSetup({ loggedIn: false });
            sync.scheduleAutoSave();
            await sleep(WAIT);
            assert.strictEqual(cloudService._saveCallCount, 0);
        });

        it('tut nichts wenn kein Cloud-Projekt verknüpft ist', async () => {
            const { sync, cloudService } = makeSetup();
            // Kein saveToCloud() zuvor → kein _currentCloudProjectId
            sync.scheduleAutoSave();
            await sleep(WAIT);
            assert.strictEqual(cloudService._saveCallCount, 0);
        });

        it('setzt _autosaveTimer wenn Cloud-Projekt verknüpft und angemeldet', async () => {
            const { sync } = makeSetup({ delay: 60_000 });
            await sync.saveToCloud();
            sync.markDirty();   // setzt isDirty + ruft scheduleAutoSave() auf
            assert.ok(sync._autosaveTimer !== null,
                'Timer sollte nach markDirty() mit Cloud-Projekt gesetzt sein');
            sync.cancelAutoSave();
        });

    });


    // ── Debounce-Verhalten ────────────────────────────────────────────────────

    describe('Debounce', () => {

        it('mehrfache markDirty()-Aufrufe führen nur zu einem Speichervorgang (Debounce)', async () => {
            const { sync, cloudService } = makeSetup();
            await sync.saveToCloud();                   // Cloud-Projekt verknüpfen
            const callCountAfterFirstSave = cloudService._saveCallCount;

            // markDirty() setzt isDirty=true UND ruft scheduleAutoSave() auf
            // Mehrfache Aufrufe in kurzer Folge → Debounce → nur ein Timer aktiv
            sync.markDirty();
            sync.markDirty();
            sync.markDirty();

            await sleep(WAIT);  // Auf Timer-Ablauf warten

            // Genau ein weiterer Save-Call (nicht drei)
            assert.strictEqual(
                cloudService._saveCallCount - callCountAfterFirstSave,
                1,
                'Debounce sollte genau einen Speichervorgang auslösen'
            );
        });

        it('Timer wird bei jedem Aufruf zurückgesetzt (Debounce)', async () => {
            const { sync } = makeSetup({ delay: 60_000 });
            await sync.saveToCloud();
            sync.markDirty();                           // setzt isDirty + erster Timer
            const timer1 = sync._autosaveTimer;

            sync.markDirty();                           // setzt neuen Timer
            const timer2 = sync._autosaveTimer;

            // Timer-Handles müssen verschieden sein (Debounce ersetzt immer)
            assert.notStrictEqual(timer1, timer2,
                'Debounce muss alten Timer durch neuen ersetzen');

            sync.cancelAutoSave();
        });

    });


    // ── cancelAutoSave ────────────────────────────────────────────────────────

    describe('cancelAutoSave()', () => {

        it('verhindert den geplanten Speichervorgang', async () => {
            const { sync, cloudService } = makeSetup();
            await sync.saveToCloud();
            const countAfter = cloudService._saveCallCount;

            sync.scheduleAutoSave();
            sync.cancelAutoSave();   // Sofort abbrechen

            await sleep(WAIT);

            assert.strictEqual(cloudService._saveCallCount, countAfter,
                'Kein weiterer Save nach cancelAutoSave()');
        });

        it('setzt _autosaveTimer auf null', async () => {
            const { sync } = makeSetup({ delay: 60_000 });
            await sync.saveToCloud();
            sync.scheduleAutoSave();
            sync.cancelAutoSave();
            assert.strictEqual(sync._autosaveTimer, null);
        });

        it('kann mehrfach aufgerufen werden ohne Fehler', async () => {
            const { sync } = makeSetup();
            assert.doesNotThrow(() => {
                sync.cancelAutoSave();
                sync.cancelAutoSave();
            });
        });

    });


    // ── Timer feuert Speichervorgang ─────────────────────────────────────────

    describe('Timer-gesteuerter Speichervorgang', () => {

        it('saveToCloud() wird nach Ablauf der Wartezeit ausgeführt', async () => {
            const { sync, cloudService } = makeSetup();
            await sync.saveToCloud();
            const countAfter = cloudService._saveCallCount;

            sync.markDirty();   // setzt isDirty=true und plant Autosave

            await sleep(WAIT);

            assert.ok(
                cloudService._saveCallCount > countAfter,
                'Autosave sollte saveToCloud() ausgeführt haben'
            );
        });

        it('isDirty ist nach Autosave false', async () => {
            const { sync } = makeSetup();
            await sync.saveToCloud();
            sync.markDirty();   // setzt isDirty=true und plant Autosave

            await sleep(WAIT);

            assert.strictEqual(sync.isDirty, false);
        });

        it('Status ist SYNCED nach Autosave', async () => {
            const { sync, statusManager } = makeSetup();
            await sync.saveToCloud();
            sync.markDirty();   // setzt isDirty + plant Autosave

            await sleep(WAIT);

            assert.strictEqual(statusManager.status, SyncStatus.SYNCED);
        });

        it('kein Speichervorgang wenn isDirty false ist', async () => {
            const { sync, cloudService } = makeSetup();
            await sync.saveToCloud();
            const countAfter = cloudService._saveCallCount;

            // isDirty ist false → scheduleAutoSave() direkt ohne markDirty() aufrufen
            // (interner Aufruf für den Fall dass jemand den Timer manuell plant)
            sync.scheduleAutoSave();

            await sleep(WAIT);

            assert.strictEqual(cloudService._saveCallCount, countAfter,
                'Kein Speichervorgang wenn keine Änderungen vorhanden');
        });

    });


    // ── markDirty() löst Autosave aus ────────────────────────────────────────

    describe('markDirty() und Autosave', () => {

        it('markDirty() setzt Timer wenn Cloud-Projekt verknüpft', async () => {
            const { sync } = makeSetup({ delay: 60_000 });
            await sync.saveToCloud();

            const timerBefore = sync._autosaveTimer;
            sync.markDirty();

            assert.notStrictEqual(sync._autosaveTimer, timerBefore,
                'markDirty() sollte scheduleAutoSave() auslösen');

            sync.cancelAutoSave();
        });

        it('markDirty() setzt KEINEN Timer wenn kein Cloud-Projekt verknüpft', () => {
            const { sync } = makeSetup({ delay: 60_000 });
            sync.markDirty();
            assert.strictEqual(sync._autosaveTimer, null);
        });

        it('markDirty() löst nach Wartezeit einen Speichervorgang aus', async () => {
            const { sync, cloudService } = makeSetup();
            await sync.saveToCloud();
            const countAfter = cloudService._saveCallCount;

            sync.markDirty();   // setzt isDirty=true und ruft scheduleAutoSave() auf

            await sleep(WAIT);  // Timer abwarten

            assert.ok(
                cloudService._saveCallCount > countAfter,
                'markDirty() sollte nach der Wartezeit saveToCloud() ausgelöst haben'
            );
        });

    });


    // ── reset() und dispose() ────────────────────────────────────────────────

    describe('reset() bricht Autosave ab', () => {

        it('reset() setzt _autosaveTimer auf null', async () => {
            const { sync } = makeSetup({ delay: 60_000 });
            await sync.saveToCloud();
            sync.scheduleAutoSave();
            assert.ok(sync._autosaveTimer !== null);

            sync.reset();
            assert.strictEqual(sync._autosaveTimer, null);
        });

        it('reset() verhindert den geplanten Speichervorgang', async () => {
            const { sync, cloudService } = makeSetup();
            await sync.saveToCloud();
            const countAfter = cloudService._saveCallCount;

            sync._isDirty = true;
            sync.scheduleAutoSave();
            sync.reset();  // Sofort zurücksetzen

            await sleep(WAIT);

            assert.strictEqual(cloudService._saveCallCount, countAfter);
        });

    });


    describe('dispose() bricht Autosave ab', () => {

        it('dispose() setzt _autosaveTimer auf null', async () => {
            const { sync } = makeSetup({ delay: 60_000 });
            await sync.saveToCloud();
            sync.scheduleAutoSave();

            sync.dispose();
            assert.strictEqual(sync._autosaveTimer, null);
        });

        it('dispose() verhindert den geplanten Speichervorgang', async () => {
            const { sync, cloudService } = makeSetup();
            await sync.saveToCloud();
            const countAfter = cloudService._saveCallCount;

            sync._isDirty = true;
            sync.scheduleAutoSave();
            sync.dispose();

            await sleep(WAIT);

            assert.strictEqual(cloudService._saveCallCount, countAfter);
        });

    });


    // ── _isSaving verhindert parallele Aufrufe ────────────────────────────────

    describe('_isSaving-Flag', () => {

        it('_isSaving ist initial false', () => {
            const { sync } = makeSetup();
            assert.strictEqual(sync._isSaving, false);
        });

        it('_isSaving wird nach Abschluss des Speichervorgangs zurückgesetzt', async () => {
            const { sync } = makeSetup();
            await sync.saveToCloud();
            assert.strictEqual(sync._isSaving, false);
        });

    });

});
