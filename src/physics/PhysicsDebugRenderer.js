/**
 * PhysicsDebugRenderer – Visualisiert Physik-Debug-Informationen (Phase G.7)
 *
 * Zeichnet Collider-Umrisse und Gelenkachsen in der Three.js-Szene.
 * Nützlich zum Debuggen von Physik-Setups.
 *
 * Darstellung:
 *  - Collider: Grüne Wireframe-Boxen/-Kugeln/-Zylinder
 *  - Schlafende Bodies: Blaue Wireframes
 *  - Gelenke: Gelbe/Rote Linien (Achsen)
 *  - Kontaktpunkte: Rote Punkte
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sentinel size used when a collider's dimensions cannot be determined. */
const FALLBACK_SIZE = 0.1;

/** World-space axes used when drawing joint orientation lines. */
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Half-length (metres) of the axis arrows drawn at each joint anchor. */
const JOINT_AXIS_LENGTH = 0.3;

// ---------------------------------------------------------------------------

export class PhysicsDebugRenderer {
  /**
   * @param {object} params
   * @param {THREE.Scene}                                                params.scene
   * @param {import('./PhysicsWorld.js').PhysicsWorld}                   params.physicsWorld
   * @param {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter}   params.adapter
   * @param {object}                                                      [params.options]
   * @param {boolean} [params.options.showColliders=true]
   * @param {boolean} [params.options.showJoints=true]
   * @param {boolean} [params.options.showContacts=false]
   * @param {number}  [params.options.colliderColor=0x00cc44]  Active collider wireframe colour
   * @param {number}  [params.options.sleepingColor=0x4488ff]  Sleeping body wireframe colour
   * @param {number}  [params.options.jointColor=0xffcc00]     Joint axis line colour
   */
  constructor({ scene, physicsWorld, adapter, options = {} }) {
    /** @type {THREE.Scene} */
    this._scene = scene;

    /** @type {import('./PhysicsWorld.js').PhysicsWorld} */
    this._world = physicsWorld;

    /** @type {import('./PhysicsEngineAdapter.js').PhysicsEngineAdapter} */
    this._adapter = adapter;

    // ---- resolved options ----
    this._opts = {
      showColliders:  options.showColliders  !== undefined ? !!options.showColliders  : true,
      showJoints:     options.showJoints     !== undefined ? !!options.showJoints     : true,
      showContacts:   options.showContacts   !== undefined ? !!options.showContacts   : false,
      colliderColor:  options.colliderColor  !== undefined ? options.colliderColor    : 0x00cc44,
      sleepingColor:  options.sleepingColor  !== undefined ? options.sleepingColor    : 0x4488ff,
      jointColor:     options.jointColor     !== undefined ? options.jointColor       : 0xffcc00,
    };

    // ---- cached materials (one per colour, reused across meshes) ----
    /** @type {THREE.LineBasicMaterial} */
    this._matColliderActive  = new THREE.LineBasicMaterial({
      color: this._opts.colliderColor,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });

    /** @type {THREE.LineBasicMaterial} */
    this._matColliderSleeping = new THREE.LineBasicMaterial({
      color: this._opts.sleepingColor,
      depthTest: false,
      transparent: true,
      opacity: 0.5,
    });

    /** @type {THREE.LineBasicMaterial} */
    this._matJoint = new THREE.LineBasicMaterial({
      color: this._opts.jointColor,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });

    /** @type {THREE.PointsMaterial} */
    this._matContact = new THREE.PointsMaterial({
      color: 0xff2222,
      size: 0.06,
      depthTest: false,
    });

    // ---- root container — lets us toggle visibility in O(1) ----
    /** @type {THREE.Group} */
    this._root = new THREE.Group();
    this._root.name = 'PhysicsDebugRenderer';
    this._root.renderOrder = 999; // always on top of scene objects
    this._scene.add(this._root);

    // ---- live object tracking (rebuilt every frame) ----
    /** @type {THREE.Object3D[]} */
    this._frameObjects = [];

    /** @type {boolean} */
    this._visible = true;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Called every frame.  Removes all previous-frame debug objects and
   * rebuilds them from the current physics state.
   *
   * @param {Map<string, { position: THREE.Vector3Like, rotation: THREE.QuaternionLike }>} [instanceTransforms]
   *   Optional map of current instance transforms.  When provided, transforms
   *   supplied here are used instead of querying the adapter (faster).
   */
  update(instanceTransforms) {
    // Remove and dispose previous frame's objects.
    this._clearFrameObjects();

    if (!this._visible) return;

    if (this._opts.showColliders) {
      this._drawColliders(instanceTransforms);
    }

    if (this._opts.showJoints) {
      this._drawJoints();
    }

    if (this._opts.showContacts) {
      this._drawContacts();
    }
  }

  /**
   * Show or hide all debug visualisations without disposing them.
   *
   * @param {boolean} visible
   */
  setVisible(visible) {
    this._visible = !!visible;
    this._root.visible = this._visible;
  }

  /**
   * Remove all debug objects from the scene (does not dispose materials).
   * Safe to call while the renderer is still in use.
   */
  clear() {
    this._clearFrameObjects();
    // Remove persistent objects if any were added outside the frame loop.
    while (this._root.children.length > 0) {
      this._root.remove(this._root.children[0]);
    }
  }

  /**
   * Full teardown: removes the root group from the scene and disposes every
   * geometry and material owned by this renderer.
   */
  dispose() {
    this.clear();
    this._scene.remove(this._root);

    this._matColliderActive.dispose();
    this._matColliderSleeping.dispose();
    this._matJoint.dispose();
    this._matContact.dispose();
  }

  // -------------------------------------------------------------------------
  // Private – per-frame draw calls
  // -------------------------------------------------------------------------

  /**
   * Iterate over every body/collider pair reported by the adapter and add a
   * wireframe mesh to the scene.
   *
   * @param {Map<string, { position: THREE.Vector3Like, rotation: THREE.QuaternionLike }> | undefined} instanceTransforms
   */
  _drawColliders(instanceTransforms) {
    const bodies = this._adapter.getAllBodies?.() ?? [];

    for (const body of bodies) {
      const isSleeping = body.isSleeping?.() ?? false;
      const mat = isSleeping ? this._matColliderSleeping : this._matColliderActive;

      const colliders = this._adapter.getBodyColliders?.(body) ?? [];

      for (const collider of colliders) {
        const shape  = this._adapter.getColliderShape?.(collider)  ?? 'box';
        const params = this._adapter.getColliderParams?.(collider) ?? {};

        const mesh = this._createColliderMesh(shape, params, mat);
        if (mesh == null) continue;

        // Position the wireframe at the collider's world transform.
        const pos = this._adapter.getColliderPosition?.(collider)
                 ?? this._adapter.getBodyPosition(body);
        const rot = this._adapter.getColliderRotation?.(collider)
                 ?? this._adapter.getBodyRotation(body);

        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

        this._addFrameObject(mesh);
      }

      // Fallback: if no colliders were returned, draw a small marker at the
      // body origin so it is still visible in the debug view.
      if (colliders.length === 0) {
        const pos = this._adapter.getBodyPosition(body);
        const marker = this._createColliderMesh('box', { halfExtents: { x: FALLBACK_SIZE, y: FALLBACK_SIZE, z: FALLBACK_SIZE } }, mat);
        if (marker) {
          marker.position.set(pos.x, pos.y, pos.z);
          this._addFrameObject(marker);
        }
      }
    }
  }

  /**
   * Draw axis tripods at each joint anchor point.
   */
  _drawJoints() {
    const joints = this._adapter.getAllJoints?.() ?? [];

    for (const joint of joints) {
      const anchorA = this._adapter.getJointAnchorA?.(joint);
      const anchorB = this._adapter.getJointAnchorB?.(joint);

      if (anchorA && anchorB) {
        const line = this._createJointLine(anchorA, anchorB);
        this._addFrameObject(line);
      }

      // Draw a small axis tripod at anchorA (if available).
      if (anchorA) {
        const tripod = this._createAxisTripod(anchorA);
        this._addFrameObject(tripod);
      }
    }
  }

  /**
   * Draw a Points cloud at contact manifold positions.
   */
  _drawContacts() {
    const contacts = this._adapter.getContactPoints?.() ?? [];
    if (contacts.length === 0) return;

    const positions = new Float32Array(contacts.length * 3);
    contacts.forEach((pt, i) => {
      positions[i * 3]     = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const points = new THREE.Points(geo, this._matContact);
    this._addFrameObject(points, geo);
  }

  // -------------------------------------------------------------------------
  // Private – geometry factories
  // -------------------------------------------------------------------------

  /**
   * Build a wireframe LineSegments object for the given collider shape.
   *
   * Supported shapes:
   *   - `'box'`      params: `{ halfExtents: {x,y,z} }`
   *   - `'sphere'`   params: `{ radius: number }`
   *   - `'capsule'`  params: `{ radius: number, halfHeight: number }`
   *   - `'cylinder'` params: `{ radius: number, halfHeight: number }`
   *   - `'cone'`     params: `{ radius: number, height: number }`
   *
   * Returns `null` for unknown shapes rather than throwing.
   *
   * @param {string}              shape
   * @param {object}              params
   * @param {THREE.LineBasicMaterial} mat
   * @returns {THREE.LineSegments | null}
   */
  _createColliderMesh(shape, params, mat) {
    let geo = null;

    try {
      switch (shape) {
        case 'box': {
          const he = params.halfExtents ?? { x: FALLBACK_SIZE, y: FALLBACK_SIZE, z: FALLBACK_SIZE };
          const baseGeo = new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2);
          geo = new THREE.WireframeGeometry(baseGeo);
          baseGeo.dispose(); // base geo only needed to produce the wireframe
          break;
        }

        case 'sphere': {
          const r = params.radius ?? FALLBACK_SIZE;
          const baseGeo = new THREE.SphereGeometry(r, 8, 6);
          geo = new THREE.WireframeGeometry(baseGeo);
          baseGeo.dispose();
          break;
        }

        case 'capsule': {
          // Three.js CapsuleGeometry: (radius, length, capSegments, radialSegments)
          const r  = params.radius     ?? FALLBACK_SIZE;
          const hh = params.halfHeight ?? FALLBACK_SIZE;
          const baseGeo = new THREE.CapsuleGeometry(r, hh * 2, 4, 8);
          geo = new THREE.WireframeGeometry(baseGeo);
          baseGeo.dispose();
          break;
        }

        case 'cylinder': {
          const r  = params.radius     ?? FALLBACK_SIZE;
          const hh = params.halfHeight ?? FALLBACK_SIZE;
          const baseGeo = new THREE.CylinderGeometry(r, r, hh * 2, 8, 1, true);
          geo = new THREE.WireframeGeometry(baseGeo);
          baseGeo.dispose();
          break;
        }

        case 'cone': {
          const r = params.radius ?? FALLBACK_SIZE;
          const h = params.height ?? FALLBACK_SIZE * 2;
          const baseGeo = new THREE.ConeGeometry(r, h, 8);
          geo = new THREE.WireframeGeometry(baseGeo);
          baseGeo.dispose();
          break;
        }

        default:
          console.warn(`[PhysicsDebugRenderer] _createColliderMesh: unknown shape "${shape}".`);
          return null;
      }
    } catch (err) {
      console.warn(`[PhysicsDebugRenderer] _createColliderMesh error for shape "${shape}":`, err);
      return null;
    }

    const mesh = new THREE.LineSegments(geo, mat);
    mesh.matrixAutoUpdate = true;
    return mesh;
  }

  /**
   * Build a single line segment between two world-space anchor points.
   *
   * @param {{ x: number, y: number, z: number }} anchorA
   * @param {{ x: number, y: number, z: number }} anchorB
   * @returns {THREE.LineSegments}
   */
  _createJointLine(anchorA, anchorB) {
    const positions = new Float32Array([
      anchorA.x, anchorA.y, anchorA.z,
      anchorB.x, anchorB.y, anchorB.z,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    return new THREE.LineSegments(geo, this._matJoint);
  }

  /**
   * Build a small axis-tripod (X=red, Y=green, Z=blue) centred at `origin`.
   * Useful for showing joint orientations at a glance.
   *
   * @param {{ x: number, y: number, z: number }} origin
   * @returns {THREE.LineSegments}
   */
  _createAxisTripod(origin) {
    const l = JOINT_AXIS_LENGTH;
    // 3 axes × 2 vertices × 3 components = 18 floats
    const positions = new Float32Array([
      origin.x,   origin.y,   origin.z,   // X axis start
      origin.x+l, origin.y,   origin.z,   // X axis end
      origin.x,   origin.y,   origin.z,   // Y axis start
      origin.x,   origin.y+l, origin.z,   // Y axis end
      origin.x,   origin.y,   origin.z,   // Z axis start
      origin.x,   origin.y,   origin.z+l, // Z axis end
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Re-use the joint material (yellow) for the tripod.
    return new THREE.LineSegments(geo, this._matJoint);
  }

  // -------------------------------------------------------------------------
  // Private – object lifecycle helpers
  // -------------------------------------------------------------------------

  /**
   * Add an object to the root group and record it for disposal at frame end.
   * Pass an optional separate `geometry` when the LineSegments owns a geometry
   * that was not created by WireframeGeometry (i.e. raw BufferGeometry).
   *
   * @param {THREE.Object3D}         object
   * @param {THREE.BufferGeometry}  [ownedGeo]  Geometry to dispose with the object
   */
  _addFrameObject(object, ownedGeo) {
    if (ownedGeo) {
      // Attach so _clearFrameObjects can dispose it via userData.
      object.userData._ownedGeo = ownedGeo;
    }
    this._root.add(object);
    this._frameObjects.push(object);
  }

  /**
   * Remove every object created in the last frame and dispose their geometries.
   * Materials are shared and NOT disposed here.
   */
  _clearFrameObjects() {
    for (const obj of this._frameObjects) {
      this._root.remove(obj);

      // Dispose geometry to avoid GPU memory leaks on hot paths.
      if (obj.geometry) {
        obj.geometry.dispose();
      }

      // Dispose any separately-tracked geometry (e.g. contact Points).
      if (obj.userData._ownedGeo) {
        obj.userData._ownedGeo.dispose();
        obj.userData._ownedGeo = null;
      }
    }
    this._frameObjects.length = 0;
  }
}
