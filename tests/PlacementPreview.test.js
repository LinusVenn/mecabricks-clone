import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlacementPreview } from '../src/editor/PlacementPreview.js';

describe('PlacementPreview', () => {

    let scene, preview;

    beforeEach(() => {
        scene   = new THREE.Scene();
        preview = new PlacementPreview(scene);
    });

    // ── Initialisierung ──────────────────────────────────────────────────────

    it('group ist initial null', () => {
        assert.strictEqual(preview.group, null);
    });

    it('currentType ist initial null', () => {
        assert.strictEqual(preview.currentType, null);
    });

    it('validMaterial ist transparent und grün', () => {
        assert.strictEqual(preview.validMaterial.color.getHex(), 0x00ff00);
        assert.strictEqual(preview.validMaterial.transparent, true);
        assert.ok(preview.validMaterial.opacity < 1);
    });

    it('invalidMaterial ist transparent und rot', () => {
        assert.strictEqual(preview.invalidMaterial.color.getHex(), 0xff0000);
        assert.strictEqual(preview.invalidMaterial.transparent, true);
        assert.ok(preview.invalidMaterial.opacity < 1);
    });

    // ── setType ──────────────────────────────────────────────────────────────

    it('setType ignoriert unbekannte Typen und setzt kein group', () => {
        preview.setType('gibts_nicht');
        assert.strictEqual(preview.group, null);
    });

    it('setType setzt currentType und erzeugt eine Gruppe für bekannte Typen', () => {
        // 'brick_2x4' ist eine definierte Part-Definition
        preview.setType('brick_2x4');
        assert.strictEqual(preview.currentType, 'brick_2x4');
        assert.ok(preview.group instanceof THREE.Group);
    });

    it('setType fügt die Gruppe der Szene hinzu', () => {
        preview.setType('brick_2x4');
        assert.ok(scene.children.includes(preview.group));
    });

    it('setType enthält genau ein Mesh-Kind', () => {
        preview.setType('brick_2x4');
        const meshes = preview.group.children.filter(c => c instanceof THREE.Mesh);
        assert.strictEqual(meshes.length, 1);
    });

    it('setType entfernt vorherige Gruppe aus der Szene', () => {
        preview.setType('brick_2x4');
        const firstGroup = preview.group;
        preview.setType('brick_2x2');
        assert.ok(!scene.children.includes(firstGroup));
    });

    it('Mesh hat validMaterial direkt nach setType', () => {
        preview.setType('brick_2x4');
        const mesh = preview.group.children[0];
        assert.strictEqual(mesh.material, preview.validMaterial);
    });

    // ── update ───────────────────────────────────────────────────────────────

    it('update tut nichts wenn kein group gesetzt', () => {
        assert.doesNotThrow(() =>
            preview.update({ x: 1, y: 0, z: 1 }, 0, true)
        );
    });

    it('update setzt die Position der Gruppe', () => {
        preview.setType('brick_2x4');
        preview.update({ x: 3, y: 1, z: -2 }, 0, true);
        assert.ok(Math.abs(preview.group.position.x - 3) < 1e-6);
        assert.ok(Math.abs(preview.group.position.y - 1) < 1e-6);
        assert.ok(Math.abs(preview.group.position.z - (-2)) < 1e-6);
    });

    it('update setzt die Y-Rotation der Gruppe', () => {
        preview.setType('brick_2x4');
        const angle = Math.PI / 2;
        preview.update({ x: 0, y: 0, z: 0 }, angle, true);
        assert.ok(Math.abs(preview.group.rotation.y - angle) < 1e-6);
    });

    it('update weist validMaterial zu bei valid=true', () => {
        preview.setType('brick_2x4');
        preview.update({ x: 0, y: 0, z: 0 }, 0, true);
        const mesh = preview.group.children[0];
        assert.strictEqual(mesh.material, preview.validMaterial);
    });

    it('update weist invalidMaterial zu bei valid=false', () => {
        preview.setType('brick_2x4');
        preview.update({ x: 0, y: 0, z: 0 }, 0, false);
        const mesh = preview.group.children[0];
        assert.strictEqual(mesh.material, preview.invalidMaterial);
    });

    // ── hide / show ──────────────────────────────────────────────────────────

    it('hide tut nichts wenn kein group gesetzt', () => {
        assert.doesNotThrow(() => preview.hide());
    });

    it('hide setzt visible auf false', () => {
        preview.setType('brick_2x4');
        preview.hide();
        assert.strictEqual(preview.group.visible, false);
    });

    it('show tut nichts wenn kein group gesetzt', () => {
        assert.doesNotThrow(() => preview.show());
    });

    it('show setzt visible auf true', () => {
        preview.setType('brick_2x4');
        preview.hide();
        preview.show();
        assert.strictEqual(preview.group.visible, true);
    });

});
