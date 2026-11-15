
import { LDrawLoaderFactory } from './LDrawLoaderFactory.js';
import { LDrawPathResolver } from './LDrawPathResolver.js';
import { LDrawMaterialManager } from './LDrawMaterialManager.js';

const LDU_PER_STUD = 20;
const DEFAULT_PARTS = ['3001', '3020', '3069'];

/**
 * Lädt LDraw-Bauteile bei Bedarf und verwaltet deren Ressourcen.
 *
 * Eigenschaften:
 * - Lazy Loading
 * - Gemeinsame Initialisierung bei parallelen Aufrufen
 * - Caching der geladenen Quellmodelle
 * - Eigene Object3D-Instanz bei jedem loadPart()-Aufruf
 * - Gemeinsame Nutzung von Geometrien und Materialien
 * - Explizite Freigabe von Instanzen über releasePart()
 * - Sichere Cache-Bereinigung
 *
 * WICHTIG:
 * Die zurückgegebenen Instanzen teilen Geometrien und Materialien
 * mit dem gecachten Quellmodell.
 *
 * Daher dürfen diese Ressourcen nicht direkt über die Instanz
 * freigegeben werden. Dafür ist releasePart() vorgesehen.
 */
export class LDrawManager {

    constructor({
        baseUrl = '/ldraw/',
        loaderFactory = null,
        pathResolver = null,
        materialManager = null,
        scale = 1 / LDU_PER_STUD,
        defaultParts = DEFAULT_PARTS
    } = {}) {

        if (!Number.isFinite(scale) || scale <= 0) {
            throw new RangeError(
                'LDrawManager: scale muss eine positive Zahl sein.'
            );
        }

        if (!Array.isArray(defaultParts)) {
            throw new TypeError(
                'LDrawManager: defaultParts muss ein Array sein.'
            );
        }

        this.pathResolver =
            pathResolver ?? new LDrawPathResolver(baseUrl);

        this.loaderFactory =
            loaderFactory ?? new LDrawLoaderFactory({
                pathResolver: this.pathResolver
            });

        this.materialManager =
            materialManager ?? new LDrawMaterialManager(
                this.pathResolver
            );

        this.scale = scale;
        this.defaultParts = [...defaultParts];

        this.loader = null;

        // Gemeinsamer Initialisierungsvorgang.
        this.initializationPromise = null;

        /*
         * Cache-Struktur:
         *
         * Map<partNumber, {
         *   promise: Promise<Object3D>,
         *   source: Object3D | null,
         *   activeInstances: number,
         *   evicted: boolean
         * }>
         */
        this.partCache = new Map();

        // Zuordnung zurückgegebener Instanzen zu ihren Cache-Einträgen.
        this.activeInstances = new WeakMap();

        this.disposed = false;
    }

    // ------------------------------------------------------------
    // INITIALISIERUNG
    // ------------------------------------------------------------

    /**
     * Initialisiert den LDrawLoader und seine Materialien.
     *
     * Mehrere gleichzeitige Aufrufe verwenden dieselbe Promise.
     */
    async initialize() {

        this.#assertActive();

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        const initialization = (async () => {

            const loader = this.loaderFactory.create();

            try {

                await this.materialManager.initialize(loader);

                this.#assertActive();

                this.loader = loader;

                return this;

            } catch (error) {

                throw new Error(
                    `LDraw-Initialisierung fehlgeschlagen: ${error.message}`,
                    { cause: error }
                );

            }

        })();

        this.initializationPromise = initialization;

        try {

            return await initialization;

        } catch (error) {

            // Nur den eigenen Initialisierungsvorgang zurücksetzen.
            if (this.initializationPromise === initialization) {
                this.initializationPromise = null;
                this.loader = null;
            }

            throw error;
        }
    }

    // ------------------------------------------------------------
    // BAUTEILE LADEN
    // ------------------------------------------------------------

