/**
 * ConnectionPointOverlay – Zeigt Verbindungspunkte in der 3D-Szene (Phase F.7)
 *
 * Rendert kleine 3D-Indikatoren über THREE.js-Objekte, um Verbindungspunkte zu visualisieren.
 *
 * Farb-Konvention:
 *  - Grün  (0x00cc44): kompatibler Verbindungspunkt
 *  - Rot   (0xee2222): inkompatibler Verbindungspunkt
 *  - Gelb  (0xffcc00): mögliche Verbindung (unvollständige Daten)
 *  - Blau  (0x2288ff): normaler Verbindungspunkt (kein aktiver Kontext)
 */
import * as THREE from 'three';
import { CONNECTION_TYPES } from '../connections/ConnectionTypes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_COMPATIBLE   = 0x00cc44;
const COLOR_INCOMPATIBLE = 0xee2222;
const COLOR_POSSIBLE     = 0xffcc00;
const COLOR_NORMAL       = 0x2288ff;
const COLOR_HIGHLIGHT    = 0xffffff;

const ARROW_COLOR        = 0xffa500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a reusable material cache key so we don't create duplicate materials
 * for the same colour + opacity combination.
 */
function matKey(color, opacity) {
  return `${color}_${opacity}`;
}

// ---------------------------------------------------------------------------
// ConnectionPointOverlay
// ---------------------------------------------------------------------------

