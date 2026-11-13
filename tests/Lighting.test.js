import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { addLighting } from '../src/scene/Lighting.js';

describe('addLighting', () => {

    it('fügt der Szene genau zwei Lichter hinzu', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const lights = scene.children.filter(
            c => c instanceof THREE.Light
        );
        assert.strictEqual(lights.length, 2);
    });

    it('fügt ein AmbientLight hinzu', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const ambient = scene.children.find(c => c instanceof THREE.AmbientLight);
        assert.ok(ambient, 'AmbientLight nicht gefunden');
    });

    it('fügt ein DirectionalLight hinzu', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const dir = scene.children.find(c => c instanceof THREE.DirectionalLight);
        assert.ok(dir, 'DirectionalLight nicht gefunden');
    });

    it('AmbientLight hat weiße Farbe', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const ambient = scene.children.find(c => c instanceof THREE.AmbientLight);
        assert.strictEqual(ambient.color.getHex(), 0xffffff);
    });

    it('DirectionalLight hat weiße Farbe', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const dir = scene.children.find(c => c instanceof THREE.DirectionalLight);
        assert.strictEqual(dir.color.getHex(), 0xffffff);
    });

    it('DirectionalLight ist positiv positioniert (y > 0)', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const dir = scene.children.find(c => c instanceof THREE.DirectionalLight);
        assert.ok(dir.position.y > 0, `Erwartet y > 0, erhalten ${dir.position.y}`);
    });

    it('AmbientLight-Intensität ist größer als 0', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const ambient = scene.children.find(c => c instanceof THREE.AmbientLight);
        assert.ok(ambient.intensity > 0);
    });

    it('DirectionalLight-Intensität ist größer als 0', () => {
        const scene = new THREE.Scene();
        addLighting(scene);
        const dir = scene.children.find(c => c instanceof THREE.DirectionalLight);
        assert.ok(dir.intensity > 0);
    });

    it('kann mehrfach aufgerufen werden ohne Fehler', () => {
        const scene = new THREE.Scene();
        assert.doesNotThrow(() => {
            addLighting(scene);
            addLighting(scene);
        });
    });

});
