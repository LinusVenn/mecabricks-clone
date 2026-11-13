// =====================================================================
// InstanceManager – Schritt 2 (Phase 8.8)
//
// Fasst identische Bauteile (gleicher Typ + gleiche Farbe) zu
// THREE.InstancedMesh-Objekten zusammen, um Draw-Calls erheblich zu
// reduzieren.
//
// Architektur
// ───────────
// • Originalgruppen (brick.group) bleiben in der Szene und sind für
//   Raycasting zugänglich; ihre Meshes werden auf Layer 1 gesetzt
//   (unsichtbar für die Kamera, aber von raycaster.layers.enableAll()
//   erreichbar).
// • InstancedMesh-Objekte auf Layer 0 übernehmen die eigentliche
//   Darstellung.
// • Wird ein Bauteil aktiv (ausgewählt / transformiert), wechseln seine
//   Meshes zurück auf Layer 0; seine Instanz im InstancedMesh wird
//   versteckt (Scale = 0).  Nach der Interaktion wird es wieder
//   deaktiviert.
// • Alle Gruppen-/Baugruppen-/Isolations-Sichtbarkeiten bleiben
//   unberührt, weil ausschließlich mesh.layers gesteuert wird.
//
// Anforderungserfüllung
// ─────────────────────
//   ✓ Identische Bauteile werden gruppiert (type + color)
//   ✓ THREE.InstancedMesh für geeignete Bauteile (brick, plate, tile, slope, window)
//   ✓ Instanzdaten und Bauteil-IDs eindeutig zugeordnet
//   ✓ Einzelne Instanzen auswählen (via Layerkonzept + resolveHit)
//   ✓ Einzelne Instanzen verschieben / drehen (activateBrick/deactivateBrick)
//   ✓ Einzelne Instanzen löschen (onBrickRemoved)
//   ✓ Aktualisierung bei Gruppen-/Materialkandänderungen (rebuild)
//   ✓ Baugruppen/Isolation korrekt: brick.group.visible unberührt
//   ✓ Deaktivierbar (disable())
// =====================================================================

import * as THREE from 'three';
import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';
import { STUD_PITCH }        from '../utils/Constants.js';

// Layer-Konstanten
const LAYER_CAMERA   = 0;   // Kamera rendert nur Layer 0
const LAYER_INACTIVE = 1;   // Originalgeometrien inaktiver Bauteile


// =====================================================================
// Hilfe: Merged-Geometrie für einen Bauteiltyp erzeugen
// =====================================================================

/**
 * Erzeugt eine vollständige, zusammengeführte Geometrie für den
 * angegebenen Bauteiltyp. Alle Sub-Meshes werden in den lokalen
 * Raum der Bauteilgruppe transformiert und zusammengeführt.
 *
 * Unterstützte Typen: brick, plate, tile, slope, window, technic.
 * Technic-Löcher werden weggelassen, da sie ein anderes Material
 * benötigen würden.
 *
 * @param {object} definition  PART_DEFINITIONS-Eintrag
 * @returns {THREE.BufferGeometry}
 */
function buildMergedGeometryForDefinition(definition) {
    const W = definition.width  * STUD_PITCH;
    const H = definition.height;
    const D = definition.depth  * STUD_PITCH;

    const parts = [];

    const geomType = definition.geometry ?? 'brick';

    if (geomType === 'slope') {
        // Schrägstein: benutzerdefinierte Geometrie
        const geo = _buildSlopeGeo(W, H, D);
        parts.push(geo);

    } else if (geomType === 'window') {
        // Fensterrahmen: 4 Balken
        const t = 0.15 * STUD_PITCH;
        const pieces = [
            [0, H - t / 2, 0, W, t, D],
            [0, t / 2,     0, W, t, D],
            [-W / 2 + t / 2, H / 2, 0, t, H, D],
            [ W / 2 - t / 2, H / 2, 0, t, H, D]
        ];
        for (const [px, py, pz, sx, sy, sz] of pieces) {
            const g = new THREE.BoxGeometry(sx, sy, sz);
            g.applyMatrix4(new THREE.Matrix4().makeTranslation(px, py, pz));
            parts.push(g);
        }

    } else {
        // brick / plate / tile / technic (Körper ohne Löcher)
        const bodyGeo = new THREE.BoxGeometry(W, H, D);
        bodyGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, H / 2, 0));
        parts.push(bodyGeo);

        // Noppen (falls vorhanden)
        if (definition.studs !== false) {
            const studR  = 0.3;
            const studH  = 0.24;
            const studGeo = new THREE.CylinderGeometry(studR, studR, studH, 16);

            const startX = -((definition.width  - 1) * STUD_PITCH) / 2;
            const startZ = -((definition.depth - 1) * STUD_PITCH) / 2;

            for (let xi = 0; xi < definition.width; xi++) {
                for (let zi = 0; zi < definition.depth; zi++) {
                    const sx = startX + xi * STUD_PITCH;
                    const sy = H + studH / 2;
                    const sz = startZ + zi * STUD_PITCH;

                    const g = studGeo.clone();
                    g.applyMatrix4(
                        new THREE.Matrix4().makeTranslation(sx, sy, sz)
                    );
                    parts.push(g);
                }
            }
        }
    }

    if (parts.length === 1) return parts[0];

    // Geometrien zusammenführen
    return _mergeGeometries(parts);
}


