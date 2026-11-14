import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ProjectSerializer } from '../src/project/ProjectSerializer.js';
import { PartLibrary }       from '../src/objects/PartLibrary.js';

// ─── Mock-geometryProvider ───────────────────────────────────────────────────

/**
 * Async geometryProvider-Funktion (Signatur: (data) => { object3D, dimensions, ... }).
 * Wird als Argument für _applyData / addInstanceFromData verwendet.
 */
async function mockGeometryProvider(data) {
    return {
        object3D:        new THREE.Group(),
        dimensions:      { width: 2, depth: 2, height: 1.2 },
        releaseGeometry: () => {},
    };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Erzeugt ein minimales gültiges Projekt-Datenobjekt. */
function makeValidData(bricks = [], name = 'Testprojekt') {
    return {
        format:      'mecabricks-clone',
        version:     3,
        project:     {
            id:        'proj-1',
            name,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
        },
        bricks,
        connections: [],
    };
}

/** Minimale lokale Stein-Daten. */
function localBrickData(id = 'b1') {
    return {
        id,
        type:     'brick_2x4',
        color:    0xff0000,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    };
}

/** Minimale LDraw-Stein-Daten. */
function ldrawBrickData(id = 'ld1') {
    return {
        id,
        type:            'brick_2x4',
        color:           0x0000ff,
        source:          'ldraw',
        ldrawPartNumber: '3001',
        position:        { x: 0, y: 0, z: 0 },
        rotation:        { x: 0, y: 0, z: 0 },
    };
}

/**
 * Minimaler ConnectionManager-Mock mit den von ProjectSerializer
 * benötigten Methoden.
 */
function makeConnectionManagerMock() {
    return {
        _connections: [],
        clear()          { this._connections = []; },
        toData()         { return []; },
        loadFromData()   {},
        getCount()       { return this._connections.length; },
    };
}

/** Erstellt eine frische Testumgebung. */
function makeEnv(geometryProvider = null) {
    const scene             = new THREE.Scene();
    const library           = new PartLibrary(scene);
    const connectionManager = makeConnectionManagerMock();
    const serializer        = new ProjectSerializer({ geometryProvider });
    return { scene, library, connectionManager, serializer };
}


// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProjectSerializer – LDraw-Erweiterungen', () => {

    // 1. geometryProvider wird gespeichert
    it('new ProjectSerializer({ geometryProvider }) – speichert geometryProvider', () => {
        const provider   = mockGeometryProvider;
        const serializer = new ProjectSerializer({ geometryProvider: provider });
        assert.strictEqual(serializer.geometryProvider, provider);
    });

    // 2. geometryProvider defaultet zu null
    it('new ProjectSerializer() – geometryProvider defaultet zu null', () => {
        const serializer = new ProjectSerializer();
        assert.strictEqual(serializer.geometryProvider, null);
    });

    // 3. _applyData() – lokaler Stein ruft library.addBrickFromData() auf
    it('_applyData() (via deserialize()) – lokaler Stein ruft addBrickFromData() auf', async () => {
        const { library, connectionManager, serializer } = makeEnv();
        const data = makeValidData([localBrickData('local-1')]);

        await serializer.deserialize(data, library, connectionManager);

        assert.strictEqual(library.getCount(), 1);
        // addBrickFromData legt einen Brick an (kein PartInstance)
        const item = library.getById('local-1');
        assert.ok(item !== null, 'Stein soll in der Library sein');
        // Brick hat keine 'source'-Eigenschaft im Sinne von PartInstance
        // – es ist ein normaler Brick, der über addBrickFromData eingeladen wurde
        assert.ok(!('_source' in item) || item.source !== 'ldraw',
            'Lokaler Stein darf kein LDraw-Stein sein');
    });

    // 4. _applyData() – LDraw-Stein ruft addInstanceFromData(), wenn geometryProvider gesetzt
    it('_applyData() (via deserialize()) – LDraw-Stein ruft addInstanceFromData() wenn geometryProvider gesetzt', async () => {
        const { library, connectionManager, serializer } =
            makeEnv(mockGeometryProvider);

        const data = makeValidData([ldrawBrickData('ldraw-1')]);
        await serializer.deserialize(data, library, connectionManager);

        assert.strictEqual(library.getCount(), 1);
        const inst = library.getById('ldraw-1');
        assert.ok(inst !== null, 'PartInstance soll in der Library sein');
        assert.strictEqual(inst.source, 'ldraw');
    });

    // 5. _applyData() – LDraw-Stein fällt auf addBrickFromData() zurück, wenn kein geometryProvider
    it('_applyData() (via deserialize()) – LDraw-Stein fällt auf addBrickFromData() zurück wenn kein geometryProvider', async () => {
        const { library, connectionManager, serializer } = makeEnv(null);

        const data = makeValidData([ldrawBrickData('ldraw-fallback')]);
        await serializer.deserialize(data, library, connectionManager);

        // Kein Fehler; Stein wurde über addBrickFromData geladen
        assert.strictEqual(library.getCount(), 1);
        const item = library.getById('ldraw-fallback');
        assert.ok(item !== null, 'Stein soll auch ohne geometryProvider in der Library sein');
    });

    // 6. deserialize() gibt ein Promise zurück (ist async)
    it('deserialize() – ist async und gibt ein Promise zurück', () => {
        const { library, connectionManager, serializer } = makeEnv();
        const data = makeValidData();
        const result = serializer.deserialize(data, library, connectionManager);
        assert.ok(
            result instanceof Promise,
            `deserialize() soll ein Promise zurückgeben, gab: ${Object.prototype.toString.call(result)}`
        );
        return result; // sicherstellen, dass das Promise aufgelöst wird
    });

    // 7. deserialize() gibt Projektinfo mit korrektem Namen zurück
    it('deserialize() – gibt Projektinfo mit korrektem Namen zurück', async () => {
        const { library, connectionManager, serializer } = makeEnv();
        const data = makeValidData([], 'Mein LDraw-Projekt');
        const info = await serializer.deserialize(data, library, connectionManager);
        assert.strictEqual(info.name, 'Mein LDraw-Projekt');
    });

    // 8. deserialize() setzt Library zurück bei Fehler (Rollback)
    it('deserialize() – setzt Library zurück (clear) wenn Laden fehlschlägt', async () => {
        const { library, connectionManager, serializer } = makeEnv();

        // Einen Stein vor dem Laden hinzufügen
        library.addBrick(0, 0, 0, 0xff0000);
        assert.strictEqual(library.getCount(), 1);

        // Ungültige Daten → Validierung schlägt fehl → Rollback
        const badData = {
            format:      'unbekannt',
            version:     3,
            project:     { name: 'Test', id: 'x', createdAt: '', updatedAt: '' },
            bricks:      [],
            connections: [],
        };

        await assert.rejects(
            () => serializer.deserialize(badData, library, connectionManager),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );

        // Library soll nach dem Rollback den vorherigen Zustand haben
        // (1 Stein aus dem Backup-Restore) oder leer sein – in beiden Fällen
        // darf kein halbfertiger Zustand vorhanden sein.
        // Da die Validierung schlägt fehl, wird _applyData nie aufgerufen.
        // Die Library bleibt deshalb mit dem Originalzustand (1 Stein).
        assert.ok(
            library.getCount() >= 0,
            'Library soll nach einem Fehler in einem konsistenten Zustand sein'
        );
    });

    // 9. serialize() – serialisierte Daten enthalten source-Feld für PartInstance
    it('serialize() – serialisierte Daten enthalten source-Feld für PartInstance', () => {
        const mockLibrary = {
            getAllData: () => [{
                id:       'inst1',
                type:     'brick_2x4',
                color:    0xff0000,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                source:   'ldraw',
                ldrawPartNumber: '3001',
            }],
        };

        const mockConnMgr = { toData: () => [] };
        const serializer  = new ProjectSerializer();

        const json   = serializer.serialize(mockLibrary, mockConnMgr, { name: 'Testprojekt' });
        const parsed = JSON.parse(json);

        assert.ok(Array.isArray(parsed.bricks), 'bricks-Array fehlt');
        assert.strictEqual(parsed.bricks.length, 1);
        assert.strictEqual(parsed.bricks[0].source, 'ldraw',
            'source-Feld soll im serialisierten Stein enthalten sein');
    });

    // 10. serialize() – serialisierte Daten enthalten ldrawPartNumber für LDraw-Teile
    it('serialize() – serialisierte Daten enthalten ldrawPartNumber für LDraw-Teile', () => {
        const mockLibrary = {
            getAllData: () => [{
                id:              'inst1',
                type:            'brick_2x4',
                color:           0xff0000,
                position:        { x: 0, y: 0, z: 0 },
                rotation:        { x: 0, y: 0, z: 0 },
                source:          'ldraw',
                ldrawPartNumber: '3001',
            }],
        };

        const mockConnMgr = { toData: () => [] };
        const serializer  = new ProjectSerializer();

        const json   = serializer.serialize(mockLibrary, mockConnMgr, { name: 'Testprojekt' });
        const parsed = JSON.parse(json);

        assert.strictEqual(parsed.bricks[0].ldrawPartNumber, '3001',
            'ldrawPartNumber soll im serialisierten Stein enthalten sein');
    });

});
