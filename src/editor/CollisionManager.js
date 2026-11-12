
import {
    COLLISION_EPSILON,
    STUD_PITCH
} from '../utils/Constants.js';

import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';

// =====================================================================
// CollisionManager
//
// Erkennt Kollisionen zwischen platzierten Bauteilen und Kandidaten.
// Verwendet Axis-Aligned Bounding Boxes (AABB).
// Liest Breite, Tiefe und Höhe aus PART_DEFINITIONS – damit werden alle
// neuen Bauteiltypen automatisch ohne Codeänderung unterstützt.
// =====================================================================

export class CollisionManager {

    /**
     * Berechnet die AABB eines Kandidaten (Typ + Position + Rotation).
     *
     * @param {string} type     – Bauteil-ID
     * @param {object} position – { x, y, z }
     * @param {number} rotation – Rotation in Radiant (Y-Achse)
     * @returns {{ minX, maxX, minY, maxY, minZ, maxZ } | null}
     */
    getBounds(type, position, rotation) {

        const definition = PART_DEFINITIONS[type];

        if (!definition) return null;

        const quarterTurn = Math.round(rotation / (Math.PI / 2));
        const swapped     = Math.abs(quarterTurn) % 2 === 1;

        const width = (swapped ? definition.depth : definition.width) * STUD_PITCH;
        const depth = (swapped ? definition.width : definition.depth) * STUD_PITCH;

        return {
            minX: position.x - width / 2,
            maxX: position.x + width / 2,

            minY: position.y,
            maxY: position.y + definition.height,

            minZ: position.z - depth / 2,
            maxZ: position.z + depth / 2
        };
    }

    /**
     * Berechnet die AABB eines bereits platzierten Brick-Objekts.
     *
     * @param {Brick} brick
     * @returns {{ minX, maxX, minY, maxY, minZ, maxZ }}
     */
    getBrickBounds(brick) {

        const quarterTurn = Math.round(
            brick.group.rotation.y / (Math.PI / 2)
        );

        const swapped = Math.abs(quarterTurn) % 2 === 1;

        const width = (swapped ? brick.depth : brick.width) * STUD_PITCH;
        const depth = (swapped ? brick.width : brick.depth) * STUD_PITCH;

        const position = brick.group.position;

        return {
            minX: position.x - width / 2,
            maxX: position.x + width / 2,

            minY: position.y,
            maxY: position.y + brick.height,

            minZ: position.z - depth / 2,
            maxZ: position.z + depth / 2
        };
    }

    /**
     * Prüft, ob sich zwei AABBs überlappen.
     * Ein kleines Epsilon verhindert False Positives bei
     * exakt aneinanderstoßenden Bauteilen.
     */
    hasVolumeOverlap(a, b) {

        const epsilon = COLLISION_EPSILON;

        return (
            a.minX < b.maxX - epsilon &&
            a.maxX > b.minX + epsilon &&

            a.minY < b.maxY - epsilon &&
            a.maxY > b.minY + epsilon &&

            a.minZ < b.maxZ - epsilon &&
            a.maxZ > b.minZ + epsilon
        );
    }

    /**
     * Prüft, ob ein Kandidat (type + position + rotation) mit einem
     * der vorhandenen Bauteile kollidiert.
     *
     * @returns {boolean} true = Kollision vorhanden
     */
    checkCollision(type, position, rotation, bricks) {

        const candidate = this.getBounds(type, position, rotation);

        if (!candidate) return true;

        for (const brick of bricks) {
            const existing = this.getBrickBounds(brick);
            if (this.hasVolumeOverlap(candidate, existing)) {
                return true;
            }
        }

        return false;
    }
}
