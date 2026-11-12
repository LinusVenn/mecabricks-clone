import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Brick } from '../src/objects/Brick.js';

describe('Brick', () => {

    let scene;

    beforeEach(() => { scene = new THREE.Scene(); });

    it('hat eine String-ID im Format brick-{uuid}', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.strictEqual(typeof brick.id, 'string');
        assert.ok(brick.id.startsWith('brick-'));
    });

    it('zwei Instanzen haben unterschiedliche IDs', () => {
        const b1 = new Brick(scene, 0, 0, 0, 0xff0000);
        const b2 = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.notStrictEqual(b1.id, b2.id);
    });

    it('hat den Standardtyp brick_2x4', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.strictEqual(brick.type, 'brick_2x4');
    });

    it('akzeptiert anderen Typ (brick_2x2)', () => {
        const brick = new Brick(scene, 0, 0, 0, 0x00ff00, 'brick_2x2');
        assert.strictEqual(brick.type, 'brick_2x2');
    });

    it('wirft einen Fehler bei unbekanntem Typ', () => {
        assert.throws(
            () => new Brick(scene, 0, 0, 0, 0xff0000, 'brick_99x99'),
            { message: /Unbekannter Bauteiltyp/ }
        );
    });

    // PartDefinitions: brick_2x4 = { width:4, depth:2, height:1.2 }
    //                 brick_1x2 = { width:2, depth:1, height:1.2 }
    it('setzt Breite, Tiefe, Höhe aus PartDefinitions (brick_2x4)', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000, 'brick_2x4');
        assert.strictEqual(brick.width,  4);
        assert.strictEqual(brick.depth,  2);
        assert.strictEqual(brick.height, 1.2);
    });

    it('setzt Breite, Tiefe, Höhe für brick_1x2', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000, 'brick_1x2');
        assert.strictEqual(brick.width,  2);
        assert.strictEqual(brick.depth,  1);
    });

    it('setzt die Startposition direkt im Konstruktor', () => {
        const brick = new Brick(scene, 2, 0, 4, 0xff0000);
        assert.ok(Math.abs(brick.group.position.x - 2) < 1e-9);
        assert.ok(Math.abs(brick.group.position.z - 4) < 1e-9);
    });

    it('fügt die Gruppe zur Szene hinzu', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.ok(scene.children.includes(brick.group));
    });

    it('speichert brickId in group.userData', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.strictEqual(brick.group.userData.brickId, brick.id);
    });

    it('speichert type in group.userData', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.strictEqual(brick.group.userData.type, 'brick_2x4');
    });

    it('brick_2x4 hat 9 Kinder (1 Körper + 8 Studs: 2×4)', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.strictEqual(brick.group.children.length, 9);
    });

    it('brick_2x2 hat 5 Kinder (1 Körper + 4 Studs: 2×2)', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000, 'brick_2x2');
        assert.strictEqual(brick.group.children.length, 5);
    });

    it('brick_1x2 hat 3 Kinder (1 Körper + 2 Studs: 1×2)', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000, 'brick_1x2');
        assert.strictEqual(brick.group.children.length, 3);
    });

    it('group ist eine THREE.Group', () => {
        const brick = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.ok(brick.group.isGroup);
    });


    // ── Farb-Validierung im Konstruktor ───────────────────────────

    it('wirft bei ungültiger Farbe (String "rot")', () => {
        assert.throws(
            () => new Brick(scene, 0, 0, 0, 'rot'),
            { message: /Ungültige Steinfarbe/ }
        );
    });

    it('akzeptiert Farbe 0 (schwarz)', () => {
        const b = new Brick(scene, 0, 0, 0, 0x000000);
        assert.strictEqual(b.color, 0x000000);
    });

    it('speichert numerische Farbe in brick.color', () => {
        const b = new Brick(scene, 0, 0, 0, 0x00ff00);
        assert.strictEqual(b.color, 0x00ff00);
    });

    it('speichert Farbe in group.userData.color', () => {
        const b = new Brick(scene, 0, 0, 0, 0xabcdef);
        assert.strictEqual(b.group.userData.color, 0xabcdef);
    });


    // ── Benutzerdefinierte ID ──────────────────────────────────────

    it('akzeptiert eine benutzerdefinierte ID', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'brick_2x4', 'mein-stein-1');
        assert.strictEqual(b.id, 'mein-stein-1');
    });

    it('benutzerdefinierte ID wird in group.userData gespeichert', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'brick_2x4', 'custom-id-42');
        assert.strictEqual(b.group.userData.brickId, 'custom-id-42');
    });


    // ── Kinderzahl nach Geometrietyp ──────────────────────────────

    it('plate_2x4 hat 9 Kinder (1 Körper + 8 Studs)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'plate_2x4');
        assert.strictEqual(b.group.children.length, 9);
    });

    it('plate_1x2 hat 3 Kinder (1 Körper + 2 Studs)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'plate_1x2');
        assert.strictEqual(b.group.children.length, 3);
    });

    it('tile_1x2 hat 1 Kind (nur Körper, keine Noppen)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'tile_1x2');
        assert.strictEqual(b.group.children.length, 1);
    });

    it('tile_2x2 hat 1 Kind (nur Körper)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'tile_2x2');
        assert.strictEqual(b.group.children.length, 1);
    });

    it('slope_2x2 hat 1 Kind (nur Schrägkörper)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'slope_2x2');
        assert.strictEqual(b.group.children.length, 1);
    });

    it('slope_2x4 hat 1 Kind (nur Schrägkörper)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'slope_2x4');
        assert.strictEqual(b.group.children.length, 1);
    });

    it('technic_beam_3 hat 4 Kinder (1 Körper + 3 Löcher)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'technic_beam_3');
        assert.strictEqual(b.group.children.length, 4);
    });

    it('technic_beam_7 hat 8 Kinder (1 Körper + 7 Löcher)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'technic_beam_7');
        assert.strictEqual(b.group.children.length, 8);
    });

    it('window_1x2x2 hat 4 Kinder (4 Rahmenbalken)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'window_1x2x2');
        assert.strictEqual(b.group.children.length, 4);
    });

    it('door_1x4x6 hat 4 Kinder (4 Rahmenbalken)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'door_1x4x6');
        assert.strictEqual(b.group.children.length, 4);
    });


    // ── setColor() ────────────────────────────────────────────────

    it('setColor() ändert brick.color', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        b.setColor(0x0000ff);
        assert.strictEqual(b.color, 0x0000ff);
    });

    it('setColor() aktualisiert group.userData.color', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        b.setColor(0x123456);
        assert.strictEqual(b.group.userData.color, 0x123456);
    });

    it('setColor() wirft bei ungültigem Wert', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.throws(() => b.setColor('keine_farbe'), { message: /Ungültige Steinfarbe/ });
    });

    it('setColor() mehrfach aufrufbar (letzter Wert gilt)', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        b.setColor(0x111111);
        b.setColor(0x222222);
        assert.strictEqual(b.color, 0x222222);
    });

    it('setColor() behält Technic-Loch-Farbe (0x1a1a1a) bei', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000, 'technic_beam_3');
        b.setColor(0x00ff00);
        // Loch-Meshes haben die Farbe 0x1a1a1a und sollen NICHT überschrieben werden
        const holeColors = b.group.children
            .filter(c => c.isMesh && c.material.color.getHex() === 0x1a1a1a);
        assert.strictEqual(holeColors.length, 3, 'Drei Technic-Löcher sollen schwarz bleiben');
    });


    // ── toData() ──────────────────────────────────────────────────

    it('toData() gibt ein Objekt zurück', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.strictEqual(typeof b.toData(), 'object');
    });

    it('toData() enthält id, type, color, position, rotation', () => {
        const b = new Brick(scene, 1, 2, 3, 0xff0000, 'brick_2x4', 'test-id');
        const data = b.toData();
        assert.strictEqual(data.id,    'test-id');
        assert.strictEqual(data.type,  'brick_2x4');
        assert.strictEqual(data.color, 0xff0000);
        assert.ok(data.position !== undefined);
        assert.ok(data.rotation !== undefined);
    });

    it('toData().position spiegelt die Konstruktorposition wider', () => {
        const b = new Brick(scene, 5, 1, -3, 0xff0000);
        const { position } = b.toData();
        assert.ok(Math.abs(position.x -  5) < 1e-9);
        assert.ok(Math.abs(position.y -  1) < 1e-9);
        assert.ok(Math.abs(position.z - -3) < 1e-9);
    });

    it('toData().rotation hat x, y, z', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        const { rotation } = b.toData();
        assert.ok('x' in rotation);
        assert.ok('y' in rotation);
        assert.ok('z' in rotation);
    });


    // ── setTransform() ────────────────────────────────────────────

    it('setTransform() verschiebt die Gruppe', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        b.setTransform({ x: 10, y: 2, z: -5 }, { x: 0, y: 0, z: 0 });
        assert.ok(Math.abs(b.group.position.x - 10) < 1e-9);
        assert.ok(Math.abs(b.group.position.y -  2) < 1e-9);
        assert.ok(Math.abs(b.group.position.z - -5) < 1e-9);
    });

    it('setTransform() setzt die Rotation', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        const angle = Math.PI / 2;
        b.setTransform({ x: 0, y: 0, z: 0 }, { x: 0, y: angle, z: 0 });
        assert.ok(Math.abs(b.group.rotation.y - angle) < 1e-9);
    });


    // ── dispose() ─────────────────────────────────────────────────

    it('dispose() entfernt den Stein aus der Szene', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.ok(scene.children.includes(b.group));
        b.dispose();
        assert.ok(!scene.children.includes(b.group));
    });

    it('dispose() kann mehrfach aufgerufen werden ohne Fehler', () => {
        const b = new Brick(scene, 0, 0, 0, 0xff0000);
        assert.doesNotThrow(() => {
            b.dispose();
            b.dispose();
        });
    });

});
