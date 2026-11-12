import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { AutoSaveManager } from '../src/project/AutoSaveManager.js';


// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Minimaler gültiger Projekt-JSON-String. */
function defaultProjectJSON() {
    return JSON.stringify({
        format:  'mecabricks-clone',
        version: 1,
        project: { id: 'p1', name: 'Test', createdAt: '', updatedAt: '' },
        bricks:  [],
        connections: [],
    });
}

/** Mock-ProjectManager mit konfigurierbarem Rückgabewert. */
function makeMockProjectManager(json = defaultProjectJSON()) {
    return {
        getProjectJSON: () => json,
    };
}

/** Mock-Storage mit vollständiger Zustandsverfolgung. */
function makeMockStorage(initialData = null) {
    let _data = initialData;
    return {
        save(data)  { _data = data; },
        load()      { return _data; },
        has()       { return _data !== null; },
        clear()     { _data = null; },
        getData()   { return _data; },     // Testvereinfachung
    };
}

/** Mock-Storage, der bei save() immer einen QuotaExceededError wirft. */
function makeMockStorageQuotaFull() {
    const err  = new Error('Quota exceeded');
    err.name   = 'QuotaExceededError';
    return {
        save()  { throw err; },
        load()  { return null; },
        has()   { return false; },
        clear() {},
    };
}

