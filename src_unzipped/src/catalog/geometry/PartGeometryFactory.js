import * as THREE from 'three';
import { Brick }             from '../../objects/Brick.js';
import { PART_DEFINITIONS }  from '../../objects/PartDefinitions.js';
import { PartGeometryLoader } from './PartGeometryLoader.js';

export class PartGeometryFactory {

    /**
     * @param {{
     *   ldrawManager?: import('../ldraw/LDrawManager.js').LDrawManager,
     *   normalizer?:   import('./PartGeometryNormalizer.js').PartGeometryNormalizer
     * }} [options]
     */
    constructor({ ldrawManager = null, normalizer = null } = {}) {
        this._ldrawManager = ldrawManager;
        this._loader = ldrawManager
            ? new PartGeometryLoader({ ldrawManager, normalizer })
            : null;
    }

    /**
     * Erstellt eine lokale Brick-Geometrie für ein PART_DEFINITIONS-Teil.
     *
     * @param {string} partId
     * @param {number} [color]
     * @returns {{ object3D: THREE.Object3D, dimensions: object, release: Function }}
     */
    createLocalGeometry(partId, color = 0x4488ff) {
        const def = PART_DEFINITIONS[partId];

        if (!def) {
            throw new Error(
                `PartGeometryFactory: Teil "${partId}" ist nicht in PART_DEFINITIONS vorhanden.`
            );
        }

        // Brick in eine temporäre Szene laden
        const dummyScene = new THREE.Scene();
        const brick      = new Brick(dummyScene, 0, 0, 0, color, partId);
        const group      = brick.group;

        // Aus der Dummy-Szene herauslösen
        dummyScene.remove(group);

        return {
            object3D:   group,
            dimensions: {
                width:  def.width,
                depth:  def.depth,
                height: def.height
            },
            release: () => {
                brick.dispose();
            }
        };
    }

    /**
     * Lädt ein LDraw-Bauteil asynchron und gibt eine Instanz zurück.
     *
     * @param {string} ldrawPartNumber
     * @returns {Promise<{ object3D: THREE.Object3D, dimensions: object, release: Function }>}
     */
    async createLDrawGeometry(ldrawPartNumber) {
        if (!this._loader) {
            throw new Error(
                'PartGeometryFactory: Kein LDrawManager konfiguriert.'
            );
        }

        const { object3D, dimensions } = await this._loader.load(ldrawPartNumber);

        return {
            object3D,
            dimensions,
            release: () => {
                this._ldrawManager.releasePart(object3D);
            }
        };
    }

    /**
     * Gibt an, ob LDraw-Geometrien erzeugt werden können.
     *
     * @returns {boolean}
     */
    canCreateLDraw() {
        return this._loader !== null;
    }
}
