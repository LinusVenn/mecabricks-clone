/**
 * PhysicsBodyFactory – Erstellt Rigid Bodies für PartInstances (Phase G.2)
 *
 * Erzeugt physikalische Körper aus PartInstance-Daten:
 *  - Bestimmt Body-Typ (dynamic/fixed/kinematic)
 *  - Berechnet Masse und Trägheitsmoment
 *  - Setzt Initialtransform
 *  - Wählt geeignete Collider über ColliderFactory
 *
 * @module PhysicsBodyFactory
 *
 * @example
 * const factory = new PhysicsBodyFactory({ adapter, colliderFactory, materialManager });
 * const { bodyDesc, colliderDescs } = factory.createBodyForInstance(instance, catalog);
 */
import { ColliderFactory } from './ColliderFactory.js';
import { PhysicsMaterialManager } from './PhysicsMaterialManager.js';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/**
 * Body-Typ-Bezeichner (unveränderlich).
 *
 * @enum {string}
 */
export const PHYSICS_BODY_TYPES = Object.freeze({
    /** Vollständig physikgesteuert */
    DYNAMIC:    'dynamic',

    /** Statisch, bewegt sich nicht */
    FIXED:      'fixed',

    /** Kinematisch, wird durch Code bewegt (Position) */
    KINEMATIC:  'kinematicPosition',
});

/**
 * Annäherungswert für die Masse pro Stud³.
 *
 * Basis: ABS-Kunststoff ≈ 1050 kg/m³ → skaliert auf Stud-Einheiten.
 * Wert ist bewusst gering gehalten, damit Stapel physikalisch stabil bleiben.
 *
 * @type {number}
 */
const MASS_PER_UNIT_CUBED = 0.001;   // kg pro Stud³

/**
 * Mindestmasse für jeden Körper (verhindert Division durch null in Rapier).
 *
 * @type {number}
 */
const MIN_MASS = 0.0001; // kg

/**
 * Standard-Lineardämpfung (0 = keine Reibung gegen Luftwiderstand).
 *
 * @type {number}
 */
const DEFAULT_LINEAR_DAMPING  = 0.1;

/**
 * Standard-Winkeldämpfung.
 *
 * @type {number}
 */
const DEFAULT_ANGULAR_DAMPING = 0.1;

/**
 * Kategorien, die immer als `fixed` behandelt werden.
 *
 * @type {ReadonlySet<string>}
 */
const FIXED_CATEGORIES = new Set(['panels', 'ground', 'baseplate', 'terrain', 'static']);

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Wandelt Euler-XYZ-Winkel (Radiant) in ein Quaternion um.
 *
 * Reihenfolge: Rx * Ry * Rz (intrinsisch, Three.js-kompatibel).
 *
 * @param {number} x - Drehung um X (Radiant).
 * @param {number} y - Drehung um Y (Radiant).
 * @param {number} z - Drehung um Z (Radiant).
 * @returns {{ x: number, y: number, z: number, w: number }} Einheitsquaternion.
 */
function eulerXYZToQuaternion(x, y, z) {
    const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2), sz = Math.sin(z / 2);

    return {
        x:  sx * cy * cz + cx * sy * sz,
        y:  cx * sy * cz - sx * cy * sz,
        z:  cx * cy * sz + sx * sy * cz,
        w:  cx * cy * cz - sx * sy * sz,
    };
}

// ---------------------------------------------------------------------------
// Hauptklasse
// ---------------------------------------------------------------------------

/**
 * Erzeugt RigidBodyDesc und ColliderDesc für PartInstances.
 *
 * Der Factory-Output (Descriptor-Paare) wird direkt an
 * `PhysicsWorld.addBody()` übergeben.
 */
export class PhysicsBodyFactory {
    /**
     * Erstellt eine neue PhysicsBodyFactory.
     *
     * @param {object}                                                         params
     * @param {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter}       params.adapter          - Initialisierter Rapier-Adapter.
     * @param {ColliderFactory}                                                params.colliderFactory  - ColliderFactory-Instanz.
     * @param {PhysicsMaterialManager}                                         params.materialManager  - Material-Manager.
     * @throws {TypeError} Wenn erforderliche Abhängigkeiten fehlen.
     */
    constructor({ adapter, colliderFactory, materialManager } = {}) {
        if (!adapter) {
            throw new TypeError('PhysicsBodyFactory: `adapter` ist erforderlich.');
        }
        if (!(colliderFactory instanceof ColliderFactory)) {
            throw new TypeError('PhysicsBodyFactory: `colliderFactory` muss eine ColliderFactory-Instanz sein.');
        }
        if (!(materialManager instanceof PhysicsMaterialManager)) {
            throw new TypeError('PhysicsBodyFactory: `materialManager` muss eine PhysicsMaterialManager-Instanz sein.');
        }

        /** @private @type {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter} */
        this._adapter = adapter;

        /** @private @type {ColliderFactory} */
        this._colliderFactory = colliderFactory;

        /** @private @type {PhysicsMaterialManager} */
        this._materialManager = materialManager;
    }

