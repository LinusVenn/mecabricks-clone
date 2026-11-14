/**
 * tests/ColorMaterialFactory.test.js
 *
 * Tests for ColorMaterialFactory (Phase E.3) – runs in Node.js without WebGL.
 * THREE.js (r0.187) works in Node without a WebGL context for pure CPU-side
 * material construction, so we import it directly. No mocking needed.
 *
 * Uses node:test + node:assert/strict with ESM imports.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { ColorMaterialFactory } from '../src/catalog/colors/ColorMaterialFactory.js';
import { ColorDefinition }      from '../src/catalog/colors/ColorDefinition.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal red plastic color. */
const RED_DEF = new ColorDefinition({
    id:          4,
    name:        'Red',
    displayName: 'Rot',
    hex:         '#C91A09',
    family:      'red',
    // material defaults to plastic
});

/** Transparent color. */
const TRANS_DEF = new ColorDefinition({
    id:          24,
    name:        'Transparent',
    displayName: 'Transparent',
    hex:         '#EEEEEE',
    family:      'transparent',
    material:    { type: 'transparent', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.4 },
});

/** Metallic / chrome color. */
const CHROME_DEF = new ColorDefinition({
    id:          334,
    name:        'Chrome Gold',
    displayName: 'Chrom-Gold',
    hex:         '#BBA53D',
    family:      'metallic',
    material:    { type: 'chrome', roughness: 0.1, metalness: 0.9, transparent: false, opacity: 1.0 },
});

/** Glow color. */
const GLOW_DEF = new ColorDefinition({
    id:          294,
    name:        'Glow In Dark Trans',
    displayName: 'Nachleuchtend',
    hex:         '#BDC6AD',
    family:      'transparent',
    material:    { type: 'glow', roughness: 0.5, metalness: 0.0, transparent: true, opacity: 0.9 },
});

// ─── Helper: fresh factory for each test ─────────────────────────────────────

