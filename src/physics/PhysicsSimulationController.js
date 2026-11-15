/**
 * PhysicsSimulationController – Steuerung der Physiksimulation (Phase G.1/G.7)
 *
 * Steuert den Simulationszustand und -ablauf.
 * Drei Zustände: 'edit' | 'running' | 'paused'
 *
 * Integriert sich über requestAnimationFrame in den Render-Loop.
 * Der Controller empfängt pro Frame einen `deltaTime`-Wert (Sekunden)
 * und leitet ihn skaliert an die PhysicsWorld weiter.
 *
 * @module PhysicsSimulationController
 */
import { PhysicsWorld } from './PhysicsWorld.js';
import { PhysicsSyncSystem } from './PhysicsSyncSystem.js'; // Vorwärtsreferenz (Phase G.4)

// ---------------------------------------------------------------------------
// Zustands-Konstanten
// ---------------------------------------------------------------------------

/**
 * Mögliche Simulationszustände.
 *
 * @enum {string}
 */
export const SIM_STATE = Object.freeze({
    /** Bearbeitungsmodus – Simulation ist gestoppt, Objekte können platziert werden */
    EDIT:    'edit',
    /** Simulation läuft */
    RUNNING: 'running',
    /** Simulation ist angehalten, kann fortgesetzt werden */
    PAUSED:  'paused',
});

// ---------------------------------------------------------------------------
// Grenzen
// ---------------------------------------------------------------------------

/** @type {number} Minimaler erlaubter timeScale */
const TIME_SCALE_MIN = 0.1;

/** @type {number} Maximaler erlaubter timeScale */
const TIME_SCALE_MAX = 4.0;

// ---------------------------------------------------------------------------
// Hauptklasse
// ---------------------------------------------------------------------------

/**
 * Steuert den Lebenszyklus der Physiksimulation.
 *
 * - Verwaltet drei Zustände: `edit`, `running`, `paused`
 * - Sichert den Anfangszustand für spätere Resets
 * - Skaliert die Simulationsgeschwindigkeit via `timeScale`
 * - Ruft optional ein {@link PhysicsSyncSystem} auf, um Three.js-Objekte
 *   nach jedem Schritt zu synchronisieren
 *
 * @example
 * const controller = new PhysicsSimulationController({ physicsWorld, syncSystem });
 * controller.snapshotInitialState();
 * controller.start();
 *
 * // Im Render-Loop:
 * controller.update(deltaTime);
 */
export class PhysicsSimulationController {
    /**
     * Erzeugt einen neuen Controller.
     *
     * @param {object}            params                      - Konfigurationsparameter.
     * @param {PhysicsWorld}      params.physicsWorld         - Die zu steuernde Physikwelt.
     * @param {PhysicsSyncSystem|null} [params.syncSystem=null] - Optionales Synchronisierungssystem.
     * @param {object}            [params.options={}]         - Laufzeit-Optionen.
     * @param {number}            [params.options.timeScale=1.0]  - Simulationsgeschwindigkeit (0.1–4.0).
     * @param {boolean}           [params.options.autoStart=false] - Startet Simulation automatisch.
     */
    constructor({ physicsWorld, syncSystem = null, options = {} } = {}) {
        if (!(physicsWorld instanceof PhysicsWorld)) {
            throw new TypeError(
                'PhysicsSimulationController: `physicsWorld` muss eine PhysicsWorld-Instanz sein.'
            );
        }

        /** @private @type {PhysicsWorld} */
        this._world = physicsWorld;

        /** @private @type {PhysicsSyncSystem|null} */
        this._syncSystem = syncSystem;

        /** @private @type {string} Aktueller Simulationszustand */
        this._state = SIM_STATE.EDIT;

        /** @private @type {number} Schritte seit letztem Start */
        this._stepCount = 0;

        // timeScale mit Begrenzung initialisieren
        const rawScale = typeof options.timeScale === 'number' ? options.timeScale : 1.0;
        /** @private @type {number} */
        this._timeScale = Math.max(TIME_SCALE_MIN, Math.min(TIME_SCALE_MAX, rawScale));

        /**
         * Snapshot aller Körper-Transformationen beim letzten `snapshotInitialState()`-Aufruf.
         * Format: instanceId → { position: {x,y,z}, rotation: {x,y,z,w} }
         *
         * @private
         * @type {Map<string, { position: {x:number,y:number,z:number}, rotation: {x:number,y:number,z:number,w:number} }>}
         */
        this._initialStateSnapshot = new Map();

        // ---------------------------------------------------------------------------
        // Öffentliche Callbacks
        // ---------------------------------------------------------------------------

        /**
         * Wird aufgerufen, wenn sich der Simulationszustand ändert.
         *
         * @type {((state: string) => void) | null}
         */
        this.onStateChange = null;

        /**
         * Wird nach jedem Physik-Sub-Schritt aufgerufen.
         *
         * @type {((stepCount: number) => void) | null}
         */
        this.onStep = null;

        // Auto-Start
        if (options.autoStart === true) {
            // Nicht-blockierend; wird beim nächsten update() aktiv
            // Ein direktes start() schlägt fehl, wenn noch keine Körper vorhanden sind.
            // Daher nur Flag setzen – Nutzer kann start() explizit aufrufen.
            console.info(
                'PhysicsSimulationController: autoStart=true gesetzt. ' +
                'Bitte start() nach dem Hinzufügen von Körpern aufrufen.'
            );
        }
    }

