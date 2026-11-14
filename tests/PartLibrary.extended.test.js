import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartLibrary } from '../src/objects/PartLibrary.js';
import { PartInstance } from '../src/objects/PartInstance.js';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makeScene() { return new THREE.Scene(); }

/**
 * Erzeugt Optionen für addInstance().
 * Die Gruppe wird bereits vorab zur Szene hinzugefügt, damit
 * PartInstance (das sie in der Szene sucht) korrekt arbeitet –
 * PartLibrary injiziert die eigene Szene via addInstance(), daher
 * darf object3D einfach eine frische Group sein.
 */
function makeInstanceOptions(id = 'i1') {
    const group = new THREE.Group();
    return {
        id,
        partId:          'test_part',
        source:          'ldraw',
        object3D:        group,
        color:           0x4488ff,
        dimensions:      { width: 2, depth: 2, height: 1.2 },
        ldrawPartNumber: '3001',
    };
}

/** Mock-geometryProvider für addInstanceFromData(). */
const mockProvider = {
    getGeometry: async (partId) => ({
        partId,
        source:          'ldraw',
        object3D:        new THREE.Group(),
        dimensions:      { width: 2, depth: 2, height: 1.2 },
        release:         () => {},
        ldrawPartNumber: '3001',
    }),
};

/**
 * Async-Funktion, die addInstanceFromData() als geometryProvider-Argument
 * erwartet (Signatur: async (data) => { object3D, dimensions, ... }).
 */
async function geometryProviderFn(data) {
    return {
        object3D:        new THREE.Group(),
        dimensions:      { width: 2, depth: 2, height: 1.2 },
        releaseGeometry: () => {},
    };
}


// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PartLibrary (PartInstance-Erweiterungen)', () => {

    let scene, library;

    beforeEach(() => {
        scene   = makeScene();
        library = new PartLibrary(scene);
    });


    // 1. addInstance gibt eine PartInstance zurück
    it('addInstance() – gibt eine PartInstance zurück', () => {
        const inst = library.addInstance(makeInstanceOptions('inst-1'));
        assert.ok(inst instanceof PartInstance);
    });

    // 2. addInstance – Instanz erscheint in getAll()
    it('addInstance() – Instanz ist in getAll() enthalten', () => {
        const inst = library.addInstance(makeInstanceOptions('inst-2'));
        assert.ok(library.getAll().includes(inst));
    });

    // 3. addInstance – Instanz per getById() abrufbar
    it('addInstance() – Instanz ist über getById(id) abrufbar', () => {
        const inst = library.addInstance(makeInstanceOptions('inst-3'));
        assert.strictEqual(library.getById('inst-3'), inst);
    });

    // 4. addInstance – hasId gibt true zurück
    it('addInstance() – hasId gibt true zurück', () => {
        library.addInstance(makeInstanceOptions('inst-4'));
        assert.strictEqual(library.hasId('inst-4'), true);
    });

    // 5. addInstance mit doppelter ID wirft Fehler
    it('addInstance() – wirft bei doppelter ID einen Fehler', () => {
        library.addInstance(makeInstanceOptions('doppelt'));
        assert.throws(
            () => library.addInstance(makeInstanceOptions('doppelt')),
            { message: /doppelt/ }
        );
    });

    // 6. getAll() gibt Bricks UND PartInstances zurück
    it('getAll() – gibt sowohl Bricks als auch PartInstances zurück', () => {
        library.addBrick(0, 0, 0, 0xff0000);
        library.addInstance(makeInstanceOptions('mix-inst'));
        const all = library.getAll();
        assert.strictEqual(all.length, 2);
    });

    // 7. getCount() berücksichtigt PartInstances
    it('getCount() – berücksichtigt die Anzahl der PartInstances', () => {
        library.addBrick(0, 0, 0, 0xff0000);
        library.addInstance(makeInstanceOptions('cnt-inst'));
        assert.strictEqual(library.getCount(), 2);
    });

    // 8. getAllData() enthält toData()-Ausgabe der PartInstance
    it('getAllData() – enthält die toData()-Ausgabe der PartInstance', () => {
        const inst = library.addInstance(makeInstanceOptions('data-inst'));
        const allData = library.getAllData();
        const found = allData.find(d => d.id === inst.id);
        assert.ok(found !== undefined, 'toData-Eintrag der PartInstance nicht gefunden');
    });

    // 9. getAllData() – PartInstance-Eintrag hat source-Feld
    it('getAllData() – PartInstance-Eintrag enthält das source-Feld', () => {
        library.addInstance(makeInstanceOptions('src-inst'));
        const allData = library.getAllData();
        const instData = allData.find(d => d.id === 'src-inst');
        assert.ok(instData !== undefined);
        assert.ok('source' in instData, 'source-Feld fehlt im toData()-Ergebnis');
        assert.strictEqual(instData.source, 'ldraw');
    });

    // 10. removeBrick() mit PartInstance gibt true zurück und entfernt sie
    it('removeBrick() – gibt true zurück und entfernt die PartInstance', () => {
        const inst = library.addInstance(makeInstanceOptions('rm-inst'));
        const result = library.removeBrick(inst);
        assert.strictEqual(result, true);
        assert.strictEqual(library.getCount(), 0);
    });

    // 11. removeBrick() – getById gibt null zurück nach Entfernung
    it('removeBrick() – getById gibt null zurück nach Entfernung', () => {
        const inst = library.addInstance(makeInstanceOptions('rm-inst-2'));
        library.removeBrick(inst);
        assert.strictEqual(library.getById('rm-inst-2'), null);
    });

    // 12. removeBrick() – ruft dispose() auf (releaseGeometry-Callback wird aufgerufen)
    it('removeBrick() – ruft dispose() auf der PartInstance auf', () => {
        let released = false;
        const opts = {
            ...makeInstanceOptions('rm-dispose'),
            releaseGeometry: () => { released = true; },
        };
        const inst = library.addInstance(opts);
        library.removeBrick(inst);
        assert.strictEqual(released, true);
    });

    // 13. clear() leert auch PartInstances
    it('clear() – leert auch die PartInstance-Sammlung', () => {
        library.addBrick(0, 0, 0, 0xff0000);
        library.addInstance(makeInstanceOptions('clr-inst'));
        library.clear();
        assert.strictEqual(library.getCount(), 0);
        assert.deepStrictEqual(library.getAll(), []);
    });

    // 14. getById() findet einen Brick anhand der ID
    it('getById() – findet einen Brick anhand der ID', () => {
        const brick = library.addBrick(0, 0, 0, 0xff0000);
        assert.strictEqual(library.getById(brick.id), brick);
    });

    // 15. getById() findet eine PartInstance anhand der ID
    it('getById() – findet eine PartInstance anhand der ID', () => {
        const inst = library.addInstance(makeInstanceOptions('find-inst'));
        assert.strictEqual(library.getById('find-inst'), inst);
    });

    // 16. getById() gibt null bei unbekannter ID zurück
    it('getById() – gibt null bei unbekannter ID zurück', () => {
        assert.strictEqual(library.getById('existiert-nicht'), null);
    });

    // 17. hasId() – true für einen Brick
    it('hasId() – gibt true für einen registrierten Brick zurück', () => {
        const brick = library.addBrick(0, 0, 0, 0xff0000);
        assert.strictEqual(library.hasId(brick.id), true);
    });

    // 18. hasId() – true für eine PartInstance
    it('hasId() – gibt true für eine registrierte PartInstance zurück', () => {
        library.addInstance(makeInstanceOptions('has-inst'));
        assert.strictEqual(library.hasId('has-inst'), true);
    });

    // 19. hasId() – false bei unbekannter ID
    it('hasId() – gibt false bei unbekannter ID zurück', () => {
        assert.strictEqual(library.hasId('unbekannt'), false);
    });

    // 20. addInstanceFromData() – async, verwendet geometryProvider-Mock
    it('addInstanceFromData() – async, lädt Instanz über geometryProvider', async () => {
        const data = {
            id:              'from-data-1',
            type:            'test_part',
            color:           0x4488ff,
            source:          'ldraw',
            ldrawPartNumber: '3001',
            position:        { x: 0, y: 0, z: 0 },
            rotation:        { x: 0, y: 0, z: 0 },
        };

        const inst = await library.addInstanceFromData(data, geometryProviderFn);

        assert.ok(inst instanceof PartInstance, 'Ergebnis soll eine PartInstance sein');
        assert.strictEqual(inst.id, 'from-data-1');
        assert.strictEqual(library.getById('from-data-1'), inst);
    });

});
