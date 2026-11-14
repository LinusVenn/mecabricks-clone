import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartInstance } from '../src/objects/PartInstance.js';

// ─── Hilfsfunktion ───────────────────────────────────────────────────────────

function makeInstance(overrides = {}) {
    const scene = new THREE.Scene();
    const geo   = new THREE.BoxGeometry(1, 1, 1);
    const mat   = new THREE.MeshBasicMaterial();
    const mesh  = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(mesh);

    return new PartInstance({
        scene,
        partId:          overrides.partId          ?? 'test_part',
        source:          overrides.source          ?? 'ldraw',
        object3D:        overrides.object3D        ?? group,
        color:           overrides.color           ?? 0xff0000,
        dimensions:      overrides.dimensions      ?? { width: 2, depth: 2, height: 1.2 },
        ldrawPartNumber: overrides.ldrawPartNumber ?? '3001',
        releaseGeometry: overrides.releaseGeometry ?? null,
        ...overrides,
    });
}

/** Erzeugt eine frische Szene + Gruppe + Mesh und gibt beides zurück. */
function makeSceneAndGroup() {
    const scene = new THREE.Scene();
    const geo   = new THREE.BoxGeometry(1, 1, 1);
    const mat   = new THREE.MeshBasicMaterial();
    const mesh  = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(mesh);
    return { scene, group };
}


// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PartInstance', () => {

    // 1. Erstellen ohne Fehler
    it('new PartInstance(opts) – erstellt Instanz ohne Fehler', () => {
        assert.doesNotThrow(() => makeInstance());
    });

    // 2. id ist ein nicht-leerer String
    it('id – ist ein nicht-leerer String', () => {
        const inst = makeInstance();
        assert.strictEqual(typeof inst.id, 'string');
        assert.ok(inst.id.length > 0);
    });

    // 3. id verwendet die übergebene ID
    it('id – verwendet die übergebene id, wenn angegeben', () => {
        const inst = makeInstance({ id: 'meine-feste-id' });
        assert.strictEqual(inst.id, 'meine-feste-id');
    });

    // 4. id wird automatisch generiert, wenn nicht angegeben
    it('id – generiert eindeutige IDs automatisch, wenn keine angegeben', () => {
        const a = makeInstance();
        const b = makeInstance();
        assert.notStrictEqual(a.id, b.id);
    });

    // 5. type entspricht partId (Abwärtskompatibilität)
    it('type – entspricht der partId (Abwärtskompatibilität)', () => {
        const inst = makeInstance({ partId: 'brick_2x4' });
        assert.strictEqual(inst.type, 'brick_2x4');
    });

    // 6. partId entspricht dem übergebenen Wert
    it('partId – entspricht dem übergebenen partId', () => {
        const inst = makeInstance({ partId: 'brick_2x4' });
        assert.strictEqual(inst.partId, 'brick_2x4');
    });

    // 7. source entspricht 'ldraw'
    it('source – entspricht dem übergebenen Wert "ldraw"', () => {
        const inst = makeInstance({ source: 'ldraw' });
        assert.strictEqual(inst.source, 'ldraw');
    });

    // 8. color entspricht dem übergebenen Farbwert
    it('color – entspricht dem übergebenen Farbwert', () => {
        const inst = makeInstance({ color: 0x4488ff });
        assert.strictEqual(inst.color, 0x4488ff);
    });

    // 9. width/depth/height entsprechen den Abmessungen
    it('width/depth/height – entsprechen den übergebenen Abmessungen', () => {
        const inst = makeInstance({ dimensions: { width: 3, depth: 5, height: 2.4 } });
        assert.strictEqual(inst.width,  3);
        assert.strictEqual(inst.depth,  5);
        assert.strictEqual(inst.height, 2.4);
    });

    // 10. geometry entspricht source
    it('geometry – entspricht source', () => {
        const inst = makeInstance({ source: 'ldraw' });
        assert.strictEqual(inst.geometry, 'ldraw');
    });

    // 11. studs ist false
    it('studs – ist false', () => {
        const inst = makeInstance();
        assert.strictEqual(inst.studs, false);
    });

    // 12. ldrawPartNumber entspricht dem übergebenen Wert
    it('ldrawPartNumber – entspricht dem übergebenen Wert', () => {
        const inst = makeInstance({ ldrawPartNumber: '3001.dat' });
        assert.strictEqual(inst.ldrawPartNumber, '3001.dat');
    });

    // 13. group ist eine THREE.Group-Instanz
    it('group – ist eine THREE.Group-Instanz', () => {
        const inst = makeInstance();
        assert.ok(inst.group instanceof THREE.Group);
    });

    // 14. group.userData.brickId entspricht instance.id
    it('group.userData.brickId – entspricht der Instanz-ID', () => {
        const inst = makeInstance({ id: 'test-id-42' });
        assert.strictEqual(inst.group.userData.brickId, 'test-id-42');
    });

    // 15. group.userData.type entspricht partId
    it('group.userData.type – entspricht der partId', () => {
        const inst = makeInstance({ partId: 'brick_2x2' });
        assert.strictEqual(inst.group.userData.type, 'brick_2x2');
    });

    // 16. group wird der Szene hinzugefügt
    it('group – wird der übergebenen Szene hinzugefügt', () => {
        const { scene, group } = makeSceneAndGroup();
        const inst = new PartInstance({
            scene,
            partId:     'test_part',
            source:     'ldraw',
            object3D:   group,
            color:      0xff0000,
            dimensions: { width: 2, depth: 2, height: 1.2 },
        });
        assert.ok(scene.children.includes(inst.group));
    });

    // 17. setTransform() aktualisiert group.position
    it('setTransform() – aktualisiert group.position', () => {
        const inst = makeInstance();
        inst.setTransform({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0 });
        assert.ok(Math.abs(inst.group.position.x - 1) < 1e-9);
        assert.ok(Math.abs(inst.group.position.y - 2) < 1e-9);
        assert.ok(Math.abs(inst.group.position.z - 3) < 1e-9);
    });

    // 18. setTransform() aktualisiert group.rotation
    it('setTransform() – aktualisiert group.rotation', () => {
        const inst = makeInstance();
        inst.setTransform({ x: 0, y: 0, z: 0 }, { x: 0.1, y: 0.2, z: 0.3 });
        assert.ok(Math.abs(inst.group.rotation.x - 0.1) < 1e-9);
        assert.ok(Math.abs(inst.group.rotation.y - 0.2) < 1e-9);
        assert.ok(Math.abs(inst.group.rotation.z - 0.3) < 1e-9);
    });

    // 19. setColor() aktualisiert _color
    it('setColor() – aktualisiert den internen Farbwert', () => {
        const inst = makeInstance({ color: 0xff0000 });
        inst.setColor(0x00ff00);
        assert.strictEqual(inst.color, 0x00ff00);
    });

    // 20. setColor() ignoriert nicht-finite Eingaben
    it('setColor() – ignoriert nicht-finite Eingaben (Farbe bleibt unverändert)', () => {
        const inst = makeInstance({ color: 0xff0000 });
        inst.setColor(NaN);
        assert.strictEqual(inst.color, 0xff0000);
        inst.setColor(Infinity);
        assert.strictEqual(inst.color, 0xff0000);
    });

    // 21. setColor() aktualisiert group.userData.color
    it('setColor() – aktualisiert group.userData.color', () => {
        const inst = makeInstance({ color: 0xff0000 });
        inst.setColor(0x0000ff);
        assert.strictEqual(inst.group.userData.color, 0x0000ff);
    });

    // 22. toData() gibt { id, type, color, position, rotation, source } zurück
    it('toData() – gibt alle Pflichtfelder zurück', () => {
        const inst = makeInstance({ id: 'inst-1', partId: 'brick_2x4', color: 0xaabbcc, source: 'ldraw' });
        const data = inst.toData();
        assert.ok('id'       in data, 'id fehlt');
        assert.ok('type'     in data, 'type fehlt');
        assert.ok('color'    in data, 'color fehlt');
        assert.ok('position' in data, 'position fehlt');
        assert.ok('rotation' in data, 'rotation fehlt');
        assert.ok('source'   in data, 'source fehlt');
        assert.strictEqual(data.id,    'inst-1');
        assert.strictEqual(data.type,  'brick_2x4');
        assert.strictEqual(data.color, 0xaabbcc);
        assert.strictEqual(data.source, 'ldraw');
    });

    // 23. toData() für ldraw-Quelle enthält ldrawPartNumber
    it('toData() – enthält ldrawPartNumber bei LDraw-Quelle', () => {
        const inst = makeInstance({ source: 'ldraw', ldrawPartNumber: '3001.dat' });
        const data = inst.toData();
        assert.strictEqual(data.ldrawPartNumber, '3001.dat');
    });

    // 24. dispose() entfernt group aus der Szene
    it('dispose() – entfernt die Gruppe aus der Szene', () => {
        const { scene, group } = makeSceneAndGroup();
        const inst = new PartInstance({
            scene,
            partId:     'test_part',
            source:     'ldraw',
            object3D:   group,
            color:      0xff0000,
            dimensions: { width: 2, depth: 2, height: 1.2 },
        });
        assert.ok(scene.children.includes(inst.group), 'Gruppe sollte vor dispose() in der Szene sein');
        inst.dispose();
        assert.ok(!scene.children.includes(inst.group), 'Gruppe sollte nach dispose() nicht mehr in der Szene sein');
    });

    // 25. dispose() ruft releaseGeometry-Callback auf
    it('dispose() – ruft den releaseGeometry-Callback auf', () => {
        let released = false;
        const inst = makeInstance({ releaseGeometry: () => { released = true; } });
        inst.dispose();
        assert.strictEqual(released, true);
    });

    // 26. dispose() ist idempotent
    it('dispose() – ist idempotent (zweiter Aufruf wirft keinen Fehler)', () => {
        let callCount = 0;
        const inst = makeInstance({ releaseGeometry: () => { callCount++; } });
        assert.doesNotThrow(() => {
            inst.dispose();
            inst.dispose();
        });
        // releaseGeometry wird nur einmal aufgerufen
        assert.strictEqual(callCount, 1);
    });

    // 27. Object3D, das kein Group ist, wird in eine neue Group eingehüllt
    it('object3D, das kein Group ist, wird in eine neue Group eingehüllt', () => {
        const { scene } = makeSceneAndGroup();
        const geo  = new THREE.BoxGeometry(1, 1, 1);
        const mat  = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geo, mat);  // kein Group

        const inst = new PartInstance({
            scene,
            partId:     'test_part',
            source:     'ldraw',
            object3D:   mesh,
            color:      0xff0000,
            dimensions: { width: 2, depth: 2, height: 1.2 },
        });

        assert.ok(inst.group instanceof THREE.Group);
        assert.ok(inst.group.children.includes(mesh),
            'Das Mesh sollte als Kind der neuen Group enthalten sein');
    });

});
