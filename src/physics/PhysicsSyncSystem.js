/**
 * PhysicsSyncSystem – Synchronisiert Physik-Welt und Three.js-Szene (Phase G.6)
 *
 * Überträgt Positionen und Rotationen in BEIDEN Richtungen:
 *
 * Simulation → Szene (während der Simulation):
 *   PhysicsWorld → PhysicsSyncSystem → PartInstance.group.position/quaternion
 *
 * Szene → Simulation (bei manueller Bearbeitung):
 *   Editor/TransformManager → PartInstance.transform → PhysicsSyncSystem → PhysicsWorld
 *
 * Wichtige Regel: Nur eine Richtung ist zur selben Zeit aktiv.
 * Der TransformGizmo wird blockiert, wenn die Simulation läuft.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Reusable THREE objects to avoid per-frame GC pressure. */
const _pos  = new THREE.Vector3();
const _quat = new THREE.Quaternion();

// ---------------------------------------------------------------------------

export class PhysicsSyncSystem {
  /**
   * @param {object} params
   * @param {import('./PhysicsWorld.js').PhysicsWorld}                   params.physicsWorld
   * @param {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter}   params.adapter
   * @param {import('../library/PartLibrary.js').PartLibrary}            params.library
   */
  constructor({ physicsWorld, adapter, library }) {
    /** @type {import('./PhysicsWorld.js').PhysicsWorld} */
    this._world = physicsWorld;

    /** @type {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter} */
    this._adapter = adapter;

    /** @type {import('../library/PartLibrary.js').PartLibrary} */
    this._library = library;

    /**
     * Primary map  :  instanceId  →  RigidBody
     * @type {Map<string, import('@dimforge/rapier3d').RigidBody>}
     */
    this._instanceToBody = new Map();

    /**
     * Reverse map  :  RigidBody   →  instanceId
     * Kept in sync with _instanceToBody for O(1) reverse look-up.
     * @type {Map<import('@dimforge/rapier3d').RigidBody, string>}
     */
    this._bodyToInstance = new Map();

    /**
     * When true:  simulation is running  →  only physics→scene is allowed.
     * When false: edit mode              →  only scene→physics is allowed.
     * @type {boolean}
     */
    this._simulationActive = false;
  }

  // -------------------------------------------------------------------------
  // Registration API
  // -------------------------------------------------------------------------

  /**
   * Register a mapping between a placed scene instance and its physics body.
   *
   * @param {string}  instanceId
   * @param {import('@dimforge/rapier3d').RigidBody} physicsBodyHandle
   */
  addInstance(instanceId, physicsBodyHandle) {
    if (this._instanceToBody.has(instanceId)) {
      console.warn(
        `[PhysicsSyncSystem] addInstance: "${instanceId}" is already registered. ` +
        `Call removeInstance() first if you want to replace it.`
      );
    }
    this._instanceToBody.set(instanceId, physicsBodyHandle);
    this._bodyToInstance.set(physicsBodyHandle, instanceId);
  }

  /**
   * Remove the mapping for the given instance.
   * Does NOT destroy the underlying physics body.
   *
   * @param {string} instanceId
   */
  removeInstance(instanceId) {
    const body = this._instanceToBody.get(instanceId);
    if (body !== undefined) {
      this._bodyToInstance.delete(body);
    }
    this._instanceToBody.delete(instanceId);
  }

  /**
   * Returns the RigidBody for the given instanceId, or `null`.
   *
   * @param {string} instanceId
   * @returns {import('@dimforge/rapier3d').RigidBody | null}
   */
  getBodyForInstance(instanceId) {
    return this._instanceToBody.get(instanceId) ?? null;
  }

  /**
   * @param {string} instanceId
   * @returns {boolean}
   */
  isRegistered(instanceId) {
    return this._instanceToBody.has(instanceId);
  }

  /**
   * Remove ALL instance↔body mappings without touching the physics world.
   */
  clear() {
    this._instanceToBody.clear();
    this._bodyToInstance.clear();
  }

  // -------------------------------------------------------------------------
  // Simulation-mode gate
  // -------------------------------------------------------------------------

  /**
   * Toggle between simulation mode and edit mode.
   *
   * @param {boolean} active
   */
  setSimulationActive(active) {
    this._simulationActive = !!active;
  }

  // -------------------------------------------------------------------------
  // Physics → Scene
  // -------------------------------------------------------------------------

