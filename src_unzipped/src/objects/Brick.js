
import * as THREE from 'three';

import { STUD_PITCH } from '../utils/Constants.js';
import { PART_DEFINITIONS } from './PartDefinitions.js';

// =====================================================================
// ID-Generator
// =====================================================================

function generateBrickId() {
    if (typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function') {
        return `brick-${crypto.randomUUID()}`;
    }
    return `brick-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}


// =====================================================================
// Hilfsgeometrie: Slope (Keilform / Schrägstein)
//
// Vertices (im lokalen Raum, Ursprung = Unterkante-Mitte):
//   0: back-left-bottom   (-W/2, 0,  -D/2)
//   1: back-right-bottom  ( W/2, 0,  -D/2)
//   2: front-right-bottom ( W/2, 0,   D/2)
//   3: front-left-bottom  (-W/2, 0,   D/2)
//   4: back-left-top      (-W/2, H,  -D/2)
//   5: back-right-top     ( W/2, H,  -D/2)
//
// Die Neigung geht von der vollen Höhe an der Rückseite auf 0
// an der Vorderseite (klassischer LEGO-45°-Slope).
// =====================================================================

function buildSlopeGeometry(W, H, D) {
    const verts = new Float32Array([
        -W/2, 0, -D/2,   //  0  back-left-bottom
         W/2, 0, -D/2,   //  1  back-right-bottom
         W/2, 0,  D/2,   //  2  front-right-bottom
        -W/2, 0,  D/2,   //  3  front-left-bottom
        -W/2, H, -D/2,   //  4  back-left-top
         W/2, H, -D/2    //  5  back-right-top
    ]);

    // Dreiecke mit CCW-Wicklung (outward normals):
    // Bottom (-Y): 0,1,2  0,2,3
    // Back   (-Z): 0,4,5  0,5,1
    // Left   (-X): 0,3,4
    // Right  (+X): 1,5,2
    // Slope  (up+fwd): 4,2,5  4,3,2
    const idx = new Uint16Array([
        0, 1, 2,   0, 2, 3,   // bottom
        0, 4, 5,   0, 5, 1,   // back wall
        0, 3, 4,              // left triangle
        1, 5, 2,              // right triangle
        4, 2, 5,   4, 3, 2    // angled top
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(Array.from(idx));
    geo.computeVertexNormals();
    return geo;
}


// =====================================================================
// Hilfsgeometrie: Fensterrahmen (Hohlkasten)
//
// Vier Balken bilden einen rechteckigen Rahmen. Es gibt keine echte
// Boole'sche Subtraktion in Three.js – wir simulieren den Rahmen mit
// vier Quader-Meshes (oben, unten, links, rechts).
// =====================================================================

function buildWindowFrameMeshes(W, H, D, material) {
    const t = 0.15 * STUD_PITCH;   // Rahmenbreite (Wandstärke)
    const meshes = [];

    const pieces = [
        // [bx, by, bz, sx, sy, sz]  — Position und Größe des Balkens
        [0,     H/2,     0,   W,  t,  D],  // oben
        [0,     t/2,     0,   W,  t,  D],  // unten
        [-W/2 + t/2, H/2, 0,  t,  H,  D],  // links
        [ W/2 - t/2, H/2, 0,  t,  H,  D],  // rechts
    ];

    for (const [px, py, pz, sx, sy, sz] of pieces) {
        const geo = new THREE.BoxGeometry(sx, sy, sz);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(px, py, pz);
        mesh.castShadow = true;
        meshes.push(mesh);
    }

    return meshes;
}


// =====================================================================
// Brick-Klasse
// =====================================================================

export class Brick {

    constructor(
        scene,
        x,
        y,
        z,
        color,
        type = 'brick_2x4',
        id = null
    ) {
        const definition = PART_DEFINITIONS[type];

        if (!definition) {
            throw new Error(`Unbekannter Bauteiltyp: ${type}`);
        }

        // Eindeutige ID
        this.id = id || generateBrickId();

        // Grundeigenschaften
        this.type   = type;
        this.color  = Number(color);

        if (!Number.isFinite(this.color)) {
            throw new Error('Ungültige Steinfarbe.');
        }

        // Abmessungen aus der Definition
        this.width    = definition.width;
        this.depth    = definition.depth;
        this.height   = definition.height;
        this.geometry = definition.geometry ?? 'brick';
        this.studs    = definition.studs    ?? true;

        // THREE.Group als Wurzel
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);

        // Metadaten an der Gruppe
        this.group.userData.brickId = this.id;
        this.group.userData.type    = this.type;
        this.group.userData.color   = this.color;

        // Geometrie aufbauen
        this._buildGeometry();

        scene.add(this.group);
    }


    // -----------------------------------------------------------------
    // Geometrie-Dispatcher
    // -----------------------------------------------------------------

    _buildGeometry() {

        switch (this.geometry) {

            case 'plate':
                this._buildBox();
                if (this.studs) this._buildStuds();
                break;

            case 'tile':
                this._buildBox();
                // Keine Noppen
                break;

            case 'slope':
                this._buildSlope();
                break;

            case 'technic':
                this._buildTechnicBeam();
                break;

            case 'window':
                this._buildWindowFrame();
                break;

            case 'brick':
            default:
                this._buildBox();
                if (this.studs) this._buildStuds();
                break;
        }
    }


    // -----------------------------------------------------------------
    // Normaler Quader (für brick, plate, tile)
    // -----------------------------------------------------------------

    _buildBox() {
        const geo = new THREE.BoxGeometry(
            this.width  * STUD_PITCH,
            this.height,
            this.depth  * STUD_PITCH
        );

        const mat = new THREE.MeshStandardMaterial({ color: this.color });

        this.body = new THREE.Mesh(geo, mat);
        this.body.position.y = this.height / 2;
        this.body.castShadow    = true;
        this.body.receiveShadow = true;

        this.group.add(this.body);
    }


    // -----------------------------------------------------------------
    // Noppen (Studs)
    // -----------------------------------------------------------------

    _buildStuds() {
        const studR = 0.3;
        const studH = 0.24;

        const geo = new THREE.CylinderGeometry(studR, studR, studH, 16);
        const mat = new THREE.MeshStandardMaterial({ color: this.color });

        const startX = -((this.width - 1) * STUD_PITCH) / 2;
        const startZ = -((this.depth - 1) * STUD_PITCH) / 2;

        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                const stud = new THREE.Mesh(geo, mat);
                stud.position.set(
                    startX + x * STUD_PITCH,
                    this.height + studH / 2,
                    startZ + z * STUD_PITCH
                );
                stud.castShadow    = true;
                stud.receiveShadow = true;
                this.group.add(stud);
            }
        }
    }


    // -----------------------------------------------------------------
    // Schrägstein-Geometrie
    // -----------------------------------------------------------------

    _buildSlope() {
        const W = this.width  * STUD_PITCH;
        const H = this.height;
        const D = this.depth  * STUD_PITCH;

        const geo = buildSlopeGeometry(W, H, D);
        const mat = new THREE.MeshStandardMaterial({ color: this.color });

        this.body = new THREE.Mesh(geo, mat);
        // Geometry-Ursprung liegt bereits bei y=0 (Unterkante)
        this.body.castShadow    = true;
        this.body.receiveShadow = true;

        this.group.add(this.body);
    }


    // -----------------------------------------------------------------
    // Technic-Balken: Quader + Löcher (dunkle Zylinder an den Seiten)
    // -----------------------------------------------------------------

    _buildTechnicBeam() {
        // Körper
        this._buildBox();

        // Technic-Löcher: eine Reihe Zylinder entlang der X-Achse
        const holeR  = 0.25;
        const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

        for (let i = 0; i < this.width; i++) {
            const x = (-(this.width - 1) / 2 + i) * STUD_PITCH;
            const y = this.height / 2;

            // Zylinder entlang Z-Achse (seitliches Loch)
            const geoSide = new THREE.CylinderGeometry(
                holeR, holeR, this.depth * STUD_PITCH * 1.02, 12
            );
            geoSide.rotateX(Math.PI / 2);

            const holeSide = new THREE.Mesh(geoSide, holeMat);
            holeSide.position.set(x, y, 0);
            this.group.add(holeSide);
        }
    }


    // -----------------------------------------------------------------
    // Fensterrahmen: vier Quader als Rahmen
    // -----------------------------------------------------------------

    _buildWindowFrame() {
        const mat = new THREE.MeshStandardMaterial({ color: this.color });
        const W   = this.width  * STUD_PITCH;
        const H   = this.height;
        const D   = this.depth  * STUD_PITCH;

        const frameMeshes = buildWindowFrameMeshes(W, H, D, mat);
        for (const m of frameMeshes) {
            m.castShadow    = true;
            m.receiveShadow = true;
            this.group.add(m);
        }
    }


    // -----------------------------------------------------------------
    // Transform / Farbe / Serialisierung
    // -----------------------------------------------------------------

    setTransform(position, rotation) {
        this.group.position.set(position.x, position.y, position.z);
        this.group.rotation.set(rotation.x, rotation.y, rotation.z);
        this.group.updateMatrixWorld(true);
    }

    setColor(color) {
        const numericColor = Number(color);

        if (!Number.isFinite(numericColor)) {
            throw new Error('Ungültige Steinfarbe.');
        }

        this.color = numericColor;

        this.group.traverse((object) => {
            if (object.isMesh && object.material) {
                // Technic-Löcher (schwarz) und Rahmenmaterial beibehalten
                if (object.material.color.getHex() !== 0x1a1a1a) {
                    object.material.color.setHex(this.color);
                }
            }
        });

        this.group.userData.color = this.color;
    }

    toData() {
        return {
            id:   this.id,
            type: this.type,
            color: this.color,
            position: {
                x: this.group.position.x,
                y: this.group.position.y,
                z: this.group.position.z
            },
            rotation: {
                x: this.group.rotation.x,
                y: this.group.rotation.y,
                z: this.group.rotation.z
            }
        };
    }

    dispose() {
        const geos  = new Set();
        const mats  = new Set();

        this.group.traverse((object) => {
            if (!object.isMesh) return;
            if (object.geometry) geos.add(object.geometry);
            if (Array.isArray(object.material)) {
                object.material.forEach(m => mats.add(m));
            } else if (object.material) {
                mats.add(object.material);
            }
        });

        geos.forEach(g => g.dispose());
        mats.forEach(m => m.dispose());
        this.group.removeFromParent();
    }
}