    // -----------------------------------------------------------------------
    // Zustandseigenschaften (lesend)
    // -----------------------------------------------------------------------

    /**
     * Aktueller Simulationszustand.
     *
     * @type {'edit' | 'running' | 'paused'}
     */
    get state() {
        return this._state;
    }

    /**
     * Gibt an, ob die Simulation läuft.
     *
     * @type {boolean}
     */
    get isRunning() {
        return this._state === SIM_STATE.RUNNING;
    }

    /**
     * Gibt an, ob die Simulation angehalten ist.
     *
     * @type {boolean}
     */
    get isPaused() {
        return this._state === SIM_STATE.PAUSED;
    }

    /**
     * Gibt an, ob sich der Controller im Bearbeitungsmodus befindet.
     *
     * @type {boolean}
     */
    get isEditMode() {
        return this._state === SIM_STATE.EDIT;
    }

    /**
     * Gesamtanzahl der durchgeführten Physik-Sub-Schritte seit dem letzten `start()`.
     *
     * @type {number}
     */
    get stepCount() {
        return this._stepCount;
    }

    // -----------------------------------------------------------------------
    // timeScale
    // -----------------------------------------------------------------------

    /**
     * Aktuelle Simulationsgeschwindigkeit (Multiplikator für deltaTime).
     *
     * @type {number}
     */
    get timeScale() {
        return this._timeScale;
    }

    /**
     * Setzt die Simulationsgeschwindigkeit.
     *
     * Wird auf [0.1, 4.0] begrenzt.
     *
     * @param {number} v - Neuer timeScale-Wert.
     */
    set timeScale(v) {
        if (typeof v !== 'number' || !isFinite(v)) {
            console.warn('PhysicsSimulationController: timeScale muss eine endliche Zahl sein.');
            return;
        }
        this._timeScale = Math.max(TIME_SCALE_MIN, Math.min(TIME_SCALE_MAX, v));
    }

    // -----------------------------------------------------------------------
    // Zustandsübergänge
    // -----------------------------------------------------------------------

    /**
     * Startet die Simulation (Übergang: edit → running).
     *
     * Gibt `false` zurück, wenn keine Körper in der Welt registriert sind
     * (Start ohne Objekte wäre sinnlos) oder die Simulation bereits läuft.
     *
     * @returns {boolean} `true` bei erfolgreicher Zustandsänderung.
     */
    start() {
        if (this._state === SIM_STATE.RUNNING) {
            return false;
        }

        const bodyIds = this._world.getAllBodyIds();
        if (bodyIds.length === 0) {
            console.warn(
                'PhysicsSimulationController.start: Keine Körper in der Welt registriert.'
            );
            return false;
        }

        this._stepCount = 0;
        this._setState(SIM_STATE.RUNNING);
        return true;
    }

    /**
     * Pausiert die Simulation (Übergang: running → paused).
     *
     * Hat keine Wirkung, wenn die Simulation nicht läuft.
     *
     * @returns {void}
     */
    pause() {
        if (this._state !== SIM_STATE.RUNNING) {
            return;
        }
        this._setState(SIM_STATE.PAUSED);
    }

    /**
     * Setzt eine pausierte Simulation fort (Übergang: paused → running).
     *
     * Hat keine Wirkung, wenn die Simulation nicht pausiert ist.
     *
     * @returns {void}
     */
    resume() {
        if (this._state !== SIM_STATE.PAUSED) {
            return;
        }
        this._setState(SIM_STATE.RUNNING);
    }