/** Schrägstein-Geometrie (identisch zu Brick.js) */
function _buildSlopeGeo(W, H, D) {
    const verts = new Float32Array([
        -W/2, 0, -D/2,
         W/2, 0, -D/2,
         W/2, 0,  D/2,
        -W/2, 0,  D/2,
        -W/2, H, -D/2,
         W/2, H, -D/2
    ]);
    const idx = new Uint16Array([
        0, 1, 2,   0, 2, 3,
        0, 4, 5,   0, 5, 1,
        0, 3, 4,
        1, 5, 2,
        4, 2, 5,   4, 3, 2
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(Array.from(idx));
    geo.computeVertexNormals();
    return geo;
}


/**
 * Einfaches Zusammenführen mehrerer BufferGeometries ohne externen
 * Util-Import. Nur position + normal werden übernommen.
 */
function _mergeGeometries(geos) {
    const posArrays  = [];
    const normArrays = [];
    let   totalVerts = 0;

    for (const g of geos) {
        const pos  = g.getAttribute('position');
        const norm = g.getAttribute('normal');
        if (!pos) continue;

        // Normalen berechnen falls fehlend
        if (!norm) g.computeVertexNormals();

        posArrays.push(g.getAttribute('position').array);
        normArrays.push(g.getAttribute('normal')?.array ?? new Float32Array(pos.count * 3));
        totalVerts += pos.count;
    }

    const merged = new THREE.BufferGeometry();
    const posFlat  = new Float32Array(totalVerts * 3);
    const normFlat = new Float32Array(totalVerts * 3);
    let   offset   = 0;

    for (let i = 0; i < posArrays.length; i++) {
        posFlat.set(posArrays[i],  offset);
        normFlat.set(normArrays[i], offset);
        offset += posArrays[i].length;
    }

    merged.setAttribute('position', new THREE.BufferAttribute(posFlat,  3));
    merged.setAttribute('normal',   new THREE.BufferAttribute(normFlat, 3));

    // Originale freigeben
    for (const g of geos) g.dispose();

    return merged;
}


// =====================================================================
// InstanceGroup – Interne Datenstruktur pro (type, color)-Kombination
// =====================================================================

class InstanceGroup {

    /**
     * @param {string}              groupKey   z. B. "brick_2x4_16711680"
     * @param {THREE.BufferGeometry} geometry
     * @param {number}              color
     * @param {THREE.Scene}         scene
     */
    constructor(groupKey, geometry, color, scene) {
        this.groupKey = groupKey;
        this.scene    = scene;

        /** Bauteil-IDs in der Reihenfolge ihrer Instanz-Indizes. */
        this.brickIds = [];

        this._geometry = geometry;
        this._material = new THREE.MeshStandardMaterial({ color });
        this._material.castShadow    = true;
        this._material.receiveShadow = true;

        /** @type {THREE.InstancedMesh | null} */
        this.mesh = null;
    }


    // ------------------------------------------------------------------
    // Aufbau / Aktualisierung
    // ------------------------------------------------------------------

    /**
     * Erstellt oder ersetzt das InstancedMesh. Muss aufgerufen werden,
     * nachdem brickIds befüllt oder verändert wurde.
     *
     * @param {Map<string, import('../objects/Brick.js').Brick>} brickMap   id → Brick
     */
    rebuild(brickMap) {
        this._disposeInstancedMesh();

        const count = this.brickIds.length;
        if (count === 0) return;

        this.mesh              = new THREE.InstancedMesh(this._geometry, this._material, count);
        this.mesh.castShadow    = true;
        this.mesh.receiveShadow = true;
        this.mesh.layers.set(LAYER_CAMERA);

        // Metadaten für den Instanzierungs-Manager
        this.mesh.userData.instanceGroupKey = this.groupKey;

        const matrix = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            const brick = brickMap.get(this.brickIds[i]);
            if (brick) {
                brick.group.updateMatrixWorld(true);
                matrix.copy(brick.group.matrixWorld);
            } else {
                matrix.makeScale(0, 0, 0);   // versteckt fehlende Instanz
            }
            this.mesh.setMatrixAt(i, matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);
    }


    /**
     * Aktualisiert die Matrix einer einzelnen Instanz.
     * @param {string}                                           brickId
     * @param {import('../objects/Brick.js').Brick | null}       brick
     */
    updateInstance(brickId, brick) {
        if (!this.mesh) return;
        const idx = this.brickIds.indexOf(brickId);
        if (idx === -1) return;

        const matrix = new THREE.Matrix4();
        if (brick) {
            brick.group.updateMatrixWorld(true);
            matrix.copy(brick.group.matrixWorld);
        } else {
            matrix.makeScale(0, 0, 0);
        }
        this.mesh.setMatrixAt(idx, matrix);
        this.mesh.instanceMatrix.needsUpdate = true;
    }


    /**
     * Versteckt eine einzelne Instanz (z. B. bei Auswahl / Interaktion).
     * @param {string} brickId
     */
    hideInstance(brickId) {
        if (!this.mesh) return;
        const idx = this.brickIds.indexOf(brickId);
        if (idx === -1) return;
        const m = new THREE.Matrix4().makeScale(0, 0, 0);
        this.mesh.setMatrixAt(idx, m);
        this.mesh.instanceMatrix.needsUpdate = true;
    }


    /** Gibt instanceId für eine brickId zurück (-1 = nicht vorhanden). */
    getInstanceIndex(brickId) {
        return this.brickIds.indexOf(brickId);
    }


    /** Gibt die brickId für einen instanceId zurück. */
    getBrickId(instanceId) {
        return this.brickIds[instanceId] ?? null;
    }


    _disposeInstancedMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
    }


    dispose() {
        this._disposeInstancedMesh();
        this._material.dispose();
        // Geometrie wird vom InstanceManager verwaltet
    }
}


// =====================================================================
// InstanceManager
// =====================================================================

export class InstanceManager {

    /**
     * @param {THREE.Scene}                                         scene
     * @param {import('../objects/PartLibrary.js').PartLibrary}     library
     */
    constructor(scene, library) {
        this._scene   = scene;
        this._library = library;

        /** @type {boolean} */
        this._enabled = false;

        /** @type {Map<string, InstanceGroup>} groupKey → InstanceGroup */
        this._groups = new Map();

        /** @type {Map<string, string>} brickId → groupKey */
        this._brickToGroup = new Map();

        /**
         * brickIds die gerade "aktiv" sind (ausgewählt / in Interaktion).
         * Ihre Originalgruppen-Meshes sind auf Layer 0, ihre Instanz ist
         * versteckt.
         * @type {Set<string>}
         */
        this._activeBricks = new Set();

        /** @type {Map<string, THREE.BufferGeometry>} type → merged geometry */
        this._geometryCache = new Map();
    }


    // ------------------------------------------------------------------
    // Aktivierung / Deaktivierung
    // ------------------------------------------------------------------

    get enabled() { return this._enabled; }


    /**
     * Instanzierung aktivieren. Baut InstancedMeshes aus der aktuellen
     * Bibliothek auf und versetzt Brick-Meshes auf Layer 1.
     */
    enable() {
        if (this._enabled) return;
        this._enabled = true;
        this.rebuild();
    }


    /**
     * Instanzierung deaktivieren. Stellt alle Originalgeometrien wieder
     * her und entfernt alle InstancedMesh-Objekte.
     */
    disable() {
        if (!this._enabled) return;

        // Alle Meshes auf Layer 0 zurücksetzen
        for (const brick of this._library.getAll()) {
            this._setMeshLayer(brick, LAYER_CAMERA);
        }

        // Alle InstanceGroups entleeren
        for (const group of this._groups.values()) {
            group.dispose();
        }
        this._groups.clear();
        this._brickToGroup.clear();
        this._activeBricks.clear();

        this._enabled = false;
    }


    /**
     * Baut alle InstanceGroups vollständig neu auf. Aufrufen wenn:
     *   – Bauteile hinzugefügt / entfernt wurden
     *   – Farben geändert wurden
     *   – Gruppen / Baugruppen geändert wurden
     */
    rebuild() {
        if (!this._enabled) return;

        // Alte Groups entfernen
        for (const group of this._groups.values()) {
            group.dispose();
        }
        this._groups.clear();
        this._brickToGroup.clear();
        this._activeBricks.clear();

        const bricks  = this._library.getAll();
        const brickMap = new Map(bricks.map(b => [b.id, b]));

        // Bricks nach (type, color) gruppieren
        for (const brick of bricks) {
            const key      = this._groupKey(brick.type, brick.color);
            let   ig       = this._groups.get(key);

            if (!ig) {
                const geo = this._getOrBuildGeometry(brick.type);
                ig = new InstanceGroup(key, geo, brick.color, this._scene);
                this._groups.set(key, ig);
            }

            ig.brickIds.push(brick.id);
            this._brickToGroup.set(brick.id, key);
        }

        // InstancedMeshes erstellen
        for (const ig of this._groups.values()) {
            ig.rebuild(brickMap);
        }

        // Originalgeometrien verstecken (Layer 1)
        for (const brick of bricks) {
            this._setMeshLayer(brick, LAYER_INACTIVE);
        }
    }


    // ------------------------------------------------------------------
    // Einzelne Bauteile verwalten
    // ------------------------------------------------------------------

    /**
     * Fügt ein neues Bauteil zum Instancing hinzu.
     * Einfache Variante: rebuild() aufrufen wenn viele Bauteile auf
     * einmal hinzugefügt werden; für Einzelzugaben wird die bestehende
     * Gruppe erweitert.
     * @param {import('../objects/Brick.js').Brick} brick
     */
    addBrick(brick) {
        if (!this._enabled) return;

        const key = this._groupKey(brick.type, brick.color);
        let   ig  = this._groups.get(key);

        if (!ig) {
            const geo = this._getOrBuildGeometry(brick.type);
            ig = new InstanceGroup(key, geo, brick.color, this._scene);
            this._groups.set(key, ig);
        }

        ig.brickIds.push(brick.id);
        this._brickToGroup.set(brick.id, key);

        // Gruppe neu aufbauen
        const brickMap = new Map(
            this._library.getAll().map(b => [b.id, b])
        );
        ig.rebuild(brickMap);

        // Original verstecken
        this._setMeshLayer(brick, LAYER_INACTIVE);
    }


    /**
     * Entfernt ein Bauteil aus dem Instancing.
     * @param {string} brickId
     */
    onBrickRemoved(brickId) {
        if (!this._enabled) return;

        const key = this._brickToGroup.get(brickId);
        if (!key) return;

        const ig = this._groups.get(key);
        if (!ig) return;

        ig.brickIds = ig.brickIds.filter(id => id !== brickId);
        this._brickToGroup.delete(brickId);
        this._activeBricks.delete(brickId);

        if (ig.brickIds.length === 0) {
            ig.dispose();
            this._groups.delete(key);
        } else {
            const brickMap = new Map(
                this._library.getAll().map(b => [b.id, b])
            );
            ig.rebuild(brickMap);
        }
    }


    /**
     * Aktualisiert die Matrix-Instanz nach einer Transformation.
     * @param {string} brickId
     */
    updateBrickMatrix(brickId) {
        if (!this._enabled) return;

        const key = this._brickToGroup.get(brickId);
        if (!key) return;

        const ig    = this._groups.get(key);
        const brick = this._library.getById(brickId);
        ig?.updateInstance(brickId, brick ?? null);
    }


    // ------------------------------------------------------------------
    // Interaktions-Verwaltung (Auswahl / Transformation)
    // ------------------------------------------------------------------

    /**
     * Aktiviert ein Bauteil: zeigt die Originalgeometrie (Layer 0) und
     * versteckt seine InstancedMesh-Instanz.
     * @param {string} brickId
     * @returns {import('../objects/Brick.js').Brick | null}
     */
    activateBrick(brickId) {
        if (!this._enabled) return null;

        const brick = this._library.getById(brickId);
        if (!brick) return null;

        this._activeBricks.add(brickId);

        // Originalgeometrie sichtbar machen
        this._setMeshLayer(brick, LAYER_CAMERA);

        // Instanz im InstancedMesh verstecken
        const key = this._brickToGroup.get(brickId);
        this._groups.get(key)?.hideInstance(brickId);

        return brick;
    }


    /**
     * Deaktiviert ein Bauteil: versteckt die Originalgeometrie (Layer 1)
     * und restauriert die InstancedMesh-Instanz.
     * @param {string} brickId
     */
    deactivateBrick(brickId) {
        if (!this._enabled) return;

        this._activeBricks.delete(brickId);

        const brick = this._library.getById(brickId);
        if (!brick) return;

        // Originalgeometrie verbergen
        this._setMeshLayer(brick, LAYER_INACTIVE);

        // Instanz im InstancedMesh restaurieren
        const key = this._brickToGroup.get(brickId);
        const ig  = this._groups.get(key);
        ig?.updateInstance(brickId, brick);
    }


    /**
     * Deaktiviert alle aktuell aktiven Bauteile.
     */
    deactivateAll() {
        if (!this._enabled) return;
        for (const brickId of [...this._activeBricks]) {
            this.deactivateBrick(brickId);
        }
    }


    // ------------------------------------------------------------------
    // Raycasting-Hilfsmethoden
    // ------------------------------------------------------------------

    /**
     * Gibt alle InstancedMesh-Objekte zurück (für externe Raycaster).
     * @returns {THREE.InstancedMesh[]}
     */
    getInstancedMeshes() {
        const meshes = [];
        for (const ig of this._groups.values()) {
            if (ig.mesh) meshes.push(ig.mesh);
        }
        return meshes;
    }


    /**
     * Löst einen Raycaster-Treffer auf eine InstancedMesh auf und gibt
     * die zugehörige brickId zurück.
     *
     * @param {THREE.Object3D} object      Getroffenes Objekt
     * @param {number}         instanceId  Instanz-Index
     * @returns {string | null}
     */
    resolveHit(object, instanceId) {
        const key = object.userData?.instanceGroupKey;
        if (!key) return null;
        return this._groups.get(key)?.getBrickId(instanceId) ?? null;
    }


    // ------------------------------------------------------------------
    // Hilfsmethoden
    // ------------------------------------------------------------------

    _groupKey(type, color) {
        return `${type}_${color}`;
    }


    /**
     * Setzt alle Meshes innerhalb der Bauteilgruppe auf den
     * angegebenen Layer.
     * @param {import('../objects/Brick.js').Brick} brick
     * @param {number} layer
     */
    _setMeshLayer(brick, layer) {
        brick.group.traverse(obj => {
            if (obj.isMesh) {
                obj.layers.set(layer);
            }
        });
    }


    /**
     * Gibt die gecachte Merged-Geometrie für einen Typ zurück oder
     * erstellt sie neu.
     * @param {string} type
     * @returns {THREE.BufferGeometry}
     */
    _getOrBuildGeometry(type) {
        if (this._geometryCache.has(type)) {
            return this._geometryCache.get(type);
        }
        const definition = PART_DEFINITIONS[type];
        if (!definition) {
            // Fallback: einfacher Quader
            return new THREE.BoxGeometry(1, 1, 1);
        }
        const geo = buildMergedGeometryForDefinition(definition);
        this._geometryCache.set(type, geo);
        return geo;
    }


    /** Gibt alle Ressourcen frei. */
    dispose() {
        this.disable();
        for (const geo of this._geometryCache.values()) {
            geo.dispose();
        }
        this._geometryCache.clear();
    }
}
