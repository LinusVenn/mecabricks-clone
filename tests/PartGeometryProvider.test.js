import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartGeometryProvider } from '../src/catalog/geometry/PartGeometryProvider.js';
import { PartGeometryValidator } from '../src/catalog/geometry/PartGeometryValidator.js';

// ---------------------------------------------------------------------------
// Minimaler Mock-Katalog
// extraParts: Array von { id, ldrawPartNumber? } – wird in eine Map geladen.
// ---------------------------------------------------------------------------
function makeCatalog(extraParts = []) {
    const parts = new Map(extraParts.map(p => [p.id, p]));
    return {
        getPartById: (id) => parts.get(id) ?? null,
    };
}

// ---------------------------------------------------------------------------
// Minimaler Mock-LDrawManager: gibt ein echtes THREE.Group-Objekt mit einer
// einfachen BoxGeometry zurück, damit PartGeometryValidator zufrieden ist.
// ---------------------------------------------------------------------------
function makeLDrawManager() {
    return {
        async loadPart(partNumber) {
            const group = new THREE.Group();
            const mesh  = new THREE.Mesh(
                new THREE.BoxGeometry(2, 1.2, 2),
                new THREE.MeshBasicMaterial()
            );
            group.add(mesh);
            group.userData.ldrawPartNumber = partNumber;
            return group;
        },
        releasePart() {},
    };
}

// ---------------------------------------------------------------------------
// Eine catalog-Teil-ID, die in PART_DEFINITIONS vorhanden ist (lokal).
// ---------------------------------------------------------------------------
const LOCAL_PART_ID  = 'brick_2x4';

// ---------------------------------------------------------------------------
// Eine Katalog-ID, die nur über LDraw aufgelöst werden kann.
// ---------------------------------------------------------------------------
const LDRAW_PART_ID       = 'ldraw_catalog_part';
const LDRAW_PART_NUMBER   = '3001';

// ---------------------------------------------------------------------------
// Hilfsfunktion: Erstellt einen Provider ohne LDrawManager (nur local).
// ---------------------------------------------------------------------------
function makeLocalProvider() {
    return new PartGeometryProvider({ catalog: makeCatalog() });
}

// ---------------------------------------------------------------------------
// Hilfsfunktion: Erstellt einen Provider mit LDrawManager und einem
// Katalogeintrag, der ein ldrawPartNumber hat.
// ---------------------------------------------------------------------------
function makeLDrawProvider() {
    const catalog = makeCatalog([
        { id: LDRAW_PART_ID, ldrawPartNumber: LDRAW_PART_NUMBER }
    ]);
    return new PartGeometryProvider({
        catalog,
        ldrawManager: makeLDrawManager(),
    });
}

