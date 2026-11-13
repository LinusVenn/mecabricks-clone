import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { VisibilityOptimizer } from '../src/performance/VisibilityOptimizer.js';


// =====================================================================
// Hilfs-Konstruktoren
// =====================================================================

function makeCamera() {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(0, 10, 20);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    return cam;
}

function makeBrick(x = 0, y = 0, z = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.visible = true;
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1.2, 1),
        new THREE.MeshStandardMaterial()
    );
    mesh.position.y = 0.6;
    group.add(mesh);
    group.updateMatrixWorld(true);
    return { id: `b_${x}_${y}_${z}`, group };
}

function makeLibrary(bricks) {
    return { getAll: () => [...bricks] };
}


describe('VisibilityOptimizer', () => {

    let optimizer, camera, library, bricksInFrustum, bricksOutside;

    beforeEach(() => {
        camera = makeCamera();

        // Stein direkt vor der Kamera (im Frustum)
        bricksInFrustum = [makeBrick(0, 0, 0)];

        // Stein extrem weit hinter der Kamera (außerhalb des Frustums)
        bricksOutside = [makeBrick(0, 0, -999)];

        library = makeLibrary([...bricksInFrustum, ...bricksOutside]);
        optimizer = new VisibilityOptimizer(camera, library);
    });


    // ------------------------------------------------------------------
    // Initialisierung
    // ------------------------------------------------------------------

    it('ist standardmäßig deaktiviert', () => {
        assert.strictEqual(optimizer.enabled, false);
    });

    it('enable() aktiviert den Optimierer', () => {
        optimizer.enable();
        assert.strictEqual(optimizer.enabled, true);
    });

    it('disable() deaktiviert den Optimierer', () => {
        optimizer.enable();
        optimizer.disable();
        assert.strictEqual(optimizer.enabled, false);
    });


    // ------------------------------------------------------------------
    // Frustum Culling
    // ------------------------------------------------------------------

    it('update() wirft keinen Fehler', () => {
        optimizer.enable();
        assert.doesNotThrow(() => optimizer.update());
    });

    it('Steine weit außerhalb des Frustums werden als culled markiert', () => {
        optimizer.enable();
        optimizer.update();
        // Stein bei z=-999 sollte culled sein
        const brick = bricksOutside[0];
        assert.ok(
            !brick.group.visible || optimizer.isCulled(brick.id),
            'Stein weit außerhalb des Frustums sollte unsichtbar oder culled sein'
        );
    });

    it('Steine im Frustum bleiben sichtbar', () => {
        optimizer.enable();
        optimizer.update();
        const brick = bricksInFrustum[0];
        assert.ok(
            brick.group.visible,
            'Stein im Frustum sollte sichtbar bleiben'
        );
    });


    // ------------------------------------------------------------------
    // disable() stellt alle Sichtbarkeiten wieder her
    // ------------------------------------------------------------------

    it('disable() macht alle optimizer-versteckten Steine wieder sichtbar', () => {
        optimizer.enable();
        optimizer.update();
        optimizer.disable();
        // Alle Steine sollten nach dem Deaktivieren sichtbar sein
        for (const brick of [...bricksInFrustum, ...bricksOutside]) {
            assert.ok(
                brick.group.visible,
                `Stein ${brick.id} sollte nach disable() sichtbar sein`
            );
        }
    });


    // ------------------------------------------------------------------
    // Selektion-Schutz
    // ------------------------------------------------------------------

    it('ausgewählte (excludedIds) Steine werden nicht culled', () => {
        optimizer.enable();
        optimizer.setExcludedIds(new Set([bricksOutside[0].id]));
        optimizer.update();
        assert.ok(
            bricksOutside[0].group.visible,
            'Ausgeschlossener Stein darf nicht culled werden'
        );
    });


    // ------------------------------------------------------------------
    // Schon-unsichtbare Steine nicht anfassen
    // ------------------------------------------------------------------

    it('Steine die bereits unsichtbar sind (Isolation) werden nicht durch Optimizer verändert', () => {
        // Stein vorab auf unsichtbar setzen (z.B. durch Isolation)
        bricksInFrustum[0].group.visible = false;
        optimizer.enable();
        optimizer.update();
        optimizer.disable();
        // Nach disable() sollte der Stein NICHT vom Optimizer auf true gesetzt worden sein
        // (der Optimizer darf nicht in Isolation-Zustand eingreifen)
        assert.ok(
            !bricksInFrustum[0].group.visible,
            'Vom Isolation-System versteckter Stein sollte weiterhin unsichtbar sein'
        );
    });


    // ------------------------------------------------------------------
    // Robustheit
    // ------------------------------------------------------------------

    it('update() ohne Kamera wirft keinen Fehler', () => {
        const opt2 = new VisibilityOptimizer(null, library);
        assert.doesNotThrow(() => opt2.update());
    });

    it('update() mit leerer Library wirft keinen Fehler', () => {
        const opt3 = new VisibilityOptimizer(camera, makeLibrary([]));
        opt3.enable();
        assert.doesNotThrow(() => opt3.update());
    });

});
