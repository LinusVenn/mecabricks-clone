/**
 * ConnectionPointManager – Verwaltet alle Verbindungspunkte (Phase F.2)
 *
 * Zentrale Registry für Verbindungspunktdefinitionen aller Bauteile.
 *
 * Verantwortlichkeiten:
 *  - Verbindungspunkte pro Bauteiltyp (partId) registrieren
 *  - Verbindungspunkte anhand aktueller Variante auflösen
 *  - Weltkoordinaten transformierter Punkte liefern
 *  - Auto-Generierung für Standard-Bauteile als Fallback
 *  - Singleton-Zugang für modulübergreifende Nutzung
 *
 * Wichtig: Der Manager ist bewusst entkoppelt von der Szenen-Hierarchie
 * (Three.js).  Er arbeitet ausschließlich mit einfachen {x,y,z}-Objekten
 * und nimmt keine Three.js-Abhängigkeit auf.
 */

import { ConnectionPoint } from './ConnectionPoint.js';
import { CONNECTION_TYPES } from './ConnectionTypes.js';
import { BRICK_HEIGHT, PLATE_HEIGHT } from '../utils/Constants.js';

// ---------------------------------------------------------------------------
// Singleton-Verwaltung
// ---------------------------------------------------------------------------

/** @type {ConnectionPointManager|null} */
let _instance = null;

// ---------------------------------------------------------------------------
// Klasse ConnectionPointManager
// ---------------------------------------------------------------------------

export class ConnectionPointManager {
    /**
     * Erstellt eine neue Instanz.
     *
     * @param {{
     *   variantManager?:  object,  // PartVariantManager (optional)
     *   partDefinitions?: object   // PART_DEFINITIONS-Map (optional, für Auto-Generierung)
     * }} options
     */
    constructor(options = {}) {
        /**
         * Haupt-Registry:  partId → ConnectionPoint[]
         * @type {Map<string, ConnectionPoint[]>}
         */
        this._registry = new Map();

        /**
         * Varianten-Override:  `${partId}::${variantId}` → ConnectionPoint[]
         * @type {Map<string, ConnectionPoint[]>}
         */
        this._variantRegistry = new Map();

        /**
         * Optionaler PartVariantManager für variantenabhängige Auflösung.
         * @type {object|null}
         */
        this._variantManager = options.variantManager ?? null;

        /**
         * Optionale Bauteil-Definitionen für die Auto-Generierung.
         * @type {object|null}
         */
        this._partDefinitions = options.partDefinitions ?? null;
    }

    // ── Registrierung ────────────────────────────────────────────────────────

    /**
     * Registriert ein Array von ConnectionPoint-Objekten für einen Bauteiltyp.
     *
     * Vorhandene Einträge für dieselbe `partId` werden überschrieben.
     * Übergib `variantId`, um variantenspezifische Punkte zu registrieren.
     *
     * @param {string}            partId
     * @param {ConnectionPoint[]} connectionPoints
     * @param {string|null}       [variantId]  Optional: Varianten-ID
     *
     * @throws {TypeError} Falls connectionPoints kein Array ist oder
     *                     ein Element kein ConnectionPoint-Objekt.
     */
    registerPoints(partId, connectionPoints, variantId = null) {
        if (!Array.isArray(connectionPoints)) {
            throw new TypeError(
                `ConnectionPointManager.registerPoints: connectionPoints muss ein Array sein (für partId "${partId}").`
            );
        }
        for (const cp of connectionPoints) {
            if (!(cp instanceof ConnectionPoint)) {
                throw new TypeError(
                    `ConnectionPointManager.registerPoints: Alle Elemente müssen ConnectionPoint-Instanzen sein (partId "${partId}").`
                );
            }
        }

        const frozen = Object.freeze([...connectionPoints]);

        if (variantId !== null) {
            this._variantRegistry.set(`${partId}::${variantId}`, frozen);
        } else {
            this._registry.set(partId, frozen);
        }
    }

    /**
     * Registriert Verbindungspunkte aus einem Array einfacher Datenobjekte
     * (plain objects – wie sie in ConnectionPointDefinitions.js stehen).
     *
     * Bequeme Alternative zu {@link registerPoints}, die keine vorab
     * erstellten ConnectionPoint-Instanzen erfordert.
     *
     * @param {string}   partId
     * @param {object[]} rawDefs  Array von Objekt-Definitionen
     * @param {string|null} [variantId]
     */
    registerPointsFromData(partId, rawDefs, variantId = null) {
        const points = rawDefs.map(def => ConnectionPoint.fromData(def));
        this.registerPoints(partId, points, variantId);
    }

