/**
 * ConnectionPointDefinitions – Eingebaute Verbindungspunktdefinitionen (Phase F)
 *
 * Definiert die Verbindungspunkte für alle 50 eingebauten Bauteiltypen.
 *
 * Werte aus Constants.js (direkt eingebettet, keine symbolischen Referenzen
 * im Datenteil):
 *   BRICK_HEIGHT = 1.2
 *   PLATE_HEIGHT = 0.4
 *   STUD_PITCH   = 1    (Noppenpitch, 1 Einheit = 8 mm)
 *
 * Koordinatensystem (lokal, Basisursprung = Unterkante Mitte):
 *   X  → Breite   (eine Noppe = 1 Einheit)
 *   Y  → Höhe     (aufwärts)
 *   Z  → Tiefe
 *
 * Stud-Positionen (oben):
 *   x = −width/2 + 0.5 + i   für i ∈ [0, width)
 *   z = −depth/2 + 0.5 + j   für j ∈ [0, depth)
 *   y = height (Oberseite des Bauteils)
 *   direction: (0, +1, 0)
 *
 * Anti-Stud-Positionen (unten):
 *   x, z wie Studs; y = 0; direction: (0, −1, 0)
 *
 * Technic-Loch-Positionen:
 *   x = −width/2 + 0.5 + i; y = height/2 (Mitte); z = 0
 *   direction: (0, 0, +1) — Loch geht durch die Z-Achse
 *
 * ID-Konvention:
 *   Stud:         {partId}_stud_{i}_{j}
 *   Anti-Stud:    {partId}_antistud_{i}_{j}
 *   Technic-Loch: {partId}_technic_{i}
 */

// ---------------------------------------------------------------------------
// Konstanten (direkte Werte – kein Import erforderlich, damit die Datei
// als reines Datenobjekt geladen werden kann ohne Modul-Auflösung)
// ---------------------------------------------------------------------------

/** @const {number} BRICK_HEIGHT = 1.2 */
const BH = 1.2;

/** @const {number} PLATE_HEIGHT = 0.4 */
const PH = 0.4;

// ---------------------------------------------------------------------------
// Generator-Hilfsfunktionen
// Alle Funktionen geben plain-object-Arrays zurück (keine ConnectionPoint-
// Instanzen) – der ConnectionPointManager instanziert sie beim Laden.
// ---------------------------------------------------------------------------

/**
 * Generiert Stud-Punkte für eine w×d-Oberfläche auf Höhe `h`.
 *
 * @param {string} partId
 * @param {number} w      Breite in Noppen
 * @param {number} d      Tiefe in Noppen
 * @param {number} h      Y-Position der Studs (= Bauteilhöhe)
 * @returns {object[]}
 */
function studs(partId, w, d, h) {
    const pts = [];
    for (let i = 0; i < w; i++) {
        for (let j = 0; j < d; j++) {
            pts.push({
                id:            `${partId}_stud_${i}_${j}`,
                partId,
                type:          'stud',
                localPosition: { x: -w / 2 + 0.5 + i, y: h, z: -d / 2 + 0.5 + j },
                direction:     { x: 0, y: 1, z: 0 },
                properties:    {},
            });
        }
    }
    return pts;
}

/**
 * Generiert Anti-Stud-Punkte für eine w×d-Unterseite (y = 0).
 *
 * Anti-Studs (Röhren/Buchsen) befinden sich unter jedem Noppenpunkt.
 * 1×1-Teile haben keine Röhren, aber der Boden kann trotzdem als
 * Anti-Stud-Empfänger dienen (z. B. wenn ein Stud von unten drückt).
 *
 * @param {string} partId
 * @param {number} w
 * @param {number} d
 * @returns {object[]}
 */
function antiStuds(partId, w, d) {
    const pts = [];
    for (let i = 0; i < w; i++) {
        for (let j = 0; j < d; j++) {
            pts.push({
                id:            `${partId}_antistud_${i}_${j}`,
                partId,
                type:          'anti-stud',
                localPosition: { x: -w / 2 + 0.5 + i, y: 0, z: -d / 2 + 0.5 + j },
                direction:     { x: 0, y: -1, z: 0 },
                properties:    {},
            });
        }
    }
    return pts;
}

/**
 * Generiert Technic-Loch-Punkte entlang der X-Achse auf y = h/2.
 *
 * @param {string} partId
 * @param {number} w  Breite = Anzahl Löcher
 * @param {number} h  Gesamthöhe des Balkens
 * @returns {object[]}
 */
function technicHoles(partId, w, h) {
    const pts = [];
    const cy = h / 2;
    for (let i = 0; i < w; i++) {
        pts.push({
            id:            `${partId}_technic_${i}`,
            partId,
            type:          'technic-hole',
            localPosition: { x: -w / 2 + 0.5 + i, y: cy, z: 0 },
            direction:     { x: 0, y: 0, z: 1 },
            properties:    { holeIndex: i },
        });
    }
    return pts;
}

