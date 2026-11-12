
import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';
import { PART_CATEGORIES   } from '../objects/PartCategories.js';

// =====================================================================
// PartCatalog
//
// Zentraler Zugriffspunkt auf alle verfügbaren Bauteiltypen.
//
// PartCatalog enthält die DEFINITION möglicher Bauteile.
// PartLibrary (src/objects/PartLibrary.js) enthält die INSTANZEN,
// die sich im aktuellen 3D-Modell befinden. Diese beiden Konzepte
// werden bewusst getrennt.
//
// Singleton-Muster: PartCatalog.instance() gibt immer dieselbe
// Instanz zurück. Damit können alle Module ohne explizites Dependency-
// Injection den Katalog verwenden.
// =====================================================================

let _catalogInstance = null;

export class PartCatalog {

    constructor() {
        // Interne Map für schnelle ID-Suche
        this._parts = new Map();

        // Alle Definitionen aus PartDefinitions.js registrieren
        for (const def of Object.values(PART_DEFINITIONS)) {
            this._parts.set(def.id, def);
        }
    }


    // ----------------------------------------------------------------
    // Singleton-Zugriff
    // ----------------------------------------------------------------

    /**
     * Gibt die globale PartCatalog-Instanz zurück (erstellt sie einmalig).
     * @returns {PartCatalog}
     */
    static instance() {
        if (!_catalogInstance) {
            _catalogInstance = new PartCatalog();
        }
        return _catalogInstance;
    }


    // ----------------------------------------------------------------
    // Datenzugriff
    // ----------------------------------------------------------------

    /**
     * Alle verfügbaren Bauteile als Array.
     * @returns {object[]}
     */
    getAllParts() {
        return Array.from(this._parts.values());
    }

    /**
     * Bauteil anhand seiner ID suchen.
     * @param {string} id
     * @returns {object|undefined}
     */
    getPartById(id) {
        return this._parts.get(id);
    }

    /**
     * Alle Bauteile einer Kategorie.
     * @param {string} category  – Kategorie-ID (z. B. "bricks")
     * @returns {object[]}
     */
    getPartsByCategory(category) {
        return this.getAllParts().filter(p => p.category === category);
    }

    /**
     * Alle bekannten Kategorien (aus PART_CATEGORIES).
     * @returns {object[]}
     */
    getCategories() {
        return Object.values(PART_CATEGORIES);
    }

    /**
     * Prüft, ob eine Bauteil-ID im Katalog vorhanden ist.
     * Wird von ProjectValidator genutzt, um geladene Projekte zu prüfen.
     * @param {string} id
     * @returns {boolean}
     */
    hasPart(id) {
        return this._parts.has(id);
    }

    /**
     * Neues Bauteil dynamisch registrieren (z. B. aus einem Plugin).
     * Überschreibt eine vorhandene Definition mit gleicher ID.
     * @param {object} definition
     */
    addPart(definition) {
        if (!definition || !definition.id) {
            throw new Error('addPart: Definition braucht eine id.');
        }
        this._parts.set(definition.id, definition);
    }
}
