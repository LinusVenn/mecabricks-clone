/**
 * PhysicsWorld – Verwaltet die Rapier-Physikwelt (Phase G.1)
 *
 * Zuständig für:
 *  - Schwerkraft und Welteinstellungen
 *  - Verwaltung aller Physikobjekte (Bodies, Collider, Gelenke)
 *  - Feste Zeitschritte (dt = 1/60 s)
 *  - Zustandsreset
 *
 * @module PhysicsWorld
 */
import { PhysicsEngineAdapter } from './PhysicsEngineAdapter.js';

// ---------------------------------------------------------------------------
// Standardwerte
// ---------------------------------------------------------------------------

/** @type {number} Standard-Zeitschritt in Sekunden (60 Hz) */
const DEFAULT_TIME_STEP = 1 / 60;

/** @type {number} Maximale Anzahl Sub-Schritte pro Frame */
const DEFAULT_MAX_SUB_STEPS = 4;

/** @type {number} Maximale rohe Delta-Zeit (Schutz vor Spiralen nach Tab-Wechsel) */
const DEFAULT_MAX_DELTA_TIME_CAP = 0.25;

/** @type {{ x: number, y: number, z: number }} Standard-Schwerkraft */
const DEFAULT_GRAVITY = Object.freeze({ x: 0, y: -9.81, z: 0 });

// ---------------------------------------------------------------------------
// Hauptklasse
// ---------------------------------------------------------------------------

/**
 * Verwaltet die Rapier-Physikwelt und alle registrierten Physikobjekte.
 *
 * Verwendet einen Fixed-Timestep-Akkumulator, um eine stabile Simulation
 * unabhängig von der Render-Frame-Rate zu gewährleisten.
 *
 * @example
 * const world = new PhysicsWorld(adapter, { gravity: { x: 0, y: -9.81, z: 0 } });
 * const { bodyHandle } = world.addBody('brick_001', bodyDesc, [colliderDesc]);
 * world.step(deltaTime);
 */
export class PhysicsWorld {
    /**
     * Erstellt eine neue PhysicsWorld.
     *
     * @param {PhysicsEngineAdapter} adapter           - Initialisierter Physik-Adapter.
     * @param {object}               [options={}]      - Konfigurationsoptionen.
     * @param {{ x: number, y: number, z: number }} [options.gravity]         - Schwerkraftvektor.
     * @param {number}               [options.timeStep]                        - Fester Zeitschritt in Sekunden.
     * @param {number}               [options.maxSubSteps]                     - Max. Sub-Schritte pro Frame.
     * @param {number}               [options.maxDeltaTimeCap]                 - Maximale rohe Delta-Zeit.
     */
    constructor(adapter, options = {}) {
        if (!(adapter instanceof PhysicsEngineAdapter)) {
            throw new TypeError(
                'PhysicsWorld: Erster Parameter muss eine PhysicsEngineAdapter-Instanz sein.'
            );
        }

        /** @private @type {PhysicsEngineAdapter} */
        this._adapter = adapter;

        /** @private @type {{ x: number, y: number, z: number }} */
        this._gravity = { ...DEFAULT_GRAVITY, ...options.gravity };

        /** @private @type {number} */
        this._timeStep = typeof options.timeStep === 'number' && options.timeStep > 0
            ? options.timeStep
            : DEFAULT_TIME_STEP;

        /** @private @type {number} */
        this._maxSubSteps = typeof options.maxSubSteps === 'number' && options.maxSubSteps >= 1
            ? Math.floor(options.maxSubSteps)
            : DEFAULT_MAX_SUB_STEPS;

        /** @private @type {number} Maximale rohe Delta-Zeit (verhindert Simulations-Explosion) */
        this._maxDeltaTimeCap = typeof options.maxDeltaTimeCap === 'number' && options.maxDeltaTimeCap > 0
            ? options.maxDeltaTimeCap
            : DEFAULT_MAX_DELTA_TIME_CAP;

        /** @private @type {number} Akkumulierter Zeittest */
        this._accumulator = 0;

        /**
         * Interne Map von instanceId → { bodyHandle, colliderHandles[] }
         *
         * @private
         * @type {Map<string, { bodyHandle: number, colliderHandles: number[] }>}
         */
        this._bodies = new Map();

        /**
         * Interne Map von jointId → ImpulseJointHandle
         *
         * @private
         * @type {Map<string, number>}
         */
        this._joints = new Map();

        // Rapier-Welt erzeugen
        /** @private @type {import('@dimforge/rapier3d-compat').World} */
        this._world = this._createFreshWorld();

        // ---------------------------------------------------------------------------
        // Ereignis-Callbacks (optional)
        // ---------------------------------------------------------------------------

        /**
         * Callback bei Kollisionskontakt zwischen zwei Körpern.
         *
         * @type {(({ instanceIdA: string, instanceIdB: string, contactPoint: {x:number,y:number,z:number} }) => void) | null}
         */
        this.onContact = null;

        /**
         * Callback, wenn ein Körper in den Schlafzustand übergeht.
         *
         * @type {(({ instanceId: string }) => void) | null}
         */
        this.onSleep = null;

        /**
         * Callback, wenn ein Körper aus dem Schlafzustand aufgeweckt wird.
         *
         * @type {(({ instanceId: string }) => void) | null}
         */
        this.onWake = null;
    }