/**
 * Kombiniert Studs oben + Anti-Studs unten — das Standard-Muster für
 * Steine und Platten.
 *
 * @param {string} partId
 * @param {number} w
 * @param {number} d
 * @param {number} h
 * @returns {object[]}
 */
function brickPoints(partId, w, d, h) {
    return [...studs(partId, w, d, h), ...antiStuds(partId, w, d)];
}

/**
 * Nur Anti-Studs unten — für Tiles (glatte Oberfläche, keine Studs).
 *
 * @param {string} partId
 * @param {number} w
 * @param {number} d
 * @returns {object[]}
 */
function tilePoints(partId, w, d) {
    return antiStuds(partId, w, d);
}

/**
 * Nur Anti-Studs unten — für normale Schrägsteine (keine Noppen oben).
 *
 * @param {string} partId
 * @param {number} w
 * @param {number} d
 * @returns {object[]}
 */
function slopePoints(partId, w, d) {
    return antiStuds(partId, w, d);
}

/**
 * Studs oben — für invertierte Schrägsteine (Noppen auf der schrägen Seite).
 *
 * @param {string} partId
 * @param {number} w
 * @param {number} d
 * @param {number} h
 * @returns {object[]}
 */
function slopeInvertedPoints(partId, w, d, h) {
    return studs(partId, w, d, h);
}

/**
 * Fenster/Türrahmen: Nur Anti-Studs unter der Basisreihe.
 * Höhe ist vielfaches von BRICK_HEIGHT; es gibt keine Studs auf dem Rahmen.
 *
 * @param {string} partId
 * @param {number} w
 * @returns {object[]}
 */
function windowPoints(partId, w) {
    // Nur die unterste Reihe (depth=1) als Anti-Stud
    return antiStuds(partId, w, 1);
}

// ---------------------------------------------------------------------------
// Hauptexport: BUILTIN_CONNECTION_POINT_DEFINITIONS
//
// Schlüssel = partId (exakt wie in PartDefinitions.js)
// Wert      = Array von Verbindungspunkt-Datenobjekten
// ---------------------------------------------------------------------------

