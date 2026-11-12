import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PartLibrary }       from '../src/objects/PartLibrary.js';
import { ConnectionManager } from '../src/editor/ConnectionManager.js';
import { HistoryManager }    from '../src/history/HistoryManager.js';


// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function makeEnv() {
    const scene             = new THREE.Scene();
    const library           = new PartLibrary(scene);
    const connectionManager = new ConnectionManager();
    const hm                = new HistoryManager(library, connectionManager);
    hm.initialize();
    return { library, connectionManager, hm };
}


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('HistoryManager', () => {


    // ── Initialisierung ───────────────────────────────────────────────────────

    describe('Initialisierung', () => {

        it('canUndo() ist false nach initialize()', () => {
            const { hm } = makeEnv();
            assert.strictEqual(hm.canUndo(), false);
        });

        it('canRedo() ist false nach initialize()', () => {
            const { hm } = makeEnv();
            assert.strictEqual(hm.canRedo(), false);
        });

        it('getHistoryLength() ist 1 nach initialize()', () => {
            const { hm } = makeEnv();
            assert.strictEqual(hm.getHistoryLength(), 1);
        });

        it('currentIndex ist 0 nach initialize()', () => {
            const { hm } = makeEnv();
            assert.strictEqual(hm.currentIndex, 0);
        });

        it('initialize() setzt einen vorherigen Zustand zurück', () => {
            const { hm } = makeEnv();
            hm.saveState();
            hm.saveState();
            hm.initialize();
            assert.strictEqual(hm.getHistoryLength(), 1);
        });

    });


    // ── saveState ────────────────────────────────────────────────────────────

    describe('saveState()', () => {

        it('gibt true zurück wenn ein neuer Zustand gespeichert wurde', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            assert.strictEqual(hm.saveState(), true);
        });

        it('gibt false zurück wenn sich der Zustand nicht geändert hat', () => {
            const { hm } = makeEnv();
            assert.strictEqual(hm.saveState(), false);
        });

        it('erhöht die History-Länge um 1', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            assert.strictEqual(hm.getHistoryLength(), 2);
        });

        it('canUndo() ist true nach einer Modelländerung + saveState()', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            assert.strictEqual(hm.canUndo(), true);
        });

        it('ruft onChange auf wenn neuer Zustand gespeichert wird', () => {
            const { hm, library } = makeEnv();
            let called = false;
            hm.onChange = () => { called = true; };

            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();

            assert.strictEqual(called, true);
        });

        it('ruft onChange NICHT auf wenn Zustand identisch ist', () => {
            const { hm } = makeEnv();
            let calls = 0;
            hm.onChange = () => { calls++; };

            hm.saveState(); // identisch

            assert.strictEqual(calls, 0);
        });

        it('ruft onHistoryChange mit (canUndo, canRedo) auf', () => {
            const { hm, library } = makeEnv();
            let args = null;
            hm.onHistoryChange = (canUndo, canRedo) => { args = { canUndo, canRedo }; };

            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();

            assert.ok(args !== null);
            assert.strictEqual(args.canUndo, true);
            assert.strictEqual(args.canRedo, false);
        });

        it('ruft onHistoryChange NICHT auf wenn Zustand identisch ist', () => {
            const { hm } = makeEnv();
            let calls = 0;
            hm.onHistoryChange = () => { calls++; };

            hm.saveState(); // identisch

            assert.strictEqual(calls, 0);
        });

    });


    // ── undo ─────────────────────────────────────────────────────────────────

    describe('undo()', () => {

        it('gibt false zurück wenn canUndo() false ist', () => {
            const { hm } = makeEnv();
            assert.strictEqual(hm.undo(), false);
        });

        it('gibt true zurück wenn erfolgreich rückgängig gemacht', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            assert.strictEqual(hm.undo(), true);
        });

        it('stellt vorherigen Modellzustand wieder her', () => {
            const { hm, library } = makeEnv();
            // Zustand 0: leer
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            // Zustand 1: 1 Stein

            hm.undo();
            // Zurück zu Zustand 0
            assert.strictEqual(library.getCount(), 0);
        });

        it('canRedo() ist true nach undo()', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();
            assert.strictEqual(hm.canRedo(), true);
        });

        it('ruft onChange auf', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();

            let called = false;
            hm.onChange = () => { called = true; };
            hm.undo();

            assert.strictEqual(called, true);
        });

        it('ruft onHistoryChange mit korrekten Werten auf', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();

            let args = null;
            hm.onHistoryChange = (canUndo, canRedo) => { args = { canUndo, canRedo }; };
            hm.undo();

            assert.ok(args !== null);
            assert.strictEqual(args.canUndo, false); // am Anfang
            assert.strictEqual(args.canRedo, true);
        });

        it('ruft onRestore auf', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();

            let called = false;
            hm.onRestore = () => { called = true; };
            hm.undo();

            assert.strictEqual(called, true);
        });

    });


    // ── redo ─────────────────────────────────────────────────────────────────

    describe('redo()', () => {

        it('gibt false zurück wenn canRedo() false ist', () => {
            const { hm } = makeEnv();
            assert.strictEqual(hm.redo(), false);
        });

        it('gibt true zurück wenn erfolgreich wiederholt', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();
            assert.strictEqual(hm.redo(), true);
        });

        it('stellt den Zustand nach einem Undo wieder her', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();
            hm.redo();
            assert.strictEqual(library.getCount(), 1);
        });

        it('canRedo() ist false nach redo() bis zum Ende', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();
            hm.redo();
            assert.strictEqual(hm.canRedo(), false);
        });

        it('ruft onChange auf', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();

            let called = false;
            hm.onChange = () => { called = true; };
            hm.redo();

            assert.strictEqual(called, true);
        });

        it('ruft onHistoryChange mit korrekten Werten auf', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();

            let args = null;
            hm.onHistoryChange = (canUndo, canRedo) => { args = { canUndo, canRedo }; };
            hm.redo();

            assert.ok(args !== null);
            assert.strictEqual(args.canUndo, true);
            assert.strictEqual(args.canRedo, false);
        });

        it('ruft onRestore auf', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();

            let called = false;
            hm.onRestore = () => { called = true; };
            hm.redo();

            assert.strictEqual(called, true);
        });

    });


    // ── Undo dann neue Aktion verwirft Redo-Stack ─────────────────────────────

    describe('Undo → neue Aktion verwirft Redo-Stack', () => {

        it('canRedo() ist false nach neuer Aktion nach Undo', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();

            // Neue Aktion
            library.addBrick(4, 0, 0, 0x00ff00);
            hm.saveState();

            assert.strictEqual(hm.canRedo(), false);
        });

        it('History enthält nach neuer Aktion post-Undo nur 2 Einträge', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState(); // Zustand 1
            library.addBrick(4, 0, 0, 0x00ff00);
            hm.saveState(); // Zustand 2

            hm.undo(); // zurück zu Zustand 1
            // Neue Aktion von Zustand 1 aus
            library.addBrick(0, 0, 4, 0x0000ff);
            hm.saveState();

            // Zustand 0 (leer) + Zustand 1 (1 Stein) + neuer Zustand 2
            assert.strictEqual(hm.getHistoryLength(), 3);
        });

    });


    // ── maxHistory Limit ─────────────────────────────────────────────────────

    describe('maxHistory-Limit', () => {

        it('überschreitet maxHistory nie', () => {
            const scene  = new THREE.Scene();
            const lib    = new PartLibrary(scene);
            const cm     = new ConnectionManager();
            const hm     = new HistoryManager(lib, cm, 3); // max 3
            hm.initialize();

            // 4 verschiedene Zustände erzeugen
            for (let i = 0; i < 4; i++) {
                lib.addBrick(i, 0, 0, 0xff0000);
                hm.saveState();
            }

            assert.ok(hm.getHistoryLength() <= 3);
        });

        it('älteste Zustände werden verworfen', () => {
            const scene = new THREE.Scene();
            const lib   = new PartLibrary(scene);
            const cm    = new ConnectionManager();
            const hm    = new HistoryManager(lib, cm, 2); // max 2
            hm.initialize();

            lib.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            lib.addBrick(4, 0, 0, 0x00ff00);
            hm.saveState();

            // Jetzt ist die History voll (max 2).
            // canUndo muss true sein (currentIndex > 0)
            assert.strictEqual(hm.canUndo(), true);
            assert.strictEqual(hm.getHistoryLength(), 2);
        });

    });


    // ── clear ────────────────────────────────────────────────────────────────

    describe('clear()', () => {

        it('setzt die History auf einen einzelnen Eintrag zurück', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.clear();
            assert.strictEqual(hm.getHistoryLength(), 1);
        });

        it('canUndo() ist false nach clear()', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.clear();
            assert.strictEqual(hm.canUndo(), false);
        });

        it('canRedo() ist false nach clear()', () => {
            const { hm, library } = makeEnv();
            library.addBrick(0, 0, 0, 0xff0000);
            hm.saveState();
            hm.undo();
            hm.clear();
            assert.strictEqual(hm.canRedo(), false);
        });

    });

});