export class ConnectionPointOverlay {
  /**
   * @param {object} params
   * @param {THREE.Scene}              params.scene
   * @param {object}                   params.connectionPointManager
   * @param {THREE.Camera}             params.camera
   * @param {object}                  [params.options]
   * @param {number}                  [params.options.dotSize=0.15]
   * @param {number}                  [params.options.lineLength=0.4]
   * @param {number}                  [params.options.opacity=0.8]
   * @param {boolean}                 [params.options.showDirectionArrows=true]
   */
  constructor({ scene, connectionPointManager, camera, options = {} }) {
    this._scene                  = scene;
    this._connectionPointManager = connectionPointManager;
    this._camera                 = camera;

    // --- options with defaults ---
    this._dotSize            = options.dotSize            ?? 0.15;
    this._lineLength         = options.lineLength         ?? 0.4;
    this._opacity            = options.opacity            ?? 0.8;
    this._showDirectionArrows = options.showDirectionArrows ?? true;

    // --- internal state ---
    /** @type {Map<string, THREE.Object3D>} pointId → mesh */
    this._markers = new Map();
    /** @type {Map<string, THREE.Material>} cache key → material */
    this._materialCache = new Map();
    /** @type {THREE.Geometry[]} for disposal */
    this._geometries = [];

    // --- root group ---
    this._group = new THREE.Group();
    this._group.name = 'connection-point-overlay';
    this._scene.add(this._group);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Shows all connection points for a part at the given world transform.
   *
   * @param {string}            partId
   * @param {THREE.Matrix4}     transform   World transform of the part
   * @param {string|null}       variantId
   */
  showForPart(partId, transform, variantId = null) {
    this.clear();

    const points = this._connectionPointManager.getPointsForPart(partId, variantId);
    if (!points || points.length === 0) return;

    for (const cp of points) {
      this._addMarker(cp, transform, COLOR_NORMAL);
    }
  }

  /**
   * Shows color-coded connection points for a part, indicating which are
   * compatible with already-placed parts.
   *
   * @param {string}           partId
   * @param {THREE.Matrix4}    transform
   * @param {object[]}         placedParts           Array of placed-part descriptors
   * @param {object}           connectionCompatibility  Has `.check(cpA, cpB)→boolean`
   */
  showCompatible(partId, transform, placedParts, connectionCompatibility) {
    this.clear();

    const points = this._connectionPointManager.getPointsForPart(partId);
    if (!points || points.length === 0) return;

    for (const cp of points) {
      let color = COLOR_NORMAL;
      let matched = false;

      for (const placed of placedParts) {
        const placedPoints = this._connectionPointManager.getPointsForPart(placed.partId, placed.variantId);
        if (!placedPoints) continue;

        for (const placedCp of placedPoints) {
          if (!placedCp || !cp) continue;

          // If compatibility data is incomplete, mark as possible
          if (!cp.type || !placedCp.type) {
            color   = COLOR_POSSIBLE;
            matched = true;
            break;
          }

          const isCompatible = connectionCompatibility.check(cp, placedCp);
          if (isCompatible) {
            color   = COLOR_COMPATIBLE;
            matched = true;
            break;
          } else {
            color = COLOR_INCOMPATIBLE;
          }
        }

        if (matched && color === COLOR_COMPATIBLE) break;
      }

      this._addMarker(cp, transform, color);
    }
  }

  /**
   * Highlights a specific connection point with a given colour.
   *
   * @param {string}          pointId
   * @param {number|null}     color   Hex colour; null → revert to normal
   */
  highlight(pointId, color = COLOR_HIGHLIGHT) {
    const marker = this._markers.get(pointId);
    if (!marker) return;

    const target = marker.userData.mainMesh ?? marker;
    const mat    = this._getMaterial(color ?? COLOR_NORMAL, this._opacity);

    if (Array.isArray(target.material)) {
      target.material = target.material.map(() => mat);
    } else {
      target.material = mat;
    }
  }

  /** Removes all overlay markers from the scene group. */
  clear() {
    for (const [, obj] of this._markers) {
      this._group.remove(obj);
    }
    this._markers.clear();
  }

  /**
   * Shows or hides the entire overlay.
   * @param {boolean} visible
   */
  setVisible(visible) {
    this._group.visible = visible;
  }

  /**
   * Removes the group from the scene and disposes all GPU resources.
   */
  dispose() {
    this.clear();

    // Dispose cached geometries
    for (const geo of this._geometries) {
      geo.dispose();
    }
    this._geometries.length = 0;

    // Dispose cached materials
    for (const [, mat] of this._materialCache) {
      mat.dispose();
    }
    this._materialCache.clear();

    this._scene.remove(this._group);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Creates and registers a marker for a connection point.
   *
   * @param {object}        cp         Connection-point descriptor
   * @param {THREE.Matrix4} transform  Part's world transform
   * @param {number}        color      Hex colour
   */
  _addMarker(cp, transform, color) {
    const pivot = new THREE.Group();

    // Position the pivot at the connection point's local position, then
    // apply the part's world transform.
    if (cp.position) {
      pivot.position.set(cp.position.x, cp.position.y, cp.position.z);
    }

    // Apply the part transform to the pivot's matrix
    const partMatrix = transform instanceof THREE.Matrix4
      ? transform
      : new THREE.Matrix4().set(...transform);

    // Decompose transform into position / quaternion / scale
    const pos   = new THREE.Vector3();
    const quat  = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    partMatrix.decompose(pos, quat, scale);

    pivot.position.applyMatrix4(partMatrix);
    // Avoid scaling the marker with the part
    // (keep world-space size constant relative to dotSize)

    // --- main mesh ---
    const mesh = this._createPointMesh(cp.type);
    mesh.material = this._getMaterial(color, this._opacity);
    pivot.add(mesh);
    pivot.userData.mainMesh = mesh;

    // --- optional direction arrow ---
    if (this._showDirectionArrows && cp.normal) {
      const arrow = this._createDirectionArrow(cp.normal, color);
      pivot.add(arrow);
    }

    // --- optional stem line ---
    if (this._lineLength > 0 && cp.normal) {
      const stem = this._createStem(cp.normal);
      pivot.add(stem);
    }

    const pointId = cp.id ?? `cp_${Math.random().toString(36).slice(2)}`;
    this._markers.set(pointId, pivot);
    this._group.add(pivot);
  }

  /**
   * Creates a small sphere (stud / anti-stud) or cylinder (technic hole).
   *
   * @param {string|undefined} type  CONNECTION_TYPES value
   * @returns {THREE.Mesh}
   */
  _createPointMesh(type) {
    let geometry;

    if (
      type === CONNECTION_TYPES?.TECHNIC_HOLE ||
      type === 'technic-hole' ||
      type === 'axle-hole'
    ) {
      // Cylinder for technic-style holes / axle holes
      geometry = new THREE.CylinderGeometry(
        this._dotSize * 0.6,   // radiusTop
        this._dotSize * 0.6,   // radiusBottom
        this._dotSize * 1.2,   // height
        12                     // radialSegments
      );
    } else {
      // Sphere for stud / anti-stud / generic
      geometry = new THREE.SphereGeometry(
        this._dotSize,
        10,   // widthSegments
        8     // heightSegments
      );
    }

    this._geometries.push(geometry);

    // Material assigned later via _getMaterial
    return new THREE.Mesh(geometry);
  }

  /**
   * Creates a small arrow mesh pointing along `normal`.
   *
   * @param {{x:number,y:number,z:number}} normal
   * @param {number} color
   * @returns {THREE.ArrowHelper}
   */
  _createDirectionArrow(normal, color) {
    const dir    = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const origin = new THREE.Vector3(0, 0, 0);
    const arrow  = new THREE.ArrowHelper(
      dir,
      origin,
      this._lineLength * 0.8,
      ARROW_COLOR,
      this._lineLength * 0.3,
      this._dotSize * 1.2
    );
    return arrow;
  }

  /**
   * Creates a thin line segment along `normal` to act as a stem.
   *
   * @param {{x:number,y:number,z:number}} normal
   * @returns {THREE.Line}
   */
  _createStem(normal) {
    const dir = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const end = dir.clone().multiplyScalar(this._lineLength);

    const points = [new THREE.Vector3(0, 0, 0), end];
    const geo    = new THREE.BufferGeometry().setFromPoints(points);
    this._geometries.push(geo);

    const mat  = this._getMaterial(COLOR_NORMAL, this._opacity * 0.5, true);
    return new THREE.Line(geo, mat);
  }

  /**
   * Returns (or creates and caches) a MeshBasicMaterial for the given colour.
   *
   * @param {number}  color
   * @param {number}  opacity
   * @param {boolean} [line=false]  Use LineBasicMaterial instead
   * @returns {THREE.Material}
   */
  _getMaterial(color, opacity, line = false) {
    const key = matKey(color, opacity) + (line ? '_line' : '');

    if (this._materialCache.has(key)) {
      return this._materialCache.get(key);
    }

    let mat;
    if (line) {
      mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    } else {
      mat = new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthTest: false,   // always visible through other geometry
      });
    }

    this._materialCache.set(key, mat);
    return mat;
  }
}