    /**
     * Lädt ein LDraw-Bauteil und gibt eine neue Instanz zurück.
     *
     * Das Quellmodell wird nur einmal geladen und anschließend
     * für weitere Instanzen aus dem Cache verwendet.
     *
     * @param {string|number} partNumber
     * @returns {Promise<Object3D>}
     */
    async loadPart(partNumber) {

        this.#assertActive();

        const key = this.#normalizePartNumber(partNumber);

        await this.initialize();

        this.#assertActive();

        let entry = this.partCache.get(key);

        if (!entry) {

            entry = {
                promise: null,
                source: null,
                activeInstances: 0,
                evicted: false
            };

            const currentEntry = entry;

            currentEntry.promise = this.loader
                .loadAsync(`parts/${key}.dat`)
                .then(source => {

                    if (!source || !source.isObject3D) {
                        throw new Error(
                            `LDrawLoader hat für ${key} kein gültiges Object3D geliefert.`
                        );
                    }

                    source.name = `LDrawPart:${key}`;

                    source.scale.setScalar(this.scale);

                    source.userData = {
                        ...source.userData,
                        ldrawPartNumber: key,
                        ldrawSource: 'LDraw',
                        ldrawScale: this.scale
                    };

                    source.updateMatrixWorld(true);

                    currentEntry.source = source;

                    /*
                     * Der Cache-Eintrag könnte während des Ladens
                     * entfernt oder der Manager disposed worden sein.
                     */
                    if (
                        currentEntry.evicted ||
                        this.disposed
                    ) {

                        this.#disposeObjectResources(source);

                        throw new Error(
                            `LDraw-Bauteil ${key} wurde während des Ladens verworfen.`
                        );
                    }

                    return source;

                })
                .catch(error => {

                    // Fehlgeschlagene Einträge aus dem Cache entfernen.
                    if (this.partCache.get(key) === currentEntry) {
                        this.partCache.delete(key);
                    }

                    throw new Error(
                        `LDraw-Bauteil ${key} konnte nicht geladen werden: ${error.message}`,
                        { cause: error }
                    );
                });

            this.partCache.set(key, currentEntry);
        }

        const source = await entry.promise;

        this.#assertActive();

        if (entry.evicted) {
            throw new Error(
                `LDraw-Bauteil ${key} wurde aus dem Cache entfernt.`
            );
        }

        // Neue Objektstruktur, aber gemeinsame Geometrien/Materialien.
        const instance = source.clone(true);

        instance.name = `LDrawInstance:${key}`;

        instance.userData = {
            ...instance.userData,
            ldrawPartNumber: key,
            ldrawSource: 'LDraw',
            ldrawScale: this.scale
        };

        entry.activeInstances++;

        this.activeInstances.set(instance, entry);

        return instance;
    }

    // ------------------------------------------------------------
    // INSTANZEN FREIGEBEN
    // ------------------------------------------------------------

    /**
     * Gibt eine zuvor mit loadPart() geladene Instanz frei.
     *
     * Die Instanz darf anschließend nicht mehr verwendet werden.
     * Sie wird nicht automatisch aus der Szene entfernt.
     *
     * @param {Object3D} instance
     * @returns {boolean}
     */
    releasePart(instance) {

        if (!instance || !instance.isObject3D) {
            return false;
        }

        const entry = this.activeInstances.get(instance);

        if (!entry) {
            return false;
        }

        this.activeInstances.delete(instance);

        entry.activeInstances = Math.max(
            0,
            entry.activeInstances - 1
        );

        /*
         * Nur freigeben, wenn der Cache-Eintrag bereits entfernt
         * wurde und keine Instanzen mehr darauf zugreifen.
         */
        if (
            entry.evicted &&
            entry.activeInstances === 0 &&
            entry.source
        ) {

            this.#disposeObjectResources(entry.source);

            entry.source = null;
        }

        return true;
    }

    // ------------------------------------------------------------
    // TESTBAUTEILE
    // ------------------------------------------------------------

    /**
     * Lädt mehrere Testbauteile.
     *
     * Bei einem Fehler werden bereits erfolgreich geladene
     * Instanzen wieder freigegeben.
     *
     * @param {string[]} partNumbers
     * @returns {Promise<Object3D[]>}
     */
    async loadTestParts(partNumbers = this.defaultParts) {

        this.#assertActive();

        if (!Array.isArray(partNumbers)) {
            throw new TypeError(
                'loadTestParts erwartet ein Array von Teilenummern.'
            );
        }

        const results = await Promise.allSettled(
            partNumbers.map(number => this.loadPart(number))
        );

        const instances = [];
        const errors = [];

        for (const result of results) {

            if (result.status === 'fulfilled') {
                instances.push(result.value);
            } else {
                errors.push(result.reason);
            }
        }

        if (errors.length > 0) {

            // Bereits geladene Instanzen wieder freigeben.
            for (const instance of instances) {
                this.releasePart(instance);
            }

            throw new AggregateError(
                errors,
                'Mindestens ein LDraw-Testbauteil konnte nicht geladen werden.'
            );
        }

        return instances;
    }

