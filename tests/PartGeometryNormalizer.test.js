import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartGeometryNormalizer } from '../src/catalog/geometry/PartGeometryNormalizer.js';

// ---------------------------------------------------------------------------
// Hilfsfunktion: Erstellt ein Mesh mit einer BoxGeometry der Maße w × h × d.
// Die Box wird so positioniert, dass der Boden bei y=0 beginnt (mesh.position.y
// = h/2), was einem typisch geladenen Objekt entspricht.
// ---------------------------------------------------------------------------
function makeMesh(w, h, d) {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mat  = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    // BoxGeometry ist um den Ursprung zentriert → Boden bei −h/2.
    // Wir verschieben ihn, sodass der Boden auf einer bestimmten Y-Position
    // liegt, damit normalize() etwas zu tun hat.
    mesh.position.y = h / 2; // Mittelpunkt liegt bei h/2 → Boden bei 0
    return mesh;
}

// Erstellt ein leeres Object3D ohne Geometrie (liefert isEmpty() = true).
function makeEmpty() {
    return new THREE.Object3D();
}

describe('PartGeometryNormalizer', () => {

    let normalizer;

    beforeEach(() => {
        normalizer = new PartGeometryNormalizer();
    });

    // -----------------------------------------------------------------------
    // normalize() – Fallback bei leerer Geometrie
    // -----------------------------------------------------------------------

    it('normalize() gibt Fallback-Abmessungen zurück wenn die Geometrie leer ist', () => {
        const empty  = makeEmpty();
        const result = normalizer.normalize(empty);

        assert.deepStrictEqual(result, { width: 1, depth: 1, height: 1.2 });
    });

    // -----------------------------------------------------------------------
    // normalize() – Y-Ausrichtung (Boden bei Y=0)
    // -----------------------------------------------------------------------

    it('normalize() verschiebt das Objekt so, dass der Boden der Bounding Box bei Y=0 liegt', () => {
        const mesh = makeMesh(2, 1.2, 2);
        // Vor normalize: Boden liegt bei position.y - h/2 = 0
        // Wir verschieben den Boden absichtlich weg von Y=0
        mesh.position.y = 3; // Boden bei 3 - 0.6 = 2.4

        normalizer.normalize(mesh);

        // Weltmatrix aktualisieren und neue Bounding Box berechnen
        mesh.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(mesh);

        assert.ok(
            Math.abs(box.min.y) < 1e-9,
            `Boden der Bounding Box sollte bei Y≈0 liegen, ist aber ${box.min.y}`
        );
    });

    // -----------------------------------------------------------------------
    // normalize() – XZ-Zentrierung
    // -----------------------------------------------------------------------

    it('normalize() zentriert das Objekt auf der XZ-Ebene (Mitte X≈0, Z≈0)', () => {
        const mesh = makeMesh(4, 1.2, 2);
        // Objekt absichtlich außerhalb der Mitte platzieren
        mesh.position.x = 10;
        mesh.position.z = -5;

        normalizer.normalize(mesh);

        mesh.updateWorldMatrix(true, true);
        const box    = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3();
        box.getCenter(center);

        assert.ok(Math.abs(center.x) < 1e-9, `Mittelpunkt X sollte ≈0 sein, ist aber ${center.x}`);
        assert.ok(Math.abs(center.z) < 1e-9, `Mittelpunkt Z sollte ≈0 sein, ist aber ${center.z}`);
    });

    // -----------------------------------------------------------------------
    // normalize() – korrekte Breite in Noppen
    // -----------------------------------------------------------------------

    it('normalize() gibt die korrekte Breite in Noppen zurück (STUD_PITCH=1)', () => {
        // BoxGeometry mit Breite 4 → width=4 bei STUD_PITCH=1
        const mesh   = makeMesh(4, 1.2, 2);
        const result = normalizer.normalize(mesh);

        assert.strictEqual(result.width, 4);
    });

    // -----------------------------------------------------------------------
    // normalize() – korrekte Tiefe in Noppen
    // -----------------------------------------------------------------------

    it('normalize() gibt die korrekte Tiefe in Noppen zurück (STUD_PITCH=1)', () => {
        // BoxGeometry mit Tiefe 3 → depth=3 bei STUD_PITCH=1
        const mesh   = makeMesh(2, 1.2, 3);
        const result = normalizer.normalize(mesh);

        assert.strictEqual(result.depth, 3);
    });

    // -----------------------------------------------------------------------
    // normalize() – Mindestdimension ist 1
    // -----------------------------------------------------------------------

    it('normalize() gibt nie 0 für Breite oder Tiefe zurück (Minimum ist 1)', () => {
        // Sehr schmales Objekt (x-Ausdehnung < 0.5 → würde zu 0 runden)
        const mesh   = makeMesh(0.1, 1.2, 0.1);
        const result = normalizer.normalize(mesh);

        assert.ok(result.width  >= 1, `width  sollte ≥1 sein, ist aber ${result.width}`);
        assert.ok(result.depth  >= 1, `depth  sollte ≥1 sein, ist aber ${result.depth}`);
    });

    // -----------------------------------------------------------------------
    // normalize() – zweimaliger Aufruf liefert konsistente Ergebnisse
    // -----------------------------------------------------------------------

    it('normalize() liefert bei zweimaligem Aufruf konsistente Abmessungen', () => {
        const mesh    = makeMesh(2, 1.2, 2);
        const first   = normalizer.normalize(mesh);
        const second  = normalizer.normalize(mesh);

        assert.strictEqual(first.width,  second.width);
        assert.strictEqual(first.depth,  second.depth);
        assert.ok(
            Math.abs(first.height - second.height) < 1e-9,
            'Höhe sollte konsistent sein'
        );
    });

    // -----------------------------------------------------------------------
    // computeDimensions() – verändert die Position NICHT
    // -----------------------------------------------------------------------

    it('computeDimensions() verändert die Position des Objekts nicht', () => {
        const mesh = makeMesh(4, 1.2, 2);
        mesh.position.set(5, 3, -2);

        normalizer.computeDimensions(mesh);

        assert.strictEqual(mesh.position.x,  5);
        assert.strictEqual(mesh.position.y,  3);
        assert.strictEqual(mesh.position.z, -2);
    });

    // -----------------------------------------------------------------------
    // computeDimensions() – gibt boundingBox zurück
    // -----------------------------------------------------------------------

    it('computeDimensions() gibt eine boundingBox in der Rückgabe zurück', () => {
        const mesh   = makeMesh(4, 1.2, 2);
        const result = normalizer.computeDimensions(mesh);

        assert.ok(
            result.boundingBox instanceof THREE.Box3,
            'boundingBox sollte eine THREE.Box3-Instanz sein'
        );
    });

    // -----------------------------------------------------------------------
    // computeDimensions() – Rückgabeobjekt hat alle Felder
    // -----------------------------------------------------------------------

    it('computeDimensions() gibt { width, depth, height, boundingBox } zurück', () => {
        const mesh   = makeMesh(2, 1.2, 3);
        const result = normalizer.computeDimensions(mesh);

        assert.ok('width'       in result, 'width fehlt');
        assert.ok('depth'       in result, 'depth fehlt');
        assert.ok('height'      in result, 'height fehlt');
        assert.ok('boundingBox' in result, 'boundingBox fehlt');
    });

    // -----------------------------------------------------------------------
    // computeDimensions() – Fallback bei leerer Geometrie
    // -----------------------------------------------------------------------

    it('computeDimensions() gibt Fallback-Abmessungen zurück wenn die Geometrie leer ist', () => {
        const empty  = makeEmpty();
        const result = normalizer.computeDimensions(empty);

        assert.strictEqual(result.width,  1);
        assert.strictEqual(result.depth,  1);
        assert.strictEqual(result.height, 1.2);
        assert.ok(result.boundingBox instanceof THREE.Box3, 'boundingBox fehlt im Fallback');
    });

    // -----------------------------------------------------------------------
    // _dimensionsFromSize() – rundet auf nächste Noppen-Anzahl
    // -----------------------------------------------------------------------

    it('_dimensionsFromSize() rundet auf die nächste Noppen-Anzahl (STUD_PITCH=1)', () => {
        // Größe 3.4 → rundet zu 3; Größe 3.6 → rundet zu 4
        const size34 = new THREE.Vector3(3.4, 1.2, 2.6);
        const size36 = new THREE.Vector3(3.6, 1.2, 1.4);

        const res34  = normalizer._dimensionsFromSize(size34);
        const res36  = normalizer._dimensionsFromSize(size36);

        assert.strictEqual(res34.width, 3, 'x=3.4 sollte auf 3 runden');
        assert.strictEqual(res34.depth, 3, 'z=2.6 sollte auf 3 runden');
        assert.strictEqual(res36.width, 4, 'x=3.6 sollte auf 4 runden');
        assert.strictEqual(res36.depth, 1, 'z=1.4 sollte auf 1 runden');
    });
});
