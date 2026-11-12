// =====================================================================
// Bauteilkategorien
//
// Jede Kategorie hat eine eindeutige ID und einen Anzeigenamen.
// Dieser Import ist die einzige Quelle der Kategorie-Definitionen –
// PartCatalog, PartSearch und PartLibraryUI lesen nur hier nach.
// =====================================================================

export const PART_CATEGORIES = {

    bricks: {
        id:   'bricks',
        name: 'Steine',
        icon: '🧱',
        description: 'Klassische LEGO-Steine'
    },

    plates: {
        id:   'plates',
        name: 'Platten',
        icon: '▬',
        description: 'Flache Platten (1/3 Steinhöhe)'
    },

    tiles: {
        id:   'tiles',
        name: 'Fliesen',
        icon: '⬜',
        description: 'Glatte Oberflächen ohne Noppen'
    },

    slopes: {
        id:   'slopes',
        name: 'Schrägsteine',
        icon: '📐',
        description: 'Schräg- und Dachsteine'
    },

    technic: {
        id:   'technic',
        name: 'Technic',
        icon: '⚙️',
        description: 'Technic-Balken und -Verbinder'
    },

    windows: {
        id:   'windows',
        name: 'Fenster & Türen',
        icon: '🪟',
        description: 'Fensterrahmen und Türelemente'
    }
};
