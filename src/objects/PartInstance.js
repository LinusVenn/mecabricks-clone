import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion: Eindeutige Instanz-ID erzeugen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Erzeugt eine eindeutige ID für eine neue PartInstance.
 * Bevorzugt die native `crypto.randomUUID()`-API (Web-Standard, Node ≥ 14.17).
 * Fällt bei Nicht-Verfügbarkeit auf einen Zeitstempel-/Zufallswert zurück.
 *
 * @returns {string}  UUID-Zeichenkette oder Fallback-String
 */
function generateInstanceId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback: Millisekunden-Zeitstempel + 9-stellige Zufallszeichenkette (Base-36)
    return `instance-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}


// ─────────────────────────────────────────────────────────────────────────────
// PartInstance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PartInstance – einheitliche Bauteil-Instanz für den Editor.
 *
 * Kapselt entweder ein lokales (Brick) oder ein externes (LDraw)
 * Bauteil und stellt dieselbe Schnittstelle wie `Brick.js` bereit,
 * sodass SelectionManager, GroupManager, ConnectionManager und
 * ProjectSerializer nicht zwischen Bauteiltypen unterscheiden müssen.
 *
 * Lebenszyklus:
 *   1. Erstellen  → `new PartInstance({ ... })` (oder via PartLibrary.addInstance)
 *   2. Nutzen     → Transformationen, Farbänderungen, Serialisierung
 *   3. Freigeben  → `dispose()` (Szene-Entnahme + Geometrie-Rückgabe)
 *
 * @example
 *   const inst = new PartInstance({
 *     scene,
 *     partId:     '3001',
 *     source:     'ldraw',
 *     object3D:   ldrawObject,
 *     color:      0xff0000,
 *     dimensions: { width: 2, depth: 4, height: 1 },
 *     ldrawPartNumber: '3001.dat',
 *     releaseGeometry: () => ldrawManager.release('3001.dat'),
 *   });
 */
export class PartInstance {

    /**
     * Erstellt eine neue PartInstance.
     *
     * @param {object}             options
     * @param {THREE.Scene|null}   options.scene             – Szene, in die das Bauteil eingefügt wird (null = kein Auto-Add)
     * @param {string|null}        [options.id]              – Vorab-ID; wird per `generateInstanceId()` erzeugt, wenn nicht angegeben
     * @param {string}             options.partId            – Katalog-ID des Bauteils (z. B. '3001', 'brick_2x4')
     * @param {'local'|'ldraw'}    options.source            – Herkunft des Bauteils
     * @param {THREE.Object3D}     options.object3D          – Das eigentliche 3D-Objekt (Mesh, Group, …)
     * @param {number}             options.color             – Hex-Farbwert (z. B. 0xff0000)
     * @param {{width: number, depth: number, height: number}} options.dimensions – Abmessungen in Noppen bzw. Welt-Einheiten
     * @param {string|null}        [options.ldrawPartNumber] – LDraw-Dateiname (z. B. '3001.dat'); nur bei source='ldraw'
     * @param {Function|null}      [options.releaseGeometry] – Callback, der beim Dispose die gecachte Geometrie im LDrawManager freigibt
     */
    constructor({
        scene,
        id                 = null,
        partId,
        source,
        object3D,
        color,
        dimensions,
        ldrawPartNumber    = null,
        releaseGeometry    = null,
        colorId            = null,   // number | null  — LDraw-Farb-ID (optional, für neue Bauteile)
        variantId          = null    // string | null  — Varianten-ID (optional)
    }) {
        // ── Pflichtparameter prüfen ────────────────────────────────────────
        if (!partId)    throw new Error('PartInstance: partId ist erforderlich.');
        if (!source)    throw new Error('PartInstance: source ist erforderlich.');
        if (!object3D)  throw new Error('PartInstance: object3D ist erforderlich.');
        if (color === undefined || color === null) {
            throw new Error('PartInstance: color ist erforderlich.');
        }
        if (!dimensions || typeof dimensions.width  !== 'number'
                        || typeof dimensions.depth  !== 'number'
                        || typeof dimensions.height !== 'number') {
            throw new Error('PartInstance: dimensions muss { width, depth, height } als Zahlen enthalten.');
        }

        // ── Interne Felder ─────────────────────────────────────────────────
        this._id              = id ?? generateInstanceId();
        this._partId          = partId;
        this._source          = source;
        this._color           = color;
        this._dimensions      = { ...dimensions };    // flache Kopie, kein externer Zugriff
        this._ldrawPartNumber = ldrawPartNumber;
        this._releaseGeometry = releaseGeometry;
        this._disposed        = false;
        this._colorId         = typeof colorId === 'number' ? colorId : null;
        this._variantId       = variantId || null;


        // ── Three.js-Gruppe aufbauen ───────────────────────────────────────
        // Wird object3D bereits als THREE.Group übergeben, wird es direkt
        // verwendet (typisch für LDraw-Ergebnisse mit Unter-Meshes).
        // Andernfalls wird eine neue Gruppe angelegt, die object3D kapselt.
        if (object3D instanceof THREE.Group) {
            this.group = object3D;
        } else {
            this.group = new THREE.Group();
            this.group.add(object3D);
        }

        // userData ermöglicht Raycasting-Identifikation (identisch zu Brick.js).
        // `brickId` bleibt aus Abwärtskompatibilität erhalten, auch wenn es sich
        // technisch um eine PartInstance handelt.
        this.group.userData = {
            brickId: this._id,
            type:    this._partId,
            color:   this._color,
            source:  this._source
        };


        // ── In Szene einhängen ─────────────────────────────────────────────
        if (scene) {
            scene.add(this.group);
        }
    }


    // =========================================================================
    // Brick-kompatible Getter (readonly)
    // =========================================================================

    /** Eindeutige Instanz-ID (read-only). */
    get id()     { return this._id; }

    /**
     * Katalog-ID des Bauteils.
     * Alias für `partId`; bleibt aus Abwärtskompatibilität mit Brick.js erhalten
     * (dort heißt das Feld `type`).
     */
    get type()   { return this._partId; }

    /** Katalog-ID des Bauteils. */
    get partId() { return this._partId; }

    /** Hex-Farbwert des Bauteils (z. B. 0xff0000). */
    get color()  { return this._color; }

    /** Herkunft: 'local' (eigene Geometrie) oder 'ldraw' (externes LDraw-Modell). */
    get source() { return this._source; }

    /** Breite des Bauteils in Noppen. */
    get width()    { return this._dimensions.width;  }

    /** Tiefe des Bauteils in Noppen. */
    get depth()    { return this._dimensions.depth;  }

    /** Höhe des Bauteils in Welt-Einheiten. */
    get height()   { return this._dimensions.height; }

    /**
     * Geometrie-Typ – für PartInstance identisch mit `source`.
     * Brick.js gibt hier 'box' oder 'cylinder' zurück; PartInstance
     * verwendet stattdessen die Herkunftskennung.
     */
    get geometry() { return this._source; }

    /**
     * Noppen-Flag.
     * Brick.js gibt `true` zurück, wenn das Bauteil Noppen hat.
     * PartInstance hat keine explizite Noppen-Geometrie → `false`.
     */
    get studs()    { return false; }

    /** LDraw-Teilenummer (z. B. '3001.dat'), nur bei source='ldraw'; sonst null. */
    get ldrawPartNumber() { return this._ldrawPartNumber; }

    /**
     * LDraw-Farb-ID (number | null).
     * Optional; wird nur gesetzt, wenn das Bauteil einer LDraw-Farbpalette
     * zugeordnet ist (Phase E.3).
     */
    get colorId() { return this._colorId; }

    /**
     * Varianten-Kennung (string | null).
     * Optional; identifiziert eine Bauteil-Variante innerhalb desselben partId
     * (Phase E.5).
     */
    get variantId() { return this._variantId; }

    /**
     * Setzt die LDraw-Farb-ID.
     * Löst kein Ereignis aus; aktualisiert nur den internen Wert.
     *
     * @param {number|null} colorId  – Nicht-negative ganze Zahl oder null
     */
    setColorId(colorId) {
        this._colorId = typeof colorId === 'number' ? colorId : null;
    }


    // =========================================================================
    // Transformationen
    // =========================================================================

    /**
     * Setzt Position und Euler-Rotation der Gruppe auf einmal.
     * Aktualisiert danach die WorldMatrix aller Kindknoten.
     *
     * @param {{ x: number, y: number, z: number }} position  – Weltposition
     * @param {{ x: number, y: number, z: number }} rotation  – Euler-Winkel in Bogenmaß (XYZ-Reihenfolge)
     */
    setTransform(position, rotation) {
        this.group.position.set(
            Number(position.x),
            Number(position.y),
            Number(position.z)
        );
        this.group.rotation.set(
            Number(rotation.x),
            Number(rotation.y),
            Number(rotation.z)
        );
        // WorldMatrix manuell aktualisieren, damit Raycasting und
        // abhängige Berechnungen sofort korrekte Werte erhalten.
        this.group.updateMatrixWorld(true);
    }


    // =========================================================================
    // Farbverwaltung
    // =========================================================================

    /**
     * Ändert die Farbe aller Meshes innerhalb der Gruppe.
     * Legt keine neuen Materialien an – mutiert nur `material.color`.
     *
     * @param {number} color  – Neuer Hex-Farbwert (z. B. 0x00ff00)
     */
    setColor(color) {
        if (!Number.isFinite(color)) return;   // ungültige Werte still ignorieren

        this._color = color;
        this.group.userData.color = color;     // userData synchron halten
        this._applyColor(color);
    }

    /**
     * Wendet einen Hex-Farbwert direkt auf alle Mesh-Materialien an.
     * Unterstützt sowohl einzelne Materialien als auch Material-Arrays
     * (multi-material Meshes).
     *
     * @private
     * @param {number} color  – Hex-Farbwert
     */
    _applyColor(color) {
        const threeColor = new THREE.Color(color);

        this.group.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            if (!child.material) return;

            // Material kann ein einzelnes Objekt oder ein Array sein.
            const mats = Array.isArray(child.material)
                ? child.material
                : [child.material];

            for (const mat of mats) {
                if (mat.color) {
                    mat.color.copy(threeColor);
                }
            }
        });
    }


    // =========================================================================
    // Serialisierung
    // =========================================================================

    /**
     * Gibt eine serialisierbare (JSON-fähige) Darstellung der Instanz zurück.
     *
     * Das Format ist abwärtskompatibel zu `Brick.toData()`:
     * ```json
     * {
     *   "id":       "...",
     *   "type":     "3001",
     *   "color":    16711680,
     *   "position": { "x": 0, "y": 0, "z": 0 },
     *   "rotation": { "x": 0, "y": 0, "z": 0 },
     *   "source":   "ldraw"
     * }
     * ```
     * Für LDraw-Bauteile wird zusätzlich `ldrawPartNumber` hinzugefügt.
     *
     * @returns {object}  Flaches Datenobjekt ohne Zirkelbezüge
     */
    toData() {
        const pos = this.group.position;
        const rot = this.group.rotation;

        const data = {
            id:       this._id,
            type:     this._partId,   // 'type' statt 'partId' für Brick-Kompatibilität
            color:    this._color,
            position: { x: pos.x, y: pos.y, z: pos.z },
            rotation: { x: rot.x, y: rot.y, z: rot.z },
            source:   this._source,
            colorId:  this._colorId   // null ist erlaubt (Phase E.3)
        };

        // ldrawPartNumber nur einbeziehen, wenn vorhanden
        if (this._ldrawPartNumber) {
            data.ldrawPartNumber = this._ldrawPartNumber;
        }

        // variantId nur einbeziehen, wenn gesetzt (Phase E.5)
        if (this._variantId !== null) {
            data.variantId = this._variantId;
        }

        return data;
    }


    // =========================================================================
    // Ressourcenfreigabe
    // =========================================================================

    /**
     * Entfernt das Bauteil aus der Szene und gibt alle gehaltenen Ressourcen frei.
     *
     * Reihenfolge:
     *   1. Gruppe aus Elternobjekt (Szene / andere Group) entfernen
     *   2. Geometrie-Callback aufrufen (LDrawManager-Referenzzähler verringern)
     *
     * Diese Methode ist **idempotent** – mehrfache Aufrufe sind sicher und
     * verursachen keine Fehler oder doppelte Freigaben.
     */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;

        // Aus der Szene (oder dem übergeordneten Knoten) entfernen
        this.group.removeFromParent();

        // Gecachte LDraw-Geometrie im Manager freigeben
        if (typeof this._releaseGeometry === 'function') {
            this._releaseGeometry();
            this._releaseGeometry = null;   // GC erlauben
        }
    }
}