    // ── Abfragen ─────────────────────────────────────────────────────────────

    /**
     * Gibt alle Verbindungspunkte für einen Bauteiltyp zurück.
     *
     * Varianten-Auflösung:
     *  1. Falls `variantId` übergeben und variantenspezifische Punkte
     *     vorhanden → diese werden zurückgegeben.
     *  2. Andernfalls: Basis-Registry.
     *  3. Fallback: Auto-Generierung aus Bauteil-Definitionen.
     *
     * @param {string}      partId
     * @param {string|null} [variantId]
     * @returns {ConnectionPoint[]}
     */
    getPointsForPart(partId, variantId = null) {
        // 1. Varianten-spezifisch
        if (variantId !== null) {
            const key = `${partId}::${variantId}`;
            if (this._variantRegistry.has(key)) {
                return this._variantRegistry.get(key);
            }
        }

        // 2. Basis-Registry
        if (this._registry.has(partId)) {
            return this._registry.get(partId);
        }

        // 3. Auto-Generierung als Fallback
        if (this._partDefinitions && this._partDefinitions[partId]) {
            const generated = this.autoGenerateForPart(partId, this._partDefinitions[partId]);
            if (generated.length > 0) {
                // Einmalig cachen, damit nicht jedes Mal neu generiert wird
                this._registry.set(partId, Object.freeze(generated));
                return this._registry.get(partId);
            }
        }

        return [];
    }

    /**
     * Gibt einen einzelnen Verbindungspunkt anhand seiner ID zurück.
     *
     * @param {string} partId
     * @param {string} pointId
     * @returns {ConnectionPoint|null}
     */
    getPointById(partId, pointId) {
        const points = this.getPointsForPart(partId);
        return points.find(p => p.id === pointId) ?? null;
    }

    /**
     * Gibt zurück, ob für ein Bauteil Verbindungspunkte registriert sind.
     *
     * Berücksichtigt auch Auto-Generierung: Falls ein partDefinitions-Eintrag
     * vorhanden ist, der Punkte generieren würde, gibt diese Methode ebenfalls
     * `true` zurück.
     *
     * @param {string} partId
     * @returns {boolean}
     */
    hasPoints(partId) {
        if (this._registry.has(partId)) return true;
        if (!this._partDefinitions) return false;
        const def = this._partDefinitions[partId];
        if (!def) return false;
        // Grobe Vorab-Prüfung: hat das Bauteil überhaupt generierbare Punkte?
        return (def.studs === true) || def.geometry === 'technic';
    }

    // ── Weltkoordinaten ───────────────────────────────────────────────────────

    /**
     * Gibt alle Verbindungspunkte eines Bauteils zusammen mit ihren
     * berechneten Weltpositionen zurück.
     *
     * @param {string} partId
     * @param {{
     *   position: {x:number,y:number,z:number},
     *   rotation?: {x:number,y:number,z:number}
     * }} partTransform  Aktueller Transform der Bauteilinstanz
     * @param {string|null} [variantId]
     *
     * @returns {Array<{point: ConnectionPoint, worldPos: {x:number,y:number,z:number}}>}
     */
    getWorldPoints(partId, partTransform, variantId = null) {
        const points = this.getPointsForPart(partId, variantId);
        return points.map(point => ({
            point,
            worldPos: point.worldPosition(partTransform),
        }));
    }

