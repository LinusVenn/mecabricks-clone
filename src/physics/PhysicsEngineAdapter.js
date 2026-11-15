/**
 * PhysicsEngineAdapter – Abstraktion über die Rapier-Physik-Engine (Phase G.1)
 *
 * Kapselt alle direkten Rapier-API-Aufrufe. Wenn die Engine gewechselt werden soll,
 * reicht es, diesen Adapter zu ersetzen.
 * @version 1.0.0
 *
 * Verwendung:
 *   const adapter = await PhysicsEngineAdapter.initialize();
 *   const world = adapter.createWorld({ x:0, y:-9.81, z:0 });
 *
 * @module PhysicsEngineAdapter
 */
import RAPIER from '@dimforge/rapier3d-compat';

// ---------------------------------------------------------------------------
// Interne Hilfskonstante – verhindert direkten Konstruktoraufruf von außen
// ---------------------------------------------------------------------------

/** @type {symbol} Privates Konstruktor-Token */
const _PRIVATE = Symbol('PhysicsEngineAdapter_private');

// ---------------------------------------------------------------------------
// Hauptklasse
// ---------------------------------------------------------------------------

/**
 * Adapter für die Rapier 3D Physik-Engine.
 *
 * Instanzen werden ausschließlich über {@link PhysicsEngineAdapter.initialize}
 * erzeugt, da der WASM-Modul asynchron geladen werden muss.
 */
export class PhysicsEngineAdapter {
    /**
     * Erstellt eine neue Adapterinstanz (nur intern über `initialize()` aufrufen).
     *
     * @param {symbol} token      - Muss das private Symbol `_PRIVATE` sein.
     * @param {object} rapierRef  - Referenz auf das initialisierte RAPIER-Modul.
     * @throws {Error} Wenn das Token nicht korrekt ist.
     */
    constructor(token, rapierRef) {
        if (token !== _PRIVATE) {
            throw new Error(
                'PhysicsEngineAdapter: Direkte Instanziierung nicht erlaubt. ' +
                'Bitte PhysicsEngineAdapter.initialize() verwenden.'
            );
        }

        /** @private @type {object} Referenz auf das RAPIER-Modul */
        this._rapier = rapierRef;

        /** @private @type {boolean} Gibt an, ob der Adapter initialisiert ist */
        this._initialized = true;
    }

    // -----------------------------------------------------------------------
    // Statische Factory-Methode
    // -----------------------------------------------------------------------

    /**
     * Initialisiert das Rapier-WASM-Modul und gibt einen neuen Adapter zurück.
     *
     * Muss genau einmal pro Anwendungslebenszyklus aufgerufen werden.
     * Mehrfache Aufrufe sind sicher (RAPIER.init() ist idempotent).
     *
     * @returns {Promise<PhysicsEngineAdapter>} Der initialisierte Adapter.
     * @throws {Error} Wenn das RAPIER-Modul nicht geladen werden kann.
     *
     * @example
     * const adapter = await PhysicsEngineAdapter.initialize();
     */
    static async initialize() {
        await RAPIER.init();
        return new PhysicsEngineAdapter(_PRIVATE, RAPIER);
    }

    // -----------------------------------------------------------------------
    // Eigenschaften
    // -----------------------------------------------------------------------

    /**
     * Gibt an, ob der Adapter erfolgreich initialisiert wurde.
     *
     * @type {boolean}
     */
    get isInitialized() {
        return this._initialized === true;
    }

    /**
     * Gibt die Version des RAPIER-Pakets zurück, sofern verfügbar.
     *
     * @type {string}
     */
    get engineVersion() {
        return this._rapier?.version?.() ?? 'unbekannt';
    }

    // -----------------------------------------------------------------------
    // Welt
    // -----------------------------------------------------------------------

    /**
     * Erzeugt eine neue Rapier-Physikwelt mit der angegebenen Schwerkraft.
     *
     * @param {{ x: number, y: number, z: number }} gravity - Schwerkraftvektor (SI: m/s²).
     * @returns {import('@dimforge/rapier3d-compat').World} Die neue Rapier-Welt.
     *
     * @example
     * const world = adapter.createWorld({ x: 0, y: -9.81, z: 0 });
     */
    createWorld(gravity) {
        this._assertInitialized();
        return new this._rapier.World(gravity);
    }

    // -----------------------------------------------------------------------
    // Rigid-Body-Beschreibungen
    // -----------------------------------------------------------------------

