import * as THREE from 'three';
import { STUD_PITCH } from '../../utils/Constants.js';

export class PartGeometryNormalizer {

    /**
     * Normalisiert ein geladenes Object3D so, dass:
     *  - der untere Rand der Bounding Box bei Y=0 liegt
     *  - der XZ-Mittelpunkt bei (0,0) liegt
     *
     * @param {THREE.Object3D} object3D
     * @returns {{ width: number, depth: number, height: number }}
     *   Abmessungen in Editor-Einheiten (STUD_PITCH = 1 Einheit = 1 Noppe)
     */
    normalize(object3D) {
        // Alle Weltmatrizen auf den neuesten Stand bringen
        object3D.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(object3D);

        // Fallback für leere Geometrie
        if (box.isEmpty()) {
            return { width: 1, depth: 1, height: 1.2 };
        }

        const size   = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // Verschiebung: Boden bei Y=0, Mittelpunkt XZ bei (0,0)
        object3D.position.x -= center.x;
        object3D.position.y -= box.min.y;
        object3D.position.z -= center.z;

        // Weltmatrizen nach der Verschiebung neu berechnen
        object3D.updateWorldMatrix(true, true);

        return this._dimensionsFromSize(size);
    }

    /**
     * Berechnet Abmessungen ohne die Position zu verändern.
     *
     * @param {THREE.Object3D} object3D
     * @returns {{ width: number, depth: number, height: number, boundingBox: THREE.Box3 }}
     */
    computeDimensions(object3D) {
        object3D.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(object3D);

        if (box.isEmpty()) {
            return {
                width:       1,
                depth:       1,
                height:      1.2,
                boundingBox: box
            };
        }

        const size = new THREE.Vector3();
        box.getSize(size);

        return {
            ...this._dimensionsFromSize(size),
            boundingBox: box
        };
    }

    /**
     * Rechnet einen THREE.Vector3-Größenwert in Editor-Einheiten um.
     * Breite und Tiefe werden auf die nächste Noppen-Anzahl gerundet (min. 1).
     * Die Höhe wird als exakter Welteinheitswert beibehalten.
     *
     * @param {THREE.Vector3} size
     * @returns {{ width: number, depth: number, height: number }}
     * @private
     */
    _dimensionsFromSize(size) {
        // Auf die nächste Noppen-Anzahl runden (mindestens 1)
        const width  = Math.max(1, Math.round(size.x / STUD_PITCH));
        const depth  = Math.max(1, Math.round(size.z / STUD_PITCH));
        const height = size.y; // exakte Höhe in Welteinheiten beibehalten

        return { width, depth, height };
    }
}