  /**
   * Copy the current physics-world transform into the matching Three.js group.
   *
   * @param {string} [instanceId]
   *   When provided only that instance is synced.
   *   When omitted every registered instance is synced.
   */
  syncPhysicsToScene(instanceId) {
    if (instanceId !== undefined) {
      this._applyBodyToGroup(instanceId);
      return;
    }

    for (const [id] of this._instanceToBody) {
      this._applyBodyToGroup(id);
    }
  }

  /**
   * Internal: copy one body's transform to the corresponding Three.js group.
   *
   * @param {string} instanceId
   */
  _applyBodyToGroup(instanceId) {
    const body = this._instanceToBody.get(instanceId);
    if (body == null) return;

    const instance = this._library.getInstance(instanceId);
    if (instance == null) {
      console.warn(
        `[PhysicsSyncSystem] _applyBodyToGroup: no scene instance for "${instanceId}".`
      );
      return;
    }

    const group = instance.group;
    if (group == null) return;

    // Position
    const pos = this._adapter.getBodyPosition(body); // {x,y,z}
    group.position.set(pos.x, pos.y, pos.z);

    // Rotation (quaternion – avoids gimbal lock)
    const rot = this._adapter.getBodyRotation(body); // {x,y,z,w}
    group.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // Flush world matrix so child objects and raycasts use fresh values immediately.
    group.updateMatrixWorld(true);
  }

  // -------------------------------------------------------------------------
  // Scene → Physics
  // -------------------------------------------------------------------------

  /**
   * Teleport the physics body to the current world-space transform of the
   * Three.js group.  Resets linear and angular velocities so the body behaves
   * as if freshly placed.
   *
   * Blocked while the simulation is active to avoid fighting the integrator.
   *
   * @param {string} instanceId
   */
  syncSceneToPhysics(instanceId) {
    if (this._simulationActive) {
      console.warn(
        `[PhysicsSyncSystem] syncSceneToPhysics("${instanceId}") blocked: ` +
        `simulation is active.  Stop the simulation before editing transforms.`
      );
      return;
    }

    const body = this._instanceToBody.get(instanceId);
    if (body == null) return;

    const instance = this._library.getInstance(instanceId);
    if (instance == null) return;

    const group = instance.group;
    if (group == null) return;

    // Read world-space transform (handles nested groups correctly).
    group.getWorldPosition(_pos);
    group.getWorldQuaternion(_quat);

    // Teleport – `true` = wake the body immediately.
    body.setTranslation({ x: _pos.x,  y: _pos.y,  z: _pos.z  }, true);
    body.setRotation  ({ x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w }, true);

    // Zero velocities: prevents phantom movement after a manual edit.
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // -------------------------------------------------------------------------
  // Bulk sync
  // -------------------------------------------------------------------------

  /**
   * Sync every registered instance in one direction.
   *
   * @param {'physics-to-scene' | 'scene-to-physics'} direction
   * @returns {number} Count of synced instances.
   */
  syncAll(direction) {
    if (direction === 'physics-to-scene') {
      let count = 0;
      for (const [id] of this._instanceToBody) {
        this._applyBodyToGroup(id);
        count++;
      }
      return count;
    }

    if (direction === 'scene-to-physics') {
      if (this._simulationActive) {
        console.warn(
          `[PhysicsSyncSystem] syncAll('scene-to-physics') blocked: simulation is active.`
        );
        return 0;
      }
      let count = 0;
      for (const [id] of this._instanceToBody) {
        this.syncSceneToPhysics(id);
        count++;
      }
      return count;
    }

    console.error(`[PhysicsSyncSystem] syncAll: unknown direction "${direction}".`);
    return 0;
  }

  // -------------------------------------------------------------------------
  // Static utilities
  // -------------------------------------------------------------------------

  /**
   * Convert a quaternion `{x,y,z,w}` (or a THREE.Quaternion) to Euler angles
   * in radians using the YXZ order (Three.js default).
   *
   * Useful for serialisation: physics engines return quaternions but most save
   * formats prefer Euler angles.
   *
   * @param {{ x: number, y: number, z: number, w: number }} q
   * @returns {{ x: number, y: number, z: number }}
   */
  static quaternionToEuler(q) {
    const euler = new THREE.Euler();
    const threeQ = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    euler.setFromQuaternion(threeQ, 'YXZ');
    return { x: euler.x, y: euler.y, z: euler.z };
  }
}
