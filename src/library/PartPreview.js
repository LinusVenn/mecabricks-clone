
import * as THREE from 'three';
import { Brick     } from '../objects/Brick.js';
import { PartCatalog } from './PartCatalog.js';

// =====================================================================
// PartPreview
//
// Eigenständige Mini-Three.js-Szene für die 3D-Vorschau eines Bauteils.
// Erzeugt ein <canvas>-Element, das in die PartLibraryUI eingebettet
// wird. Dreht das Bauteil automatisch, wenn sichtbar.
//
// Wichtig: Die Vorschau verändert weder PartLibrary noch HistoryManager.
// =====================================================================

export class PartPreview {

    /**
     * @param {HTMLElement} container  – DOM-Element, in das das Canvas eingefügt wird
     * @param {number}      [width=180]
     * @param {number}      [height=120]
     */
    constructor(container, width = 180, height = 120) {

        this._container = container;
        this._w         = width;
        this._h         = height;

        this._currentPartId = null;
        this._color         = 0x4488ff;
        this._animFrame     = null;
        this._visible       = false;

        // Canvas
        this._canvas = document.createElement('canvas');
        this._canvas.width  = width;
        this._canvas.height = height;
        this._canvas.style.cssText =
            'display:block;width:100%;border-radius:6px;background:#1e1e1e;';
        container.appendChild(this._canvas);

        // Renderer
        this._renderer = new THREE.WebGLRenderer({
            canvas:    this._canvas,
            antialias: true,
            alpha:     false
        });
        this._renderer.setSize(width, height);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this._renderer.setClearColor(0x1e1e1e);

        // Szene + Beleuchtung
        this._scene = new THREE.Scene();

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this._scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 8, 5);
        this._scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
        fillLight.position.set(-4, 2, -3);
        this._scene.add(fillLight);

        // Kamera
        this._camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        this._camera.position.set(3, 4, 5);
        this._camera.lookAt(0, 0.6, 0);

        // Bauteil-Gruppe (wird beim Wechsel ersetzt)
        this._partGroup = null;

        // Dummy-Szene zum Instantiieren von Brick ohne echte Scene.add
        this._dummyScene = new THREE.Scene();
    }


    // ----------------------------------------------------------------
    // Bauteil anzeigen
    // ----------------------------------------------------------------

    /**
     * Lädt ein Bauteil in die Vorschau.
     *
     * @param {string} partId
     * @param {number} [color]
     */
    setPart(partId, color = null) {

        if (color !== null) this._color = color;

        if (partId === this._currentPartId && color === null) return;

        this._currentPartId = partId;

        // Altes Bauteil entfernen
        if (this._partGroup) {
            this._scene.remove(this._partGroup);
            this._disposePart(this._partGroup);
            this._partGroup = null;
        }

        const def = PartCatalog.instance().getPartById(partId);

        if (!def) return;

        // Brick in einer Hilfs-Szene erstellen, dann Gruppe in die
        // Preview-Szene umhängen (Brick.constructor fügt zur Szene hinzu)
        try {
            const brick = new Brick(
                this._dummyScene,
                0, 0, 0,
                this._color,
                partId
            );

            // Gruppe aus der Hilfs-Szene nehmen und in die Preview-Szene
            this._dummyScene.remove(brick.group);
            this._scene.add(brick.group);
            this._partGroup = brick.group;

            // Kamera auf Bauteil ausrichten
            this._fitCamera(def);

        } catch (e) {
            console.error('PartPreview: Bauteil konnte nicht geladen werden', e);
        }
    }

    /** Setzt die Vorschaufarbe ohne das Bauteil neu zu laden. */
    setColor(color) {
        this._color = color;

        if (this._currentPartId) {
            this.setPart(this._currentPartId, color);
        }
    }


    // ----------------------------------------------------------------
    // Sichtbarkeit und Animation
    // ----------------------------------------------------------------

    show() {
        this._visible = true;
        this._canvas.style.display = 'block';
        this._startLoop();
    }

    hide() {
        this._visible = false;
        this._canvas.style.display = 'none';
        this._stopLoop();
    }

    _startLoop() {
        if (this._animFrame !== null) return;

        const loop = () => {
            if (!this._visible) {
                this._animFrame = null;
                return;
            }

            // Langsam drehen
            if (this._partGroup) {
                this._partGroup.rotation.y += 0.012;
            }

            this._renderer.render(this._scene, this._camera);
            this._animFrame = requestAnimationFrame(loop);
        };

        this._animFrame = requestAnimationFrame(loop);
    }

    _stopLoop() {
        if (this._animFrame !== null) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
    }


    // ----------------------------------------------------------------
    // Hilfsmethoden
    // ----------------------------------------------------------------

    _fitCamera(def) {
        const maxDim = Math.max(def.width, def.depth, def.height / 0.4);
        const dist   = maxDim * 1.4 + 2.5;

        this._camera.position.set(dist * 0.6, dist * 0.8, dist * 1.0);
        this._camera.lookAt(0, def.height / 2, 0);
    }

    _disposePart(group) {
        group.traverse((obj) => {
            if (!obj.isMesh) return;
            obj.geometry?.dispose();

            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material?.dispose();
            }
        });
    }

    dispose() {
        this._stopLoop();

        if (this._partGroup) {
            this._disposePart(this._partGroup);
        }

        this._renderer.dispose();
        this._canvas.remove();
    }
}
