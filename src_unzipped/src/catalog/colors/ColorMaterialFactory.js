/**
 * ColorMaterialFactory – Erstellt Three.js-Materialien aus Farbdefinitionen (Phase E.3)
 *
 * Erzeugt MeshStandardMaterial-Instanzen, die dem visuellen Erscheinungsbild
 * der jeweiligen Farbe entsprechen. Materialeigenschaften werden aus
 * ColorDefinition.material entnommen.
 *
 * Unterstützte Materialtypen:
 *  - 'plastic'    → Standard-Plastik mit realistischer Rauheit
 *  - 'transparent'→ Durchsichtiges Plastik (depthWrite=false, side=DoubleSide)
 *  - 'metallic'   → Metallische Oberfläche (hohe Metalness, niedrige Roughness)
 *  - 'chrome'     → Hochglanz-Chrom (sehr hohe Metalness, envMapIntensity erhöht)
 *  - 'pearl'      → Perlmutt-Effekt (mittlere Metalness, niedrige Roughness)
 *  - 'glitter'    → Glitzer (transparent mit leichter Metalness)
 *  - 'glow'       → Nachleuchtend (leichte Emissivität)
 *
 * Material-Caching:
 *  - Für jede colorId wird maximal ein Material erstellt und gecacht.
 *  - createMaterialFromHex() nutzt den Cache NICHT (Freiheitswert-Materialien).
 *  - clearCache() gibt alle gecachten Materialien frei (dispose()).
 */

import * as THREE from 'three';
import { ColorDefinition } from './ColorDefinition.js';

// ─── Konstanten ───────────────────────────────────────────────────────────────

/**
 * Standardwerte für Materialeigenschaften, falls in der ColorDefinition
 * keine spezifischen Werte angegeben sind.
 */
const MATERIAL_DEFAULTS = Object.freeze({
    roughness:   0.65,
    metalness:   0.0,
    transparent: false,
    opacity:     1.0,
    envMapIntensity: 1.0,
});

/**
 * Materialtyp-spezifische Korrekturen (overrides), die auf die Basiswerte
 * aus der ColorDefinition aufaddiert werden.
 *
 * Jeder Eintrag wird als Delta-Objekt über Object.assign angewendet.
 * @type {Record<string, object>}
 */
const MATERIAL_TYPE_OVERRIDES = Object.freeze({
    // Normales Plastik: keine Änderungen, Werte kommen aus ColorDefinition
    plastic: {},

    // Transparentes Plastik: Doppelseitig, kein Tiefen-Schreiben
    transparent: {
        side:      THREE.DoubleSide,
        depthWrite: false,
    },

    // Metallisch: Glänzende Oberfläche
    metallic: {
        envMapIntensity: 1.5,
    },

    // Chrome: Spiegelnd, sehr hohe Reflexion
    chrome: {
        envMapIntensity: 2.5,
        side: THREE.FrontSide,
    },

    // Perlmutt: Sanfte Reflexion, leicht glänzend
    pearl: {
        envMapIntensity: 1.2,
    },

    // Glitzer: Transparent mit leichtem Glanz
    glitter: {
        side:      THREE.DoubleSide,
        depthWrite: false,
        envMapIntensity: 0.8,
    },

    // Nachleuchtend: Emissive-Farbe auf 10 % gesetzt
    glow: {
        // Emissive wird in _buildMaterial gesondert behandelt
        _applyGlow: true,
    },
});

// ─── Hauptklasse ──────────────────────────────────────────────────────────────

export class ColorMaterialFactory {

    // ─── Konstruktor ─────────────────────────────────────────────────────────

    /**
     * Erstellt eine neue ColorMaterialFactory mit leerem Cache.
     */
    constructor() {
        /**
         * Material-Cache: colorId → THREE.MeshStandardMaterial
         * Stellt sicher, dass für jede ID maximal ein Material erstellt wird.
         * @type {Map<number, THREE.MeshStandardMaterial>}
         */
        this._cache = new Map();
    }

    // ─── Öffentliche API ──────────────────────────────────────────────────────