    // -----------------------------------------------------------------------
    // Rohzugriff
    // -----------------------------------------------------------------------

    /**
     * Gibt direkten Zugriff auf die zugrundeliegende Rapier-Welt.
     *
     * Nur für fortgeschrittene Anwendungsfälle; bevorzugt die öffentliche API nutzen.
     *
     * @type {import('@dimforge/rapier3d-compat').World}
     */
    get rapierWorld() {
        return this._world;
    }

    // -----------------------------------------------------------------------
    // Simulations-Schritt
    // -----------------------------------------------------------------------

    /**
     * Führt die Physiksimulation mit Fixed-Timestep-Akkumulator vor.
     *
     * Die rohe Delta-Zeit wird auf `maxDeltaTimeCap` begrenzt, um eine
     * Simulations-Explosion nach Browser-Tab-Wechseln zu verhindern.
     *
     * @param {number} deltaTime - Vergangene Zeit seit dem letzten Frame in Sekunden.
     * @returns {number} Anzahl der durchgeführten Sub-Schritte (0–maxSubSteps).
     */
    step(deltaTime) {
        // Delta-Zeit begrenzen
        const dt = Math.min(deltaTime, this._maxDeltaTimeCap);
        this._accumulator += dt;

        let subSteps = 0;

        while (this._accumulator >= this._timeStep && subSteps < this._maxSubSteps) {
            this._world.timestep = this._timeStep;
            this._adapter.stepWorld(this._world);
            this._accumulator -= this._timeStep;
            subSteps++;
        }

        return subSteps;
    }

    // -----------------------------------------------------------------------
    // Körper-Verwaltung
    // -----------------------------------------------------------------------

    /**
     * Fügt einen neuen Starrkörper mit Collidern zur Welt hinzu.
     *
     * @param {string}  instanceId    - Eindeutige ID der PartInstance.
     * @param {import('@dimforge/rapier3d-compat').RigidBodyDesc}    bodyDesc       - Rapier RigidBodyDesc.
     * @param {import('@dimforge/rapier3d-compat').ColliderDesc[]}   colliderDescs  - Array von Collider-Beschreibungen.
     * @returns {{ bodyHandle: number, colliderHandles: number[] }} Handles für Body und Collider.
     * @throws {Error} Wenn `instanceId` bereits registriert ist.
     */
    addBody(instanceId, bodyDesc, colliderDescs) {
        if (this._bodies.has(instanceId)) {
            throw new Error(
                `PhysicsWorld.addBody: instanceId "${instanceId}" ist bereits registriert.`
            );
        }

        // Körper erstellen
        const body = this._world.createRigidBody(bodyDesc);
        const bodyHandle = body.handle;

        // Collider an Körper binden
        const colliderHandles = [];
        for (const desc of colliderDescs) {
            const collider = this._world.createCollider(desc, body);
            colliderHandles.push(collider.handle);
        }

        // Intern speichern
        this._bodies.set(instanceId, { bodyHandle, colliderHandles });

        return { bodyHandle, colliderHandles };
    }

