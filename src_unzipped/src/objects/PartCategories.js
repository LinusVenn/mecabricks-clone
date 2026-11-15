/**
 * PartCategories – Definitionen aller Bauteilkategorien (Phase E)
 *
 * Enthält 16 Kategorien:
 *  - 6 ursprüngliche Basiskategorien
 *  - 10 neue Kategorien aus Phase E
 *
 * Exporte:
 *  - PART_CATEGORIES   Object-Map aller Kategorien (id → Objekt)
 *  - PART_CATEGORY_LIST  Array aller Kategorieobjekte
 *  - getPartCategory(id)      Gibt eine Kategorie anhand ihrer ID zurück
 *  - isValidPartCategory(id)  Prüft, ob eine Kategorie-ID gültig ist
 */

export const PART_CATEGORIES = {

    // ─── Ursprüngliche 6 Basiskategorien ──────────────────────────────────────

    /** Klassische und modifizierte LEGO-Steine */
    bricks: {
        id: 'bricks',
        name: 'Steine',
        icon: '🧱',
        description: 'Klassische und modifizierte LEGO-Steine'
    },

    /** Flache Platten in allen Größen */
    plates: {
        id: 'plates',
        name: 'Platten',
        icon: '▬',
        description: 'Flache Platten und modifizierte Platten'
    },

    /** Glatte Fliesen ohne Noppen */
    tiles: {
        id: 'tiles',
        name: 'Fliesen',
        icon: '⬜',
        description: 'Glatte Oberflächen ohne Noppen'
    },

    /** Schräg- und Dachsteine */
    slopes: {
        id: 'slopes',
        name: 'Schrägsteine',
        icon: '📐',
        description: 'Schräg-, Dach- und Keilsteine'
    },

    /** Technic-Konstruktionselemente */
    technic: {
        id: 'technic',
        name: 'Technic',
        icon: '⚙️',
        description: 'Technic-Balken, Verbinder und Konstruktionselemente'
    },

    /** Fensterrahmen und Fensterelemente */
    windows: {
        id: 'windows',
        name: 'Fenster & Türen',
        icon: '🪟',
        description: 'Fensterrahmen, Türen und entsprechende Bauelemente'
    },

    // ─── Neue Kategorien Phase E ───────────────────────────────────────────────

    /** Türen, Scharniere und Zugbrücken */
    doors: {
        id: 'doors',
        name: 'Türen',
        icon: '🚪',
        description: 'Türen, Scharniere und Zugbrücken'
    },

    /** Räder, Felgen und Radnaben */
    wheels: {
        id: 'wheels',
        name: 'Räder',
        icon: '⭕',
        description: 'Räder, Felgen und Radnaben'
    },

    /** Reifen und Gummiringe */
    tires: {
        id: 'tires',
        name: 'Reifen',
        icon: '🔵',
        description: 'Reifen und Gummiringe'
    },

    /** Technic-Achsen und Antriebswellen */
    axles: {
        id: 'axles',
        name: 'Achsen',
        icon: '➖',
        description: 'Technic-Achsen und Antriebswellen'
    },

    /** Technic-Pins, Verbindungsstifte und Nieten */
    pins: {
        id: 'pins',
        name: 'Verbinder',
        icon: '🔩',
        description: 'Technic-Pins, Verbindungsstifte und Nieten'
    },

    /** Scharniere, Gelenke und bewegliche Verbindungen */
    hinges: {
        id: 'hinges',
        name: 'Gelenke',
        icon: '🔗',
        description: 'Scharniere, Gelenke und bewegliche Verbindungen'
    },

    /** Große Verkleidungsplatten und Karosserieteile */
    panels: {
        id: 'panels',
        name: 'Verkleidungen',
        icon: '◼',
        description: 'Große Verkleidungsplatten und Karosserieteile'
    },

    /** Minifigurenbauteile: Kopf, Torso, Beine, Zubehör */
    minifigures: {
        id: 'minifigures',
        name: 'Minifiguren',
        icon: '👤',
        description: 'Minifigurenbauteile: Kopf, Torso, Beine, Zubehör'
    },

    /** Werkzeuge, Waffen, Fahnenmasten und kleines Zubehör */
    accessories: {
        id: 'accessories',
        name: 'Zubehör',
        icon: '🛠',
        description: 'Werkzeuge, Waffen, Fahnenmasten und kleines Zubehör'
    },

    /** Weitere Bauteile ohne spezifische Kategorie */
    other: {
        id: 'other',
        name: 'Sonstige',
        icon: '📦',
        description: 'Weitere Bauteile ohne spezifische Kategorie'
    }
};

/**
 * Flaches Array aller Kategorieobjekte.
 * Nützlich für UI-Listen und Iterationen.
 * @type {Array<{id: string, name: string, icon: string, description: string}>}
 */
export const PART_CATEGORY_LIST = Object.values(PART_CATEGORIES);

/**
 * Gibt ein Kategorieobjekt anhand seiner ID zurück.
 * @param {string} categoryId  Die Kategorie-ID (z. B. 'bricks', 'wheels')
 * @returns {{ id: string, name: string, icon: string, description: string } | null}
 */
export function getPartCategory(categoryId) {
    return PART_CATEGORIES[categoryId] ?? null;
}

/**
 * Prüft, ob eine Kategorie-ID gültig ist.
 * @param {string} categoryId  Die zu prüfende Kategorie-ID
 * @returns {boolean}
 */
export function isValidPartCategory(categoryId) {
    return Object.prototype.hasOwnProperty.call(
        PART_CATEGORIES,
        categoryId
    );
}