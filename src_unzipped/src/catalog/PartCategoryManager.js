/**
 * PartCategoryManager – zentrale Kategorieverwaltung (Phase E.2)
 *
 * Verwaltet die Kategoriehierarchie und stellt Hilfsfunktionen
 * für Suche, Filter und Darstellung bereit.
 *
 * Unterstützt:
 *  - Laden aller eingebauten Kategorien aus PART_CATEGORIES
 *  - Hinzufügen eigener (benutzerdefinierter) Kategorien
 *  - Schutz eingebauter Kategorien vor dem Löschen
 *  - Erzeugung aus JSON (PartCategoryManager.fromJSON)
 */

import { PART_CATEGORIES, getPartCategory } from '../objects/PartCategories.js';

// ─── Konstanten ────────────────────────────────────────────────────────────────

/** Bezeichner, um eingebaute Kategorien intern zu markieren */
const BUILTIN_FLAG = Symbol('builtin');

// ─── Klasse ────────────────────────────────────────────────────────────────────

export class PartCategoryManager {

    /**
     * Erstellt einen neuen PartCategoryManager.
     *
     * @param {Array<{id: string, name: string, icon?: string, description?: string}>|null} customCategories
     *   Optionale Liste benutzerdefinierter Kategorien, die zusätzlich geladen werden.
     */
    constructor(customCategories = null) {
        /**
         * Interne Map: categoryId (string) → erweitertes Kategorieobjekt.
         * Das Kategorieobjekt enthält zusätzlich das interne BUILTIN_FLAG-Symbol.
         * @type {Map<string, object>}
         */
        this._categories = new Map();

        // Zuerst alle eingebauten Standardkategorien laden
        this._loadDefaults();

        // Danach optionale benutzerdefinierte Kategorien hinzufügen
        if (customCategories) {
            this._loadCustom(customCategories);
        }
    }

    // ─── Öffentliche Methoden ────────────────────────────────────────────────────

    /**
     * Gibt ein Array aller bekannten Kategorieobjekte zurück.
     * Jedes Objekt enthält: id, name, icon, description.
     * Das interne BUILTIN_FLAG-Symbol wird NICHT mitgeliefert.
     *
     * @returns {Array<{id: string, name: string, icon: string, description: string}>}
     */
    getAll() {
        return Array.from(this._categories.values()).map(cat => this._toPublic(cat));
    }

    /**
     * Gibt eine einzelne Kategorie anhand ihrer ID zurück.
     *
     * @param {string} id  Die Kategorie-ID (z. B. 'bricks', 'wheels')
     * @returns {{ id: string, name: string, icon: string, description: string } | null}
     */
    getById(id) {
        const cat = this._categories.get(String(id));
        return cat ? this._toPublic(cat) : null;
    }

    /**
     * Prüft, ob eine Kategorie mit der angegebenen ID vorhanden ist.
     *
     * @param {string} id  Die zu prüfende Kategorie-ID
     * @returns {boolean}
     */
    hasCategory(id) {
        return this._categories.has(String(id));
    }

    /**
     * Gibt ein Array aller vorhandenen Kategorie-IDs zurück.
     *
     * @returns {string[]}
     */
    getIds() {
        return Array.from(this._categories.keys());
    }

