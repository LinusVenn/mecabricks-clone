// =====================================================================
// initializePerformancePhase88 – Schritt 7 (Phase 8.8)
//
// Einsprungpunkt für die vollständige Phase-8.8-Integration.
// Gibt ein Objekt mit allen Teilsystemen zurück.
//
// Aufruf in main.js:
//
//   const phase88 = await initializePerformancePhase88({
//       sidebar, scene, camera, renderer, library,
//       sceneManager, shadowManager, selectionManager,
//       multiSelectionManager, connectionManager,
//       groupManager, componentLibrary
//   });
//
// Die Integration:
//   1. PerformanceManager erstellen
//   2. PerformancePanel in die Seitenleiste einbauen
//   3. Render-Schleife einbinden (beginFrame / endFrame)
//   4. Instancing-Klick-Auflösung als Capture-Handler registrieren
//   5. Selection-Hooks verdrahten
//   6. Globale Zugriffspunkte setzen
// =====================================================================

import * as THREE from 'three';
import { PerformanceManager } from './PerformanceManager.js';
import { PerformancePanel }   from '../ui/PerformancePanel.js';


/**
 * @param {{
 *   sidebar:               HTMLElement
 *   scene:                 import('three').Scene
 *   camera:                import('three').Camera
 *   renderer:              import('three').WebGLRenderer
 *   library:               import('../objects/PartLibrary.js').PartLibrary
 *   sceneManager:          object
 *   shadowManager?:        object
 *   selectionManager?:     object
 *   multiSelectionManager?: object
 *   connectionManager?:    object
 *   groupManager?:         object
 *   componentLibrary?:     object
 * }} options
 */
export async function initializePerformancePhase88({
    sidebar,
    scene,
    camera,
    renderer,
    library,
    sceneManager,
    shadowManager       = null,
    selectionManager    = null,
    multiSelectionManager = null,
    connectionManager   = null,
    groupManager        = null,
    componentLibrary    = null
}) {

    // ------------------------------------------------------------------
    // 1. PerformanceManager erstellen
    // ------------------------------------------------------------------

    const performanceManager = new PerformanceManager({
        scene,
        camera,
        renderer,
        library,
        shadowManager,
        connectionManager,
        groupManager,
        componentLibrary,
        selectionManager
    });


    // ------------------------------------------------------------------
    // 2. Panel in die Seitenleiste einbauen
    // ------------------------------------------------------------------

    let panelContainer = document.getElementById('performance-panel-container');
    if (!panelContainer) {
        panelContainer = document.createElement('div');
        panelContainer.id        = 'performance-panel-container';
        panelContainer.className = 'phase-panel-container';

        const heading = document.createElement('h3');
        heading.textContent = 'Performance (Phase 8.8)';
        panelContainer.appendChild(heading);

        sidebar.appendChild(panelContainer);
    }

    const performancePanel = new PerformancePanel(
        panelContainer,
        performanceManager
    );


    // ------------------------------------------------------------------
    // 3. Render-Schleife einbinden
    //
    // SceneManager.animate() ruft intern renderer.render(). Wir ersetzen
    // die animate()-Methode durch eine Version mit beginFrame/endFrame-
    // Aufrufen.
    // ------------------------------------------------------------------

    _wrapAnimateLoop(sceneManager, performanceManager);


    // ------------------------------------------------------------------
    // 4. Instancing: Capture-Handler für InstancedMesh-Klicks
    //
    // Wenn Instancing aktiv ist und der Nutzer auf eine InstancedMesh-
    // Instanz klickt, muss das zugehörige Bauteil aktiviert und dem
    // SelectionManager übergeben werden, bevor dessen eigener Klick-
    // Handler läuft.
    // ------------------------------------------------------------------

    if (selectionManager) {
        _registerInstanceClickCapture(
            renderer.domElement,
            camera,
            renderer,
            performanceManager,
            selectionManager,
            multiSelectionManager,
            library
        );
    }


    // ------------------------------------------------------------------
    // 5. MultiSelectionManager-Hook
    //
    // Wenn die Mehrfachauswahl gelöscht wird, alle aktiven Instanzen
    // deaktivieren.
    // ------------------------------------------------------------------

    if (multiSelectionManager) {
        const prevOnChanged = multiSelectionManager.onSelectionChanged;
        multiSelectionManager.onSelectionChanged = ids => {
            prevOnChanged?.(ids);
            if (performanceManager.instanceManager.enabled) {
                // Deaktiviere alle; die Einzelauswahl wird über
                // selectionManager.onSelectionChanged neu gesetzt.
                performanceManager.instanceManager.deactivateAll();
                // Aktiv gebliebene Selektion neu aktivieren
                if (Array.isArray(ids)) {
                    for (const id of ids) {
                        performanceManager.instanceManager.activateBrick(id);
                    }
                }
            }
        };
    }


    // ------------------------------------------------------------------
    // 6. Globale Zugriffspunkte
    // ------------------------------------------------------------------

    window.performanceManager = performanceManager;
    window.performancePanel   = performancePanel;
    window.phase88            = { performanceManager, performancePanel };


    return { performanceManager, performancePanel };
}


