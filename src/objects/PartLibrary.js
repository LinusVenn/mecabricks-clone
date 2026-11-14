
import { Brick }        from './Brick.js';
import { PartInstance } from './PartInstance.js';

// ─────────────────────────────────────────────────────────────────────────────
// PartLibrary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PartLibrary – zentrale Verwaltung aller aktiven Bauteile in einer Szene.
 *
 * Verwaltet zwei getrennte Sammlungen:
 *   • `parts`       – Array von `Brick`-Instanzen (lokale Bauteile, Bestandscode)
 *   • `_instances`  – Map von `PartInstance`-Instanzen (externe/LDraw-Bauteile)
 *
 * Alle öffentlichen Methoden sind abwärtskompatibel zur ursprünglichen
 * Implementierung, sodass bestehende Aufrufer (SelectionManager, UndoManager,
 * ProjectSerializer usw.) ohne Änderungen weiterarbeiten.
 *
 * Neue Methoden für PartInstance:
 *   • {@link addInstance}
 *   • {@link addInstanceFromData}
 *
 * Übergreifende Methoden (funktionieren für beide Typen):
 *   • {@link getById}, {@link hasId}
 *   • {@link getAll}, {@link getAllData}
 *   • {@link getCount}
 *   • {@link removeBrick}  (akzeptiert Brick UND PartInstance)
 *   • {@link clear}
 */
export class PartLibrary {

    /**
     * @param {THREE.Scene} scene  – Die Three.js-Szene, in der Bauteile leben
     */
    constructor(scene) {
        /** Three.js-Szene; wird beim Anlegen neuer Bauteile weitergegeben. */
        this.scene = scene;

        /**
         * Liste aller aktiven Brick-Instanzen (lokale Bauteile).
         * Bleibt aus Abwärtskompatibilität ein Array.
         *
         * @type {Brick[]}
         */
        this.parts = [];

        /**
         * Map aller aktiven PartInstance-Instanzen (externe/LDraw-Bauteile).
         * Schlüssel: instance.id (string), Wert: PartInstance
         *
         * @type {Map<string, PartInstance>}
         */
        this._instances = new Map();
    }


    // =========================================================================
    // Brick-API (Bestandscode – unveränderte Signaturen)
    // =========================================================================

    /**
     * Erstellt einen neuen Brick und fügt ihn der Szene hinzu.
     *
     * @param {number} x       – X-Position in der Welt
     * @param {number} y       – Y-Position in der Welt
     * @param {number} z       – Z-Position in der Welt
     * @param {number} color   – Hex-Farbwert (z. B. 0xff0000)
     * @param {string} [type='brick_2x4']  – Bauteil-Typ-Kennung
     * @returns {Brick}
     */
    addBrick(
        x,
        y,
        z,
        color,
        type = 'brick_2x4'
    ) {
        const brick = new Brick(
            this.scene,
            x,
            y,
            z,
            color,
            type
        );

        this.parts.push(brick);

        return brick;
    }

    /**
     * Stellt einen Brick aus gespeicherten Daten wieder her (z. B. beim Laden).
     * Wirft bei ungültigen oder doppelten Daten einen Fehler.
     *
     * @param {{ id: string, type: string, color: number,
     *            position: {x,y,z}, rotation: {x,y,z} }} data
     * @returns {Brick}
     * @throws {Error}  bei fehlenden Pflichtfeldern oder doppelter ID
     */
    addBrickFromData(data) {
        if (!data || !data.id || !data.type) {
            throw new Error('Ungültige Steindaten.');
        }

        if (this.hasId(data.id)) {
            throw new Error(
                `Die Stein-ID ${data.id} existiert bereits.`
            );
        }

        if (!data.position || !data.rotation) {
            throw new Error(
                'Position oder Rotation fehlt.'
            );
        }

        const brick = new Brick(
            this.scene,
            data.position.x,
            data.position.y,
            data.position.z,
            data.color,
            data.type,
            data.id
        );

        brick.setTransform(
            data.position,
            data.rotation
        );

        this.parts.push(brick);

        return brick;
    }


    // =========================================================================
    // PartInstance-API (neu)
    // =========================================================================

    /**
     * Erstellt eine neue PartInstance und registriert sie in `_instances`.
     * Diese Methode ist synchron – das object3D muss bereits geladen vorliegen.
     *
     * @param {object}          options               – Alle Parameter für den PartInstance-Konstruktor
     * @param {string}          options.partId
     * @param {'local'|'ldraw'} options.source
     * @param {THREE.Object3D}  options.object3D      – Fertig geladenes 3D-Objekt
     * @param {number}          options.color
     * @param {{width,depth,height}} options.dimensions
     * @param {string|null}     [options.id]
     * @param {string|null}     [options.ldrawPartNumber]
     * @param {Function|null}   [options.releaseGeometry]
     * @returns {PartInstance}
     * @throws {Error}  wenn die resultierende ID bereits belegt ist
     */
    addInstance(options) {
        // Szene automatisch injizieren, damit Aufrufer sie nicht selbst übergeben müssen
        const instance = new PartInstance({
            scene: this.scene,
            ...options
        });

        if (this._instances.has(instance.id)) {
            // Sofort aufräumen, dann Fehler werfen
            instance.dispose();
            throw new Error(
                `Die Instanz-ID ${instance.id} existiert bereits.`
            );
        }

        this._instances.set(instance.id, instance);

        return instance;
    }