export const BUILTIN_CONNECTION_POINT_DEFINITIONS = {

    // =========================================================================
    // STEINE (bricks) – geometry: 'brick'  |  height: BRICK_HEIGHT = 1.2
    // =========================================================================

    // ── brick_1x1 ─────────────────────────────────────────────────────────────
    // 1 Stud oben, keine Röhre unten (zu klein für Anti-Stud-Röhre)
    brick_1x1: [
        ...studs('brick_1x1', 1, 1, BH),
        // 1×1 Unterseite: einzelner Anti-Stud (Bodenkontakt)
        {
            id:            'brick_1x1_antistud_0_0',
            partId:        'brick_1x1',
            type:          'anti-stud',
            localPosition: { x: 0, y: 0, z: 0 },
            direction:     { x: 0, y: -1, z: 0 },
            properties:    {},
        },
    ],

    // ── brick_1x2 ─────────────────────────────────────────────────────────────
    brick_1x2: brickPoints('brick_1x2', 2, 1, BH),

    // ── brick_1x4 ─────────────────────────────────────────────────────────────
    brick_1x4: brickPoints('brick_1x4', 4, 1, BH),

    // ── brick_1x6 ─────────────────────────────────────────────────────────────
    brick_1x6: brickPoints('brick_1x6', 6, 1, BH),

    // ── brick_1x8 ─────────────────────────────────────────────────────────────
    brick_1x8: brickPoints('brick_1x8', 8, 1, BH),

    // ── brick_2x2 ─────────────────────────────────────────────────────────────
    brick_2x2: brickPoints('brick_2x2', 2, 2, BH),

    // ── brick_2x4 ─────────────────────────────────────────────────────────────
    brick_2x4: brickPoints('brick_2x4', 4, 2, BH),

    // ── brick_2x6 ─────────────────────────────────────────────────────────────
    brick_2x6: brickPoints('brick_2x6', 6, 2, BH),

    // ── brick_2x8 ─────────────────────────────────────────────────────────────
    brick_2x8: brickPoints('brick_2x8', 8, 2, BH),

    // ── brick_2x2_corner  (L-förmig 2×2) ─────────────────────────────────────
    // Geometrie ähnelt normaler 2×2-Brick, aber ein Viertel fehlt.
    // Für Verbindungspunkte behandeln wir ihn wie einen vollen 2×2.
    brick_2x2_corner: brickPoints('brick_2x2_corner', 2, 2, BH),

    // ── brick_1x1_round (Zylinder) ────────────────────────────────────────────
    brick_1x1_round: [
        ...studs('brick_1x1_round', 1, 1, BH),
        {
            id:            'brick_1x1_round_antistud_0_0',
            partId:        'brick_1x1_round',
            type:          'anti-stud',
            localPosition: { x: 0, y: 0, z: 0 },
            direction:     { x: 0, y: -1, z: 0 },
            properties:    { shape: 'round' },
        },
    ],

    // ── brick_2x2_round (Zylinder) ────────────────────────────────────────────
    brick_2x2_round: brickPoints('brick_2x2_round', 2, 2, BH),

    // ── brick_1x2_grille (Gitterstein – keine Studs, aber Anti-Studs) ─────────
    brick_1x2_grille: antiStuds('brick_1x2_grille', 2, 1),


    // =========================================================================
    // PLATTEN (plates) – geometry: 'plate'  |  height: PLATE_HEIGHT = 0.4
    // =========================================================================

    // ── plate_1x1 ─────────────────────────────────────────────────────────────
    plate_1x1: [
        ...studs('plate_1x1', 1, 1, PH),
        {
            id:            'plate_1x1_antistud_0_0',
            partId:        'plate_1x1',
            type:          'anti-stud',
            localPosition: { x: 0, y: 0, z: 0 },
            direction:     { x: 0, y: -1, z: 0 },
            properties:    {},
        },
    ],

    // ── plate_1x2 ─────────────────────────────────────────────────────────────
    plate_1x2: brickPoints('plate_1x2', 2, 1, PH),

    // ── plate_1x4 ─────────────────────────────────────────────────────────────
    plate_1x4: brickPoints('plate_1x4', 4, 1, PH),

    // ── plate_1x6 ─────────────────────────────────────────────────────────────
    plate_1x6: brickPoints('plate_1x6', 6, 1, PH),

    // ── plate_2x2 ─────────────────────────────────────────────────────────────
    plate_2x2: brickPoints('plate_2x2', 2, 2, PH),

    // ── plate_2x4 ─────────────────────────────────────────────────────────────
    plate_2x4: brickPoints('plate_2x4', 4, 2, PH),

    // ── plate_2x6 ─────────────────────────────────────────────────────────────
    plate_2x6: brickPoints('plate_2x6', 6, 2, PH),

    // ── plate_2x8 ─────────────────────────────────────────────────────────────
    plate_2x8: brickPoints('plate_2x8', 8, 2, PH),

    // ── plate_2x2_corner (L-förmig) ───────────────────────────────────────────
    plate_2x2_corner: brickPoints('plate_2x2_corner', 2, 2, PH),

    // ── plate_1x2_with_rail ───────────────────────────────────────────────────
    // Schiene ist seitlich – Studs/Anti-Studs wie normale 1×2-Platte.
    plate_1x2_with_rail: brickPoints('plate_1x2_with_rail', 2, 1, PH),

    // ── plate_3x3 ─────────────────────────────────────────────────────────────
    plate_3x3: brickPoints('plate_3x3', 3, 3, PH),


    // =========================================================================
    // FLIESEN (tiles) – geometry: 'tile'  |  height: PLATE_HEIGHT = 0.4
    // Glatte Oberseite → KEINE Studs oben, nur Anti-Studs unten
    // =========================================================================

    // ── tile_1x1 ──────────────────────────────────────────────────────────────
    tile_1x1: tilePoints('tile_1x1', 1, 1),

    // ── tile_1x2 ──────────────────────────────────────────────────────────────
    tile_1x2: tilePoints('tile_1x2', 2, 1),

    // ── tile_1x4 ──────────────────────────────────────────────────────────────
    tile_1x4: tilePoints('tile_1x4', 4, 1),

    // ── tile_2x2 ──────────────────────────────────────────────────────────────
    tile_2x2: tilePoints('tile_2x2', 2, 2),

    // ── tile_2x4 ──────────────────────────────────────────────────────────────
    tile_2x4: tilePoints('tile_2x4', 4, 2),

    // ── tile_1x6 ──────────────────────────────────────────────────────────────
    tile_1x6: tilePoints('tile_1x6', 6, 1),

    // ── tile_2x6 ──────────────────────────────────────────────────────────────
    tile_2x6: tilePoints('tile_2x6', 6, 2),

    // ── tile_4x4 ──────────────────────────────────────────────────────────────
    tile_4x4: tilePoints('tile_4x4', 4, 4),

    // ── tile_1x1_round ────────────────────────────────────────────────────────
    // Runde Fliese – nur einzelner Anti-Stud unten (Mittelpunkt)
    tile_1x1_round: [
        {
            id:            'tile_1x1_round_antistud_0_0',
            partId:        'tile_1x1_round',
            type:          'anti-stud',
            localPosition: { x: 0, y: 0, z: 0 },
            direction:     { x: 0, y: -1, z: 0 },
            properties:    { shape: 'round' },
        },
    ],


    // =========================================================================
    // SCHRÄGSTEINE (slopes) – geometry: 'slope'  |  height: BRICK_HEIGHT = 1.2
    // Geneigte Oberseite → KEINE Studs oben, nur Anti-Studs unten
    // =========================================================================

    // ── slope_1x2 ─────────────────────────────────────────────────────────────
    slope_1x2: slopePoints('slope_1x2', 2, 1),

    // ── slope_1x3 ─────────────────────────────────────────────────────────────
    slope_1x3: slopePoints('slope_1x3', 3, 1),

    // ── slope_2x2 ─────────────────────────────────────────────────────────────
    slope_2x2: slopePoints('slope_2x2', 2, 2),

    // ── slope_2x4 ─────────────────────────────────────────────────────────────
    slope_2x4: slopePoints('slope_2x4', 4, 2),

    // ── slope_3x3_corner ──────────────────────────────────────────────────────
    // Eckschrägstein 3×3 – keine Studs, nur untere Anti-Studs
    slope_3x3_corner: slopePoints('slope_3x3_corner', 3, 3),

    // ── slope_2x2_inverted ────────────────────────────────────────────────────
    // Invertierter Schrägstein: studs: true → Studs oben, KEINE Anti-Studs
    slope_2x2_inverted: slopeInvertedPoints('slope_2x2_inverted', 2, 2, BH),


    // =========================================================================
    // TECHNIC-BAUTEILE – geometry: 'technic'  |  height: BRICK_HEIGHT = 1.2
    // Technic-Löcher entlang X-Achse (keine Studs/Anti-Studs)
    // =========================================================================

    // ── technic_beam_3 ────────────────────────────────────────────────────────
    technic_beam_3: technicHoles('technic_beam_3', 3, BH),

    // ── technic_beam_5 ────────────────────────────────────────────────────────
    technic_beam_5: technicHoles('technic_beam_5', 5, BH),

    // ── technic_beam_7 ────────────────────────────────────────────────────────
    technic_beam_7: technicHoles('technic_beam_7', 7, BH),

    // ── technic_beam_9 ────────────────────────────────────────────────────────
    technic_beam_9: technicHoles('technic_beam_9', 9, BH),

    // ── technic_beam_11 ───────────────────────────────────────────────────────
    technic_beam_11: technicHoles('technic_beam_11', 11, BH),

    // ── technic_beam_13 ───────────────────────────────────────────────────────
    technic_beam_13: technicHoles('technic_beam_13', 13, BH),

    // ── technic_angular_beam_3 ────────────────────────────────────────────────
    // Winkelbalken: hat zwei Schenkel; vereinfacht als 3-Loch-Streifen.
    // Im echten Modell würde hier ein zweiter Satz Löcher senkrecht stehen –
    // für Phase F genügt ein Satz entlang der langen Achse.
    technic_angular_beam_3: technicHoles('technic_angular_beam_3', 3, BH),

    // ── technic_liftarm_1x3 ───────────────────────────────────────────────────
    technic_liftarm_1x3: technicHoles('technic_liftarm_1x3', 3, BH),


    // =========================================================================
    // FENSTER UND TÜREN – geometry: 'window'
    // Rahmen-Bauteile: keine Studs, nur Anti-Studs an der Basis
    // =========================================================================

    // ── window_1x2x2 ──────────────────────────────────────────────────────────
    // Breite = 2, Tiefe = 1; Anti-Studs nur in der Basisreihe
    window_1x2x2: windowPoints('window_1x2x2', 2),

    // ── window_1x4x3 ──────────────────────────────────────────────────────────
    window_1x4x3: windowPoints('window_1x4x3', 4),

    // ── door_1x4x6 ────────────────────────────────────────────────────────────
    door_1x4x6: windowPoints('door_1x4x6', 4),

};

// ---------------------------------------------------------------------------
// Hilfsfunktion: Gesamtanzahl der definierten Punkte (für Tests / Logs)
// ---------------------------------------------------------------------------

/**
 * Gibt die Gesamtzahl aller in BUILTIN_CONNECTION_POINT_DEFINITIONS
 * definierten Verbindungspunkte zurück.
 *
 * @returns {number}
 */
export function countBuiltinConnectionPoints() {
    let total = 0;
    for (const arr of Object.values(BUILTIN_CONNECTION_POINT_DEFINITIONS)) {
        total += arr.length;
    }
    return total;
}

/**
 * Gibt die Anzahl der Bauteiltypen zurück, für die Definitionen vorhanden sind.
 *
 * @returns {number}
 */
export function countDefinedPartTypes() {
    return Object.keys(BUILTIN_CONNECTION_POINT_DEFINITIONS).length;
}
