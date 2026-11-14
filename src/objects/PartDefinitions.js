
import { BRICK_HEIGHT, PLATE_HEIGHT } from '../utils/Constants.js';


// =====================================================================
// Bauteil-Definitionen (erweitertes Datenmodell)
//
// Neue Felder gegenüber Phase 1-4:
//   category   – Kategorie-ID (aus PartCategories.js)
//   geometry   – Geometrie-Typ: "brick" | "plate" | "tile" | "slope" |
//                               "technic" | "window"
//   studs      – true = Noppen vorhanden, false = glatte Oberfläche
//   description – Kurzbeschreibung
//   tags       – Suchbegriffe (lowercase)
//
// WICHTIG: Die IDs der vorhandenen drei Grundsteine (brick_2x4,
// brick_2x2, brick_1x2) werden NICHT verändert. Gespeicherte Projekte
// referenzieren diese IDs und müssen weiterhin geladen werden können.
// =====================================================================

export const PART_DEFINITIONS = {


    // ------------------------------------------------------------------
    // Steine (bricks) – normale Steinhöhe BRICK_HEIGHT = 1.2
    // ------------------------------------------------------------------

    brick_1x1: {
        id: 'brick_1x1',
        name: '1 x 1 Stein',
        category: 'bricks',
        width: 1, depth: 1, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: 'Kleiner 1×1-Stein mit einer Noppe',
        tags: ['stein', 'grundstein', '1x1', 'klein', 'standard']
    },

    // brick_1x2 bereits vorhanden – ID beibehalten, Felder erweitern
    brick_1x2: {
        id: 'brick_1x2',
        name: '1 x 2 Stein',
        category: 'bricks',
        width: 2, depth: 1, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: 'Schmaler 1×2-Stein mit zwei Noppen',
        tags: ['stein', 'grundstein', '1x2', 'schmal', 'standard']
    },

    brick_1x4: {
        id: 'brick_1x4',
        name: '1 x 4 Stein',
        category: 'bricks',
        width: 4, depth: 1, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: 'Langer schmaler 1×4-Stein',
        tags: ['stein', 'grundstein', '1x4', 'schmal', 'lang', 'standard']
    },

    brick_1x6: {
        id: 'brick_1x6',
        name: '1 x 6 Stein',
        category: 'bricks',
        width: 6, depth: 1, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: '1×6-Stein mit sechs Noppen',
        tags: ['stein', 'grundstein', '1x6', 'schmal', 'lang']
    },

    brick_1x8: {
        id: 'brick_1x8',
        name: '1 x 8 Stein',
        category: 'bricks',
        width: 8, depth: 1, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: '1×8-Stein mit acht Noppen',
        tags: ['stein', 'grundstein', '1x8', 'schmal', 'lang']
    },

    // brick_2x2 bereits vorhanden – erweitert
    brick_2x2: {
        id: 'brick_2x2',
        name: '2 x 2 Stein',
        category: 'bricks',
        width: 2, depth: 2, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: 'Quadratischer 2×2-Stein mit vier Noppen',
        tags: ['stein', 'grundstein', '2x2', 'quadrat', 'standard']
    },

    // brick_2x4 bereits vorhanden – ID unverändert, Felder erweitert
    brick_2x4: {
        id: 'brick_2x4',
        name: '2 x 4 Stein',
        category: 'bricks',
        width: 4, depth: 2, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: 'Klassischer LEGO-Stein mit acht Noppen',
        tags: ['stein', 'grundstein', '2x4', 'standard', 'klassisch']
    },

    brick_2x6: {
        id: 'brick_2x6',
        name: '2 x 6 Stein',
        category: 'bricks',
        width: 6, depth: 2, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: '2×6-Stein mit zwölf Noppen',
        tags: ['stein', 'grundstein', '2x6', 'lang', 'standard']
    },

    brick_2x8: {
        id: 'brick_2x8',
        name: '2 x 8 Stein',
        category: 'bricks',
        width: 8, depth: 2, height: BRICK_HEIGHT,
        geometry: 'brick',
        studs: true,
        description: '2×8-Stein mit sechzehn Noppen',
        tags: ['stein', 'grundstein', '2x8', 'lang', 'standard']
    },


    // ------------------------------------------------------------------
    // Platten (plates) – flach, Höhe PLATE_HEIGHT = 0.4
    // ------------------------------------------------------------------

    plate_1x1: {
        id: 'plate_1x1',
        name: '1 x 1 Platte',
        category: 'plates',
        width: 1, depth: 1, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: 'Kleine 1×1-Platte',
        tags: ['platte', '1x1', 'klein', 'flach']
    },

    plate_1x2: {
        id: 'plate_1x2',
        name: '1 x 2 Platte',
        category: 'plates',
        width: 2, depth: 1, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: 'Schmale 1×2-Platte',
        tags: ['platte', '1x2', 'schmal', 'flach']
    },

    plate_1x4: {
        id: 'plate_1x4',
        name: '1 x 4 Platte',
        category: 'plates',
        width: 4, depth: 1, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: 'Lange 1×4-Platte',
        tags: ['platte', '1x4', 'schmal', 'lang', 'flach']
    },

    plate_1x6: {
        id: 'plate_1x6',
        name: '1 x 6 Platte',
        category: 'plates',
        width: 6, depth: 1, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: '1×6-Platte',
        tags: ['platte', '1x6', 'schmal', 'lang', 'flach']
    },

    plate_2x2: {
        id: 'plate_2x2',
        name: '2 x 2 Platte',
        category: 'plates',
        width: 2, depth: 2, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: 'Quadratische 2×2-Platte',
        tags: ['platte', '2x2', 'quadrat', 'flach']
    },

    plate_2x4: {
        id: 'plate_2x4',
        name: '2 x 4 Platte',
        category: 'plates',
        width: 4, depth: 2, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: '2×4-Platte mit acht Noppen',
        tags: ['platte', '2x4', 'flach', 'standard']
    },

    plate_2x6: {
        id: 'plate_2x6',
        name: '2 x 6 Platte',
        category: 'plates',
        width: 6, depth: 2, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: '2×6-Platte mit zwölf Noppen',
        tags: ['platte', '2x6', 'lang', 'flach']
    },

    plate_2x8: {
        id: 'plate_2x8',
        name: '2 x 8 Platte',
        category: 'plates',
        width: 8, depth: 2, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: '2×8-Platte mit sechzehn Noppen',
        tags: ['platte', '2x8', 'lang', 'flach']
    },


    // ------------------------------------------------------------------
    // Fliesen (tiles) – glatte Oberfläche ohne Noppen
    // ------------------------------------------------------------------

    tile_1x1: {
        id: 'tile_1x1',
        name: '1 x 1 Fliese',
        category: 'tiles',
        width: 1, depth: 1, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Kleine glatte 1×1-Fliese ohne Noppen',
        tags: ['fliese', '1x1', 'glatt', 'flach', 'ohne noppen']
    },

    tile_1x2: {
        id: 'tile_1x2',
        name: '1 x 2 Fliese',
        category: 'tiles',
        width: 2, depth: 1, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Glatte 1×2-Fliese ohne Noppen',
        tags: ['fliese', '1x2', 'glatt', 'flach', 'ohne noppen']
    },

    tile_1x4: {
        id: 'tile_1x4',
        name: '1 x 4 Fliese',
        category: 'tiles',
        width: 4, depth: 1, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Lange glatte 1×4-Fliese',
        tags: ['fliese', '1x4', 'glatt', 'lang', 'ohne noppen']
    },

    tile_2x2: {
        id: 'tile_2x2',
        name: '2 x 2 Fliese',
        category: 'tiles',
        width: 2, depth: 2, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Quadratische glatte 2×2-Fliese',
        tags: ['fliese', '2x2', 'glatt', 'quadrat', 'ohne noppen']
    },

    tile_2x4: {
        id: 'tile_2x4',
        name: '2 x 4 Fliese',
        category: 'tiles',
        width: 4, depth: 2, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Glatte 2×4-Fliese ohne Noppen',
        tags: ['fliese', '2x4', 'glatt', 'ohne noppen']
    },


    // ------------------------------------------------------------------
    // Schrägsteine (slopes) – Keilform mit geneigter Oberseite
    // ------------------------------------------------------------------

    slope_2x2: {
        id: 'slope_2x2',
        name: '2 x 2 Schrägstein',
        category: 'slopes',
        width: 2, depth: 2, height: BRICK_HEIGHT,
        geometry: 'slope',
        studs: false,
        description: '45°-Schrägstein für Dächer und Verkleidungen',
        tags: ['schraeg', 'dach', 'slope', '2x2', 'keil', 'geneigt']
    },

    slope_2x4: {
        id: 'slope_2x4',
        name: '2 x 4 Schrägstein',
        category: 'slopes',
        width: 4, depth: 2, height: BRICK_HEIGHT,
        geometry: 'slope',
        studs: false,
        description: 'Breiter 45°-Schrägstein',
        tags: ['schraeg', 'dach', 'slope', '2x4', 'keil', 'geneigt', 'breit']
    },

    slope_1x2: {
        id: 'slope_1x2',
        name: '1 x 2 Schrägstein',
        category: 'slopes',
        width: 2, depth: 1, height: BRICK_HEIGHT,
        geometry: 'slope',
        studs: false,
        description: 'Schmaler 1×2-Schrägstein',
        tags: ['schraeg', 'dach', 'slope', '1x2', 'keil', 'schmal']
    },


    // ------------------------------------------------------------------
    // Technic-Bauteile
    // ------------------------------------------------------------------

    technic_beam_3: {
        id: 'technic_beam_3',
        name: 'Technic Balken 3',
        category: 'technic',
        width: 3, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic',
        studs: false,
        description: 'Technic-Balken mit 3 Löchern',
        tags: ['technic', 'balken', 'loch', '3', 'verbinder', 'pin']
    },

    technic_beam_5: {
        id: 'technic_beam_5',
        name: 'Technic Balken 5',
        category: 'technic',
        width: 5, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic',
        studs: false,
        description: 'Technic-Balken mit 5 Löchern',
        tags: ['technic', 'balken', 'loch', '5', 'verbinder', 'pin']
    },

    technic_beam_7: {
        id: 'technic_beam_7',
        name: 'Technic Balken 7',
        category: 'technic',
        width: 7, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic',
        studs: false,
        description: 'Technic-Balken mit 7 Löchern',
        tags: ['technic', 'balken', 'loch', '7', 'verbinder', 'pin']
    },

    technic_beam_9: {
        id: 'technic_beam_9',
        name: 'Technic Balken 9',
        category: 'technic',
        width: 9, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic',
        studs: false,
        description: 'Technic-Balken mit 9 Löchern',
        tags: ['technic', 'balken', 'loch', '9', 'verbinder', 'lang']
    },


    // ------------------------------------------------------------------
    // Fenster und Türen
    // ------------------------------------------------------------------

    window_1x2x2: {
        id: 'window_1x2x2',
        name: 'Fensterrahmen 1x2x2',
        category: 'windows',
        width: 2, depth: 1, height: BRICK_HEIGHT * 2,
        geometry: 'window',
        studs: false,
        description: 'Einfacher Fensterrahmen, zwei Steine hoch',
        tags: ['fenster', 'rahmen', 'wand', '1x2x2']
    },

    window_1x4x3: {
        id: 'window_1x4x3',
        name: 'Fensterrahmen 1x4x3',
        category: 'windows',
        width: 4, depth: 1, height: BRICK_HEIGHT * 3,
        geometry: 'window',
        studs: false,
        description: 'Breiter Fensterrahmen, drei Steine hoch',
        tags: ['fenster', 'rahmen', 'wand', '1x4x3', 'breit']
    },

    door_1x4x6: {
        id: 'door_1x4x6',
        name: 'Türrahmen 1x4x6',
        category: 'windows',
        width: 4, depth: 1, height: BRICK_HEIGHT * 6,
        geometry: 'window',
        studs: false,
        description: 'Türrahmen, sechs Steine hoch',
        tags: ['tuer', 'tür', 'rahmen', 'wand', '1x4x6', 'eingang']
    },


    // ------------------------------------------------------------------
    // Schrägsteine (slopes) – zusätzliche Varianten (Phase E.6)
    // ------------------------------------------------------------------

    slope_1x3: {
        id: 'slope_1x3',
        name: '1 x 3 Schrägstein',
        category: 'slopes',
        width: 3, depth: 1, height: BRICK_HEIGHT,
        geometry: 'slope',
        studs: false,
        description: 'Schräger 1×3-Baustein',
        tags: ['schräg', '1x3', 'dach']
    },

    slope_2x2_inverted: {
        id: 'slope_2x2_inverted',
        name: '2 x 2 Schrägstein invers',
        category: 'slopes',
        width: 2, depth: 2, height: BRICK_HEIGHT,
        geometry: 'slope_inverted',
        studs: true,
        description: '2×2 invertierter Schrägstein mit Noppen',
        tags: ['schräg', 'invers', '2x2']
    },

    slope_3x3_corner: {
        id: 'slope_3x3_corner',
        name: '3 x 3 Eckschrägstein',
        category: 'slopes',
        width: 3, depth: 3, height: BRICK_HEIGHT,
        geometry: 'slope_corner',
        studs: false,
        description: '3×3-Eckschrägstein für Dachkonstruktionen',
        tags: ['schräg', 'ecke', '3x3', 'dach']
    },


    // ------------------------------------------------------------------
    // Platten (plates) – zusätzliche Varianten (Phase E.6)
    // ------------------------------------------------------------------

    plate_2x2_corner: {
        id: 'plate_2x2_corner',
        name: '2 x 2 Eckplatte',
        category: 'plates',
        width: 2, depth: 2, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: 'L-förmige 2×2-Eckplatte',
        tags: ['platte', 'ecke', '2x2', 'l-form']
    },

    plate_1x2_with_rail: {
        id: 'plate_1x2_with_rail',
        name: '1 x 2 Platte mit Schiene',
        category: 'plates',
        width: 2, depth: 1, height: PLATE_HEIGHT,
        geometry: 'plate_rail',
        studs: true,
        description: '1×2-Platte mit seitlicher Schiene',
        tags: ['platte', 'schiene', '1x2']
    },

    plate_3x3: {
        id: 'plate_3x3',
        name: '3 x 3 Platte',
        category: 'plates',
        width: 3, depth: 3, height: PLATE_HEIGHT,
        geometry: 'plate',
        studs: true,
        description: 'Quadratische 3×3-Platte',
        tags: ['platte', '3x3']
    },


    // ------------------------------------------------------------------
    // Fliesen (tiles) – zusätzliche Varianten (Phase E.6)
    // ------------------------------------------------------------------

    tile_1x6: {
        id: 'tile_1x6',
        name: '1 x 6 Fliese',
        category: 'tiles',
        width: 6, depth: 1, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Lange glatte 1×6-Fliese ohne Noppen',
        tags: ['fliese', 'glatt', '1x6']
    },

    tile_2x6: {
        id: 'tile_2x6',
        name: '2 x 6 Fliese',
        category: 'tiles',
        width: 6, depth: 2, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Glatte 2×6-Fliese ohne Noppen',
        tags: ['fliese', 'glatt', '2x6']
    },

    tile_4x4: {
        id: 'tile_4x4',
        name: '4 x 4 Fliese',
        category: 'tiles',
        width: 4, depth: 4, height: PLATE_HEIGHT,
        geometry: 'tile',
        studs: false,
        description: 'Große quadratische 4×4-Fliese ohne Noppen',
        tags: ['fliese', 'glatt', '4x4']
    },

    tile_1x1_round: {
        id: 'tile_1x1_round',
        name: '1 x 1 Runde Fliese',
        category: 'tiles',
        width: 1, depth: 1, height: PLATE_HEIGHT,
        geometry: 'tile_round',
        studs: false,
        description: 'Runde 1×1-Fliese ohne Noppen',
        tags: ['fliese', 'glatt', 'rund', '1x1']
    },


    // ------------------------------------------------------------------
    // Steine (bricks) – zusätzliche Varianten (Phase E.6)
    // ------------------------------------------------------------------

    brick_2x2_corner: {
        id: 'brick_2x2_corner',
        name: '2 x 2 Eckstein',
        category: 'bricks',
        width: 2, depth: 2, height: BRICK_HEIGHT,
        geometry: 'brick_corner',
        studs: true,
        description: 'L-förmiger 2×2-Eckstein',
        tags: ['stein', 'ecke', '2x2']
    },

    brick_1x1_round: {
        id: 'brick_1x1_round',
        name: '1 x 1 Rundstein',
        category: 'bricks',
        width: 1, depth: 1, height: BRICK_HEIGHT,
        geometry: 'brick_round',
        studs: true,
        description: 'Zylindrischer 1×1-Rundstein',
        tags: ['stein', 'rund', '1x1', 'säule']
    },

    brick_2x2_round: {
        id: 'brick_2x2_round',
        name: '2 x 2 Rundstein',
        category: 'bricks',
        width: 2, depth: 2, height: BRICK_HEIGHT,
        geometry: 'brick_round',
        studs: true,
        description: 'Zylindrischer 2×2-Rundstein für Türme und Säulen',
        tags: ['stein', 'rund', '2x2', 'turm']
    },

    brick_1x2_grille: {
        id: 'brick_1x2_grille',
        name: '1 x 2 Gitterstein',
        category: 'bricks',
        width: 2, depth: 1, height: BRICK_HEIGHT,
        geometry: 'brick_grille',
        studs: false,
        description: '1×2-Stein mit Gittermuster',
        tags: ['stein', 'gitter', '1x2', 'belüftung']
    },


    // ------------------------------------------------------------------
    // Technic-Bauteile – zusätzliche Varianten (Phase E.6)
    // ------------------------------------------------------------------

    technic_beam_11: {
        id: 'technic_beam_11',
        name: '11er Technic-Balken',
        category: 'technic',
        width: 11, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic',
        studs: false,
        description: 'Technic-Balken mit 11 Löchern',
        tags: ['technic', 'balken', '11']
    },

    technic_beam_13: {
        id: 'technic_beam_13',
        name: '13er Technic-Balken',
        category: 'technic',
        width: 13, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic',
        studs: false,
        description: 'Technic-Balken mit 13 Löchern',
        tags: ['technic', 'balken', '13']
    },

    technic_angular_beam_3: {
        id: 'technic_angular_beam_3',
        name: '3er Technic-Winkelbalken',
        category: 'technic',
        width: 3, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic_angular',
        studs: false,
        description: 'Technic-Winkelbalken 3×5',
        tags: ['technic', 'winkelbalken', '3', 'winkel']
    },

    technic_liftarm_1x3: {
        id: 'technic_liftarm_1x3',
        name: '1 x 3 Technic-Hebearm',
        category: 'technic',
        width: 3, depth: 1, height: BRICK_HEIGHT,
        geometry: 'technic',
        studs: false,
        description: 'Technic-Hebearm mit 3 Löchern',
        tags: ['technic', 'hebearm', '1x3', 'liftarm']
    }
};