    // ------------------------------------------------------------
    // CACHE-VERWALTUNG
    // ------------------------------------------------------------

    /**
     * Prüft, ob ein Bauteil im Cache vorhanden ist.
     */
    hasCachedPart(partNumber) {

        const key = this.#normalizePartNumber(partNumber);

        return this.partCache.has(key);
    }

    /**
     * Gibt die Anzahl der Cache-Einträge zurück.
     */
    getCachedPartCount() {

        return this.partCache.size;
    }

    /**
     * Gibt die Anzahl der aktuell verwendeten Instanzen zurück.
     */
    getActiveInstanceCount() {

        let count = 0;

        for (const entry of this.partCache.values()) {
            count += entry.activeInstances;
        }

        return count;
    }

    /**
     * Entfernt alle Cache-Einträge.
     *
     * Noch verwendete Instanzen behalten ihre Ressourcen.
     * Diese werden erst nach releasePart() der letzten Instanz
     * freigegeben.
     */
    clearCache() {

        for (const [key, entry] of this.partCache) {

            entry.evicted = true;

            if (
                entry.source &&
                entry.activeInstances === 0
            ) {

                this.#disposeObjectResources(entry.source);

                entry.source = null;
            }

            /*
             * Ein noch laufender Ladevorgang wird nicht abgebrochen.
             * Seine Promise erkennt später den evicted-Status und
             * gibt das geladene Quellmodell selbst frei.
             */
            this.partCache.delete(key);
        }
    }

    // ------------------------------------------------------------
    // DISPOSE
    // ------------------------------------------------------------

    /**
     * Beendet den Manager und entfernt alle Cache-Einträge.
     *
     * Bereits zurückgegebene Instanzen behalten ihre Ressourcen,
     * bis sie über releasePart() freigegeben werden.
     */
    dispose() {

        if (this.disposed) {
            return;
        }

        this.disposed = true;

        this.clearCache();

        this.loader = null;
        this.initializationPromise = null;
    }

    // ------------------------------------------------------------
    // VALIDIERUNG
    // ------------------------------------------------------------

    /**
     * Normalisiert eine LDraw-Teilenummer.
     *
     * Beispiele:
     * 3001       -> 3001
     * 3001.dat   -> 3001
     * 3069.DAT   -> 3069
     */
    #normalizePartNumber(partNumber) {

        const value = String(partNumber ?? '')
            .trim()
            .replace(/\.dat$/i, '');

        if (!/^[a-z0-9_]+$/i.test(value)) {

            throw new Error(
                `Ungültige LDraw-Teilenummer: ${partNumber}`
            );
        }

        return value.toLowerCase();
    }

    /**
     * Verhindert Operationen nach dispose().
     */
    #assertActive() {

        if (this.disposed) {
            throw new Error(
                'LDrawManager wurde bereits disposed.'
            );
        }
    }

    // ------------------------------------------------------------
    // RESSOURCEN FREIGEBEN
    // ------------------------------------------------------------

    /**
     * Gibt Geometrien und Materialien eines Quellmodells frei.
     *
     * Diese Methode darf nur aufgerufen werden, wenn keine
     * aktiven Instanzen mehr die Ressourcen verwenden.
     */
    #disposeObjectResources(root) {

        if (!root) {
            return;
        }

        const geometries = new Set();
        const materials = new Set();

        root.traverse(object => {

            if (!object.isMesh && !object.isLineSegments) {
                return;
            }

            if (object.geometry) {
                geometries.add(object.geometry);
            }

            const materialList = Array.isArray(object.material)
                ? object.material
                : [object.material];

            for (const material of materialList) {

                if (material) {
                    materials.add(material);
                }
            }
        });

        for (const geometry of geometries) {
            geometry.dispose();
        }

        for (const material of materials) {
            material.dispose();
        }
    }
}