    /**
     * Entfernt einen Starrkörper und all seine Collider aus der Welt.
     *
     * @param {string} instanceId - ID des zu entfernenden Körpers.
     * @returns {boolean} `true` wenn erfolgreich entfernt, `false` wenn nicht gefunden.
     */
    removeBody(instanceId) {
        const entry = this._bodies.get(instanceId);
        if (!entry) {
            return false;
        }

        const body = this._world.getRigidBody(entry.bodyHandle);
        if (body) {
            this._adapter.removeBody(this._world, body);
        }

        this._bodies.delete(instanceId);
        return true;
    }

    /**
     * Gibt den Rapier-Handle des Körpers für eine instanceId zurück.
     *
     * @param {string} instanceId - ID der PartInstance.
     * @returns {number | null} Body-Handle oder `null`.
     */
    getBodyHandle(instanceId) {
        return this._bodies.get(instanceId)?.bodyHandle ?? null;
    }

    /**
     * Gibt das Rapier-RigidBody-Objekt für eine instanceId zurück.
     *
     * @param {string} instanceId - ID der PartInstance.
     * @returns {import('@dimforge/rapier3d-compat').RigidBody | null} Körper-Objekt oder `null`.
     */
    getBody(instanceId) {
        const handle = this.getBodyHandle(instanceId);
        if (handle === null) return null;
        return this._world.getRigidBody(handle) ?? null;
    }

    /**
     * Prüft, ob ein Körper mit dieser ID registriert ist.
     *
     * @param {string} instanceId - ID der PartInstance.
     * @returns {boolean}
     */
    hasBody(instanceId) {
        return this._bodies.has(instanceId);
    }

    /**
     * Gibt alle registrierten instanceIds zurück.
     *
     * @returns {string[]} Array aller Body-IDs.
     */
    getAllBodyIds() {
        return Array.from(this._bodies.keys());
    }

    // -----------------------------------------------------------------------
    // Gelenk-Verwaltung
    // -----------------------------------------------------------------------

    /**
     * Fügt ein Gelenk zwischen zwei Körpern hinzu.
     *
     * @param {string}  jointId      - Eindeutige ID des Gelenks.
     * @param {import('@dimforge/rapier3d-compat').JointData} jointData    - Gelenk-Konfiguration.
     * @param {string}  instanceIdA  - ID von Körper A.
     * @param {string}  instanceIdB  - ID von Körper B.
     * @returns {boolean} `true` bei Erfolg, `false` wenn ein Körper nicht gefunden wurde.
     */
    addJoint(jointId, jointData, instanceIdA, instanceIdB) {
        if (this._joints.has(jointId)) {
            console.warn(
                `PhysicsWorld.addJoint: jointId "${jointId}" ist bereits registriert.`
            );
            return false;
        }

        const bodyA = this.getBody(instanceIdA);
        const bodyB = this.getBody(instanceIdB);

        if (!bodyA || !bodyB) {
            console.warn(
                `PhysicsWorld.addJoint: Körper für "${instanceIdA}" oder "${instanceIdB}" nicht gefunden.`
            );
            return false;
        }

        const joint = this._adapter.createImpulseJoint(this._world, jointData, bodyA, bodyB, true);
        this._joints.set(jointId, joint.handle);
        return true;
    }

