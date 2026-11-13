// =====================================================================
// PerformanceManager – Schritt 7 (Phase 8.8)
//
// Koordiniert alle Performance-Optimierungssysteme:
//   • GeometryCache     – gemeinsame Geometrien
//   • MaterialCache     – gemeinsame Materialien
//   • InstanceManager   – THREE.InstancedMesh für identische Bauteile
//   • VisibilityOptimizer – Frustum Culling
//   • PerformanceMonitor  – Laufzeitkennzahlen
//   • ModelLoadingManager – gestaffeltes Laden großer Modelle
//
// Die Optimierungen sind einzeln aktivierbar / deaktivierbar.
// Der PerformanceManager bietet einen Tick-Hook, der von der
// Render-Schleife (SceneManager.animate) aufgerufen wird.
//
// Schattenoptimierung (Schritt 4)
// ─────────────────────────────────
// Der PerformanceManager verfolgt, ob sich die Szene seit dem letzten
// Frame geändert hat (Dirty-Flag). Ist die Szene unverändert, wird
// ShadowMap.autoUpdate = false gesetzt, sodass THREE.js die
// Schattenkarte nicht neu berechnet.
// =====================================================================

import { GeometryCache }       from './GeometryCache.js';
import { MaterialCache }       from './MaterialCache.js';
import { InstanceManager }     from './InstanceManager.js';
import { VisibilityOptimizer } from './VisibilityOptimizer.js';
import { PerformanceMonitor }  from './PerformanceMonitor.js';
import { ModelLoadingManager } from './ModelLoadingManager.js';


export class PerformanceManager {

    /**
     * @param {{
     *   scene:              import('three').Scene
     *   camera:             import('three').Camera
     *   renderer:           import('three').WebGLRenderer
     *   library:            import('../objects/PartLibrary.js').PartLibrary
     *   shadowManager?:     import('../rendering/ShadowManager.js').ShadowManager
     *   connectionManager?: object
     *   groupManager?:      object
     *   componentLibrary?:  object
     *   selectionManager?:  object
     * }} options
     */
    constructor({
        scene,
        camera,
        renderer,
        library,
        shadowManager     = null,
        connectionManager = null,
        groupManager      = null,
        componentLibrary  = null,
        selectionManager  = null
    }) {
        this._scene    = scene;
        this._camera   = camera;
        this._renderer = renderer;
        this._library  = library;

        // ------------------------------------------------------------------
        // Teilsysteme initialisieren
        // ------------------------------------------------------------------

        this.geometryCache = new GeometryCache();
        this.materialCache = new MaterialCache();

        this.instanceManager = new InstanceManager(scene, library);

        this.visibilityOptimizer = new VisibilityOptimizer(library);

        this.performanceMonitor = new PerformanceMonitor(renderer);

        this.modelLoadingManager = new ModelLoadingManager({
            library,
            connectionManager,
            groupManager,
            componentLibrary,
            chunkSize: 50
        });

        // ------------------------------------------------------------------
        // Schatten-Dirty-Tracking (Schritt 4)
        // ------------------------------------------------------------------

        /** @private */
        this._shadowManager = shadowManager;

        /**
         * true = Szene hat sich geändert, Schattenkarte muss neu berechnet
         * werden.
         * @type {boolean}
         */
        this._sceneDirty = true;

        /** @type {boolean} – Schattenoptimierung ein/aus */
        this._shadowOptimizationEnabled = false;

        // ------------------------------------------------------------------
        // SelectionManager-Integration für Instancing
        // ------------------------------------------------------------------

        if (selectionManager) {
            this._hookSelectionManager(selectionManager);
        }
    }


    // ------------------------------------------------------------------
    // Tick-Hook (einmal pro Frame aufrufen)
    // ------------------------------------------------------------------

    /**
     * Muss am Anfang jedes Frames (vor renderer.render()) aufgerufen
     * werden.
     */
    beginFrame() {
        this.performanceMonitor.beginFrame();
        this.visibilityOptimizer.update(this._camera);

        if (this._shadowOptimizationEnabled && this._shadowManager) {
            const renderer = this._renderer;
            if (this._sceneDirty) {
                renderer.shadowMap.needsUpdate = true;
                this._sceneDirty = false;
            } else {
                renderer.shadowMap.needsUpdate = false;
            }
        }
    }


    /**
     * Muss am Ende jedes Frames (nach renderer.render()) aufgerufen
     * werden.
     */
    endFrame() {
        this.performanceMonitor.endFrame();
    }


    // ------------------------------------------------------------------
    // Dirty-Flag (Schattenoptimierung)
    // ------------------------------------------------------------------

    /**
     * Muss aufgerufen werden, wenn sich die Szene verändert hat
     * (Bauteile hinzugefügt / verschoben / entfernt, Farben geändert,
     * Kamera bewegt …).
     */
    markSceneDirty() {
        this._sceneDirty = true;
    }


    // ------------------------------------------------------------------
    // Instancing
    // ------------------------------------------------------------------

    enableInstancing() {
        this.instanceManager.enable();
        // Raycaster auf alle Layer ausdehnen (für Originalgeometrien)
        this._raycasterLayersEnableAll?.();
        this.markSceneDirty();
    }