    /**
     * Erzeugt eine RigidBodyDesc für den angegebenen Körpertyp.
     *
     * @param {'dynamic'|'fixed'|'kinematicPosition'|'kinematicVelocity'} type
     *   Typ des Starrkörpers.
     * @returns {import('@dimforge/rapier3d-compat').RigidBodyDesc} Beschreibungs-Objekt.
     * @throws {Error} Bei unbekanntem Typ.
     */
    createRigidBodyDesc(type) {
        this._assertInitialized();
        const RBD = this._rapier.RigidBodyDesc;

        switch (type) {
            case 'dynamic':
                return RBD.dynamic();
            case 'fixed':
                return RBD.fixed();
            case 'kinematicPosition':
                return RBD.kinematicPositionBased();
            case 'kinematicVelocity':
                return RBD.kinematicVelocityBased();
            default:
                throw new Error(
                    `PhysicsEngineAdapter.createRigidBodyDesc: Unbekannter Typ "${type}". ` +
                    'Gültige Typen: dynamic, fixed, kinematicPosition, kinematicVelocity'
                );
        }
    }

    // -----------------------------------------------------------------------
    // Collider-Beschreibungen
    // -----------------------------------------------------------------------

    /**
     * Erzeugt eine Box-ColliderDesc mit den angegebenen Halbausdehnungen.
     *
     * @param {{ x: number, y: number, z: number }} halfExtents - Halbausdehnungen in Metern.
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc} Collider-Beschreibung.
     */
    createBoxColliderDesc(halfExtents) {
        this._assertInitialized();
        return this._rapier.ColliderDesc.cuboid(
            halfExtents.x,
            halfExtents.y,
            halfExtents.z
        );
    }

    /**
     * Erzeugt eine Kugel-ColliderDesc mit dem angegebenen Radius.
     *
     * @param {number} radius - Radius in Metern.
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc} Collider-Beschreibung.
     */
    createSphereColliderDesc(radius) {
        this._assertInitialized();
        return this._rapier.ColliderDesc.ball(radius);
    }

    /**
     * Erzeugt eine Zylinder-ColliderDesc.
     *
     * Achse ist Y (Rapier-Konvention); `halfHeight` = halbe Höhe entlang Y.
     *
     * @param {number} halfHeight - Halbe Höhe in Metern.
     * @param {number} radius     - Radius in Metern.
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc} Collider-Beschreibung.
     */
    createCylinderColliderDesc(halfHeight, radius) {
        this._assertInitialized();
        return this._rapier.ColliderDesc.cylinder(halfHeight, radius);
    }

    /**
     * Erzeugt eine Kapsel-ColliderDesc.
     *
     * Achse ist Y; `halfHeight` = halbe Höhe des zylindrischen Mittelsegments.
     *
     * @param {number} halfHeight - Halbe Höhe des Schafts in Metern.
     * @param {number} radius     - Radius in Metern.
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc} Collider-Beschreibung.
     */
    createCapsuleColliderDesc(halfHeight, radius) {
        this._assertInitialized();
        return this._rapier.ColliderDesc.capsule(halfHeight, radius);
    }

    /**
     * Erzeugt eine Convex-Hull-ColliderDesc aus einem Punkt-Array.
     *
     * Gibt `null` zurück, wenn Rapier keine gültige konvexe Hülle berechnen kann
     * (z. B. zu wenige oder kollineare Punkte).
     *
     * @param {Float32Array} points - Vertices als flaches Array [x0,y0,z0, x1,y1,z1, ...].
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc | null} Collider-Beschreibung oder null.
     */
    createConvexHullColliderDesc(points) {
        this._assertInitialized();
        return this._rapier.ColliderDesc.convexHull(points) ?? null;
    }

    /**
     * Erzeugt eine Trimesh-ColliderDesc aus Vertices und Index-Array.
     *
     * Geeignet für statische/kinematische Körper. Nicht für dynamische Bodies
     * (Trimeshs sind in Rapier für dynamische Körper nicht unterstützt).
     *
     * @param {Float32Array} vertices - Vertex-Positionen [x0,y0,z0, ...].
     * @param {Uint32Array}  indices  - Dreiecksflächen-Indizes [i0,i1,i2, ...].
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc} Collider-Beschreibung.
     */
    createTrimeshColliderDesc(vertices, indices) {
        this._assertInitialized();
        return this._rapier.ColliderDesc.trimesh(vertices, indices);
    }

    // -----------------------------------------------------------------------
    // Collider-Eigenschaften
    // -----------------------------------------------------------------------

    /**
     * Setzt physikalische Eigenschaften auf einer ColliderDesc.
     *
     * Alle Felder in `properties` sind optional; nicht angegebene Felder bleiben
     * auf ihren Rapier-Standardwerten.
     *
     * @param {import('@dimforge/rapier3d-compat').ColliderDesc} desc - Collider-Beschreibung.
     * @param {{ friction?: number, restitution?: number, density?: number, sensor?: boolean }} properties
     *   Zu setzende Eigenschaften.
     * @returns {import('@dimforge/rapier3d-compat').ColliderDesc} Die modifizierte Beschreibung (chainbar).
     */
    setColliderProperties(desc, { friction, restitution, density, sensor } = {}) {
        this._assertInitialized();

        if (friction !== undefined) {
            desc.setFriction(friction);
        }
        if (restitution !== undefined) {
            desc.setRestitution(restitution);
        }
        if (density !== undefined) {
            desc.setDensity(density);
        }
        if (sensor !== undefined) {
            desc.setSensor(sensor);
        }

        return desc;
    }