    /**
     * Stellt eine PartInstance aus serialisierten Daten wieder her.
     * Ruft `geometryProvider` auf, um das Three.js-Objekt asynchron zu laden.
     *
     * @param {object} data                       – Serialisierte Instanzdaten (Format von `PartInstance.toData()`)
     * @param {string} data.id
     * @param {string} data.type                  – partId
     * @param {number} data.color
     * @param {{x,y,z}} data.position
     * @param {{x,y,z}} data.rotation
     * @param {'local'|'ldraw'} data.source
     * @param {string} [data.ldrawPartNumber]
     * @param {Function} geometryProvider         – Async-Funktion `(data) => { object3D, dimensions, releaseGeometry? }`
     * @returns {Promise<PartInstance>}
     * @throws {Error}  bei fehlenden Pflichtfeldern, doppelter ID oder Ladefehlern
     */
    async addInstanceFromData(data, geometryProvider) {
        // ── Pflichtfelder validieren ───────────────────────────────────────
        if (!data || !data.id || !data.type) {
            throw new Error(
                'addInstanceFromData: Ungültige Instanzdaten (id oder type fehlt).'
            );
        }

        if (this.hasId(data.id)) {
            throw new Error(
                `addInstanceFromData: Die Instanz-ID ${data.id} existiert bereits.`
            );
        }

        if (!data.position || !data.rotation) {
            throw new Error(
                'addInstanceFromData: Position oder Rotation fehlt.'
            );
        }

        if (typeof geometryProvider !== 'function') {
            throw new Error(
                'addInstanceFromData: geometryProvider muss eine Funktion sein.'
            );
        }

        // ── Geometrie asynchron laden ──────────────────────────────────────
        // geometryProvider erhält die rohen Daten und liefert:
        //   { object3D: THREE.Object3D, dimensions: {...}, releaseGeometry?: () => void }
        const { object3D, dimensions, releaseGeometry = null } =
            await geometryProvider(data);

        // ── Instanz anlegen ────────────────────────────────────────────────
        const instance = new PartInstance({
            scene:           this.scene,
            id:              data.id,
            partId:          data.type,          // 'type' im gespeicherten Format = partId
            source:          data.source ?? 'ldraw',
            object3D,
            color:           data.color,
            dimensions,
            ldrawPartNumber: data.ldrawPartNumber ?? null,
            releaseGeometry
        });

        // Transform aus den gespeicherten Daten wiederherstellen
        instance.setTransform(data.position, data.rotation);

        this._instances.set(instance.id, instance);

        return instance;
    }


    // =========================================================================
    // Gemeinsame Lesemethoden (erweitert für beide Typen)
    // =========================================================================

    /**
     * Sucht ein Bauteil anhand seiner ID.
     * Prüft zuerst `parts` (Bricks), dann `_instances` (PartInstances).
     *
     * @param {string} id
     * @returns {Brick|PartInstance|null}
     */
    getById(id) {
        // Brick-Array zuerst prüfen (O(n), historisches Verhalten)
        const brick = this.parts.find(b => b.id === id);
        if (brick) return brick;

        // PartInstance-Map prüfen (O(1))
        return this._instances.get(id) ?? null;
    }

    /**
     * Prüft, ob eine ID bereits in der Bibliothek registriert ist.
     * Berücksichtigt sowohl Bricks als auch PartInstances.
     *
     * @param {string} id
     * @returns {boolean}
     */
    hasId(id) {
        return this.parts.some(b => b.id === id)
            || this._instances.has(id);
    }

    /**
     * Gibt alle aktiven Bauteile zurück – Bricks und PartInstances zusammen.
     * Die Reihenfolge ist: erst alle Bricks (Einfügereihenfolge),
     * dann alle PartInstances (Einfügereihenfolge der Map).
     *
     * @returns {Array<Brick|PartInstance>}
     */
    getAll() {
        return [...this.parts, ...this._instances.values()];
    }

    /**
     * Gibt alle Bauteile als serialisierbare Datenobjekte zurück.
     * Das Format jedes Eintrags entspricht `Brick.toData()` / `PartInstance.toData()`.
     *
     * @returns {object[]}
     */
    getAllData() {
        const brickData    = this.parts.map(b => b.toData());
        const instanceData = [...this._instances.values()].map(i => i.toData());
        return [...brickData, ...instanceData];
    }

    /**
     * Gibt die Gesamtanzahl aller verwalteten Bauteile zurück.
     * Beinhaltet Bricks UND PartInstances.
     *
     * @returns {number}
     */
    getCount() {
        return this.parts.length + this._instances.size;
    }


    // =========================================================================
    // Entfernen / Aufräumen
    // =========================================================================

    /**
     * Entfernt ein Bauteil aus der Bibliothek und ruft `dispose()` darauf auf.
     * Akzeptiert sowohl `Brick`- als auch `PartInstance`-Objekte.
     *
     * @param {Brick|PartInstance} brick  – Das zu entfernende Bauteil
     * @returns {boolean}  `true` wenn das Bauteil gefunden und entfernt wurde
     */
    removeBrick(brick) {
        // ── Brick-Pfad ─────────────────────────────────────────────────────
        const index = this.parts.indexOf(brick);

        if (index !== -1) {
            brick.dispose();
            this.parts.splice(index, 1);
            return true;
        }

        // ── PartInstance-Pfad ──────────────────────────────────────────────
        // Suche über id, falls das Objekt in _instances registriert ist
        if (brick instanceof PartInstance && this._instances.has(brick.id)) {
            brick.dispose();
            this._instances.delete(brick.id);
            return true;
        }

        // Kein Treffer in beiden Sammlungen
        return false;
    }

    /**
     * Entfernt ALLE Bauteile aus der Bibliothek und gibt ihre Ressourcen frei.
     * Danach sind `parts` leer und `_instances` leer.
     */
    clear() {
        // Alle Bricks freigeben
        for (const brick of this.parts) {
            brick.dispose();
        }
        this.parts = [];

        // Alle PartInstances freigeben
        for (const instance of this._instances.values()) {
            instance.dispose();
        }
        this._instances.clear();
    }
}
