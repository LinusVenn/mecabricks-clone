
import * as THREE from 'three';
import { Brick     } from '../objects/Brick.js';
import { PartCatalog } from './PartCatalog.js';
import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';

// =====================================================================
// PartPreview
//
// Eigenständige Mini-Three.js-Szene für die 3D-Vorschau eines Bauteils.
// Erzeugt ein <canvas>-Element, das in die PartLibraryUI eingebettet
// wird. Dreht das Bauteil automatisch, wenn sichtbar.
//
// Wichtig: Die Vorschau verändert weder PartLibrary noch HistoryManager.
//
// Erweitert: Unterstützt optionale LDraw-Vorschau über ldrawManager
//            oder geometryProvider (beide Wege sind fire-and-forget).
// =====================================================================

export class PartPreview {

    /**
     * @param {HTMLElement}  container          – DOM-Element, in das das Canvas eingefügt wird
     * @param {number}       [width=180]
     * @param {number}       [height=120]
     * @param {object}       [options={}]
     * @param {object|null}  [options.ldrawManager]      – optionaler LDraw-Manager
     * @param {object|null}  [options.geometryProvider]  – optionaler PartGeometryProvider
     */
    constructor(container, width = 180, height = 120, options = {}) {

        this._container = container;
        this._w         = width;
        this._h         = height;

        // Optionale LDraw-Unterstützung
        this._ldrawManager      = options.ldrawManager      ?? null;
        this._geometryProvider  = options.geometryProvider  ?? null;

        this._currentPartId = null;
        this._color         = 0x4488ff;
        this._animFrame     = null;
        this._visible       = false;

        // Generation counter: Jedes setPart()-Aufruf erhöht diesen Zähler.
        // Async-Loads prüfen damit ob sie noch aktuell sind.
        this._loadGeneration = 0;

        // Referenz auf laufendes LDraw-Geometrie-Ergebnis (für Release)
        this._previewGeoResult = null;

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

        // Overlay-Element für Textnachrichten (Loading / Nicht verfügbar)
        this._overlay = document.createElement('div');
        this._overlay.style.cssText = [
            'position:absolute',
            'inset:0',
            'display:none',
            'align-items:center',
            'justify-content:center',
            'color:#aaa',
            'font-size:11px',
            'font-family:sans-serif',
            'text-align:center',
            'padding:4px',
            'pointer-events:none',
            'border-radius:6px',
            'background:rgba(30,30,30,0.75)'
        ].join(';');
        // Container braucht position:relative damit das Overlay korrekt positioniert
        const origPos = window.getComputedStyle(container).position;
        if (!origPos || origPos === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(this._overlay);
    }


    // ----------------------------------------------------------------
    // Bauteil anzeigen
    // ----------------------------------------------------------------

    /**
     * Lädt ein Bauteil in die Vorschau.
     * Fire-and-forget – bei LDraw-Teilen läuft der Ladevorgang asynchron.
     *
     * @param {string} partId
     * @param {number} [color]
     */
    setPart(partId, color = null) {

        if (color !== null) this._color = color;

        if (partId === this._currentPartId && color === null) return;

        this._currentPartId = partId;

        // Erhöhe Generation, um laufende Loads ungültig zu machen
        this._loadGeneration += 1;

        // Altes Bauteil entfernen (inkl. etwaiger LDraw-Geometrie)
        this._clearPartGroup();
        this._previewGeoRelease();

        // Overlay ausblenden
        this._hideOverlay();

        // Pfad 1: Bauteil ist in PART_DEFINITIONS → klassischer Brick-Pfad
        if (Object.prototype.hasOwnProperty.call(PART_DEFINITIONS, partId)) {
            const def = PartCatalog.instance().getPartById(partId);
            if (!def) {
                this._showUnavailable();
                return;
            }
            this._buildBrickPreview(partId, def);
            return;
        }

        // Pfad 2: Bauteil ist im Katalog und hat ldrawPartNumber
        const catalogEntry = PartCatalog.instance().getPartById(partId);
        if (
            catalogEntry?.ldrawPartNumber &&
            (this._ldrawManager || this._geometryProvider)
        ) {
            this._setLDrawPart(partId, catalogEntry.ldrawPartNumber, this._color);
            return;
        }

        // Pfad 3: Kein Geometrie-Pfad verfügbar
        this._showUnavailable();
    }

    /** Setzt die Vorschaufarbe ohne das Bauteil neu zu laden. */
    setColor(color) {
        this._color = color;

        if (this._currentPartId) {
            // Force-reload durch temporäres Löschen der gespeicherten ID
            const savedId = this._currentPartId;
            this._currentPartId = null;
            this.setPart(savedId, color);
        }
    }


    // ----------------------------------------------------------------
    // Private: LDraw-Vorschau
    // ----------------------------------------------------------------

    /**
     * Lädt das LDraw-Bauteil asynchron und aktualisiert die Vorschau.
     * Intern fire-and-forget; nutzt Generation-Counter zum Abbrechen
     * veralteter Ladevorgänge.
     *
     * @param {string} partId
     * @param {string} ldrawPartNumber
     * @param {number} color
     */
    async _setLDrawPart(partId, ldrawPartNumber, color) {

        const generation = this._loadGeneration;

        this._showLoadingPlaceholder();

        try {
            let geoResult = null;

            if (this._geometryProvider) {
                // Bevorzugter Pfad: generischer PartGeometryProvider
                geoResult = await this._geometryProvider.getGeometry(
                    partId,
                    { color }
                );
            } else if (this._ldrawManager) {
                // Alternativer Pfad: direkter LDraw-Manager
                geoResult = await this._ldrawManager.loadPart(
                    ldrawPartNumber,
                    { color }
                );
            }

            // Prüfen ob in der Zwischenzeit ein anderes Teil gewählt wurde
            if (generation !== this._loadGeneration) {
                // Veraltetes Ergebnis sofort freigeben
                if (geoResult && typeof geoResult.release === 'function') {
                    geoResult.release();
                }
                return;
            }

            if (!geoResult) {
                this._hideOverlay();
                this._showUnavailable();
                return;
            }

            this._previewGeoResult = geoResult;

            const object3D = geoResult.object3D ?? geoResult.scene ?? geoResult;

            // Abmessungen aus geoResult oder Katalog ableiten
            const catalogEntry = PartCatalog.instance().getPartById(partId);
            const dimensions = geoResult.dimensions ?? {
                width:  catalogEntry?.width  ?? 2,
                height: catalogEntry?.height ?? 1.2,
                depth:  catalogEntry?.depth  ?? 2
            };

            this._hideOverlay();
            this._showPreviewObject(object3D, dimensions);

        } catch (err) {
            if (generation !== this._loadGeneration) return;

            console.warn('PartPreview: LDraw-Bauteil konnte nicht geladen werden', err);
            this._hideOverlay();
            this._showUnavailable();
        }
    }

    /**
     * Zeigt einen einfachen Platzhalter-Würfel und "Lädt…"-Text während
     * das LDraw-Modell geladen wird.
     */
    _showLoadingPlaceholder() {
        // Überschreibe overlay-Text
        this._showOverlay('Lädt…');

        // Leichten Platzhalter-Würfel zeigen damit die Szene nicht leer wirkt
        this._clearPartGroup();

        const geo  = new THREE.BoxGeometry(1, 1, 1);
        const mat  = new THREE.MeshStandardMaterial({
            color: 0x555566,
            transparent: true,
            opacity: 0.4,
            wireframe: true
        });
        const mesh  = new THREE.Mesh(geo, mat);
        const group = new THREE.Group();
        group.add(mesh);

        this._scene.add(group);
        this._partGroup = group;

        // Kamera auf Standardposition
        this._camera.position.set(3, 4, 5);
        this._camera.lookAt(0, 0.6, 0);
    }

    /**
     * Ersetzt die aktuelle Bauteil-Gruppe durch das gegebene Object3D.
     *
     * @param {THREE.Object3D} object3D
     * @param {{ width: number, height: number, depth: number }} dimensions
     */
    _showPreviewObject(object3D, dimensions) {
        this._clearPartGroup();

        const group = new THREE.Group();
        group.add(object3D);

        this._scene.add(group);
        this._partGroup = group;

        // Kamera anpassen
        this._fitCameraFromDimensions(dimensions);
    }


    // ----------------------------------------------------------------
    // Private: Klassischer Brick-Vorschau-Pfad
    // ----------------------------------------------------------------

    /**
     * Erstellt eine Brick-basierte Vorschau für Teile aus PART_DEFINITIONS.
     *
     * @param {string} partId
     * @param {object} def  – normalisierter Katalogeintrag
     */
    _buildBrickPreview(partId, def) {
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
            this._showUnavailable();
        }
    }