    /**
     * Erstellt oder gibt ein gecachtes Material für eine ColorDefinition zurück.
     *
     * Der Cache-Schlüssel ist die colorId. Wenn bereits ein Material für diese
     * ID existiert, wird es wiederverwendet (kein Neubau).
     *
     * @param {ColorDefinition} colorDef - Farbdefinition
     * @returns {THREE.MeshStandardMaterial}
     * @throws {TypeError} Wenn colorDef keine ColorDefinition-Instanz ist
     */
    createMaterial(colorDef) {
        if (!(colorDef instanceof ColorDefinition)) {
            throw new TypeError(
                'ColorMaterialFactory.createMaterial: Erwartet eine ColorDefinition-Instanz.'
            );
        }

        // Cache-Treffer: vorhandenes Material zurückgeben
        const cached = this._cache.get(colorDef.id);
        if (cached) return cached;

        // Neues Material erstellen und cachen
        const material = this._buildMaterial(colorDef);
        this._cache.set(colorDef.id, material);
        return material;
    }

    /**
     * Erstellt oder gibt ein gecachtes Material anhand einer Farb-ID zurück.
     * Schlägt die Farbe im ColorManager nach und delegiert an createMaterial().
     *
     * @param {number}       colorId      - LDraw-Farb-ID
     * @param {object}       colorManager - ColorManager-Instanz (muss getColorById() haben)
     * @returns {THREE.MeshStandardMaterial|null} Material oder null wenn ID unbekannt
     */
    createMaterialById(colorId, colorManager) {
        if (!colorManager || typeof colorManager.getColorById !== 'function') {
            console.warn(
                'ColorMaterialFactory.createMaterialById: Ungültiger ColorManager übergeben.'
            );
            return null;
        }

        const colorDef = colorManager.getColorById(colorId);
        if (!colorDef) {
            console.warn(
                `ColorMaterialFactory.createMaterialById: Farb-ID ${colorId} nicht gefunden.`
            );
            return null;
        }

        return this.createMaterial(colorDef);
    }

    /**
     * Erstellt ein Einmal-Material direkt aus einem Hex-Wert.
     * Dieses Material wird NICHT gecacht (kein colorId-Bezug).
     *
     * Nützlich für dynamisch erzeugte Farben, die nicht in der Palette stehen.
     *
     * @param {string|number} hex - CSS-Hex-String ('#RRGGBB') oder numerischer Wert (0xRRGGBB)
     * @param {{
     *   roughness?:   number,
     *   metalness?:   number,
     *   transparent?: boolean,
     *   opacity?:     number,
     * }} [options={}] - Optionale Materialeigenschaften
     * @returns {THREE.MeshStandardMaterial}
     */
    createMaterialFromHex(hex, options = {}) {
        // Hex-Wert normalisieren (String oder Zahl → THREE.Color)
        let threeColor;
        if (typeof hex === 'number') {
            threeColor = new THREE.Color(hex);
        } else if (typeof hex === 'string') {
            threeColor = new THREE.Color(hex);
        } else {
            console.warn(
                'ColorMaterialFactory.createMaterialFromHex: Ungültiger Hex-Wert, verwende Fallback.'
            );
            threeColor = new THREE.Color(0x4488FF);
        }

        // Materialeigenschaften zusammenstellen
        const roughness   = typeof options.roughness   === 'number' ? options.roughness   : MATERIAL_DEFAULTS.roughness;
        const metalness   = typeof options.metalness   === 'number' ? options.metalness   : MATERIAL_DEFAULTS.metalness;
        const transparent = typeof options.transparent === 'boolean' ? options.transparent : MATERIAL_DEFAULTS.transparent;
        const opacity     = typeof options.opacity     === 'number' ? options.opacity     : MATERIAL_DEFAULTS.opacity;

        const mat = new THREE.MeshStandardMaterial({
            color:       threeColor,
            roughness,
            metalness,
            transparent,
            opacity,
            side: transparent ? THREE.DoubleSide : THREE.FrontSide,
        });

        if (transparent) mat.depthWrite = false;

        return mat;
    }

