import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ProjectStorage } from '../src/project/ProjectStorage.js';


// ─── localStorage-Mock ───────────────────────────────────────────────────────
//
// Node.js stellt kein localStorage bereit. Wir installieren einen einfachen
// in-memory-Ersatz als globale Variable, bevor die Tests laufen.
// Jeder beforeEach-Lauf leert den Store, damit Tests sich nicht gegenseitig
// beeinflussen.

let _mockStore;

function installLocalStorageMock() {
    _mockStore = new Map();
    globalThis.localStorage = {
        getItem:    (k) => _mockStore.has(k) ? _mockStore.get(k) : null,
        setItem:    (k, v) => { _mockStore.set(k, String(v)); },
        removeItem: (k) => { _mockStore.delete(k); },
        clear:      () => { _mockStore.clear(); },
    };
}


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ProjectStorage', () => {

    beforeEach(() => {
        installLocalStorageMock();
    });


    // ── Konstruktor ───────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('verwendet den Standardschlüssel "lego-editor-project"', () => {
            const s = new ProjectStorage();
            assert.strictEqual(s.key, 'lego-editor-project');
        });

        it('akzeptiert einen benutzerdefinierten Schlüssel', () => {
            const s = new ProjectStorage('my-custom-key');
            assert.strictEqual(s.key, 'my-custom-key');
        });

    });


    // ── save / load – Roundtrip ───────────────────────────────────────────────

    describe('save() + load()', () => {

        it('gespeichertes Objekt kann wieder geladen werden', () => {
            const s    = new ProjectStorage('test-key');
            const data = { name: 'Mein Projekt', bricks: [1, 2, 3] };
            s.save(data);
            assert.deepStrictEqual(s.load(), data);
        });

        it('überschreibt einen bestehenden Eintrag', () => {
            const s = new ProjectStorage('test-key');
            s.save({ value: 1 });
            s.save({ value: 2 });
            assert.strictEqual(s.load().value, 2);
        });

        it('verschiedene Schlüssel sind unabhängig voneinander', () => {
            const s1 = new ProjectStorage('key-1');
            const s2 = new ProjectStorage('key-2');
            s1.save({ from: 'one' });
            s2.save({ from: 'two' });
            assert.strictEqual(s1.load().from, 'one');
            assert.strictEqual(s2.load().from, 'two');
        });

        it('speichert verschachtelte Objekte korrekt', () => {
            const s    = new ProjectStorage('test-key');
            const data = { project: { name: 'X', meta: { version: 1 } } };
            s.save(data);
            assert.deepStrictEqual(s.load(), data);
        });

    });


    // ── load ─────────────────────────────────────────────────────────────────

    describe('load()', () => {

        it('gibt null zurück wenn kein Eintrag vorhanden ist', () => {
            const s = new ProjectStorage('leer');
            assert.strictEqual(s.load(), null);
        });

        it('gibt null zurück wenn der gespeicherte JSON ungültig ist', () => {
            const s = new ProjectStorage('kaputt');
            // Direkt ungültigen JSON-Text schreiben, ohne save() zu benutzen
            _mockStore.set('kaputt', '{ungültig json}}}');
            assert.strictEqual(s.load(), null);
        });

    });


    // ── has ───────────────────────────────────────────────────────────────────

    describe('has()', () => {

        it('gibt false zurück wenn kein Eintrag vorhanden ist', () => {
            const s = new ProjectStorage('empty-key');
            assert.strictEqual(s.has(), false);
        });

        it('gibt true zurück nach save()', () => {
            const s = new ProjectStorage('present-key');
            s.save({ ok: true });
            assert.strictEqual(s.has(), true);
        });

        it('gibt false zurück nach clear()', () => {
            const s = new ProjectStorage('cleared-key');
            s.save({ ok: true });
            s.clear();
            assert.strictEqual(s.has(), false);
        });

    });


    // ── clear ─────────────────────────────────────────────────────────────────

    describe('clear()', () => {

        it('entfernt einen vorhandenen Eintrag', () => {
            const s = new ProjectStorage('remove-key');
            s.save({ x: 1 });
            s.clear();
            assert.strictEqual(s.load(), null);
        });

        it('schlägt nicht fehl wenn kein Eintrag vorhanden ist', () => {
            const s = new ProjectStorage('non-existent');
            assert.doesNotThrow(() => s.clear());
        });

        it('löscht nur den eigenen Schlüssel, nicht andere', () => {
            const s1 = new ProjectStorage('k1');
            const s2 = new ProjectStorage('k2');
            s1.save({ a: 1 });
            s2.save({ b: 2 });
            s1.clear();
            assert.strictEqual(s1.load(), null);
            assert.deepStrictEqual(s2.load(), { b: 2 });
        });

    });


    // ── save – Fehlerverhalten ────────────────────────────────────────────────

    describe('save() – Fehlerverhalten', () => {

        it('wirft einen Fehler weiter (z. B. QuotaExceededError)', () => {
            const s = new ProjectStorage('quota-key');
            const err = new Error('Storage quota exceeded');
            err.name = 'QuotaExceededError';

            // Überschreibe setItem so, dass es immer wirft
            globalThis.localStorage.setItem = () => { throw err; };

            assert.throws(() => s.save({ data: 'x' }),
                { name: 'QuotaExceededError' });
        });

    });

});
