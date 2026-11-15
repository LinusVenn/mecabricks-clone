/**
 * CoordinateConverter – Konvertiert Koordinaten zwischen Three.js und LDraw (Phase H)
 *
 * Koordinatensysteme:
 *
 * Three.js:
 *   Y-Achse zeigt NACH OBEN (Standard für 3D-Szenen)
 *   Einheit: 1 Stud-Pitch (STUD_PITCH = 1)
 *
 * LDraw:
 *   Y-Achse zeigt NACH UNTEN
 *   Einheit: LDraw-Einheiten (1 Stud = 20 LDraw-Einheiten = 8 mm)
 *
 * Konvertierung:
 *   LDraw_x = Three_x * 20
 *   LDraw_y = -Three_y * 20  (Y umgekehrt!)
 *   LDraw_z = Three_z * 20
 *
 * Rotationsmatrix:
 *   LDraw_matrix = mirror_Y ⋅ Three_matrix ⋅ mirror_Y
 *   wobei mirror_Y = diag(1, -1, 1)
 *
 * Indexkonvention für flache 3×3-Arrays (spalten-major / column-major):
 *   Index: [0,1,2, 3,4,5, 6,7,8]
 *          [m00,m10,m20, m01,m11,m21, m02,m12,m22]
 *   (kompatibel mit Three.js Matrix3.elements)
 *
 * @module CoordinateConverter
 */

export class CoordinateConverter {

    // -------------------------------------------------------------------------
    // Konstanten
    // -------------------------------------------------------------------------

    /**
     * Umrechnungsfaktor: 1 Three.js-Einheit (Stud-Pitch) = 20 LDraw-Einheiten.
     *
     * @type {number}
     * @readonly
     */
    static STUD_TO_LDRAW = 20;

    /**
     * 3×3 Y-Spiegelungsmatrix als flaches, spalten-majores Array.
     *
     * Spiegelt die Y-Achse: diag(1, -1, 1)
     * Wird für die Rotationskonvertierung benötigt.
     *
     * @type {number[]}
     * @readonly
     */
    static MIRROR_Y = [
        1,  0, 0,   // Spalte 0
        0, -1, 0,   // Spalte 1
        0,  0, 1    // Spalte 2
    ];

    // -------------------------------------------------------------------------
    // Positions-Konvertierung
    // -------------------------------------------------------------------------

    /**
     * Konvertiert eine Three.js-Position in LDraw-Koordinaten.
     *
     * Skaliert alle Achsen mit {@link CoordinateConverter.STUD_TO_LDRAW} und
     * kehrt die Y-Achse um.
     *
     * @param {{ x: number, y: number, z: number }} pos - Three.js-Position.
     * @returns {{ x: number, y: number, z: number }}   - LDraw-Position.
     */
    static positionToLDraw(pos) {
        const f = CoordinateConverter.STUD_TO_LDRAW;
        return {
            x:  pos.x * f,
            y: -pos.y * f,
            z:  pos.z * f,
        };
    }

    /**
     * Konvertiert eine LDraw-Position zurück in Three.js-Koordinaten.
     *
     * Kehrt den Vorgang von {@link positionToLDraw} um.
     *
     * @param {{ x: number, y: number, z: number }} pos - LDraw-Position.
     * @returns {{ x: number, y: number, z: number }}   - Three.js-Position.
     */
    static positionFromLDraw(pos) {
        const f = CoordinateConverter.STUD_TO_LDRAW;
        return {
            x:  pos.x / f,
            y: -pos.y / f,
            z:  pos.z / f,
        };
    }

    // -------------------------------------------------------------------------
    // Rotations-Konvertierung
    // -------------------------------------------------------------------------

    /**
     * Berechnet eine 3×3-Rotationsmatrix aus XYZ-Euler-Winkeln (Bogenmaß).
     *
     * Multiplikationsreihenfolge: R = Rz * Ry * Rx (intrinsische XYZ-Rotation).
     * Das Ergebnis ist spalten-major (kompatibel mit Three.js Matrix3.elements).
     *
     * @param {{ x: number, y: number, z: number }} euler
     *   Euler-Winkel in Bogenmaß (Reihenfolge: XYZ).
     * @returns {number[]} Flaches spalten-majores 3×3-Array (9 Elemente).
     */
    static eulerToRotationMatrix(euler) {
        const cx = Math.cos(euler.x), sx = Math.sin(euler.x);
        const cy = Math.cos(euler.y), sy = Math.sin(euler.y);
        const cz = Math.cos(euler.z), sz = Math.sin(euler.z);

        // Rz * Ry * Rx (intrinsisch XYZ, spalten-major)
        //
        // Rx = [[1,  0,   0  ],
        //       [0,  cx, -sx ],
        //       [0,  sx,  cx ]]
        //
        // Ry = [[cy,  0, sy],
        //       [0,   1,  0],
        //       [-sy, 0, cy]]
        //
        // Rz = [[cz, -sz, 0],
        //       [sz,  cz, 0],
        //       [0,   0,  1]]
        //
        // Ergebnis: R = Rz * Ry * Rx

        // Spalte 0 (Basis-X nach Transformation)
        const m00 =  cy * cz;
        const m10 =  cy * sz;
        const m20 = -sy;

        // Spalte 1 (Basis-Y nach Transformation)
        const m01 =  sx * sy * cz - cx * sz;
        const m11 =  sx * sy * sz + cx * cz;
        const m21 =  sx * cy;

        // Spalte 2 (Basis-Z nach Transformation)
        const m02 =  cx * sy * cz + sx * sz;
        const m12 =  cx * sy * sz - sx * cz;
        const m22 =  cx * cy;

        // Spalten-major: [m00,m10,m20, m01,m11,m21, m02,m12,m22]
        return [
            m00, m10, m20,
            m01, m11, m21,
            m02, m12, m22,
        ];
    }