    // -----------------------------------------------------------------------
    // Hauptmethoden
    // -----------------------------------------------------------------------

    /**
     * Erstellt einen Rigid-Body-Descriptor und zugehörige Collider-Descriptoren
     * für eine PartInstance.
     *
     * @param {string}  instanceId   - Eindeutige ID der PartInstance.
     * @param {object}  partDef      - Normalisierte Bauteil-Definition aus dem PartCatalog.
     * @param {{ position: {x:number,y:number,z:number}, rotation: {x:number,y:number,z:number} }} transform
     *   Initialtransformation (Position in Metern, Rotation als Euler-XYZ in Radiant).
     * @param {'dynamic'|'fixed'|'kinematicPosition'|'kinematicVelocity'} [bodyType='dynamic']
     *   Body-Typ.
     * @returns {{ bodyDesc: import('@dimforge/rapier3d-compat').RigidBodyDesc, colliderDescs: import('@dimforge/rapier3d-compat').ColliderDesc[] }}
     */
    createBody(instanceId, partDef, transform, bodyType = PHYSICS_BODY_TYPES.DYNAMIC) {
        // Body-Descriptor erstellen
        const resolvedType = bodyType ?? this.getDefaultBodyType(partDef);
        const bodyDesc = this._adapter.createRigidBodyDesc(resolvedType);

        // Position setzen (Meter)
        const pos = transform?.position ?? { x: 0, y: 0, z: 0 };
        bodyDesc.setTranslation(pos.x, pos.y, pos.z);

        // Rotation aus Euler-XYZ → Quaternion
        const rot = transform?.rotation ?? { x: 0, y: 0, z: 0 };
        const quat = eulerXYZToQuaternion(rot.x, rot.y, rot.z);
        bodyDesc.setRotation(quat);

        // Masse und Dämpfung für dynamische Körper
        if (resolvedType === PHYSICS_BODY_TYPES.DYNAMIC) {
            const mass = this.computeMass(partDef);
            bodyDesc.setAdditionalMass(mass);
            bodyDesc.setLinearDamping(DEFAULT_LINEAR_DAMPING);
            bodyDesc.setAngularDamping(DEFAULT_ANGULAR_DAMPING);
        }

        // Collider erstellen
        const material = this._materialManager.getMaterial(partDef?.category ?? 'default');
        const colliderDescs = this._colliderFactory.createCollidersForPart(partDef, material);

        return { bodyDesc, colliderDescs };
    }

    /**
     * Erstellt Body-Deskriptoren direkt aus einer PartInstance.
     *
     * Die Methode liest Dimension und Transform aus der PartInstance,
     * schlägt die Bauteil-Definition im Catalog nach und delegiert
     * an `createBody()`.
     *
     * @param {object}  instance            - PartInstance-Objekt.
     * @param {string}  instance.partId     - ID des Bauteils im Catalog.
     * @param {object}  instance.group      - Three.js-Gruppe (Position/Rotation).
     * @param {number}  [instance.width]    - Breite in Stud (Fallback wenn partDef fehlt).
     * @param {number}  [instance.depth]    - Tiefe in Stud.
     * @param {number}  [instance.height]   - Höhe in Stud.
     * @param {object}  catalog             - PartCatalog mit `getPartById(id)`-Methode.
     * @param {object}  [options={}]        - Optionale Überschreibungen.
     * @param {string}  [options.bodyType]  - Überschreibt den Body-Typ.
     * @param {number}  [options.mass]      - Überschreibt die berechnete Masse.
     * @returns {{ bodyDesc: import('@dimforge/rapier3d-compat').RigidBodyDesc, colliderDescs: import('@dimforge/rapier3d-compat').ColliderDesc[] }}
     */
    createBodyForInstance(instance, catalog, options = {}) {
        if (!instance) {
            throw new TypeError('PhysicsBodyFactory.createBodyForInstance: `instance` ist erforderlich.');
        }

        // Bauteil-Definition aus Catalog abrufen
        let partDef = null;
        if (catalog && typeof catalog.getPartById === 'function') {
            partDef = catalog.getPartById(instance.partId) ?? null;
        }

        // Fallback: partDef aus Instance-Daten synthetisieren
        if (!partDef) {
            partDef = {
                id:       instance.partId ?? 'unknown',
                category: instance.category ?? 'bricks',
                geometry: instance.geometry ?? 'brick',
                width:    instance.width  ?? 1,
                depth:    instance.depth  ?? 1,
                height:   instance.height ?? 1.2,
            };
        }

        // Body-Typ ermitteln
        const bodyType = options.bodyType ?? this.getDefaultBodyType(partDef);

        // Transform aus Three.js-Gruppe
        const group = instance.group;
        const position = group?.position
            ? { x: group.position.x, y: group.position.y, z: group.position.z }
            : { x: 0, y: 0, z: 0 };
        const rotation = group?.rotation
            ? { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z }
            : { x: 0, y: 0, z: 0 };

        const { bodyDesc, colliderDescs } = this.createBody(
            instance.partId ?? 'unknown',
            partDef,
            { position, rotation },
            bodyType
        );

        // Optionale Massen-Überschreibung
        if (typeof options.mass === 'number' && options.mass > 0) {
            bodyDesc.setAdditionalMass(options.mass);
        }

        return { bodyDesc, colliderDescs };
    }

