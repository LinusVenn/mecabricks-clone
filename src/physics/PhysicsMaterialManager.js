/**
 * PhysicsMaterialManager – Verwaltung physikalischer Materialeigenschaften (Phase G.2)
 *
 * Definiert Reibung, Elastizität und andere physikalische Materialien für
 * verschiedene Bauteilkategorien.
 *
 * Kann sowohl als Singleton (statische Methoden) als auch als Instanz verwendet werden.
 *
 * @module PhysicsMaterialManager
 *
 * @example
 * // Statische Verwendung:
 * const mat = PhysicsMaterialManager.getDefaultMaterial('bricks');
 * // → { friction: 0.7, restitution: 0.05, density: 0.001 }
 *
 * // Instanz-Verwendung:
 * const manager = new PhysicsMaterialManager();
 * const mat = manager.getMaterial('wheels');
 */

// ---------------------------------------------------------------------------
// Materialien-Tabelle
// ---------------------------------------------------------------------------

/**
 * Vollständige Materialdefinition.
 *
 * @typedef {object} PhysicsMaterial
 * @property {number} friction     - Reibungskoeffizient (0 = reibungslos, >1 = sehr rau).
 * @property {number} restitution  - Elastizitätskoeffizient (0 = inelastisch, 1 = perfekt elastisch).
 * @property {number} density      - Dichte in kg/stud³ (Annäherungswert).
 */

/**
 * Unveränderliche Map aller definierten Kategorien auf ihre Materialeigenschaften.
 *
 * @type {Readonly<Record<string, Readonly<PhysicsMaterial>>>}
 */
const MATERIALS_TABLE = Object.freeze({
    /** Standard-LEGO-Steine */
    bricks: Object.freeze({ friction: 0.7,  restitution: 0.05,  density: 0.001 }),

    /** Dünne Platten (1/3 Steinhöhe) */
    plates: Object.freeze({ friction: 0.7,  restitution: 0.05,  density: 0.001 }),

    /** Fliesen / glatte Platten */
    tiles: Object.freeze({ friction: 0.4,  restitution: 0.03,  density: 0.0008 }),

    /** Räder */
    wheels: Object.freeze({ friction: 0.9,  restitution: 0.4,   density: 0.0015 }),

    /** Reifen */
    tires: Object.freeze({ friction: 0.9,  restitution: 0.4,   density: 0.0015 }),

    /** Technic-Bauteile (Pins, Liftarme, …) */
    technic: Object.freeze({ friction: 0.65, restitution: 0.04,  density: 0.0012 }),

    /** Transparente Elemente (Glas, Fenster) */
    transparent: Object.freeze({ friction: 0.35, restitution: 0.1,  density: 0.0009 }),

    /** Gummiteile */
    rubber: Object.freeze({ friction: 1.0,  restitution: 0.5,   density: 0.0018 }),

    /** Metallteile */
    metal: Object.freeze({ friction: 0.5,  restitution: 0.2,   density: 0.004 }),

    /** Minifiguren-Teile */
    minifig: Object.freeze({ friction: 0.6,  restitution: 0.05,  density: 0.001 }),

    /** Standardwert – für alle nicht explizit definierten Kategorien */
    default: Object.freeze({ friction: 0.7,  restitution: 0.05,  density: 0.001 }),
});

// ---------------------------------------------------------------------------
// Hauptklasse
// ---------------------------------------------------------------------------

/**
 * Verwaltet physikalische Materialeigenschaften für Bauteilkategorien.
 */
export class PhysicsMaterialManager {
    /**
     * Erstellt einen neuen MaterialManager.
     *
     * Da alle Daten statisch sind, ist kein Zustand notwendig.
     * Die Instanz dient primär als bequeme API-Oberfläche.
     */
    constructor() {
        // Kein eigener Zustand; alle Daten stammen aus der statischen Tabelle.
    }

    // -----------------------------------------------------------------------
    // Statische Konstante
    // -----------------------------------------------------------------------

    /**
     * Unveränderliche Map aller bekannten Materialien.
     *
     * @type {Readonly<Record<string, Readonly<PhysicsMaterial>>>}
     */
    static get MATERIALS() {
        return MATERIALS_TABLE;
    }

    // -----------------------------------------------------------------------
    // Statische Methoden
    // -----------------------------------------------------------------------

    /**
     * Gibt die Standardmaterialeigenschaften für eine Kategorie zurück.
     *
     * Unbekannte Kategorien erhalten das `default`-Material.
     * Gibt immer ein neues (bearbeitbares) Objekt zurück, sodass der Aufrufer
     * die Werte ohne Seiteneffekte überschreiben kann.
     *
     * @param {string} category - Bauteil-Kategorie (z. B. `'bricks'`, `'tiles'`).
     * @returns {PhysicsMaterial} Materialeigenschaften.
     *
     * @example
     * const mat = PhysicsMaterialManager.getDefaultMaterial('wheels');
     * // → { friction: 0.9, restitution: 0.4, density: 0.0015 }
     */
    static getDefaultMaterial(category) {
        const key = typeof category === 'string' ? category.toLowerCase() : 'default';
        const source = MATERIALS_TABLE[key] ?? MATERIALS_TABLE.default;
        // Flache Kopie zurückgeben – unveränderliche Quelle bleibt intakt
        return { ...source };
    }

    /**
     * Gibt alle bekannten Kategorienamen zurück.
     *
     * @returns {string[]} Array der Kategorienamen.
     */
    static getAvailableCategories() {
        return Object.keys(MATERIALS_TABLE);
    }

    /**
     * Prüft, ob eine Kategorie bekannt ist.
     *
     * @param {string} category - Zu prüfende Kategorie.
     * @returns {boolean}
     */
    static hasCategory(category) {
        return Object.prototype.hasOwnProperty.call(
            MATERIALS_TABLE,
            typeof category === 'string' ? category.toLowerCase() : ''
        );
    }

    // -----------------------------------------------------------------------
    // Instanzmethoden
    // -----------------------------------------------------------------------

    /**
     * Gibt die Materialeigenschaften für eine Kategorie oder ID zurück.
     *
     * Aliasiert auf die statische Methode; kann in zukünftigen Versionen
     * instanzspezifische Überschreibungen unterstützen.
     *
     * @param {string} categoryOrId - Bauteil-Kategorie oder -ID.
     * @returns {PhysicsMaterial} Materialeigenschaften.
     */
    getMaterial(categoryOrId) {
        return PhysicsMaterialManager.getDefaultMaterial(categoryOrId);
    }

    /**
     * Erstellt ein benutzerdefiniertes Material durch Zusammenführen mit dem Standardmaterial.
     *
     * @param {string}  category   - Basiskategorie.
     * @param {Partial<PhysicsMaterial>} overrides - Zu überschreibende Werte.
     * @returns {PhysicsMaterial} Zusammengeführtes Material.
     *
     * @example
     * const mat = manager.blendMaterial('bricks', { friction: 0.3 });
     * // → { friction: 0.3, restitution: 0.05, density: 0.001 }
     */
    blendMaterial(category, overrides = {}) {
        const base = PhysicsMaterialManager.getDefaultMaterial(category);
        return { ...base, ...overrides };
    }
}