    /**
     * Sucht alle Verbindungspunkte in der Nähe einer Weltposition.
     *
     * Durchsucht alle platzierten Instanzen im übergebenen `catalog` und
     * gibt diejenigen Punkte zurück, deren Weltposition innerhalb von
     * `radius` liegt.
     *
     * @param {{x:number,y:number,z:number}} worldPos   Suchweltposition
     * @param {number}                       radius     Suchradius in Einheiten
     * @param {{
     *   type?:           string|null,    // Nur Punkte dieses Typs
     *   excludePartId?:  string|null,    // Instanz-ID ausschließen
     *   catalog?:        object|null     // Live-Catalog der platzierten Instanzen
     * }} [options]
     *
     * @returns {Array<{
     *   point:      ConnectionPoint,
     *   worldPos:   {x:number,y:number,z:number},
     *   partId:     string,
     *   instanceId: string
     * }>}
     */
    findNearbyPoints(worldPos, radius, options = {}) {
        const {
            type:          filterType  = null,
            excludePartId: excludeId   = null,
            catalog:       catalog     = null,
        } = options;

        if (!catalog) return [];

        const results = [];
        const r2 = radius * radius;

        // Iteriere über alle platzierten Instanzen
        const instances = typeof catalog.getAll === 'function'
            ? catalog.getAll()
            : (Array.isArray(catalog) ? catalog : Object.values(catalog));

        for (const instance of instances) {
            const instanceId = instance.id ?? instance.instanceId;
            if (excludeId !== null && instanceId === excludeId) continue;

            const partId    = instance.partId ?? instance.type;
            const transform = instance.transform ?? {
                position: instance.position ?? { x: 0, y: 0, z: 0 },
                rotation: instance.rotation ?? { x: 0, y: 0, z: 0 },
            };

            const worldPoints = this.getWorldPoints(partId, transform);

            for (const { point, worldPos: wp } of worldPoints) {
                // Typ-Filter
                if (filterType !== null && point.type !== filterType) continue;

                // Abstandstest (quadratisch, spart sqrt)
                const dx = wp.x - worldPos.x;
                const dy = wp.y - worldPos.y;
                const dz = wp.z - worldPos.z;
                if (dx * dx + dy * dy + dz * dz <= r2) {
                    results.push({ point, worldPos: wp, partId, instanceId });
                }
            }
        }

        return results;
    }

    // ── Auto-Generierung ──────────────────────────────────────────────────────

    /**
     * Generiert grundlegende Stud/Anti-Stud/Technic-Punkte automatisch
     * aus den Bauteil-Dimensionen.
     *
     * Wird als Fallback verwendet, wenn keine expliziten Definitionen
     * registriert wurden.
     *
     * Regeln:
     *  - Geometry 'brick'|'plate' mit `studs: true` → Studs oben + Anti-Studs unten
     *  - Geometry 'tile'                             → nur Anti-Studs unten
     *  - Geometry 'slope'                            → nur Anti-Studs unten
     *  - Geometry 'slope_inverted'                   → nur Studs oben
     *  - Geometry 'technic'|'technic_angular'        → Technic-Löcher
     *  - Alles andere                                → leere Liste
     *
     * @param {string} partId
     * @param {{
     *   width:    number,
     *   depth:    number,
     *   height:   number,
     *   geometry: string,
     *   studs?:   boolean
     * }} partDef
     *
     * @returns {ConnectionPoint[]}
     */
    autoGenerateForPart(partId, partDef) {
        const { width, depth, height, geometry, studs } = partDef;
        const points = [];

        switch (geometry) {
            case 'brick':
            case 'brick_corner':
            case 'brick_round':
            case 'brick_grille':
            case 'plate':
            case 'plate_rail': {
                if (studs) {
                    // Studs oben
                    for (let i = 0; i < width; i++) {
                        for (let j = 0; j < depth; j++) {
                            const x = -width / 2 + 0.5 + i;
                            const z = -depth / 2 + 0.5 + j;
                            points.push(new ConnectionPoint({
                                id:            `${partId}_stud_${i}_${j}`,
                                partId,
                                type:          CONNECTION_TYPES.STUD,
                                localPosition: { x, y: height, z },
                                direction:     { x: 0, y: 1, z: 0 },
                            }));
                        }
                    }
                    // Anti-Studs unten (nur wenn width*depth > 1 – 1x1 hat keine Röhre)
                    if (width * depth > 1) {
                        for (let i = 0; i < width; i++) {
                            for (let j = 0; j < depth; j++) {
                                const x = -width / 2 + 0.5 + i;
                                const z = -depth / 2 + 0.5 + j;
                                points.push(new ConnectionPoint({
                                    id:            `${partId}_antistud_${i}_${j}`,
                                    partId,
                                    type:          CONNECTION_TYPES.ANTI_STUD,
                                    localPosition: { x, y: 0, z },
                                    direction:     { x: 0, y: -1, z: 0 },
                                }));
                            }
                        }
                    }
                }
                break;
            }

            case 'tile':
            case 'tile_round': {
                // Nur Anti-Studs unten (glatte Oberfläche, keine Studs oben)
                for (let i = 0; i < width; i++) {
                    for (let j = 0; j < depth; j++) {
                        const x = -width / 2 + 0.5 + i;
                        const z = -depth / 2 + 0.5 + j;
                        points.push(new ConnectionPoint({
                            id:            `${partId}_antistud_${i}_${j}`,
                            partId,
                            type:          CONNECTION_TYPES.ANTI_STUD,
                            localPosition: { x, y: 0, z },
                            direction:     { x: 0, y: -1, z: 0 },
                        }));
                    }
                }
                break;
            }

            case 'slope':
            case 'slope_corner': {
                // Nur Anti-Studs unten
                for (let i = 0; i < width; i++) {
                    for (let j = 0; j < depth; j++) {
                        const x = -width / 2 + 0.5 + i;
                        const z = -depth / 2 + 0.5 + j;
                        points.push(new ConnectionPoint({
                            id:            `${partId}_antistud_${i}_${j}`,
                            partId,
                            type:          CONNECTION_TYPES.ANTI_STUD,
                            localPosition: { x, y: 0, z },
                            direction:     { x: 0, y: -1, z: 0 },
                        }));
                    }
                }
                break;
            }

            case 'slope_inverted': {
                // Studs oben (inverted slopes haben Noppen)
                for (let i = 0; i < width; i++) {
                    for (let j = 0; j < depth; j++) {
                        const x = -width / 2 + 0.5 + i;
                        const z = -depth / 2 + 0.5 + j;
                        points.push(new ConnectionPoint({
                            id:            `${partId}_stud_${i}_${j}`,
                            partId,
                            type:          CONNECTION_TYPES.STUD,
                            localPosition: { x, y: height, z },
                            direction:     { x: 0, y: 1, z: 0 },
                        }));
                    }
                }
                break;
            }

            case 'technic':
            case 'technic_angular': {
                // Technic-Löcher entlang der X-Achse, auf halber Höhe, z = 0
                const cy = height / 2;
                for (let i = 0; i < width; i++) {
                    const x = -width / 2 + 0.5 + i;
                    points.push(new ConnectionPoint({
                        id:            `${partId}_technic_hole_${i}`,
                        partId,
                        type:          CONNECTION_TYPES.TECHNIC_HOLE,
                        localPosition: { x, y: cy, z: 0 },
                        direction:     { x: 0, y: 0, z: 1 },
                    }));
                }
                break;
            }

            // Fenster, Türen und unbekannte Geometrien → keine Auto-Generierung
            default:
                break;
        }

        return points;
    }

