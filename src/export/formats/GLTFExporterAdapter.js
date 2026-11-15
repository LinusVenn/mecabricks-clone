/**
 * GLTFExporterAdapter – Exportiert das 3D-Modell als GLTF/GLB (Phase H.3)
 *
 * Erzeugt eine separate Export-Szene um die Originalszene nicht zu verändern.
 * Unterstützt lokale und LDraw-Bauteile.
 *
 * Wichtig:
 *  - Die Originalszene und ihre Geometrien/Materialien werden NICHT verändert
 *  - Gemeinsame Geometrien und Materialien werden NICHT dispositiert
 *  - Editor-Hilfsobjekte (Gizmos, Preview, Overlays) werden NICHT exportiert
 *  - Baugruppen werden als übergeordnete Three.js-Nodes abgebildet
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { ExportLogger } from '../utils/ExportLogger.js';

// ─── Result typedef (JSDoc only) ──────────────────────────────────────────────

/**
 * @typedef {object} GLTFExportResult
 * @property {ArrayBuffer|object} data      – GLB binary (ArrayBuffer) or GLTF JSON object
 * @property {boolean}            binary    – true = GLB, false = GLTF JSON
 * @property {string}             filename  – Suggested download filename
 * @property {{ exported: number, total: number }} stats
 */

// ─────────────────────────────────────────────────────────────────────────────
// GLTFExporterAdapter
// ─────────────────────────────────────────────────────────────────────────────

export class GLTFExporterAdapter {