    // ----------------------------------------------------------------
    // Private: Geometrie-Release
    // ----------------------------------------------------------------

    /**
     * Gibt die aktuell gehaltene LDraw-Geometrie frei (falls vorhanden).
     */
    _previewGeoRelease() {
        if (this._previewGeoResult) {
            if (typeof this._previewGeoResult.release === 'function') {
                try {
                    this._previewGeoResult.release();
                } catch (e) {
                    // Release-Fehler dürfen die UI nicht blockieren
                    console.warn('PartPreview: Fehler beim Freigeben der Geometrie', e);
                }
            }
            this._previewGeoResult = null;
        }
    }


    // ----------------------------------------------------------------
    // Private: Overlay-Helfer
    // ----------------------------------------------------------------

    _showOverlay(text) {
        this._overlay.textContent = text;
        this._overlay.style.display = 'flex';
    }

    _hideOverlay() {
        this._overlay.style.display = 'none';
        this._overlay.textContent   = '';
    }

    _showUnavailable() {
        this._showOverlay('Vorschau nicht verfügbar');
    }


    // ----------------------------------------------------------------
    // Private: Gruppe entfernen
    // ----------------------------------------------------------------

    _clearPartGroup() {
        if (this._partGroup) {
            this._scene.remove(this._partGroup);
            this._disposePart(this._partGroup);
            this._partGroup = null;
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

    /**
     * Richtet die Kamera anhand expliziter Dimensionen aus
     * (für LDraw-Bauteile, die kein normalisiertes Def-Objekt haben).
     *
     * @param {{ width: number, height: number, depth: number }} dimensions
     */
    _fitCameraFromDimensions(dimensions) {
        const w = dimensions.width  ?? 2;
        const h = dimensions.height ?? 1.2;
        const d = dimensions.depth  ?? 2;

        const maxDim = Math.max(w, d, h / 0.4);
        const dist   = maxDim * 1.4 + 2.5;

        this._camera.position.set(dist * 0.6, dist * 0.8, dist * 1.0);
        this._camera.lookAt(0, h / 2, 0);
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

        this._previewGeoRelease();

        if (this._partGroup) {
            this._disposePart(this._partGroup);
        }

        this._renderer.dispose();
        this._canvas.remove();
        this._overlay.remove();
    }
}