    /**
     * Setzt die Simulation vollständig zurück (Übergang: any → edit).
     *
     * Stellt die beim letzten `snapshotInitialState()`-Aufruf gespeicherten
     * Transformationen wieder her.
     *
     * @returns {void}
     */
    reset() {
        this._setState(SIM_STATE.EDIT);
        this._stepCount = 0;
        this.restoreInitialState();
    }

    // -----------------------------------------------------------------------
    // Manueller Schritt
    // -----------------------------------------------------------------------

    /**
     * Führt einen einzelnen Physik-Schritt mit festem Zeitschritt durch.
     *
     * Nützlich für schrittweises Debugging im Pause-Modus.
     * Kann auch im Edit-Modus aufgerufen werden (kein Zustandswechsel).
     *
     * @returns {void}
     */
    step() {
        const settings = this._world.getSettings();
        const subSteps = this._world.step(settings.timeStep);
        this._stepCount += subSteps;

        if (this._syncSystem !== null) {
            this._syncSystem.sync();
        }

        this.onStep?.(this._stepCount);
    }

    // -----------------------------------------------------------------------
    // Frame-Update
    // -----------------------------------------------------------------------

    /**
     * Aktualisiert die Simulation für einen Render-Frame.
     *
     * Wird im Render-Loop einmal pro Frame aufgerufen.
     * Leitet die skalierte Delta-Zeit an die PhysicsWorld weiter.
     *
     * Hat keine Wirkung, wenn der Zustand nicht `running` ist.
     *
     * @param {number} deltaTime - Vergangene Frame-Zeit in Sekunden.
     * @returns {void}
     */
    update(deltaTime) {
        if (this._state !== SIM_STATE.RUNNING) {
            return;
        }

        const scaledDt = deltaTime * this._timeScale;
        const subSteps = this._world.step(scaledDt);

        if (subSteps > 0) {
            this._stepCount += subSteps;

            if (this._syncSystem !== null) {
                this._syncSystem.sync();
            }

            this.onStep?.(this._stepCount);
        }
    }

    // -----------------------------------------------------------------------
    // Snapshot / Restore
    // -----------------------------------------------------------------------

    /**
     * Speichert die aktuellen Transformationen aller registrierten Körper
     * als Ausgangszustand für spätere Resets.
     *
     * Sollte aufgerufen werden, bevor `start()` zum ersten Mal ausgeführt wird.
     *
     * @returns {void}
     */
    snapshotInitialState() {
        this._initialStateSnapshot.clear();
        const adapter = this._world.rapierWorld; // Nur für Lesezugriff genutzt

        for (const instanceId of this._world.getAllBodyIds()) {
            const body = this._world.getBody(instanceId);
            if (!body) continue;

            const t = body.translation();
            const r = body.rotation();

            this._initialStateSnapshot.set(instanceId, {
                position: { x: t.x, y: t.y, z: t.z },
                rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
            });
        }
    }

    /**
     * Stellt alle Körper-Transformationen aus dem gespeicherten Snapshot wieder her.
     *
     * Setzt zusätzlich alle Geschwindigkeiten auf null zurück, damit die
     * Körper nach einem Reset wirklich stillstehen.
     *
     * Hat keine Wirkung, wenn kein Snapshot vorhanden ist.
     *
     * @returns {void}
     */
    restoreInitialState() {
        if (this._initialStateSnapshot.size === 0) {
            return;
        }

        const ZERO = { x: 0, y: 0, z: 0 };

        for (const [instanceId, snap] of this._initialStateSnapshot) {
            const body = this._world.getBody(instanceId);
            if (!body) continue;

            body.setTranslation(snap.position, true);
            body.setRotation(snap.rotation, true);
            body.setLinvel(ZERO, true);
            body.setAngvel(ZERO, true);
            body.resetForces(true);
            body.resetTorques(true);
        }

        // Akkumulator zurücksetzen, damit keine Zeit "angesammelt" ist
        // (PhysicsWorld hat keine öffentliche Methode dafür; daher direkt step(0))
        this._world.step(0);
    }

    // -----------------------------------------------------------------------
    // Private Hilfsmethoden
    // -----------------------------------------------------------------------

    /**
     * Setzt den internen Zustand und ruft `onStateChange` auf.
     *
     * @private
     * @param {string} newState - Neuer Zustand.
     * @returns {void}
     */
    _setState(newState) {
        if (this._state === newState) return;
        this._state = newState;
        this.onStateChange?.(newState);
    }
}