    // -----------------------------------------------------------------------
    // Typ-Heuristik und Massenberechnung
    // -----------------------------------------------------------------------

    /**
     * Bestimmt den Standard-Body-Typ für ein Bauteil.
     *
     * Heuristik:
     *  - `isPhysical === false` → fixed
     *  - `category` in FIXED_CATEGORIES → fixed
     *  - Alles andere → dynamic
     *
     * @param {object}  partDef              - Bauteil-Definition.
     * @param {boolean} [partDef.isPhysical] - Explizites Flag (optional).
     * @param {string}  [partDef.category]   - Bauteil-Kategorie.
     * @returns {'dynamic' | 'fixed'}
     */
    getDefaultBodyType(partDef) {
        if (!partDef) return PHYSICS_BODY_TYPES.DYNAMIC;

        if (partDef.isPhysical === false) {
            return PHYSICS_BODY_TYPES.FIXED;
        }

        const cat = typeof partDef.category === 'string'
            ? partDef.category.toLowerCase()
            : '';

        if (FIXED_CATEGORIES.has(cat)) {
            return PHYSICS_BODY_TYPES.FIXED;
        }

        return PHYSICS_BODY_TYPES.DYNAMIC;
    }

    /**
     * Berechnet die Näherungsmasse eines Bauteils in Kilogramm.
     *
     * Formel: `width × depth × height × MASS_PER_UNIT_CUBED`
     *
     * Das Ergebnis wird auf mindestens `MIN_MASS` begrenzt.
     *
     * @param {object} partDef            - Bauteil-Definition.
     * @param {number} [partDef.width]    - Breite in Stud.
     * @param {number} [partDef.depth]    - Tiefe in Stud.
     * @param {number} [partDef.height]   - Höhe in Stud.
     * @returns {number} Berechnete Masse in kg.
     */
    computeMass(partDef) {
        const w = typeof partDef?.width  === 'number' ? partDef.width  : 1;
        const d = typeof partDef?.depth  === 'number' ? partDef.depth  : 1;
        const h = typeof partDef?.height === 'number' ? partDef.height : 1.2;

        const raw = w * d * h * MASS_PER_UNIT_CUBED;
        return Math.max(MIN_MASS, raw);
    }

    /**
     * Setzt physikalische Eigenschaften auf einem RigidBodyDesc.
     *
     * Alle Felder in `properties` sind optional.
     *
     * @param {import('@dimforge/rapier3d-compat').RigidBodyDesc} bodyDesc   - Zu ändernde Beschreibung.
     * @param {object} properties                                             - Eigenschaften.
     * @param {number} [properties.mass]            - Zusätzliche Masse (kg).
     * @param {number} [properties.linearDamping]   - Lineare Dämpfung.
     * @param {number} [properties.angularDamping]  - Winkeldämpfung.
     * @param {number} [properties.gravityScale]    - Schwerkraft-Multiplikator (0 = schwebend).
     * @returns {void}
     */
    setBodyProperties(bodyDesc, properties = {}) {
        if (typeof properties.mass === 'number' && properties.mass >= 0) {
            bodyDesc.setAdditionalMass(properties.mass);
        }
        if (typeof properties.linearDamping === 'number') {
            bodyDesc.setLinearDamping(properties.linearDamping);
        }
        if (typeof properties.angularDamping === 'number') {
            bodyDesc.setAngularDamping(properties.angularDamping);
        }
        if (typeof properties.gravityScale === 'number') {
            bodyDesc.setGravityScale(properties.gravityScale);
        }
    }
}
