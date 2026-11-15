import * as THREE from 'three';
import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';
import { PartCatalog } from '../library/PartCatalog.js';
import { CONNECTION_TYPES } from '../connections/ConnectionTypes.js';

// =====================================================================
// PlacementManager
//
// Verwaltet die interaktive Bauteil-Platzierung in der Szene.
//
// Erweitert:
//   - Optionaler 9. Konstruktor-Parameter `options` mit
//     `options.geometryProvider` (PartGeometryProvider) und
//     `options.catalog` (PartCatalog).
//   - setSelectedPart() akzeptiert jetzt auch Katalog-Teile mit
//     ldrawPartNumber (zusätzlich zu PART_DEFINITIONS-Typen).
//   - placeBrick() ist jetzt async und unterstützt LDraw-Teile.
//   - cancelPlacement() gibt ausstehende LDraw-Vorschau-Geometrie frei.
// =====================================================================

export class PlacementManager {

    /**
     * @param {THREE.Camera}       camera
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Scene}        scene
     * @param {object}             library            – PartLibrary
     * @param {object}             snapSystem
     * @param {object}             collisionManager
     * @param {object}             connectionManager
     * @param {object|null}        preview            – Placement-Preview-Overlay
     * @param {object}             [options={}]
     * @param {object|null}        [options.geometryProvider] – PartGeometryProvider
     * @param {PartCatalog|null}   [options.catalog]           – PartCatalog-Instanz
     */
    constructor(
        camera,
        renderer,
        scene,
        library,
        snapSystem,
        collisionManager,
        connectionManager,
        preview,
        options = {}
    ) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.library = library;

        this.snapSystem = snapSystem;
        this.collisionManager = collisionManager;
        this.connectionManager = connectionManager;
        this.preview = preview;

        // Optionale LDraw-Unterstützung
        this._geometryProvider = options.geometryProvider ?? null;
        this._catalog          = options.catalog          ?? null;

        this.editor = null;

        // Phase F: Verbindungssysteme (werden von Editor.js nach Konstruktion gesetzt)
        this.connectionPointManager  = null;
        this.connectionCompatibility = null;

        this._selectedColorId = null;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.ground = new THREE.Plane(
            new THREE.Vector3(0, 1, 0),
            0
        );

        this.selectedPart = null;
        this.selectedColor = 0xff0000;

        this.previewPosition = null;
        this.previewRotation = 0;
        this.previewValid = false;