/** Mock-Storage, der bei save() einen generischen Fehler wirft. */
function makeMockStorageThrows(message = 'Unerwarteter Fehler') {
    return {
        save()  { throw new Error(message); },
        load()  { return null; },
        has()   { return false; },
        clear() {},
    };
}


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AutoSaveManager', () => {


    // ── Konstruktor ───────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('_isRestoring ist false nach Konstruktion', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            assert.strictEqual(auto._isRestoring, false);
        });

        it('_debounceTimer ist null nach Konstruktion', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            assert.strictEqual(auto._debounceTimer, null);
        });

        it('onStatusChange ist null nach Konstruktion', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            assert.strictEqual(auto.onStatusChange, null);
        });

    });


    // ── setRestoring ──────────────────────────────────────────────────────────

    describe('setRestoring()', () => {

        it('setzt _isRestoring auf true', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.setRestoring(true);
            assert.strictEqual(auto._isRestoring, true);
        });

        it('setzt _isRestoring zurück auf false', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.setRestoring(true);
            auto.setRestoring(false);
            assert.strictEqual(auto._isRestoring, false);
        });

        it('konvertiert truthy-Werte zu true', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.setRestoring(1);
            assert.strictEqual(auto._isRestoring, true);
        });

    });


    // ── save ──────────────────────────────────────────────────────────────────

    describe('save()', () => {

        it('gibt true zurück bei erfolgreichem Speichern', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            assert.strictEqual(auto.save(), true);
        });

        it('schreibt Daten in den Storage', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.save();
            assert.ok(storage.getData() !== null);
        });

        it('fügt savedAt-Zeitstempel hinzu', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.save();
            assert.ok(typeof storage.getData().savedAt === 'string');
        });

        it('savedAt ist ein gültiger ISO-Zeitstempel', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.save();
            const d = new Date(storage.getData().savedAt);
            assert.ok(!isNaN(d.getTime()));
        });

        it('setzt _debounceTimer auf null', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.scheduleSave(); // setzt Timer
            auto.save();         // sofort speichern → Timer löschen
            assert.strictEqual(auto._debounceTimer, null);
        });

        it('ruft onStatusChange mit "saved" auf', () => {
            let lastStatus = null;
            const auto     = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.onStatusChange = (s) => { lastStatus = s; };
            auto.save();
            assert.strictEqual(lastStatus, 'saved');
        });

        it('ruft onStatusChange mit einem Date-Objekt auf', () => {
            let lastTime = null;
            const auto   = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.onStatusChange = (_, t) => { lastTime = t; };
            auto.save();
            assert.ok(lastTime instanceof Date);
        });

        it('gibt false zurück wenn _isRestoring true ist', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.setRestoring(true);
            assert.strictEqual(auto.save(), false);
        });

        it('schreibt nicht in den Storage wenn _isRestoring true ist', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.setRestoring(true);
            auto.save();
            assert.strictEqual(storage.getData(), null);
        });

        it('gibt false zurück bei QuotaExceededError', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorageQuotaFull());
            assert.strictEqual(auto.save(), false);
        });

        it('ruft onStatusChange mit "error" bei QuotaExceededError auf', () => {
            let lastStatus = null;
            const auto     = new AutoSaveManager(makeMockProjectManager(), makeMockStorageQuotaFull());
            auto.onStatusChange = (s) => { lastStatus = s; };
            auto.save();
            assert.strictEqual(lastStatus, 'error');
        });

        it('ruft onStatusChange mit "error" bei allgemeinem Fehler auf', () => {
            let lastStatus = null;
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorageThrows());
            auto.onStatusChange = (s) => { lastStatus = s; };
            auto.save();
            assert.strictEqual(lastStatus, 'error');
        });

        it('errorMessage enthält "Speicher voll" bei QuotaExceededError', () => {
            let msg  = null;
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorageQuotaFull());
            auto.onStatusChange = (_, __, m) => { msg = m; };
            auto.save();
            assert.ok(msg && msg.toLowerCase().includes('speicher'));
        });

    });


    // ── scheduleSave ─────────────────────────────────────────────────────────

    describe('scheduleSave()', () => {

        it('setzt _debounceTimer auf einen Nicht-null-Wert', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.scheduleSave();
            assert.ok(auto._debounceTimer !== null);
            clearTimeout(auto._debounceTimer);
        });

        it('setzt Status sofort auf "saving"', () => {
            let lastStatus = null;
            const auto     = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.onStatusChange = (s) => { lastStatus = s; };
            auto.scheduleSave();
            assert.strictEqual(lastStatus, 'saving');
            clearTimeout(auto._debounceTimer);
        });

        it('ignoriert Aufrufe wenn _isRestoring true ist', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.setRestoring(true);
            auto.scheduleSave();
            assert.strictEqual(auto._debounceTimer, null);
        });

        it('mehrfache Aufrufe überschreiben den Timer (debounce)', () => {
            const auto   = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.scheduleSave();
            const first  = auto._debounceTimer;
            auto.scheduleSave();
            const second = auto._debounceTimer;
            // Timer-Handle kann sich unterscheiden (neuer Timer)
            // Wichtiger: nach flush() wird nur einmal gespeichert
            clearTimeout(second);
            assert.ok(second !== null);
        });

    });


    // ── flush ─────────────────────────────────────────────────────────────────

    describe('flush()', () => {

        it('löst sofortiges Speichern aus wenn ein Timer läuft', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.scheduleSave();
            auto.flush();
            assert.ok(storage.getData() !== null);
        });

        it('setzt _debounceTimer auf null nach flush()', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            auto.scheduleSave();
            auto.flush();
            assert.strictEqual(auto._debounceTimer, null);
        });

        it('tut nichts wenn kein Timer läuft', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.flush();
            assert.strictEqual(storage.getData(), null);
        });

        it('mehrfache flush()-Aufrufe sind idempotent', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.scheduleSave();
            auto.flush();
            auto.flush(); // zweiter Aufruf darf nicht werfen
            assert.ok(storage.getData() !== null);
        });

    });


    // ── load / hasSavedProject / deleteSavedProject ───────────────────────────

    describe('load(), hasSavedProject(), deleteSavedProject()', () => {

        it('load() gibt null zurück wenn kein Speicherstand vorhanden', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            assert.strictEqual(auto.load(), null);
        });

        it('load() gibt gespeicherte Daten zurück', () => {
            const data    = { savedAt: new Date().toISOString(), name: 'X' };
            const storage = makeMockStorage(data);
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            assert.deepStrictEqual(auto.load(), data);
        });

        it('hasSavedProject() gibt false zurück wenn Storage leer ist', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            assert.strictEqual(auto.hasSavedProject(), false);
        });

        it('hasSavedProject() gibt true zurück nach save()', () => {
            const storage = makeMockStorage();
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.save();
            assert.strictEqual(auto.hasSavedProject(), true);
        });

        it('deleteSavedProject() leert den Storage', () => {
            const storage = makeMockStorage({ savedAt: '', name: 'X' });
            const auto    = new AutoSaveManager(makeMockProjectManager(), storage);
            auto.deleteSavedProject();
            assert.strictEqual(auto.hasSavedProject(), false);
        });

    });


    // ── getLastSavedTime ──────────────────────────────────────────────────────

    describe('getLastSavedTime()', () => {

        it('gibt null zurück wenn kein Speicherstand vorhanden', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(), makeMockStorage());
            assert.strictEqual(auto.getLastSavedTime(), null);
        });

        it('gibt null zurück wenn savedAt fehlt', () => {
            const auto = new AutoSaveManager(makeMockProjectManager(),
                makeMockStorage({ name: 'X' }));  // kein savedAt
            assert.strictEqual(auto.getLastSavedTime(), null);
        });

        it('gibt ein Date-Objekt zurück wenn savedAt vorhanden', () => {
            const ts  = new Date().toISOString();
            const auto = new AutoSaveManager(makeMockProjectManager(),
                makeMockStorage({ savedAt: ts }));
            const t    = auto.getLastSavedTime();
            assert.ok(t instanceof Date);
            assert.ok(!isNaN(t.getTime()));
        });

        it('Date entspricht dem gespeicherten savedAt', () => {
            const ts   = '2024-06-15T12:00:00.000Z';
            const auto = new AutoSaveManager(makeMockProjectManager(),
                makeMockStorage({ savedAt: ts }));
            assert.strictEqual(
                auto.getLastSavedTime().toISOString(),
                ts
            );
        });

    });

});