describe('PartGeometryProvider', () => {

    // -----------------------------------------------------------------------
    // Konstruktor-Validierung
    // -----------------------------------------------------------------------

    it('constructor({ catalog: null }) wirft einen Fehler', () => {
        assert.throws(
            () => new PartGeometryProvider({ catalog: null }),
            { message: /catalog/ }
        );
    });

    // -----------------------------------------------------------------------
    // getSourceType()
    // -----------------------------------------------------------------------

    it('getSourceType("brick_2x4") gibt "local" zurück (in PART_DEFINITIONS)', () => {
        const provider = makeLocalProvider();
        assert.strictEqual(provider.getSourceType(LOCAL_PART_ID), 'local');
    });

    it('getSourceType("unknown_xyz") gibt "unknown" zurück', () => {
        const provider = makeLocalProvider();
        assert.strictEqual(provider.getSourceType('unknown_xyz'), 'unknown');
    });

    it('getSourceType() gibt "ldraw" zurück für ein Katalogteil mit ldrawPartNumber', () => {
        const catalog  = makeCatalog([{ id: LDRAW_PART_ID, ldrawPartNumber: LDRAW_PART_NUMBER }]);
        const provider = new PartGeometryProvider({ catalog });
        assert.strictEqual(provider.getSourceType(LDRAW_PART_ID), 'ldraw');
    });

    // -----------------------------------------------------------------------
    // isLocal() / isLDraw()
    // -----------------------------------------------------------------------

    it('isLocal("brick_2x4") gibt true zurück', () => {
        const provider = makeLocalProvider();
        assert.strictEqual(provider.isLocal(LOCAL_PART_ID), true);
    });

    it('isLDraw(ldrawPartId) gibt true zurück wenn der Eintrag ein ldrawPartNumber hat', () => {
        const catalog  = makeCatalog([{ id: LDRAW_PART_ID, ldrawPartNumber: LDRAW_PART_NUMBER }]);
        const provider = new PartGeometryProvider({ catalog });
        assert.strictEqual(provider.isLDraw(LDRAW_PART_ID), true);
    });

    // -----------------------------------------------------------------------
    // canProvideGeometry()
    // -----------------------------------------------------------------------

    it('canProvideGeometry("brick_2x4") gibt true zurück (kein ldrawManager nötig für local)', () => {
        const provider = makeLocalProvider();
        assert.strictEqual(provider.canProvideGeometry(LOCAL_PART_ID), true);
    });

    it('canProvideGeometry(ldrawPartId) gibt false zurück wenn kein ldrawManager konfiguriert ist', () => {
        const catalog  = makeCatalog([{ id: LDRAW_PART_ID, ldrawPartNumber: LDRAW_PART_NUMBER }]);
        const provider = new PartGeometryProvider({ catalog });
        assert.strictEqual(provider.canProvideGeometry(LDRAW_PART_ID), false);
    });

    it('canProvideGeometry(ldrawPartId) gibt true zurück wenn ein ldrawManager konfiguriert ist', () => {
        const provider = makeLDrawProvider();
        assert.strictEqual(provider.canProvideGeometry(LDRAW_PART_ID), true);
    });

    it('canProvideGeometry("unknown_xyz") gibt false zurück', () => {
        const provider = makeLocalProvider();
        assert.strictEqual(provider.canProvideGeometry('unknown_xyz'), false);
    });

    // -----------------------------------------------------------------------
    // getGeometry() – lokale Teile
    // -----------------------------------------------------------------------

    it('getGeometry("brick_2x4") gibt ein Ergebnis mit source="local", object3D und dimensions zurück', async () => {
        const provider = makeLocalProvider();
        const result   = await provider.getGeometry(LOCAL_PART_ID);

        assert.strictEqual(result.source, 'local');
        assert.ok(result.object3D,   'object3D fehlt');
        assert.ok(result.dimensions, 'dimensions fehlt');
        assert.strictEqual(result.partId, LOCAL_PART_ID);
    });

    it('getGeometry("brick_2x4") liefert ein Ergebnis, das PartGeometryValidator.isValid() besteht', async () => {
        const provider = makeLocalProvider();
        const result   = await provider.getGeometry(LOCAL_PART_ID);

        assert.strictEqual(PartGeometryValidator.isValid(result), true);
    });

    it('getGeometry("brick_2x4") – die release-Funktion wirft keinen Fehler', async () => {
        const provider = makeLocalProvider();
        const result   = await provider.getGeometry(LOCAL_PART_ID);

        assert.doesNotThrow(() => result.release());
    });

    // -----------------------------------------------------------------------
    // getGeometry() – unbekannte / fehlende Teile → Fehler
    // -----------------------------------------------------------------------

    it('getGeometry("unknown_xyz") lehnt das Promise ab (unbekanntes Teil)', async () => {
        const provider = makeLocalProvider();

        await assert.rejects(
            () => provider.getGeometry('unknown_xyz'),
            { message: /unknown_xyz/ }
        );
    });

    it('getGeometry(ldrawPartId) lehnt das Promise ab wenn kein ldrawManager konfiguriert ist', async () => {
        const catalog  = makeCatalog([{ id: LDRAW_PART_ID, ldrawPartNumber: LDRAW_PART_NUMBER }]);
        const provider = new PartGeometryProvider({ catalog });

        await assert.rejects(
            () => provider.getGeometry(LDRAW_PART_ID),
            { message: /LDrawManager/ }
        );
    });

    // -----------------------------------------------------------------------
    // getGeometry() – Farbparameter
    // -----------------------------------------------------------------------

    it('getGeometry("brick_2x4", { color: 0xff0000 }) stürzt nicht ab', async () => {
        const provider = makeLocalProvider();

        await assert.doesNotReject(
            () => provider.getGeometry(LOCAL_PART_ID, { color: 0xff0000 })
        );
    });

    // -----------------------------------------------------------------------
    // preloadParts()
    // -----------------------------------------------------------------------

    it('preloadParts([]) löst ohne Fehler auf', async () => {
        const provider = makeLocalProvider();

        await assert.doesNotReject(() => provider.preloadParts([]));
    });

    it('preloadParts(["brick_2x4"]) löst auf (lokale Teile haben kein LDraw, Aufruf ist No-Op)', async () => {
        const provider = makeLocalProvider();

        await assert.doesNotReject(() => provider.preloadParts([LOCAL_PART_ID]));
    });
});