    disableInstancing() {
        this.instanceManager.disable();
        this.markSceneDirty();
    }

    /** Registriert einen Callback, der raycaster.layers.enableAll() aufruft. */
    setRaycasterLayersEnableAll(fn) {
        this._raycasterLayersEnableAll = fn;
        if (this.instanceManager.enabled) fn?.();
    }


    // ------------------------------------------------------------------
    // Visibility-Optimizer
    // ------------------------------------------------------------------

    enableVisibilityOptimizer() {
        this.visibilityOptimizer.enable();
    }

    disableVisibilityOptimizer() {
        this.visibilityOptimizer.disable();
        this.markSceneDirty();
    }


    // ------------------------------------------------------------------
    // Schattenoptimierung
    // ------------------------------------------------------------------

    enableShadowOptimization() {
        this._shadowOptimizationEnabled = true;
    }

    disableShadowOptimization() {
        this._shadowOptimizationEnabled = false;
        // Sicherstellen, dass Schatten beim nächsten Frame aktualisiert wird
        if (this._renderer?.shadowMap) {
            this._renderer.shadowMap.needsUpdate = true;
        }
    }

    isShadowOptimizationEnabled() {
        return this._shadowOptimizationEnabled;
    }


    // ------------------------------------------------------------------
    // Performance-Monitor
    // ------------------------------------------------------------------

    enableMonitor()  { this.performanceMonitor.setEnabled(true);  }
    disableMonitor() { this.performanceMonitor.setEnabled(false); }

    /** @returns {{ fps, drawCalls, triangles, objects, geometries, textures, materials, loadTime }} */
    getMetrics() {
        return { ...this.performanceMonitor.metrics };
    }


    // ------------------------------------------------------------------
    // Modell laden (gestaffelt)
    // ------------------------------------------------------------------

    /**
     * Lädt ein Projektdaten-Objekt gestaffelt in die Szene.
     * @param {object} projectData
     * @param {{ onProgress?, onComplete?, onError? }} [callbacks]
     */
    async loadChunked(projectData, callbacks = {}) {
        this.performanceMonitor.startLoadTimer();

        const wrappedCallbacks = {
            ...callbacks,
            onComplete: () => {
                this.performanceMonitor.stopLoadTimer();
                this.markSceneDirty();
                if (this.instanceManager.enabled) {
                    this.instanceManager.rebuild();
                }
                callbacks.onComplete?.();
            }
        };

        return this.modelLoadingManager.loadChunked(projectData, wrappedCallbacks);
    }


    // ------------------------------------------------------------------
    // Benachrichtigungen über Modell-Änderungen
    // ------------------------------------------------------------------

    /** Aufrufen, wenn ein Bauteil hinzugefügt wurde. */
    onBrickAdded(brick) {
        this.markSceneDirty();
        if (this.instanceManager.enabled) {
            this.instanceManager.addBrick(brick);
        }
    }

    /** Aufrufen, wenn ein Bauteil entfernt wurde. */
    onBrickRemoved(brickId) {
        this.markSceneDirty();
        this.instanceManager.onBrickRemoved(brickId);
    }

    /** Aufrufen, wenn ein Bauteil bewegt / gedreht wurde. */
    onBrickTransformed(brickId) {
        this.markSceneDirty();
        this.instanceManager.updateBrickMatrix(brickId);
    }

    /** Aufrufen, wenn sich Gruppen- oder Materialeinstellungen geändert haben. */
    onSceneStructureChanged() {
        this.markSceneDirty();
        if (this.instanceManager.enabled) {
            this.instanceManager.rebuild();
        }
    }


    // ------------------------------------------------------------------
    // SelectionManager-Integration
    // ------------------------------------------------------------------

    /**
     * Koppelt den InstanceManager an den SelectionManager.
     * Wenn instancing aktiv ist und ein Bauteil ausgewählt / abgewählt
     * wird, wird es aktiviert / deaktiviert.
     */
    _hookSelectionManager(selectionManager) {
        // Raycaster-Layers auf alle ausdehnen
        if (selectionManager.raycaster) {
            this._raycasterLayersEnableAll = () => {
                selectionManager.raycaster.layers.enableAll();
            };
        }

        // Einzelauswahl
        const prevOnSelectionChanged = selectionManager.onSelectionChanged;
        selectionManager.onSelectionChanged = object => {
            prevOnSelectionChanged?.(object);
            if (!this.instanceManager.enabled) return;

            // Alle alten aktiven Bauteile deaktivieren
            this.instanceManager.deactivateAll();

            // Neu ausgewähltes Bauteil aktivieren
            if (object?.userData?.brickId) {
                this.instanceManager.activateBrick(object.userData.brickId);
            }
        };
    }


    // ------------------------------------------------------------------
    // Aufräumen
    // ------------------------------------------------------------------

    dispose() {
        this.instanceManager.dispose();
        this.visibilityOptimizer.disable();
        this.geometryCache.dispose();
        this.materialCache.dispose();
        this.performanceMonitor.reset();
    }
}