    // -----------------------------------------------------------------------
    // Gelenk-Beschreibungen (JointData)
    // -----------------------------------------------------------------------

    /**
     * Erzeugt JointData für ein Drehgelenk (Revolute Joint).
     *
     * @param {{ x: number, y: number, z: number }} anchorA - Ankerpunkt auf Körper A (lokal).
     * @param {{ x: number, y: number, z: number }} axisA   - Drehachse auf Körper A (lokal, normiert).
     * @param {{ x: number, y: number, z: number }} anchorB - Ankerpunkt auf Körper B (lokal).
     * @param {{ x: number, y: number, z: number }} axisB   - Drehachse auf Körper B (lokal, normiert).
     * @returns {import('@dimforge/rapier3d-compat').JointData} Gelenk-Daten.
     */
    createRevoluteJointData(anchorA, axisA, anchorB, axisB) {
        this._assertInitialized();
        return this._rapier.JointData.revolute(
            anchorA,
            axisA,
            anchorB,
            axisB
        );
    }

    /**
     * Erzeugt JointData für ein starres Gelenk (Fixed Joint).
     *
     * @param {{ x: number, y: number, z: number }}        anchorA - Ankerpunkt auf Körper A (lokal).
     * @param {{ x: number, y: number, z: number, w: number }} frameA  - Orientierungsrahmen auf Körper A (Quaternion).
     * @param {{ x: number, y: number, z: number }}        anchorB - Ankerpunkt auf Körper B (lokal).
     * @param {{ x: number, y: number, z: number, w: number }} frameB  - Orientierungsrahmen auf Körper B (Quaternion).
     * @returns {import('@dimforge/rapier3d-compat').JointData} Gelenk-Daten.
     */
    createFixedJointData(anchorA, frameA, anchorB, frameB) {
        this._assertInitialized();
        return this._rapier.JointData.fixed(anchorA, frameA, anchorB, frameB);
    }

    /**
     * Erzeugt JointData für ein Schubgelenk (Prismatic Joint).
     *
     * Das Gelenk schränkt die Bewegung auf eine Achse ein.
     * Optional können Positions-Limits angegeben werden.
     *
     * @param {{ x: number, y: number, z: number }} anchorA        - Ankerpunkt auf Körper A (lokal).
     * @param {{ x: number, y: number, z: number }} axisA          - Schubachse auf Körper A (lokal, normiert).
     * @param {{ x: number, y: number, z: number }} anchorB        - Ankerpunkt auf Körper B (lokal).
     * @param {{ x: number, y: number, z: number }} axisB          - Schubachse auf Körper B (lokal, normiert).
     * @param {{ min: number, max: number }}         [limits]       - Optionale Positions-Grenzen.
     * @returns {import('@dimforge/rapier3d-compat').JointData} Gelenk-Daten.
     */
    createPrismaticJointData(anchorA, axisA, anchorB, axisB, limits) {
        this._assertInitialized();
        const data = this._rapier.JointData.prismatic(anchorA, axisA, anchorB, axisB);

        if (limits !== undefined) {
            data.limitsEnabled = true;
            data.limits = [limits.min, limits.max];
        }

        return data;
    }

    /**
     * Erzeugt JointData für ein Kugelgelenk (Spherical Joint).
     *
     * Erlaubt freie Rotation um den Ankerpunkt, sperrt Translation.
     *
     * @param {{ x: number, y: number, z: number }} anchorA - Ankerpunkt auf Körper A (lokal).
     * @param {{ x: number, y: number, z: number }} anchorB - Ankerpunkt auf Körper B (lokal).
     * @returns {import('@dimforge/rapier3d-compat').JointData} Gelenk-Daten.
     */
    createSphericalJointData(anchorA, anchorB) {
        this._assertInitialized();
        return this._rapier.JointData.spherical(anchorA, anchorB);
    }

    // -----------------------------------------------------------------------
    // Gelenk-Verwaltung
    // -----------------------------------------------------------------------