// =====================================================================
// Hilfsfunktionen
// =====================================================================

/**
 * Umhüllt sceneManager.animate() mit beginFrame / endFrame-Aufrufen.
 */
function _wrapAnimateLoop(sceneManager, performanceManager) {
    const originalAnimate = sceneManager.animate?.bind(sceneManager);
    if (!originalAnimate) return;

    sceneManager.animate = function () {
        if (!this.isAnimating) return;

        requestAnimationFrame(() => this.animate());

        performanceManager.beginFrame();

        this.controls?.update();
        this.renderer.render(this.scene, this.camera);

        performanceManager.endFrame();
    };
}


/**
 * Registriert einen Capture-Phase-Listener, der Klicks auf InstancedMesh
 * abfängt und in echte Bauteil-Selektionen umwandelt.
 *
 * Ablauf:
 *   1. Raycast gegen alle InstancedMeshes (getInstancedMeshes())
 *   2. Bei Treffer: activateBrick() → Originalgruppe wird sichtbar
 *   3. selectObject() direkt aufrufen (kein zweiter Raycast nötig)
 *   4. stopPropagation() → SelectionManager-Listener wird nicht ausgeführt
 */
function _registerInstanceClickCapture(
    domElement,
    camera,
    renderer,
    performanceManager,
    selectionManager,
    multiSelectionManager,
    library
) {
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    domElement.addEventListener('pointerdown', event => {
        // Nur linke Maustaste; nur wenn Instancing aktiv
        if (event.button !== 0) return;
        if (!performanceManager.instanceManager.enabled) return;

        // Maus in NDC umrechnen
        const rect = domElement.getBoundingClientRect();
        mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const instancedMeshes = performanceManager.instanceManager
            .getInstancedMeshes();
        if (instancedMeshes.length === 0) return;

        const intersects = raycaster.intersectObjects(instancedMeshes, false);
        if (intersects.length === 0) return;

        const hit = intersects[0];
        if (hit.instanceId === undefined) return;

        const brickId = performanceManager.instanceManager.resolveHit(
            hit.object,
            hit.instanceId
        );
        if (!brickId) return;

        // Bauteil aktivieren (Originalgruppe sichtbar)
        const brick = performanceManager.instanceManager.activateBrick(brickId);
        if (!brick) return;

        // Szene als verändert markieren
        performanceManager.markSceneDirty();

        // Synthetic selection: direkt selectObject aufrufen
        const isCtrl = event.ctrlKey || event.metaKey;

        if (isCtrl && multiSelectionManager && selectionManager.onCtrlClick) {
            selectionManager.onCtrlClick(brickId);
        } else {
            // Mehrfachauswahl aufheben
            selectionManager.onEmptyClick?.();
            selectionManager.selectObject(brick.group);
        }

        // SelectionManager-eigenen Handler unterdrücken
        event.stopPropagation();

    }, { capture: true });
}



// THREE ist oben als statisches Modul importiert und steht überall
// in diesem Modul zur Verfügung.
