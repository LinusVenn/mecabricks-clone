import { PartGeometryNormalizer } from './PartGeometryNormalizer.js';

export class PartGeometryLoader {

    /**
     * @param {{
     *   ldrawManager: import('../ldraw/LDrawManager.js').LDrawManager,
     *   normalizer?:  PartGeometryNormalizer
     * }} options
     */
    constructor({ ldrawManager, normalizer = null }) {
        if (!ldrawManager) {
            throw new Error(
                'PartGeometryLoader: ldrawManager ist erforderlich.'
            );
        }

        this._ldrawManager = ldrawManager;
        this._normalizer   = normalizer ?? new PartGeometryNormalizer();
    }

    /**
     * Lädt ein LDraw-Bauteil und normalisiert es.
     *
     * @param {string} ldrawPartNumber  z. B. '3001'
     * @returns {Promise<{
     *   object3D:        THREE.Object3D,
     *   dimensions:      { width: number, depth: number, height: number },
     *   ldrawPartNumber: string
     * }>}
     */
    async load(ldrawPartNumber) {
        if (!ldrawPartNumber || typeof ldrawPartNumber !== 'string') {
            throw new Error(
                `PartGeometryLoader: Ungültige LDraw-Teilenummer: "${ldrawPartNumber}".`
            );
        }

        // Initialisierung des LDrawManagers sicherstellen
        await this._ldrawManager.initialize();

        // Instanz laden (bereits geklont und referenzgezählt)
        const object3D = await this._ldrawManager.loadPart(ldrawPartNumber);

        // Koordinatensystem normalisieren: Boden bei Y=0, XZ-zentriert
        const dimensions = this._normalizer.normalize(object3D);

        return { object3D, dimensions, ldrawPartNumber };
    }

    /**
     * Lädt mehrere Teile in den Cache vor.
     * Die erzeugten Instanzen werden sofort wieder freigegeben –
     * die Geometrien verbleiben im Cache des LDrawManagers.
     *
     * @param {string[]} ldrawPartNumbers
     * @returns {Promise<void>}
     */
    async preload(ldrawPartNumbers) {
        if (!Array.isArray(ldrawPartNumbers) || ldrawPartNumbers.length === 0) {
            return;
        }

        await this._ldrawManager.initialize();

        const results = await Promise.allSettled(
            ldrawPartNumbers.map(p => this._ldrawManager.loadPart(p))
        );

        // Sofort freigeben – Geometrien sind nun im Cache des LDrawManagers
        for (const result of results) {
            if (result.status === 'fulfilled') {
                this._ldrawManager.releasePart(result.value);
            }
        }
    }
}