        // Vorschau-Geometrie für LDraw-Teile (Object3D + release-Funktion)
        this._previewGeoResult = null;
    }

    // ---------------------------------------------------------
    // Teil auswählen
    // ---------------------------------------------------------

    /**
     * Wählt ein Teil zur Platzierung aus.
     * Akzeptiert sowohl PART_DEFINITIONS-Typen als auch Katalog-Teile
     * mit ldrawPartNumber (wenn geometryProvider vorhanden).
     *
     * @param {string|null} type
     * @returns {boolean}
     */
    setSelectedPart(type) {
        // null / leer beendet eine aktive Platzierung.
        if (type === null || type === undefined || type === '') {
            this.cancelPlacement();
            return true;
        }

        if (!this._isValidPart(type)) {
            console.warn(
                `PlacementManager: Teil "${type}" ist nicht implementiert.`
            );

            this.cancelPlacement();
            return false;
        }

        this.selectedPart = type;

        this.previewPosition = null;
        this.previewRotation = 0;
        this.previewValid = false;

        const isLocalPart = Object.prototype.hasOwnProperty.call(
            PART_DEFINITIONS,
            type
        );

        if (isLocalPart) {
            // Klassischer Pfad: Placement-Overlay kennt den Typ
            this.preview?.setType(type);
            this.preview?.show();
        } else {
            // LDraw-Teil: asynchron Vorschau-Geometrie laden
            this._loadLDrawPreview(type);
        }

        return true;
    }

    // ---------------------------------------------------------
    // Farbe
    // ---------------------------------------------------------

    setSelectedColor(color) {
        const numericColor = Number(color);

        if (!Number.isFinite(numericColor)) {
            throw new Error('Ungültige Platzierungsfarbe.');
        }

        this.selectedColor = numericColor;
    }

    /**
     * Wählt eine Farbe anhand ihrer Katalog-ID aus.
     * Löst die colorId über editor.colorManager auf (wenn vorhanden).
     * Falls colorManager nicht verfügbar, wird die bestehende Farbe beibehalten.
     *
     * @param {string|number} colorId
     */
    setSelectedColorById(colorId) {
        if (!this.editor?.colorManager) return;
        const colorDef = this.editor.colorManager.getColorById(colorId);
        if (colorDef) {
            this.selectedColor = colorDef.hexNumber;
            this._selectedColorId = colorId;
        }
    }

    // ---------------------------------------------------------
    // Mausposition und Raycasting
    // ---------------------------------------------------------

    getMousePosition(event) {
        if (!event || !this.renderer?.domElement) {
            return null;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        this.mouse.x =
            ((event.clientX - rect.left) / rect.width) * 2 - 1;

        this.mouse.y =
            -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(
            this.mouse,
            this.camera
        );

        const intersection = new THREE.Vector3();

        const hit = this.raycaster.ray.intersectPlane(
            this.ground,
            intersection
        );

        return hit ? intersection : null;
    }

    // ---------------------------------------------------------
    // Platzierungsvorschau aktualisieren
    // ---------------------------------------------------------

    updatePreview(event) {
        if (!this.selectedPart) return;

        // Für LDraw-Teile: Vorschau-Geometrie mitbewegen wenn vorhanden
        const isLocalPart = Object.prototype.hasOwnProperty.call(
            PART_DEFINITIONS,
            this.selectedPart
        );

        if (!isLocalPart && !this._previewGeoResult) {
            // Geometrie noch nicht geladen – nichts tun
            return;
        }

        if (isLocalPart) {
            // Klassischer Snap-/Kollisions-Pfad nur für lokale Teile
            if (
                !Object.prototype.hasOwnProperty.call(
                    PART_DEFINITIONS,
                    this.selectedPart
                )
            ) {
                this.cancelPlacement();
                return;
            }
        }

        const mousePosition = this.getMousePosition(event);

        if (!mousePosition) {
            this.previewValid = false;
            return;
        }

        const desiredPosition = this.snapSystem.snapPosition({
            x: mousePosition.x,
            y: 0,
            z: mousePosition.z
        });

        const rotation = 0;
        const bricks = this.library.getAll();

        let position = desiredPosition;

        if (isLocalPart) {
            const snapPosition = this.snapSystem.findSnapPosition(
                this.selectedPart,
                desiredPosition,
                rotation,
                bricks
            );

            position = snapPosition || desiredPosition;

            const collision = this.collisionManager.checkCollision(
                this.selectedPart,
                position,
                rotation,
                bricks
            );

            this.previewValid = !collision;
        } else {
            // LDraw-Teil: kein lokales Snap/Collision, einfach platzieren
            this.previewValid = true;

            // Vorschau-Object3D mitbewegen
            const obj3D = this._previewGeoResult?.object3D
                ?? this._previewGeoResult?.scene
                ?? null;
            if (obj3D) {
                obj3D.position.set(
                    desiredPosition.x,
                    desiredPosition.y,
                    desiredPosition.z
                );
            }
        }

        this.previewPosition = {
            x: position.x,
            y: position.y,
            z: position.z
        };

        this.previewRotation = rotation;

        if (isLocalPart) {
            this.preview?.update(
                this.previewPosition,
                rotation,
                this.previewValid
            );
        }
    }

    // ---------------------------------------------------------
    // Bauteil platzieren (async)
    // ---------------------------------------------------------

    /**
     * Platziert das aktuell ausgewählte Teil.
     * – Für lokale Teile (PART_DEFINITIONS): synchrones Verhalten (wrapped in Promise).
     * – Für LDraw-Teile: lädt eine neue Geometrie-Instanz und registriert
     *   das Teil über library.addInstance().
     *
     * @returns {Promise<object|null>}  Brick / PartInstance oder null
     */
    async placeBrick() {
        if (!this.selectedPart) {
            return null;
        }

        if (!this.previewPosition || !this.previewValid) {
            return null;
        }

        const isLocalPart = Object.prototype.hasOwnProperty.call(
            PART_DEFINITIONS,
            this.selectedPart
        );

        // ---- Lokaler Brick-Pfad (unverändertes Verhalten) ----
        if (isLocalPart) {
            return this._placeLocalBrick();
        }

        // ---- LDraw-Pfad ----
        return this._placeLDrawBrick();
    }

    /**
     * Klassischer Brick-Platzierungs-Pfad (keine Änderung gegenüber Original).
     * @returns {object|null}
     */
    _placeLocalBrick() {
        let brick = null;

        try {
            brick = this.library.addBrick(
                this.previewPosition.x,
                this.previewPosition.y,
                this.previewPosition.z,
                this.selectedColor,
                this.selectedPart
            );

            if (!brick) {
                return null;
            }

            this.createConnections(brick);

            // Genau einen Undo-Schritt für die Platzierung erzeugen.
            this.editor?.historyManager?.saveState();

            return brick;

        } catch (error) {
            // Bei einem Fehler keine teilweise platzierte Instanz
            // in der Szene zurücklassen.
            if (brick) {
                this.connectionManager?.removeConnections?.(brick.id);
                this.library.removeBrick(brick);
            }

            console.error(
                'PlacementManager: Bauteil konnte nicht platziert werden:',
                error
            );

            throw error;
        }
    }

    /**
     * LDraw-Bauteil-Platzierungs-Pfad.
     * Lädt eine frische Geometrie-Instanz und registriert sie in der Library.
     *
     * @returns {Promise<object|null>}
     */
    async _placeLDrawBrick() {
        if (!this._geometryProvider) {
            console.warn(
                'PlacementManager: Kein geometryProvider für LDraw-Bauteil verfügbar.'
            );
            return null;
        }

        let geoResult = null;
        let instance  = null;

        try {
            // Neue (eigene) Instanz der Geometrie holen
            geoResult = await this._geometryProvider.getGeometry(
                this.selectedPart,
                { color: this.selectedColor }
            );

            if (!geoResult) return null;

            const id = this._generateBrickId();

            // PartInstance über die Library registrieren
            instance = this.library.addInstance?.({
                id,
                partId: this.selectedPart,
                color:  this.selectedColor,
                geoResult
            });

            if (instance) {
                // Position setzen
                if (typeof instance.setTransform === 'function') {
                    instance.setTransform({
                        position: this.previewPosition,
                        rotation: this.previewRotation
                    });
                } else if (instance.group) {
                    instance.group.position.set(
                        this.previewPosition.x,
                        this.previewPosition.y,
                        this.previewPosition.z
                    );
                }

                this.createConnections(instance);
            }

            this.editor?.historyManager?.saveState();

            return instance ?? null;

        } catch (error) {
            // Aufräumen bei Fehler
            if (geoResult && typeof geoResult.release === 'function') {
                try { geoResult.release(); } catch (_) { /* ignore */ }
            }
            if (instance) {
                this.connectionManager?.removeConnections?.(instance.id);
                this.library.removeInstance?.(instance);
            }

            console.error(
                'PlacementManager: LDraw-Bauteil konnte nicht platziert werden:',
                error
            );

            throw error;
        }
    }

    // ---------------------------------------------------------
    // Private: LDraw-Vorschau laden
    // ---------------------------------------------------------

    /**
     * Lädt asynchron die Vorschau-Geometrie für ein LDraw-Teil und fügt
     * das Object3D zur Szene hinzu. Fire-and-forget.
     *
     * @param {string} partId
     */
    async _loadLDrawPreview(partId) {
        // Alte Vorschau-Geometrie freigeben
        this._releasePreviewGeo();

        if (!this._geometryProvider) return;

        try {
            const geoResult = await this._geometryProvider.getGeometry(
                partId,
                { color: this.selectedColor }
            );

            // Prüfen ob inzwischen ein anderes Teil gewählt wurde
            if (this.selectedPart !== partId) {
                if (geoResult && typeof geoResult.release === 'function') {
                    geoResult.release();
                }
                return;
            }

            if (!geoResult) return;

            this._previewGeoResult = geoResult;

            const obj3D = geoResult.object3D ?? geoResult.scene ?? null;
            if (obj3D) {
                this.scene.add(obj3D);
            }

        } catch (err) {
            if (this.selectedPart === partId) {
                console.warn(
                    `PlacementManager: LDraw-Vorschau für "${partId}" fehlgeschlagen:`,
                    err
                );
            }
        }
    }

    /**
     * Gibt die aktuell gehaltene Vorschau-Geometrie frei und entfernt
     * das Object3D aus der Szene.
     */
    _releasePreviewGeo() {
        if (!this._previewGeoResult) return;

        const obj3D = this._previewGeoResult.object3D
            ?? this._previewGeoResult.scene
            ?? null;

        if (obj3D) {
            this.scene.remove(obj3D);
        }

        if (typeof this._previewGeoResult.release === 'function') {
            try {
                this._previewGeoResult.release();
            } catch (e) {
                console.warn(
                    'PlacementManager: Fehler beim Freigeben der Vorschau-Geometrie',
                    e
                );
            }
        }

        this._previewGeoResult = null;
    }

    // ---------------------------------------------------------
    // Verbindungen erzeugen
    // ---------------------------------------------------------

    createConnections(brick) {
        if (!this.connectionManager || !brick) {
            return;
        }

        const bricks = this.library.getAll();

        for (const other of bricks) {
            if (other.id === brick.id) {
                continue;
            }

            const otherTopY =
                other.group.position.y + other.height;

            const sameHeight =
                Math.abs(
                    brick.group.position.y - otherTopY
                ) < 0.001;

            if (!sameHeight) {
                continue;
            }

            const dx = Math.abs(
                brick.group.position.x -
                other.group.position.x
            );

            const dz = Math.abs(
                brick.group.position.z -
                other.group.position.z
            );

            const overlapsX =
                dx < (brick.width + other.width) / 2;

            const overlapsZ =
                dz < (brick.depth + other.depth) / 2;

            if (overlapsX && overlapsZ) {
                this.connectionManager.createConnection(
                    other.id,
                    brick.id,
                    brick.group.position
                );
            }
        }

        // Phase F: Extended connection detection via ConnectionPointManager
        if (this.connectionPointManager && brick.partId) {
            this._createMechanicalConnections(brick);
        }
    }

    // ---------------------------------------------------------
    // Phase F: Mechanische Verbindungen über ConnectionPointManager
    // ---------------------------------------------------------

    /**
     * Ermittelt alle Verbindungspunkte des platzierten Bauteils,
     * sucht nahe kompatible Gegenpunkte und erstellt bei Treffer
     * eine mechanische Verbindung über den ConnectionManager.
     *
     * Fehler werden abgefangen – eine fehlende Connection darf die
     * Platzierung niemals abbrechen.
     *
     * @param {object} brick  – gerade platziertes Bauteil / PartInstance
     */
    _createMechanicalConnections(brick) {
        try {
            // Verbindungspunkte für diesen Part-Typ holen
            const pointDefs = this.connectionPointManager
                .getPointsForPart(brick.partId);

            if (!pointDefs || pointDefs.length === 0) return;

            const brickWorldPos = brick.group
                ? brick.group.position
                : (brick.position ?? { x: 0, y: 0, z: 0 });

            for (const point of pointDefs) {
                // Weltposition des Verbindungspunkts
                const worldPos = {
                    x: brickWorldPos.x + (point.localPosition?.x ?? 0),
                    y: brickWorldPos.y + (point.localPosition?.y ?? 0),
                    z: brickWorldPos.z + (point.localPosition?.z ?? 0)
                };

                // Nahe Verbindungspunkte anderer Bauteile suchen
                const SNAP_RADIUS = 0.6; // ~0.6 stud pitch for snapping
                const nearby = this.connectionPointManager.findNearbyPoints(
                    worldPos,
                    SNAP_RADIUS,
                    {
                        type:          point.type,
                        excludePartId: brick.id,
                        catalog:       this.library
                    }
                );

                if (!nearby || nearby.length === 0) continue;

                for (const candidate of nearby) {
                    // Eigene Punkte überspringen
                    if (candidate.instanceId === brick.id) continue;

                    // Kompatibilität prüfen
                    const compatible = this.connectionCompatibility
                        ?.check(point, candidate);

                    if (!compatible) continue;

                    // Verbindung erstellen
                    this.connectionManager.createConnection(
                        brick.id,
                        candidate.instanceId,
                        worldPos,
                        point.type
                    );
                }
            }
        } catch (err) {
            // Verbindungsfehler dürfen die Platzierung nicht unterbrechen
            console.warn(
                'PlacementManager: _createMechanicalConnections fehlgeschlagen:',
                err
            );
        }
    }

    // ---------------------------------------------------------
    // Platzierung abbrechen
    // ---------------------------------------------------------

    cancelPlacement() {
        this.selectedPart = null;

        this.previewPosition = null;
        this.previewRotation = 0;
        this.previewValid = false;

        // LDraw-Vorschau-Geometrie freigeben
        this._releasePreviewGeo();

        this.preview?.hide();
    }

    // ---------------------------------------------------------
    // Private: Validierung
    // ---------------------------------------------------------

    /**
     * Gibt true zurück wenn `type` ein bekannter lokaler Part-Typ ist
     * ODER wenn der Katalog einen Eintrag mit ldrawPartNumber hat
     * (und ein geometryProvider verfügbar ist).
     *
     * @param {string} type
     * @returns {boolean}
     */
    _isValidPart(type) {
        if (typeof type !== 'string') return false;

        // Lokale Teile aus PART_DEFINITIONS
        if (Object.prototype.hasOwnProperty.call(PART_DEFINITIONS, type)) {
            return true;
        }

        // Katalog-Teile mit LDraw-Nummer (brauchen geometryProvider)
        if (this._geometryProvider && this._catalog) {
            const entry = this._catalog.getPartById(type);
            if (entry?.ldrawPartNumber) return true;
        }

        // Fallback: Singleton-Katalog versuchen (ohne expliziten catalog-Option)
        if (this._geometryProvider) {
            try {
                const entry = PartCatalog.instance().getPartById(type);
                if (entry?.ldrawPartNumber) return true;
            } catch (_) {
                // PartCatalog.instance() könnte in Tests nicht verfügbar sein
            }
        }

        return false;
    }

    // ---------------------------------------------------------
    // Private: ID-Generator
    // ---------------------------------------------------------

    /**
     * Erzeugt eine eindeutige Bauteil-ID.
     * Nutzt crypto.randomUUID() wenn verfügbar, sonst Math.random()-Fallback.
     *
     * @returns {string}
     */
    _generateBrickId() {
        if (
            typeof globalThis !== 'undefined' &&
            typeof globalThis.crypto?.randomUUID === 'function'
        ) {
            return globalThis.crypto.randomUUID();
        }

        // Fallback für Umgebungen ohne crypto.randomUUID
        return 'brick-' +
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).slice(2, 10);
    }
}