    /**
     * Konvertiert eine Three.js-Rotationsmatrix in eine LDraw-Rotationsmatrix.
     *
     * Formel: M_ldraw = mirror_Y * M_three * mirror_Y
     *
     * Da mirror_Y = diag(1,-1,1) und mirror_Y² = I, entspricht dies
     * einer Vorzeichenumkehr aller Zeilen und Spalten, die mit Y interagieren.
     *
     * @param {number[]} matrix3x3
     *   Flaches spalten-majores 3×3-Array (9 Elemente).
     * @returns {number[]} Konvertierte LDraw-Rotationsmatrix (9 Elemente).
     */
    static rotationMatrixToLDraw(matrix3x3) {
        // Spalten-major: Index-Schema
        // Spalte j, Zeile i: matrix3x3[j*3 + i]
        //
        // mirror_Y * M * mirror_Y:
        //  Für mirror_Y = diag(1,-1,1):
        //  Ergebnis[i][j] = mirrorY[i][i] * M[i][j] * mirrorY[j][j]
        //
        // In spalten-major (j*3+i):
        //  mirrorSign(i) = i === 1 ? -1 : 1
        //  mirrorSign(j) = j === 1 ? -1 : 1
        //  result[j*3+i] = mirrorSign(i) * m[j*3+i] * mirrorSign(j)

        const m = matrix3x3;
        const result = new Array(9);

        for (let j = 0; j < 3; j++) {
            const signJ = j === 1 ? -1 : 1;
            for (let i = 0; i < 3; i++) {
                const signI = i === 1 ? -1 : 1;
                result[j * 3 + i] = signI * signJ * m[j * 3 + i];
            }
        }

        return result;
    }

    /**
     * Komfort-Methode: Konvertiert Euler-Winkel direkt in eine LDraw-Matrix.
     *
     * Äquivalent zu `rotationMatrixToLDraw(eulerToRotationMatrix(euler))`.
     *
     * @param {{ x: number, y: number, z: number }} euler
     *   Euler-Winkel in Bogenmaß (Reihenfolge: XYZ).
     * @returns {number[]} LDraw-Rotationsmatrix als flaches 9-Element-Array.
     */
    static eulerToLDrawMatrix(euler) {
        return CoordinateConverter.rotationMatrixToLDraw(
            CoordinateConverter.eulerToRotationMatrix(euler)
        );
    }

    // -------------------------------------------------------------------------
    // LDraw-Ausgabe-Formatierung
    // -------------------------------------------------------------------------

    /**
     * Formatiert eine vollständige LDraw-Typ-1-Zeile (Teilreferenz).
     *
     * Format:
     * ```
     * 1 {colorId} {x} {y} {z} {a} {b} {c} {d} {e} {f} {g} {h} {i} {partFile}
     * ```
     *
     * Alle Zahlen werden mit maximal 4 Nachkommastellen ausgegeben.
     * Ganzzahlige Werte werden ohne Dezimalpunkt dargestellt.
     *
     * @param {number}    colorId   - LDraw-Farb-ID (z.B. 16 = „Main Colour").
     * @param {{ x: number, y: number, z: number }} pos
     *   Position in LDraw-Einheiten (bereits konvertiert).
     * @param {number[]}  matrix    - LDraw-Rotationsmatrix (9 Elemente, spalten-major).
     * @param {string}    partFile  - LDraw-Teiledateiname (z.B. `'3001.dat'`).
     * @returns {string}  Vollständige LDraw-Zeile ohne abschließendes Zeilenumbruchzeichen.
     */
    static formatLDrawLine(colorId, pos, matrix, partFile) {
        /**
         * Formatiert eine einzelne Zahl für LDraw-Ausgabe.
         * Ganzzahlen werden ohne Dezimaltrenner, Fließkommazahlen mit
         * bis zu 4 Nachkommastellen dargestellt.
         *
         * @param {number} n
         * @returns {string}
         */
        const fmt = (n) => {
            // Auf 4 Dezimalstellen runden und trailing zeros entfernen
            const rounded = Math.round(n * 10000) / 10000;
            // Wenn Ganzzahl → kein Dezimalpunkt
            if (Number.isInteger(rounded)) return String(rounded);
            // Ansonsten parseFloat entfernt trailing zeros
            return String(parseFloat(rounded.toFixed(4)));
        };

        // matrix ist spalten-major: [m00,m10,m20, m01,m11,m21, m02,m12,m22]
        // LDraw erwartet zeilenweise: a=m00,b=m01,c=m02, d=m10,e=m11,f=m12, g=m20,h=m21,i=m22
        const [m00, m10, m20, m01, m11, m21, m02, m12, m22] = matrix;

        return [
            '1',
            fmt(colorId),
            fmt(pos.x),
            fmt(pos.y),
            fmt(pos.z),
            // Zeilenweise Rotation (LDraw-Konvention)
            fmt(m00), fmt(m01), fmt(m02),   // a b c
            fmt(m10), fmt(m11), fmt(m12),   // d e f
            fmt(m20), fmt(m21), fmt(m22),   // g h i
            partFile,
        ].join(' ');
    }
}
