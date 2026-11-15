import { PART_DEFINITIONS }        from '../../objects/PartDefinitions.js';
import { PartGeometryFactory }     from './PartGeometryFactory.js';
import { PartGeometryValidator }   from './PartGeometryValidator.js';

export class PartGeometryProvider {

    /**
     * @param {{
     *   catalog:        import('../PartCatalog.js').PartCatalog,
     *   ldrawManager?:  import('../ldraw/LDrawManager.js').LDrawManager,
     *   normalizer?:    import('./PartGeometryNormalizer.js').PartGeometryNormalizer
     * }} options
     */
    constructor({ catalog, ldrawManager = null, normalizer = null } = {}) {
        if (!catalog) {
            throw new Error(
                'PartGeometryProvider: catalog ist erforderlich.'
            );
        }

        this._catalog      = catalog;
        this._ldrawManager = ldrawManager;
        this._factory      = new PartGeometryFactory({ ldrawManager, normalizer });
    }


    // ── Abfragen ──────────────────────────────────────────────────────

    /**
     * Ermittelt den Geometrie-Typ eines Bauteils.
     *
     * @param {string} partId
     * @returns {'local' | 'ldraw' | 'unknown'}
     */
    getSourceType(partId) {
        if (Object.prototype.hasOwnProperty.call(PART_DEFINITIONS, partId)) {
            return 'local';
        }

        const part = this._catalog.getPartById(partId);

        if (part?.ldrawPartNumber) {
            return 'ldraw';
        }

        return 'unknown';
    }

    /**
     * @param {string} partId
     * @returns {boolean}
     */
    isLocal(partId) {
        return this.getSourceType(partId) === 'local';
    }

    /**
     * @param {string} partId
     * @returns {boolean}
     */
    isLDraw(partId) {
        return this.getSourceType(partId) === 'ldraw';
    }

    /**
     * Gibt an, ob für ein Bauteil eine Geometrie bereitgestellt werden kann.
     * Lokale Teile sind immer verfügbar; LDraw-Teile nur wenn ein
     * LDrawManager konfiguriert ist.
     *
     * @param {string} partId
     * @returns {boolean}
     */
    canProvideGeometry(partId) {
        const source = this.getSourceType(partId);

        if (source === 'local')  return true;
        if (source === 'ldraw')  return this._ldrawManager !== null;

        return false;
    }


    // ── Geometrie laden ───────────────────────────────────────────────

    /**
     * Liefert eine Geometrie-Instanz für das angegebene Bauteil.
     *
     * @param {string} partId
     * @param {{ color?: number }} [options]
     * @returns {Promise<{
     *   partId:           string,
     *   source:           'local' | 'ldraw',
     *   object3D:         THREE.Object3D,
     *   dimensions:       { width: number, depth: number, height: number },
     *   release:          () => void,
     *   ldrawPartNumber?: string
     * }>}
     */
    async getGeometry(partId, options = {}) {
        const color  = options.color ?? 0x4488ff;
        const source = this.getSourceType(partId);

        if (source === 'local') {
            const result = this._factory.createLocalGeometry(partId, color);

            const geo = {
                partId,
                source:     'local',
                object3D:   result.object3D,
                dimensions: result.dimensions,
                release:    result.release
            };

            PartGeometryValidator.validate(geo);
            return geo;
        }

        if (source === 'ldraw') {
            const part = this._catalog.getPartById(partId);

            if (!this._ldrawManager) {
                throw new Error(
                    `PartGeometryProvider: Für Teil "${partId}" (LDraw: "${part?.ldrawPartNumber}") ` +
                    'wird ein LDrawManager benötigt, der aber nicht konfiguriert ist.'
                );
            }

            const ldrawPartNumber = part.ldrawPartNumber;
            const result = await this._factory.createLDrawGeometry(ldrawPartNumber);

            const geo = {
                partId,
                source:          'ldraw',
                object3D:        result.object3D,
                dimensions:      result.dimensions,
                release:         result.release,
                ldrawPartNumber
            };

            PartGeometryValidator.validate(geo);
            return geo;
        }

        throw new Error(
            `PartGeometryProvider: Keine Geometrie für Teil "${partId}" verfügbar. ` +
            'Das Teil ist weder in PART_DEFINITIONS noch hat es eine LDraw-Zuordnung.'
        );
    }

    /**
     * Vorlädt LDraw-Geometrien für eine Liste von Bauteil-IDs.
     * Lokale Teile werden ignoriert.
     *
     * @param {string[]} partIds
     * @returns {Promise<void>}
     */
    async preloadParts(partIds) {
        if (!Array.isArray(partIds) || !this._factory.canCreateLDraw()) {
            return;
        }

        const ldrawNumbers = partIds
            .filter(id => this.getSourceType(id) === 'ldraw')
            .map(id    => this._catalog.getPartById(id)?.ldrawPartNumber)
            .filter(Boolean);

        if (ldrawNumbers.length > 0) {
            await this._factory._loader.preload(ldrawNumbers);
        }
    }

    /**
     * Gibt Ressourcen frei (der LDrawManager wird nicht beeinflusst).
     */
    dispose() {
        // kein eigener Zustand zu freigeben
    }
}