    /**
     * @param {object}         options
     * @param {object}         options.library       – PartLibrary instance (must expose getAll() / getById())
     * @param {ExportLogger|null} [options.logger=null] – Optional logger
     */
    constructor({ library, logger = null }) {
        if (!library) {
            throw new TypeError('GLTFExporterAdapter: library is required');
        }
        this._library = library;
        this._logger  = logger ?? _makeNullLogger();
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Exports the snapshot as a GLTF/GLB file.
     *
     * The method creates a temporary export scene, populates it with cloned
     * Three.js groups, triggers the GLTFExporter, cleans up the clones, and
     * resolves with the finished result.
     *
     * The original scene, its geometries, and its materials are **never** mutated
     * or disposed.
     *
     * @param {object}  snapshot                        – ExportSnapshot
     * @param {Array<object>}  snapshot.parts           – Part descriptors
     * @param {Array<object>}  [snapshot.assemblies]    – Assembly descriptors
     * @param {object}         [snapshot.metadata]      – Optional metadata
     *
     * @param {object}  [options]
     * @param {boolean} [options.binary=true]                    – true → .glb, false → .gltf JSON
     * @param {boolean} [options.includeAssemblyStructure=true]  – Wrap assembly parts in Group nodes
     * @param {boolean} [options.includeInvisible=false]         – Include hidden parts
     * @param {string}  [options.projectName]                    – Overrides snapshot.metadata.projectName
     *
     * @returns {Promise<GLTFExportResult>}
     */
    async export(snapshot, options = {}) {
        if (!snapshot || !Array.isArray(snapshot.parts)) {
            throw new TypeError('GLTFExporterAdapter.export: snapshot.parts must be an array');
        }

        const binary                   = options.binary !== false;            // default true
        const includeAssemblyStructure = options.includeAssemblyStructure !== false; // default true
        const includeInvisible         = options.includeInvisible === true;   // default false
        const projectName              = options.projectName
            ?? snapshot.metadata?.projectName
            ?? 'Model';

        // ── 1. Build an id → live-instance map ────────────────────────────
        const instanceMap = this._buildInstanceMap(this._library);

        // ── 2. Create the throw-away export scene ─────────────────────────
        const exportScene = new THREE.Scene();
        exportScene.name  = projectName;

        // Track every cloned object so we can dispose them after export.
        /** @type {THREE.Object3D[]} */
        const clones = [];

        // ── 3. Optionally pre-create assembly group nodes ─────────────────
        /** @type {Map<string, THREE.Group>} */
        const assemblyNodes = new Map();

        if (includeAssemblyStructure && Array.isArray(snapshot.assemblies)) {
            for (const asm of snapshot.assemblies) {
                const asmId   = asm.id ?? asm.assemblyId;
                const asmName = asm.name ?? asmId ?? 'assembly';

                const asmGroup     = new THREE.Group();
                asmGroup.name      = asmName;
                asmGroup.userData  = {
                    assemblyId:   asmId,
                    assemblyName: asmName,
                };

                assemblyNodes.set(String(asmId), asmGroup);
                exportScene.add(asmGroup);
                clones.push(asmGroup);
            }
        }

        // ── 4. Add each part to the export scene ──────────────────────────
        let exported = 0;
        const total  = snapshot.parts.length;

        for (const part of snapshot.parts) {
            const instanceId = part.id ?? part.instanceId;

            // Resolve the live instance from the library
            const instance = instanceMap.get(String(instanceId));
            if (!instance) {
                this._logger.warn(
                    `GLTFExporterAdapter: Instance "${instanceId}" not found in library — skipped`
                );
                continue;
            }

            // Get the Three.js group from the instance
            const group = this._getGroup(instance);
            if (!group) {
                this._logger.warn(
                    `GLTFExporterAdapter: No group for instance "${instanceId}" — skipped`
                );
                continue;
            }

            // Visibility check
            if (!group.visible && !includeInvisible) {
                this._logger.info(
                    `GLTFExporterAdapter: Skipping invisible part "${instanceId}"`
                );
                continue;
            }

            // Skip editor helper objects
            if (this._isEditorHelper(group)) {
                this._logger.info(
                    `GLTFExporterAdapter: Skipping editor helper "${group.name ?? instanceId}"`
                );
                continue;
            }

            // ── Clone the group (deep clone preserves all child meshes) ───
            const clone = group.clone(true);

            // Copy world-space transform from the original group.
            // Using .copy() on position/quaternion/scale is the most
            // faithful approach — it avoids recomputing the matrix.
            clone.position.copy(group.position);
            clone.quaternion.copy(group.quaternion);
            clone.scale.copy(group.scale);

            // Annotate with export metadata
            clone.userData = {
                ...clone.userData,       // preserve any existing userData keys
                partId:  part.partId  ?? instance.partId  ?? instance.type,
                colorId: part.colorId ?? instance.colorId ?? null,
            };

            clones.push(clone);

            // ── Attach to the correct parent ──────────────────────────────
            const firstAsmId = Array.isArray(part.assemblyIds) && part.assemblyIds.length > 0
                ? String(part.assemblyIds[0])
                : null;

            const parent = (includeAssemblyStructure && firstAsmId && assemblyNodes.has(firstAsmId))
                ? assemblyNodes.get(firstAsmId)
                : exportScene;

            parent.add(clone);
            exported++;
        }

        this._logger.info(
            `GLTFExporterAdapter: ${exported}/${total} parts added to export scene`
        );

        // ── 5. Run GLTFExporter ───────────────────────────────────────────
        let gltfData;
        try {
            gltfData = await this._runExporter(exportScene, { binary });
        } finally {
            // ── 6. Dispose cloned objects (NOT originals) ─────────────────
            // We only clear the export scene; original scene is untouched.
            this._disposeClones(clones);
            exportScene.clear();
        }

        const extension = binary ? 'glb' : 'gltf';
        const filename  = `${_safeName(projectName)}.${extension}`;

        return {
            data:     gltfData,
            binary,
            filename,
            stats: { exported, total },
        };
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Builds a Map from instance-id (string) → Brick|PartInstance by iterating
     * the full library.
     *
     * @param {object} library  – PartLibrary (or any object with getAll())
     * @returns {Map<string, object>}
     */
    _buildInstanceMap(library) {
        const map = new Map();
        const all = library.getAll?.() ?? [];
        for (const item of all) {
            const id = item.id;
            if (id != null) {
                map.set(String(id), item);
            }
        }
        return map;
    }

    /**
     * Extracts the THREE.Group from a Brick or PartInstance.
     *
     * Both Brick and PartInstance store their 3D representation in `.group`.
     *
     * @param {object} instance  – Brick | PartInstance
     * @returns {THREE.Group|null}
     */
    _getGroup(instance) {
        if (!instance) return null;
        // Both Brick and PartInstance expose a `.group` property (THREE.Group).
        const g = instance.group;
        if (g instanceof THREE.Object3D) return g;
        return null;
    }

    /**
     * Returns true for objects that are editor-only helpers and must not appear
     * in the exported file.
     *
     * Detection criteria (any match → true):
     *  1. `obj.userData.isEditorHelper === true`
     *  2. Object name contains one of the known helper keywords (case-insensitive)
     *
     * @param {THREE.Object3D} obj
     * @returns {boolean}
     */
    _isEditorHelper(obj) {
        if (!obj) return false;

        // Explicit flag wins
        if (obj.userData?.isEditorHelper === true) return true;

        // Name-based detection
        const name = (obj.name ?? '').toLowerCase();
        const HELPER_KEYWORDS = [
            'preview',
            'gizmo',
            'overlay',
            'connection-point-overlay',
            'selection-box',
            'snap-indicator',
            'axis-helper',
            'grid-helper',
        ];
        for (const kw of HELPER_KEYWORDS) {
            if (name.includes(kw)) return true;
        }

        return false;
    }

    /**
     * Wraps GLTFExporter.parseAsync() in a Promise so export() stays async.
     *
     * Three.js r187 ships `parseAsync(input, options) → Promise` which is
     * cleaner than the callback-based `parse()`.  We use it directly here.
     *
     * @param {THREE.Scene} scene
     * @param {{ binary: boolean }} opts
     * @returns {Promise<ArrayBuffer|object>}
     */
    _runExporter(scene, opts) {
        const exporter = new GLTFExporter();
        return exporter.parseAsync(scene, { binary: opts.binary });
    }

    /**
     * Disposes the geometry and materials of every CLONED object.
     *
     * IMPORTANT: This method must NEVER be called with the original scene's
     * objects.  It is intentionally separate from the export scene's .clear()
     * call so the two concerns stay independent.
     *
     * @param {THREE.Object3D[]} clones
     */
    _disposeClones(clones) {
        for (const obj of clones) {
            obj.traverse((child) => {
                if (!child.isMesh) return;

                // Dispose geometry (the clone owns a new reference)
                child.geometry?.dispose?.();

                // Dispose material(s) — single or array
                const mats = Array.isArray(child.material)
                    ? child.material
                    : [child.material];
                for (const mat of mats) {
                    mat?.dispose?.();
                }
            });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a filesystem-safe version of a project name.
 *
 * @param {string} name
 * @returns {string}
 */
function _safeName(name) {
    return String(name)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 64)
        || 'model';
}

/**
 * Creates a lightweight no-op logger so internal code never needs null-checks.
 *
 * @returns {{ info: Function, warn: Function, error: Function }}
 */
function _makeNullLogger() {
    const noop = () => {};
    return { info: noop, warn: noop, error: noop };
}