    // ── Bulk-Laden ────────────────────────────────────────────────────────────

    /**
     * Lädt alle eingebauten Verbindungspunktdefinitionen aus einem
     * Definitions-Objekt (wie es `ConnectionPointDefinitions.js` exportiert).
     *
     * Wird einmalig beim Start aufgerufen.
     *
     * @param {Record<string, object[]>} definitionsMap
     *   `{ partId: rawDef[] }` – rohe Datenobjekte (keine ConnectionPoint-Instanzen)
     */
    loadBuiltinDefinitions(definitionsMap) {
        if (!definitionsMap || typeof definitionsMap !== 'object') {
            throw new TypeError(
                'ConnectionPointManager.loadBuiltinDefinitions: definitionsMap muss ein Objekt sein.'
            );
        }

        let count = 0;
        for (const [partId, rawDefs] of Object.entries(definitionsMap)) {
            if (!Array.isArray(rawDefs) || rawDefs.length === 0) continue;
            this.registerPointsFromData(partId, rawDefs);
            count += rawDefs.length;
        }

        return count; // Gibt Gesamtanzahl geladener Punkte zurück (nützlich für Logs)
    }

    // ── Statistik ────────────────────────────────────────────────────────────

    /**
     * Gibt Statistiken über den aktuellen Zustand der Registry zurück.
     *
     * @returns {{ defined: number, total: number }}
     *   `defined` = Anzahl Bauteiltypen mit Einträgen
     *   `total`   = Gesamtanzahl registrierter ConnectionPoint-Objekte
     */
    getStats() {
        let total = 0;
        for (const points of this._registry.values()) {
            total += points.length;
        }
        for (const points of this._variantRegistry.values()) {
            total += points.length;
        }
        return {
            defined: this._registry.size + this._variantRegistry.size,
            total,
        };
    }

    // ── Singleton-Verwaltung ──────────────────────────────────────────────────

    /**
     * Gibt die globale Singleton-Instanz zurück.
     * Erstellt sie beim ersten Aufruf.
     *
     * @param {object} [options]  Wird nur beim ersten Aufruf berücksichtigt.
     * @returns {ConnectionPointManager}
     */
    static instance(options = {}) {
        if (!_instance) {
            _instance = new ConnectionPointManager(options);
        }
        return _instance;
    }

    /**
     * Setzt die Singleton-Instanz zurück (primär für Unit-Tests).
     */
    static resetInstance() {
        _instance = null;
    }
}
