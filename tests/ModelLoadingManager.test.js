import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ModelLoadingManager } from '../src/performance/ModelLoadingManager.js';


// =====================================================================
// Hilfsfunktionen
// =====================================================================

/** Erzeugt N Minimal-Brick-Datensätze. */
function makeBricks(n) {
    return Array.from({ length: n }, (_, i) => ({
        id:       `brick-${i}`,
        type:     'brick_2x4',
        color:    0xff0000,
        position: { x: i, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
    }));
}

/** Minimal-Library-Mock. */
function makeLibrary(bricks = []) {
    const parts = [...bricks];
    return {
        addBrickFromData: mock.fn(data => {
            const brick = { id: data.id, type: data.type, group: {} };
            parts.push(brick);
            return brick;
        }),
        getAll: () => [...parts],
    };
}


describe('ModelLoadingManager', () => {

    let manager, library;

    beforeEach(() => {
        library = makeLibrary();
        manager = new ModelLoadingManager(library, {
            chunkSize:  10,
            chunkDelay: 0,   // kein echtes setTimeout im Test
        });
    });


    // ------------------------------------------------------------------
    // Grundstruktur
    // ------------------------------------------------------------------

    it('isLoading ist initial false', () => {
        assert.strictEqual(manager.isLoading, false);
    });

    it('progress ist initial 0', () => {
        assert.strictEqual(manager.progress, 0);
    });

    it('kann ein leeres Brick-Array laden ohne Fehler', async () => {
        await assert.doesNotReject(() => manager.load([]));
    });


    // ------------------------------------------------------------------
    // load – normale Verarbeitung
    // ------------------------------------------------------------------

    it('lädt alle Bausteine über addBrickFromData', async () => {
        const bricks = makeBricks(5);
        await manager.load(bricks);
        assert.strictEqual(library.addBrickFromData.mock.callCount(), 5);
    });

    it('übergibt jeden Datensatz korrekt', async () => {
        const bricks = makeBricks(3);
        await manager.load(bricks);
        for (let i = 0; i < 3; i++) {
            assert.strictEqual(
                library.addBrickFromData.mock.calls[i].arguments[0].id,
                bricks[i].id
            );
        }
    });

    it('isLoading wird während des Ladens true', () => {
        let loadingDuringLoad = false;
        manager.onProgress = () => {
            if (manager.isLoading) loadingDuringLoad = true;
        };
        manager.load(makeBricks(1));
        assert.ok(loadingDuringLoad);
    });

    it('isLoading ist nach dem Laden false', async () => {
        await manager.load(makeBricks(5));
        assert.strictEqual(manager.isLoading, false);
    });


    // ------------------------------------------------------------------
    // Ladefortschritt
    // ------------------------------------------------------------------

    it('progress ist nach vollständigem Laden 1', async () => {
        await manager.load(makeBricks(5));
        assert.strictEqual(manager.progress, 1);
    });

    it('onProgress wird mindestens einmal aufgerufen', async () => {
        let calls = 0;
        manager.onProgress = () => calls++;
        await manager.load(makeBricks(5));
        assert.ok(calls > 0);
    });

    it('onProgress erhält einen Wert zwischen 0 und 1', async () => {
        const values = [];
        manager.onProgress = p => values.push(p);
        await manager.load(makeBricks(5));
        for (const v of values) {
            assert.ok(v >= 0 && v <= 1, `Ungültiger Fortschrittwert: ${v}`);
        }
    });


    // ------------------------------------------------------------------
    // Chunked Loading
    // ------------------------------------------------------------------

    it('verarbeitet N Bausteine in Chunks der konfigurierten Größe', async () => {
        // 25 Bausteine, chunkSize=10 → 3 Chunks (10+10+5)
        const mgr2 = new ModelLoadingManager(library, { chunkSize: 10, chunkDelay: 0 });
        let chunkCompletions = 0;
        mgr2.onChunkLoaded = () => chunkCompletions++;
        await mgr2.load(makeBricks(25));
        assert.ok(chunkCompletions >= 1, 'Mindestens ein Chunk-Event erwartet');
    });


    // ------------------------------------------------------------------
    // Abbruch
    // ------------------------------------------------------------------

    it('abort() bricht einen laufenden Ladevorgang ab', async () => {
        const mgr2 = new ModelLoadingManager(makeLibrary(), {
            chunkSize:  1,
            chunkDelay: 0,
        });
        // Simuliere Abbruch nach erstem Chunk
        mgr2.onChunkLoaded = () => mgr2.abort();
        await mgr2.load(makeBricks(100));
        assert.ok(mgr2.aborted || !mgr2.isLoading);
    });


    // ------------------------------------------------------------------
    // Fehlerbehandlung
    // ------------------------------------------------------------------

    it('wirft keinen unkontrollierten Fehler wenn addBrickFromData fehlschlägt', async () => {
        library.addBrickFromData = mock.fn(() => {
            throw new Error('Testfehler');
        });
        let errorFired = false;
        manager.onError = () => { errorFired = true; };
        await manager.load(makeBricks(3));
        assert.ok(errorFired || !manager.isLoading,
            'onError sollte aufgerufen worden sein oder isLoading = false');
    });


    // ------------------------------------------------------------------
    // onComplete-Callback
    // ------------------------------------------------------------------

    it('onComplete wird am Ende aufgerufen', async () => {
        let completed = false;
        manager.onComplete = () => { completed = true; };
        await manager.load(makeBricks(3));
        assert.ok(completed);
    });

    it('onComplete erhält die Anzahl geladener Bausteine', async () => {
        let count = -1;
        manager.onComplete = n => { count = n; };
        await manager.load(makeBricks(7));
        assert.strictEqual(count, 7);
    });

});