    /**
     * Wendet die zur colorDef passende Materialfarbe auf alle Meshes in
     * einem Object3D (und seinen Kindern) an.
     *
     * Meshes mit userData.preserveMaterial = true werden übersprungen.
     * Das Material wird gecacht (wie bei createMaterial()).
     *
     * @param {THREE.Object3D}  object3D - Zielobjekt (wird traversiert)
     * @param {ColorDefinition} colorDef - Farbdefinition
     */
    applyToObject(object3D, colorDef) {
        if (!object3D || typeof object3D.traverse !== 'function') {
            console.warn(
                'ColorMaterialFactory.applyToObject: Ungültiges Object3D übergeben.'
            );
            return;
        }
        if (!(colorDef instanceof ColorDefinition)) {
            console.warn(
                'ColorMaterialFactory.applyToObject: Ungültige ColorDefinition übergeben.'
            );
            return;
        }

        // Material einmal erstellen/aus Cache holen (spart wiederholte Erstellung)
        const material = this.createMaterial(colorDef);

        // Alle Meshes im Objekt traversieren
        object3D.traverse(node => {
            // Nur Mesh-Knoten bearbeiten
            if (!(node instanceof THREE.Mesh)) return;
            // Meshes mit gesetztem Schutz-Flag überspringen
            if (node.userData.preserveMaterial === true) return;

            node.material = material;
        });
    }

    // ─── Cache-Verwaltung ────────────────────────────────────────────────────

    /**
     * Gibt ein gecachtes Material anhand der colorId zurück.
     *
     * @param {number} colorId - LDraw-Farb-ID
     * @returns {THREE.MeshStandardMaterial|null}
     */
    getCachedMaterial(colorId) {
        return this._cache.get(colorId) ?? null;
    }

    /**
     * Gibt alle gecachten Materialien frei (Three.js dispose()) und
     * leert den Cache. Sollte aufgerufen werden, wenn die Factory nicht mehr
     * benötigt wird (z. B. bei Szenenwechsel).
     */
    clearCache() {
        for (const material of this._cache.values()) {
            material.dispose();
        }
        this._cache.clear();
    }

    /**
     * Gibt die aktuelle Anzahl gecachter Materialien zurück.
     * Nützlich für Diagnose und Performance-Überwachung.
     *
     * @returns {number}
     */
    getCacheSize() {
        return this._cache.size;
    }

    // ─── Private Methoden ────────────────────────────────────────────────────

    /**
     * Erstellt ein neues THREE.MeshStandardMaterial aus einer ColorDefinition.
     * Wird intern von createMaterial() nach Cache-Miss aufgerufen.
     *
     * Verarbeitet alle unterstützten Materialtypen (plastic, transparent,
     * metallic, chrome, pearl, glitter, glow) und setzt die zugehörigen
     * THREE.js-Eigenschaften.
     *
     * @param {ColorDefinition} colorDef - Farbdefinition
     * @returns {THREE.MeshStandardMaterial}
     * @private
     */
    _buildMaterial(colorDef) {
        const mat    = colorDef.material;
        const type   = mat.type ?? 'plastic';
        const overrides = MATERIAL_TYPE_OVERRIDES[type] ?? {};

        // ── Basiswerte aus ColorDefinition ──────────────────────────────────
        const params = {
            color:       new THREE.Color(colorDef.hexNumber),
            roughness:   mat.roughness   ?? MATERIAL_DEFAULTS.roughness,
            metalness:   mat.metalness   ?? MATERIAL_DEFAULTS.metalness,
            transparent: mat.transparent ?? MATERIAL_DEFAULTS.transparent,
            opacity:     mat.opacity     ?? MATERIAL_DEFAULTS.opacity,
            // Standard-Einstellungen
            side:             THREE.FrontSide,
            depthWrite:       true,
            envMapIntensity:  MATERIAL_DEFAULTS.envMapIntensity,
        };

        // ── Typspezifische Overrides anwenden ────────────────────────────────
        // Interne Steuer-Flags (beginnen mit '_') ausfiltern
        for (const [key, value] of Object.entries(overrides)) {
            if (!key.startsWith('_')) {
                params[key] = value;
            }
        }

        // ── THREE.js-Material instanziieren ──────────────────────────────────
        const material = new THREE.MeshStandardMaterial(params);

        // ── Nachbearbeitung für besondere Typen ──────────────────────────────

        // Glow-Typ: Emissive-Farbe setzen (10 % der Grundfarbe)
        if (overrides._applyGlow) {
            material.emissive     = new THREE.Color(colorDef.hexNumber);
            material.emissiveIntensity = 0.1;
        }

        // Transparenz-Typ: Name zur besseren Diagnose
        if (params.transparent) {
            material.name = `mat_trans_${colorDef.id}`;
        } else {
            material.name = `mat_${colorDef.id}`;
        }

        // Chrome/Pearl: Flat Shading deaktivieren (wichtig für Reflexionen)
        if (type === 'chrome' || type === 'pearl' || type === 'metallic') {
            material.flatShading = false;
        }

        return material;
    }
}