    /**
     * Entfernt ein Gelenk aus der Welt.
     *
     * @param {string} jointId - ID des zu entfernenden Gelenks.
     * @returns {boolean} `true` wenn erfolgreich, `false` wenn nicht gefunden.
     */
    removeJoint(jointId) {
        const handle = this._joints.get(jointId);
        if (handle === undefined) {
            return false;
        }

        const joint = this._world.getImpulseJoint(handle);
        if (joint) {
            this._adapter.removeJoint(this._world, joint, true);
        }

        this._joints.delete(jointId);
        return true;
    }

    /**
     * Gibt den Rapier-Handle des Gelenks für eine jointId zurück.
     *
     * @param {string} jointId - ID des Gelenks.
     * @returns {number | null} Joint-Handle oder `null`.
     */
    getJointHandle(jointId) {
        return this._joints.get(jointId) ?? null;
    }

    // -----------------------------------------------------------------------
    // Konfiguration
    // -----------------------------------------------------------------------

    /**
     * Setzt die Schwerkraft für die Physikwelt.
     *
     * Änderungen werden sofort wirksam; bereits schlafende Körper werden
     * nicht automatisch geweckt.
     *
     * @param {{ x: number, y: number, z: number }} gravity - Neuer Schwerkraftvektor.
     * @returns {void}
     */
    setGravity(gravity) {
        this._gravity = { ...gravity };
        this._world.gravity = { ...gravity };
    }

    /**
     * Gibt den aktuellen Schwerkraftvektor zurück.
     *
     * @returns {{ x: number, y: number, z: number }} Schwerkraftvektor.
     */
    getGravity() {
        return { ...this._gravity };
    }

    /**
     * Gibt die aktuellen Einstellungen der Physikwelt zurück.
     *
     * @returns {{ timeStep: number, maxSubSteps: number, gravity: {x:number, y:number, z:number} }}
     */
    getSettings() {
        return {
            timeStep: this._timeStep,
            maxSubSteps: this._maxSubSteps,
            gravity: this.getGravity(),
        };
    }

    /**
     * Gibt Laufzeitstatistiken der Physikwelt zurück.
     *
     * @returns {{ bodyCount: number, colliderCount: number, jointCount: number, accumulator: number }}
     */
    getStats() {
        return {
            bodyCount: this._bodies.size,
            colliderCount: this._countColliders(),
            jointCount: this._joints.size,
            accumulator: this._accumulator,
        };
    }

    // -----------------------------------------------------------------------
    // Reset / Clear
    // -----------------------------------------------------------------------

    /**
     * Entfernt alle Bodies, Collider und Gelenke; erstellt eine neue Welt.
     *
     * Alle internen Maps werden geleert.
     *
     * @returns {void}
     */
    clear() {
        this._bodies.clear();
        this._joints.clear();
        this._accumulator = 0;
        this._world.free?.(); // Rapier WASM-Speicher freigeben (falls verfügbar)
        this._world = this._createFreshWorld();
    }

    /**
     * Setzt die Physikwelt zurück wie `clear()`, behält aber die Konfiguration.
     *
     * Optional kann eine neue Schwerkraft angegeben werden.
     *
     * @param {{ x: number, y: number, z: number }} [gravity] - Optionale neue Schwerkraft.
     * @returns {void}
     */
    reset(gravity) {
        if (gravity !== undefined) {
            this._gravity = { ...gravity };
        }
        this.clear();
    }

    // -----------------------------------------------------------------------
    // Private Hilfsmethoden
    // -----------------------------------------------------------------------

    /**
     * Erstellt eine neue, leere Rapier-Welt mit der aktuellen Schwerkraft.
     *
     * @private
     * @returns {import('@dimforge/rapier3d-compat').World}
     */
    _createFreshWorld() {
        const world = this._adapter.createWorld(this._gravity);
        world.timestep = this._timeStep;
        return world;
    }

    /**
     * Zählt alle registrierten Collider-Handles über alle Körper.
     *
     * @private
     * @returns {number}
     */
    _countColliders() {
        let count = 0;
        for (const { colliderHandles } of this._bodies.values()) {
            count += colliderHandles.length;
        }
        return count;
    }
}
