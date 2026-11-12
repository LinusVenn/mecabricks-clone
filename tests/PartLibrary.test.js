import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartLibrary } from '../src/objects/PartLibrary.js';

describe('PartLibrary', () => {

    let scene, library;

    beforeEach(() => {
        scene = new THREE.Scene();
        library = new PartLibrary(scene);
    });

    it('startet mit einer leeren Teileliste', () => {
        assert.strictEqual(library.parts.length, 0);
    });

    // Brick erfordert einen gültigen Farbwert (Number.isFinite).
    // Alle addBrick-Aufrufe müssen daher eine Farbe übergeben.
    const RED = 0xff0000;

    it('addBrick fügt einen Baustein zur Liste hinzu', () => {
        library.addBrick(0, 0, 0, RED);
        assert.strictEqual(library.parts.length, 1);
    });

    it('addBrick gibt den erstellten Baustein zurück', () => {
        const brick = library.addBrick(0, 0, 0, RED);
        assert.ok(brick !== undefined);
        assert.strictEqual(library.parts[0], brick);
    });

    it('addBrick akzeptiert einen Typ-Parameter', () => {
        const brick = library.addBrick(0, 0, 0, 0xff0000, 'brick_2x2');
        assert.strictEqual(brick.type, 'brick_2x2');
    });

    it('addBrick setzt die übergebene Position korrekt', () => {
        const brick = library.addBrick(2, 0, 4, RED);
        assert.ok(Math.abs(brick.group.position.x - 2) < 1e-9);
        assert.ok(Math.abs(brick.group.position.z - 4) < 1e-9);
    });

    it('addBrick fügt den Baustein zur Szene hinzu', () => {
        const brick = library.addBrick(0, 0, 0, RED);
        assert.ok(scene.children.includes(brick.group));
    });

    it('mehrere Bausteine können hinzugefügt werden', () => {
        library.addBrick(0, 0, 0, RED);
        library.addBrick(2, 0, 0, RED);
        library.addBrick(4, 0, 0, RED);
        assert.strictEqual(library.parts.length, 3);
    });

    it('removeBrick entfernt den Baustein aus der Liste', () => {
        const brick = library.addBrick(0, 0, 0, RED);
        library.removeBrick(brick);
        assert.strictEqual(library.parts.length, 0);
    });

    it('removeBrick entfernt die Gruppe aus der Szene', () => {
        const brick = library.addBrick(0, 0, 0, RED);
        library.removeBrick(brick);
        assert.ok(!scene.children.includes(brick.group));
    });

    it('removeBrick mit null wirft keinen Fehler', () => {
        assert.doesNotThrow(() => library.removeBrick(null));
    });

    it('removeBrick entfernt nur den richtigen Baustein', () => {
        const b1 = library.addBrick(0, 0, 0, RED);
        const b2 = library.addBrick(2, 0, 0, RED);
        library.removeBrick(b1);
        assert.strictEqual(library.parts.length, 1);
        assert.strictEqual(library.parts[0], b2);
    });

    it('getAll gibt alle Bausteine zurück', () => {
        library.addBrick(0, 0, 0, RED);
        library.addBrick(2, 0, 0, RED);
        assert.strictEqual(library.getAll().length, 2);
    });

    it('getById findet den Baustein anhand der ID', () => {
        const brick = library.addBrick(0, 0, 0, RED);
        assert.strictEqual(library.getById(brick.id), brick);
    });

    // PartLibrary.getById gibt null zurück (nicht undefined) wenn ID nicht vorhanden
    it('getById gibt null zurück bei unbekannter ID', () => {
        assert.strictEqual(library.getById('unbekannte-id'), null);
    });

});
