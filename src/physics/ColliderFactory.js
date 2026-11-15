/**
 * ColliderFactory – Erzeugt Rapier-Collider für Bauteile (Phase G.2/G.3)
 *
 * Wählt den optimalen Collider-Typ basierend auf Bauteileigenschaften:
 *  - Box für rechteckige Steine und Platten
 *  - Zylinder für runde Bauteile
 *  - Kapsel für längliche zylindrische Bauteile
 *  - Convex Hull für komplexe dynamische Bauteile
 *
 * @module ColliderFactory
 *
 * @example
 * const factory = new ColliderFactory({ adapter, resolver });
 * const descs = factory.createCollidersForPart(partDef, material);
 */
import { ColliderDefinitionResolver } from './ColliderDefinitionResolver.js';

// ---------------------------------------------------------------------------
// Hilfskonstante
// ---------------------------------------------------------------------------

/** @type {number} Umrechnungsfaktor Stud → Meter (lokale Referenz) */
const S2M = ColliderDefinitionResolver.STUD_TO_METER;

// ---------------------------------------------------------------------------
// Hauptklasse
// ---------------------------------------------------------------------------

/**
 * Erzeugt Rapier-ColliderDesc-Objekte für Bauteile.
 *
 * Benötigt einen {@link PhysicsEngineAdapter} für den Rapier-API-Zugriff und
 * einen {@link ColliderDefinitionResolver} (statisch nutzbar) für die
 * Form-Auflösung.
 */
export class ColliderFactory {
    /**
     * Erstellt eine neue ColliderFactory.
     *
     * @param {object}                                      params          - Abhängigkeiten.
     * @param {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter} params.adapter  - Initialisierter Rapier-Adapter.
     * @param {typeof ColliderDefinitionResolver}           [params.resolver] - Optionaler Resolver (Standard: ColliderDefinitionResolver).
     * @throws {TypeError} Wenn `adapter` fehlt oder kein Adapter ist.
     */
    constructor({ adapter, resolver } = {}) {
        if (!adapter) {
            throw new TypeError(
                'ColliderFactory: `adapter` ist erforderlich.'
            );
        }

        /** @private @type {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter} */
        this._adapter = adapter;

        /** @private @type {typeof ColliderDefinitionResolver} */
        this._resolver = resolver ?? ColliderDefinitionResolver;
    }

    // -----------------------------------------------------------------------
    // Hauptmethoden
    // -----------------------------------------------------------------------

    /**
     * Erzeugt alle Collider-Beschreibungen für ein Bauteil.
     *
     * Löst den Collider-Typ über den Resolver auf und erzeugt dann die
     * entsprechenden Rapier-Descriptoren. Gibt ein Array zurück (Compound-fähig).
     *
     * @param {object}                         partDef       - Bauteil-Definition aus dem PartCatalog.
     * @param {{ friction: number, restitution: number, density: number } | null} [material=null]
     *   Physikalisches Material; wenn null, werden Rapier-Standardwerte verwendet.
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc[]} Array von Collider-Beschreibungen.
     */
    createCollidersForPart(partDef, material = null) {
        const definitions = this._resolver.resolveMultiple(partDef);
        const descs = [];

        for (const def of definitions) {
            const desc = this._createFromDefinition(def, partDef, material);
            if (desc !== null) {
                descs.push(desc);
            }
        }

        // Sicherheitsnetz: mindestens ein Box-Collider aus Abmessungen
        if (descs.length === 0) {
            const { halfX, halfY, halfZ } = this._resolver.getHalfExtentsFromPartDef(partDef);
            const fallback = this._adapter.createBoxColliderDesc({ x: halfX, y: halfY, z: halfZ });
            this._applyMaterial(fallback, material);
            descs.push(fallback);
        }

        return descs;
    }

    // -----------------------------------------------------------------------
    // Konkrete Collider-Erzeuger
    // -----------------------------------------------------------------------

    /**
     * Erzeugt eine Box-ColliderDesc aus Stud-Abmessungen.
     *
     * Konvertiert Stud → Meter und bildet Halbausdehnungen.
     *
     * @param {number} width    - Breite in Stud.
     * @param {number} depth    - Tiefe in Stud.
     * @param {number} height   - Höhe in Stud.
     * @param {{ friction: number, restitution: number, density: number } | null} [material=null]
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc}
     */
    createBoxCollider(width, depth, height, material = null) {
        const halfExtents = {
            x: (width  * S2M) / 2,
            y: (height * S2M) / 2,
            z: (depth  * S2M) / 2,
        };
        const desc = this._adapter.createBoxColliderDesc(halfExtents);
        this._applyMaterial(desc, material);
        return desc;
    }

    /**
     * Erzeugt eine Kugel-ColliderDesc.
     *
     * @param {number} radius   - Radius in Metern (bereits konvertiert).
     * @param {{ friction: number, restitution: number, density: number } | null} [material=null]
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc}
     */
    createSphereCollider(radius, material = null) {
        const desc = this._adapter.createSphereColliderDesc(radius);
        this._applyMaterial(desc, material);
        return desc;
    }