    /**
     * Fügt eine neue Kategorie hinzu.
     *
     * @param {{ id: string, name: string, displayName?: string, icon?: string, description?: string, overwrite?: boolean }} def
     *   Kategorie-Definition. Wenn `overwrite: true` gesetzt ist, wird eine
     *   vorhandene benutzerdefinierte Kategorie überschrieben.
     *   Eingebaute Kategorien können niemals überschrieben werden.
     * @throws {Error} Wenn die ID bereits existiert und `overwrite` nicht true ist
     * @throws {Error} Wenn die ID einer eingebauten Kategorie entspricht
     * @throws {Error} Wenn `id` oder `name` fehlen
     */
    addCategory(def) {
        const { id, name, displayName, icon = '', description = '', overwrite = false } = def ?? {};

        // Pflichtfelder prüfen
        if (!id || typeof id !== 'string') {
            throw new Error('PartCategoryManager.addCategory: "id" ist ein Pflichtfeld (string).');
        }
        if (!name || typeof name !== 'string') {
            throw new Error(`PartCategoryManager.addCategory: "name" ist ein Pflichtfeld (string) für id="${id}".`);
        }

        // Eingebaute Kategorien dürfen nicht überschrieben werden
        if (this.isBuiltin(id)) {
            throw new Error(
                `PartCategoryManager.addCategory: Eingebaute Kategorie "${id}" kann nicht überschrieben werden.`
            );
        }

        // Vorhandene benutzerdefinierte Kategorie: nur mit overwrite=true erlaubt
        if (this._categories.has(id) && !overwrite) {
            throw new Error(
                `PartCategoryManager.addCategory: Kategorie "${id}" existiert bereits. ` +
                'Setze overwrite: true, um sie zu überschreiben.'
            );
        }

        // Neue Kategorie einfügen (ohne BUILTIN_FLAG → benutzerdefiniert)
        this._categories.set(id, {
            id,
            name,
            displayName: displayName ?? name,
            icon,
            description
            // Kein BUILTIN_FLAG → isBuiltin() gibt false zurück
        });
    }

    /**
     * Entfernt eine benutzerdefinierte Kategorie.
     * Eingebaute Kategorien können nicht entfernt werden.
     *
     * @param {string} id  Die ID der zu entfernenden Kategorie
     * @returns {boolean}  true wenn entfernt, false wenn nicht gefunden
     * @throws {Error} Wenn versucht wird, eine eingebaute Kategorie zu entfernen
     */
    removeCategory(id) {
        const key = String(id);

        // Eingebaute Kategorien sind geschützt
        if (this.isBuiltin(key)) {
            throw new Error(
                `PartCategoryManager.removeCategory: Eingebaute Kategorie "${key}" kann nicht entfernt werden.`
            );
        }

        return this._categories.delete(key);
    }