    /**
     * Erstellt und registriert ein Impuls-Gelenk in der Physikwelt.
     *
     * @param {import('@dimforge/rapier3d-compat').World}    world     - Die Rapier-Welt.
     * @param {import('@dimforge/rapier3d-compat').JointData} jointData - Gelenk-Konfiguration.
     * @param {import('@dimforge/rapier3d-compat').RigidBody} bodyA     - Erster Körper.
     * @param {import('@dimforge/rapier3d-compat').RigidBody} bodyB     - Zweiter Körper.
     * @param {boolean} [wakeUp=true] - Weckt Körper aus Schlafzustand auf.
     * @returns {import('@dimforge/rapier3d-compat').ImpulseJoint} Das erzeugte Gelenk.
     */
    createImpulseJoint(world, jointData, bodyA, bodyB, wakeUp = true) {
        this._assertInitialized();
        return world.createImpulseJoint(jointData, bodyA, bodyB, wakeUp);
    }

    // -----------------------------------------------------------------------
    // Entfernen von Objekten
    // -----------------------------------------------------------------------

    /**
     * Entfernt einen Starrkörper aus der Physikwelt.
     *
     * Alle an den Körper gebundenen Collider werden automatisch mitentfernt.
     *
     * @param {import('@dimforge/rapier3d-compat').World}     world - Die Rapier-Welt.
     * @param {import('@dimforge/rapier3d-compat').RigidBody} body  - Der zu entfernende Körper.
     * @returns {void}
     */
    removeBody(world, body) {
        this._assertInitialized();
        world.removeRigidBody(body);
    }

    /**
     * Entfernt ein Impuls-Gelenk aus der Physikwelt.
     *
     * @param {import('@dimforge/rapier3d-compat').World}         world  - Die Rapier-Welt.
     * @param {import('@dimforge/rapier3d-compat').ImpulseJoint}  joint  - Das zu entfernende Gelenk.
     * @param {boolean} [wakeUp=true] - Weckt beteiligte Körper auf.
     * @returns {void}
     */
    removeJoint(world, joint, wakeUp = true) {
        this._assertInitialized();
        world.removeImpulseJoint(joint, wakeUp);
    }

    // -----------------------------------------------------------------------
    // Simulations-Schritt
    // -----------------------------------------------------------------------

    /**
     * Führt einen Simulationsschritt durch.
     *
     * Der interne Zeitschritt von Rapier wird durch die World-Konfiguration
     * bestimmt (`world.timestep`). Dieser Adapter schreitet immer genau einmal vor.
     *
     * @param {import('@dimforge/rapier3d-compat').World} world - Die zu aktualisierende Welt.
     * @returns {void}
     */
    stepWorld(world) {
        this._assertInitialized();
        world.step();
    }

    // -----------------------------------------------------------------------
    // Abfrage-Methoden
    // -----------------------------------------------------------------------

    /**
     * Gibt die aktuelle Weltposition eines Starrkörpers zurück.
     *
     * @param {import('@dimforge/rapier3d-compat').RigidBody} body - Der abzufragende Körper.
     * @returns {{ x: number, y: number, z: number }} Position in Weltkoordinaten.
     */
    getBodyPosition(body) {
        const t = body.translation();
        return { x: t.x, y: t.y, z: t.z };
    }

    /**
     * Gibt die aktuelle Weltrotation eines Starrkörpers als Quaternion zurück.
     *
     * @param {import('@dimforge/rapier3d-compat').RigidBody} body - Der abzufragende Körper.
     * @returns {{ x: number, y: number, z: number, w: number }} Einheitsquaternion.
     */
    getBodyRotation(body) {
        const r = body.rotation();
        return { x: r.x, y: r.y, z: r.z, w: r.w };
    }

    /**
     * Gibt die aktuelle Lineargeschwindigkeit eines Starrkörpers zurück.
     *
     * @param {import('@dimforge/rapier3d-compat').RigidBody} body - Der abzufragende Körper.
     * @returns {{ x: number, y: number, z: number }} Geschwindigkeit in m/s.
     */
    getBodyLinvel(body) {
        const v = body.linvel();
        return { x: v.x, y: v.y, z: v.z };
    }

    /**
     * Gibt die aktuelle Winkelgeschwindigkeit eines Starrkörpers zurück.
     *
     * @param {import('@dimforge/rapier3d-compat').RigidBody} body - Der abzufragende Körper.
     * @returns {{ x: number, y: number, z: number }} Winkelgeschwindigkeit in rad/s.
     */
    getBodyAngvel(body) {
        const w = body.angvel();
        return { x: w.x, y: w.y, z: w.z };
    }

    // -----------------------------------------------------------------------
    // Interne Hilfsmethoden
    // -----------------------------------------------------------------------

    /**
     * Wirft einen Fehler, wenn der Adapter nicht initialisiert ist.
     *
     * @private
     * @throws {Error} Wenn `_initialized` nicht `true` ist.
     */
    _assertInitialized() {
        if (!this._initialized) {
            throw new Error(
                'PhysicsEngineAdapter: Adapter nicht initialisiert. ' +
                'Bitte zuerst PhysicsEngineAdapter.initialize() aufrufen.'
            );
        }
    }
}