let factory;
beforeEach(() => {
    factory = new ColorMaterialFactory();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ColorMaterialFactory', () => {

    // ── Construction ─────────────────────────────────────────────────────────

    describe('constructor', () => {

        it('creates a new instance', () => {
            assert.ok(factory instanceof ColorMaterialFactory);              // 1
        });

        it('getCacheSize() is 0 initially', () => {
            assert.strictEqual(factory.getCacheSize(), 0);                   // 2
        });

        it('getCachedMaterial() returns null before any creation', () => {
            assert.strictEqual(factory.getCachedMaterial(4), null);          // 3
        });
    });

    // ── createMaterialFromHex ─────────────────────────────────────────────────

    describe('createMaterialFromHex()', () => {

        it('returns a THREE.MeshStandardMaterial for a numeric hex value', () => {
            const mat = factory.createMaterialFromHex(0xFF0000);
            assert.ok(mat instanceof THREE.MeshStandardMaterial);            // 4
        });

        it('returns a THREE.MeshStandardMaterial for a CSS hex string', () => {
            const mat = factory.createMaterialFromHex('#FF0000');
            assert.ok(mat instanceof THREE.MeshStandardMaterial);            // 5
        });

        it('material has a color property (THREE.Color)', () => {
            const mat = factory.createMaterialFromHex(0x0055BF);
            assert.ok(mat.color instanceof THREE.Color);                     // 6
        });

        it('applies roughness from options', () => {
            const mat = factory.createMaterialFromHex(0xFF0000, { roughness: 0.2 });
            assert.strictEqual(mat.roughness, 0.2);                          // 7
        });

        it('applies metalness from options', () => {
            const mat = factory.createMaterialFromHex(0xFF0000, { metalness: 0.8 });
            assert.strictEqual(mat.metalness, 0.8);                          // 8
        });

        it('applies transparent and opacity from options', () => {
            const mat = factory.createMaterialFromHex(0x88AACC, { transparent: true, opacity: 0.5 });
            assert.strictEqual(mat.transparent, true);                        // 9
            assert.strictEqual(mat.opacity, 0.5);                            // 10
        });

        it('transparent material has depthWrite = false', () => {
            const mat = factory.createMaterialFromHex(0x88AACC, { transparent: true });
            assert.strictEqual(mat.depthWrite, false);                       // 11
        });

        it('transparent material has side = DoubleSide', () => {
            const mat = factory.createMaterialFromHex(0x88AACC, { transparent: true });
            assert.strictEqual(mat.side, THREE.DoubleSide);                  // 12
        });

        it('non-transparent material has side = FrontSide', () => {
            const mat = factory.createMaterialFromHex(0xFF0000, { transparent: false });
            assert.strictEqual(mat.side, THREE.FrontSide);                   // 13
        });

        it('uses default roughness (0.65) when not specified', () => {
            const mat = factory.createMaterialFromHex(0xFF0000);
            assert.strictEqual(mat.roughness, 0.65);                         // 14
        });

        it('uses default metalness (0.0) when not specified', () => {
            const mat = factory.createMaterialFromHex(0xFF0000);
            assert.strictEqual(mat.metalness, 0.0);                          // 15
        });

        it('falls back to a color for an invalid hex value (non-string, non-number)', () => {
            // Should not throw; should return a material with fallback color
            const mat = factory.createMaterialFromHex(null);
            assert.ok(mat instanceof THREE.MeshStandardMaterial);            // 16
        });

        it('does NOT add to cache', () => {
            factory.createMaterialFromHex(0xFF0000);
            assert.strictEqual(factory.getCacheSize(), 0);                   // 17
        });
    });

    // ── createMaterial (via ColorDefinition) ─────────────────────────────────

    describe('createMaterial()', () => {

        it('returns a THREE.MeshStandardMaterial for a plastic ColorDefinition', () => {
            const mat = factory.createMaterial(RED_DEF);
            assert.ok(mat instanceof THREE.MeshStandardMaterial);            // 18
        });

        it('adds to cache after first creation', () => {
            factory.createMaterial(RED_DEF);
            assert.strictEqual(factory.getCacheSize(), 1);                   // 19
        });

        it('returns the same object on repeated calls (cache hit)', () => {
            const mat1 = factory.createMaterial(RED_DEF);
            const mat2 = factory.createMaterial(RED_DEF);
            assert.strictEqual(mat1, mat2);                                   // 20
        });

        it('getCachedMaterial() returns the material after creation', () => {
            const mat = factory.createMaterial(RED_DEF);
            assert.strictEqual(factory.getCachedMaterial(4), mat);           // 21
        });

        it('creates separate materials for different colorIds', () => {
            const matRed   = factory.createMaterial(RED_DEF);
            const matTrans = factory.createMaterial(TRANS_DEF);
            assert.notStrictEqual(matRed, matTrans);                         // 22
            assert.strictEqual(factory.getCacheSize(), 2);                   // 23
        });

        it('transparent type: sets transparent=true and depthWrite=false', () => {
            const mat = factory.createMaterial(TRANS_DEF);
            assert.strictEqual(mat.transparent, true);                        // 24
            assert.strictEqual(mat.depthWrite, false);                        // 25
        });

        it('transparent type: side = DoubleSide', () => {
            const mat = factory.createMaterial(TRANS_DEF);
            assert.strictEqual(mat.side, THREE.DoubleSide);                  // 26
        });

        it('chrome type: higher envMapIntensity', () => {
            const mat = factory.createMaterial(CHROME_DEF);
            assert.ok(mat.envMapIntensity >= 2.0);                           // 27
        });

        it('glow type: emissiveIntensity is set to 0.1', () => {
            const mat = factory.createMaterial(GLOW_DEF);
            assert.strictEqual(mat.emissiveIntensity, 0.1);                  // 28
        });

        it('glow type: emissive color is set (THREE.Color)', () => {
            const mat = factory.createMaterial(GLOW_DEF);
            assert.ok(mat.emissive instanceof THREE.Color);                  // 29
        });

        it('throws TypeError when argument is not a ColorDefinition', () => {
            assert.throws(
                () => factory.createMaterial({ id: 4 }),
                { name: 'TypeError' }
            );                                                                 // 30
        });

        it('material name contains the colorId for plastic', () => {
            const mat = factory.createMaterial(RED_DEF);
            assert.ok(mat.name.includes('4'));                                // 31
        });

        it('material name indicates transparency for transparent type', () => {
            const mat = factory.createMaterial(TRANS_DEF);
            assert.ok(mat.name.includes('trans'));                            // 32
        });
    });

    // ── createMaterialById ────────────────────────────────────────────────────

    describe('createMaterialById()', () => {

        it('returns null when colorManager is null', () => {
            const result = factory.createMaterialById(4, null);
            assert.strictEqual(result, null);                                 // 33
        });

        it('returns null when colorManager has no getColorById()', () => {
            const result = factory.createMaterialById(4, {});
            assert.strictEqual(result, null);                                 // 34
        });

        it('returns null when the colorId is not found in the manager', () => {
            const mgr = { getColorById: () => null };
            const result = factory.createMaterialById(9999, mgr);
            assert.strictEqual(result, null);                                 // 35
        });

        it('returns a material when the colorManager finds the colorDef', () => {
            const mgr = { getColorById: (id) => id === 4 ? RED_DEF : null };
            const mat = factory.createMaterialById(4, mgr);
            assert.ok(mat instanceof THREE.MeshStandardMaterial);            // 36
        });

        it('caches the material by colorId', () => {
            const mgr = { getColorById: (id) => id === 4 ? RED_DEF : null };
            factory.createMaterialById(4, mgr);
            assert.strictEqual(factory.getCacheSize(), 1);                   // 37
        });
    });

    // ── Cache management ──────────────────────────────────────────────────────

    describe('clearCache()', () => {

        it('does not throw on empty cache', () => {
            assert.doesNotThrow(() => factory.clearCache());                  // 38
        });

        it('cache size goes to 0 after clearCache()', () => {
            factory.createMaterial(RED_DEF);
            factory.createMaterial(TRANS_DEF);
            assert.strictEqual(factory.getCacheSize(), 2);
            factory.clearCache();
            assert.strictEqual(factory.getCacheSize(), 0);                   // 39
        });

        it('getCachedMaterial() returns null after clearCache()', () => {
            factory.createMaterial(RED_DEF);
            factory.clearCache();
            assert.strictEqual(factory.getCachedMaterial(4), null);          // 40
        });

        it('can create new materials after clearCache()', () => {
            factory.createMaterial(RED_DEF);
            factory.clearCache();
            const mat = factory.createMaterial(RED_DEF);
            assert.ok(mat instanceof THREE.MeshStandardMaterial);            // 41
            assert.strictEqual(factory.getCacheSize(), 1);                   // 42
        });
    });

    // ── getCachedMaterial ─────────────────────────────────────────────────────

    describe('getCachedMaterial()', () => {

        it('returns null for unknown colorId', () => {
            assert.strictEqual(factory.getCachedMaterial(999), null);        // 43
        });

        it('returns null for colorId 0 when nothing created', () => {
            assert.strictEqual(factory.getCachedMaterial(0), null);          // 44
        });
    });

    // ── getCacheSize ──────────────────────────────────────────────────────────

    describe('getCacheSize()', () => {

        it('returns 0 for a fresh factory', () => {
            assert.strictEqual(factory.getCacheSize(), 0);                   // 45
        });

        it('increments by 1 for each new colorId cached', () => {
            factory.createMaterial(RED_DEF);
            assert.strictEqual(factory.getCacheSize(), 1);
            factory.createMaterial(TRANS_DEF);
            assert.strictEqual(factory.getCacheSize(), 2);
            factory.createMaterial(CHROME_DEF);
            assert.strictEqual(factory.getCacheSize(), 3);                   // 46
        });
    });

    // ── applyToObject ─────────────────────────────────────────────────────────

    describe('applyToObject()', () => {

        it('does not throw for a valid object3D stub and ColorDefinition', () => {
            // Minimal Object3D stub with traverse()
            const stub = {
                traverse(fn) {
                    fn(this); // call callback with self (not a Mesh → skipped)
                },
            };
            assert.doesNotThrow(() => factory.applyToObject(stub, RED_DEF));  // 47
        });

        it('does not throw when passed null as object3D', () => {
            assert.doesNotThrow(() => factory.applyToObject(null, RED_DEF));  // 48
        });

        it('does not throw when passed invalid colorDef', () => {
            const stub = { traverse(fn) {} };
            assert.doesNotThrow(() => factory.applyToObject(stub, null));     // 49
        });

        it('assigns the material to a Mesh node that has no preserveMaterial flag', () => {
            const mesh = new THREE.Mesh();
            mesh.userData.preserveMaterial = false;

            const capturedNodes = [];
            const stub = {
                traverse(fn) { fn(mesh); },
            };

            factory.applyToObject(stub, RED_DEF);

            // Material should have been applied
            assert.ok(mesh.material instanceof THREE.MeshStandardMaterial);  // 50
        });

        it('skips Mesh nodes with userData.preserveMaterial = true', () => {
            const mesh = new THREE.Mesh();
            mesh.userData.preserveMaterial = true;
            const originalMaterial = mesh.material;

            const stub = { traverse(fn) { fn(mesh); } };
            factory.applyToObject(stub, RED_DEF);

            // Material must NOT have changed
            assert.strictEqual(mesh.material, originalMaterial);             // 51
        });

        it('caches the material (cache size grows by 1 on first apply)', () => {
            const stub = { traverse(fn) {} };
            assert.strictEqual(factory.getCacheSize(), 0);
            factory.applyToObject(stub, RED_DEF);
            assert.strictEqual(factory.getCacheSize(), 1);                   // 52
        });
    });
});