    /**
     * Gibt ein Array von { id, name } zurück, das für UI-Filterdropdowns
     * geeignet ist. Die Liste ist alphabetisch nach `name` sortiert.
     *
     * @returns {Array<{id: string, name: string}>}
     */
    getForFilter() {
        return Array.from(this._categories.values())
            .map(cat => ({ id: cat.id, name: cat.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    /**
     * Prüft, ob eine Kategorie eine eingebaute (nicht löschbare) Standardkategorie ist.
     *
     * @param {string} id  Die Kategorie-ID
     * @returns {boolean}
     */
    isBuiltin(id) {
        const cat = this._categories.get(String(id));
        return cat ? cat[BUILTIN_FLAG] === true : false;
    }

    /**
     * Gibt die Kategoriehierarchie als flache Liste zurück.
     * Zukünftige Versionen werden eine echte Baumstruktur unterstützen.
     *
     * Rückgabeformat:
     * ```json
     * [
     *   { "id": "bricks", "name": "Steine", "children": [] },
     *   ...
     * ]
     * ```
     *
     * @returns {Array<{id: string, name: string, icon: string, description: string, children: Array}>}
     */
    getCategoryTree() {
        // Aktuell flache Liste – Unterkategorien werden in einer späteren Phase ergänzt
        return Array.from(this._categories.values()).map(cat => ({
            ...this._toPublic(cat),
            children: [] // Platzhalter für zukünftige Subcategory-Unterstützung
        }));
    }

    // ─── Statische Fabrikmethoden ────────────────────────────────────────────────

    /**
     * Erstellt einen PartCategoryManager aus einem JSON-Objekt.
     *
     * Erwartetes Format:
     * ```json
     * {
     *   "categories": [
     *     { "id": "custom1", "name": "Meine Kategorie", "icon": "🔧", "description": "..." }
     *   ]
     * }
     * ```
     *
     * Einträge ohne `id` oder `name` werden übersprungen (mit Konsolenwarnung).
     *
     * @param {{ categories: Array<{id: string, name: string, displayName?: string, icon?: string, description?: string}> }} json
     * @returns {PartCategoryManager}
     */
    static fromJSON(json) {
        if (!json || typeof json !== 'object') {
            throw new Error('PartCategoryManager.fromJSON: Ungültiges JSON-Argument.');
        }

        const entries = Array.isArray(json.categories) ? json.categories : [];
        const manager = new PartCategoryManager();

        for (const entry of entries) {
            // Pflichtfelder prüfen – ungültige Einträge überspringen
            if (!entry?.id || !entry?.name) {
                console.warn(
                    'PartCategoryManager.fromJSON: Eintrag ohne "id" oder "name" übersprungen:',
                    entry
                );
                continue;
            }

            // Eingebaute Kategorien nicht doppelt laden
            if (manager.isBuiltin(entry.id)) {
                continue;
            }

            try {
                manager.addCategory({
                    id:          entry.id,
                    name:        entry.name,
                    displayName: entry.displayName ?? entry.name,
                    icon:        entry.icon        ?? '',
                    description: entry.description ?? ''
                });
            } catch (err) {
                console.warn(`PartCategoryManager.fromJSON: Fehler beim Laden von "${entry.id}":`, err.message);
            }
        }

        return manager;
    }

    // ─── Private Hilfsmethoden ───────────────────────────────────────────────────

    /**
     * Lädt alle eingebauten Kategorien aus PART_CATEGORIES in die interne Map.
     * Jede eingebaute Kategorie erhält das BUILTIN_FLAG-Symbol.
     *
     * @private
     */
    _loadDefaults() {
        for (const [key, cat] of Object.entries(PART_CATEGORIES)) {
            this._categories.set(key, {
                id:          cat.id,
                name:        cat.name,
                displayName: cat.name,  // Standard: displayName = name
                icon:        cat.icon        ?? '',
                description: cat.description ?? '',
                [BUILTIN_FLAG]: true    // Als eingebaut markieren
            });
        }
    }

    /**
     * Fügt benutzerdefinierte Kategorien aus einem Array hinzu.
     * Ungültige Einträge (fehlende id/name) werden mit Warnung übersprungen.
     * Bestehende Kategorien (eingebaut oder bereits geladen) werden nicht überschrieben.
     *
     * @param {Array<{id: string, name: string, icon?: string, description?: string}>} categories
     * @private
     */
    _loadCustom(categories) {
        if (!Array.isArray(categories)) {
            console.warn('PartCategoryManager._loadCustom: Erwartet ein Array.');
            return;
        }

        for (const cat of categories) {
            if (!cat?.id || !cat?.name) {
                console.warn('PartCategoryManager._loadCustom: Ungültiger Eintrag übersprungen:', cat);
                continue;
            }

            // Nicht überschreiben, falls bereits vorhanden
            if (this._categories.has(cat.id)) {
                continue;
            }

            this._categories.set(cat.id, {
                id:          cat.id,
                name:        cat.name,
                displayName: cat.displayName ?? cat.name,
                icon:        cat.icon        ?? '',
                description: cat.description ?? ''
                // Kein BUILTIN_FLAG → benutzerdefiniert
            });
        }
    }

    /**
     * Wandelt ein internes Kategorieobjekt in ein öffentliches Objekt ohne
     * interne Symbole um.
     *
     * @param {object} cat  Internes Kategorieobjekt aus this._categories
     * @returns {{ id: string, name: string, displayName: string, icon: string, description: string }}
     * @private
     */
    _toPublic(cat) {
        return {
            id:          cat.id,
            name:        cat.name,
            displayName: cat.displayName ?? cat.name,
            icon:        cat.icon        ?? '',
            description: cat.description ?? ''
        };
    }
}