    /**
     * Erzeugt eine Zylinder-ColliderDesc aus Bauteil-Abmessungen.
     *
     * Radius = halbe kleinste Grundflächen-Ausdehnung (Stud → Meter).
     *
     * @param {object} partDef           - Bauteil-Definition.
     * @param {number} [partDef.width]
     * @param {number} [partDef.depth]
     * @param {number} [partDef.height]
     * @param {{ friction: number, restitution: number, density: number } | null} [material=null]
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc}
     */
    createCylinderCollider(partDef, material = null) {
        const w = typeof partDef.width  === 'number' ? partDef.width  : 1;
        const d = typeof partDef.depth  === 'number' ? partDef.depth  : 1;
        const h = typeof partDef.height === 'number' ? partDef.height : 1.2;

        const radius     = (Math.min(w, d) * S2M) / 2;
        const halfHeight = (h * S2M) / 2;

        const desc = this._adapter.createCylinderColliderDesc(halfHeight, radius);
        this._applyMaterial(desc, material);
        return desc;
    }

    /**
     * Erzeugt eine Kapsel-ColliderDesc aus Bauteil-Abmessungen.
     *
     * @param {object} partDef           - Bauteil-Definition.
     * @param {number} [partDef.width]
     * @param {number} [partDef.depth]
     * @param {number} [partDef.height]
     * @param {{ friction: number, restitution: number, density: number } | null} [material=null]
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc}
     */
    createCapsuleCollider(partDef, material = null) {
        const w = typeof partDef.width  === 'number' ? partDef.width  : 1;
        const d = typeof partDef.depth  === 'number' ? partDef.depth  : 1;
        const h = typeof partDef.height === 'number' ? partDef.height : 1.2;

        const radius     = (Math.min(w, d) * S2M) / 2;
        const halfHeight = Math.max(0, (h * S2M) / 2 - radius);

        const desc = this._adapter.createCapsuleColliderDesc(halfHeight, radius);
        this._applyMaterial(desc, material);
        return desc;
    }

    /**
     * Erzeugt eine Convex-Hull-ColliderDesc aus einer Three.js-Geometrie.
     *
     * Gibt `null` zurück, wenn Rapier keine gültige konvexe Hülle berechnen kann.
     *
     * @param {{ attributes: { position: { array: Float32Array } } }} geometry
     *   Three.js BufferGeometry (oder kompatibles Objekt mit `attributes.position.array`).
     * @param {{ friction: number, restitution: number, density: number } | null} [material=null]
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc | null}
     */
    createConvexHullCollider(geometry, material = null) {
        const positions = geometry?.attributes?.position?.array;
        if (!positions || !(positions instanceof Float32Array)) {
            console.warn(
                'ColliderFactory.createConvexHullCollider: Keine gültige Float32Array-Positionen gefunden.'
            );
            return null;
        }

        const desc = this._adapter.createConvexHullColliderDesc(positions);
        if (desc === null) {
            console.warn(
                'ColliderFactory.createConvexHullCollider: Rapier konnte keine konvexe Hülle berechnen.'
            );
            return null;
        }

        this._applyMaterial(desc, material);
        return desc;
    }

    // -----------------------------------------------------------------------
    // Hilfsmethoden
    // -----------------------------------------------------------------------

    /**
     * Gibt die Halbausdehnungen eines Bauteils in Metern zurück.
     *
     * Delegiert an `ColliderDefinitionResolver.getHalfExtentsFromPartDef`.
     *
     * @param {object} partDef - Bauteil-Definition.
     * @returns {{ x: number, y: number, z: number }} Halbausdehnungen in Metern.
     */
    getHalfExtents(partDef) {
        const { halfX, halfY, halfZ } = this._resolver.getHalfExtentsFromPartDef(partDef);
        return { x: halfX, y: halfY, z: halfZ };
    }

    // -----------------------------------------------------------------------
    // Private Hilfsmethoden
    // -----------------------------------------------------------------------

    /**
     * Erstellt einen ColliderDesc aus einer ColliderDefinition.
     *
     * @private
     * @param {import('./ColliderDefinitionResolver.js').ColliderDefinition} def   - Aufgelöste Definition.
     * @param {object}                                                        partDef - Original-Bauteil für Fallback.
     * @param {{ friction: number, restitution: number, density: number } | null} material
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc | null}
     */
    _createFromDefinition(def, partDef, material) {
        switch (def.shape) {
            case 'box': {
                const { halfX, halfY, halfZ } = def.params;
                const desc = this._adapter.createBoxColliderDesc({ x: halfX, y: halfY, z: halfZ });
                this._applyMaterial(desc, material);
                return desc;
            }

            case 'cylinder': {
                const { halfHeight, radius } = def.params;
                const desc = this._adapter.createCylinderColliderDesc(halfHeight, radius);
                this._applyMaterial(desc, material);
                return desc;
            }

            case 'capsule': {
                const { halfHeight, radius } = def.params;
                const desc = this._adapter.createCapsuleColliderDesc(halfHeight, radius);
                this._applyMaterial(desc, material);
                return desc;
            }

            case 'sphere': {
                const { radius } = def.params;
                const desc = this._adapter.createSphereColliderDesc(radius);
                this._applyMaterial(desc, material);
                return desc;
            }

            default:
                console.warn(`ColliderFactory: Unbekannte Collider-Form "${def.shape}".`);
                return null;
        }
    }

    /**
     * Überträgt Materialeigenschaften auf eine ColliderDesc.
     *
     * Felder, die im Material-Objekt fehlen, werden übersprungen.
     *
     * @private
     * @param {import('@dimforge/rapier3d-compat').ColliderDesc} desc     - Zu ändernde Beschreibung.
     * @param {{ friction?: number, restitution?: number, density?: number } | null} material
     * @returns {void}
     */
    _applyMaterial(desc, material) {
        if (!material) return;
        this._adapter.setColliderProperties(desc, {
            friction:    material.friction,
            restitution: material.restitution,
            density:     material.density,
        });
    }
}
