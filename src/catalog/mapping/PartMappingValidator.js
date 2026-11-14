
export class PartMappingValidator {
    static STATUSES = Object.freeze({
        AVAILABLE: 'available',
        MISSING: 'missing',
        UNVERIFIED: 'unverified',
        INVALID: 'invalid'
    });

    static normalizeBrickLinkId(value) {
        if (value === null || value === undefined) {
            return null;
        }

        const normalized = String(value).trim();

        if (!normalized) {
            return null;
        }

        return normalized;
    }

    static normalizeLDrawPartNumber(value) {
        if (value === null || value === undefined) {
            return null;
        }

        let normalized = String(value)
            .trim()
            .replace(/\\/g, '/')
            .split('/')
            .pop()
            .toLowerCase();

        normalized = normalized.replace(/\.dat$/i, '');

        if (!normalized) {
            return null;
        }

        if (!/^[a-z0-9_-]+$/.test(normalized)) {
            return null;
        }

        return normalized;
    }

    static validateStructure(mapping) {
        if (!mapping || typeof mapping !== 'object') {
            return {
                valid: false,
                status: this.STATUSES.INVALID,
                reason: 'Die Mapping-Daten sind kein gültiges Objekt.'
            };
        }

        const brickLinkId = this.normalizeBrickLinkId(
            mapping.brickLinkId
        );

        const ldrawPartNumber = this.normalizeLDrawPartNumber(
            mapping.ldrawPartNumber
        );

        if (!brickLinkId) {
            return {
                valid: false,
                status: this.STATUSES.INVALID,
                reason: 'Die BrickLink-ID fehlt.'
            };
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(brickLinkId)) {
            return {
                valid: false,
                status: this.STATUSES.INVALID,
                reason: 'Die BrickLink-ID enthält ungültige Zeichen.'
            };
        }

        if (!ldrawPartNumber) {
            return {
                valid: false,
                status: this.STATUSES.INVALID,
                reason: 'Die LDraw-Teilenummer fehlt oder ist ungültig.'
            };
        }

        if (
            mapping.verified !== undefined &&
            typeof mapping.verified !== 'boolean'
        ) {
            return {
                valid: false,
                status: this.STATUSES.INVALID,
                reason: 'Das Feld verified muss ein Boolean sein.'
            };
        }

        if (
            mapping.internalPartId !== undefined &&
            mapping.internalPartId !== null &&
            typeof mapping.internalPartId !== 'string'
        ) {
            return {
                valid: false,
                status: this.STATUSES.INVALID,
                reason: 'Die interne Bauteil-ID muss ein String sein.'
            };
        }

        return {
            valid: true,
            brickLinkId,
            ldrawPartNumber
        };
    }

    
    static async validate(mapping, ldrawIndex) {
        const structure = this.validateStructure(mapping);

        if (!structure.valid) {
            return {
                ...structure,
                status: this.STATUSES.INVALID
            };
        }

        if (!ldrawIndex || !ldrawIndex.isLoaded()) {
            return {
                valid: true,
                status: this.STATUSES.UNVERIFIED,
                reason: 'Der LDraw-Dateiindex wurde noch nicht geladen.',
                ...structure
            };
        }

        const exists = await ldrawIndex.hasPart(
            structure.ldrawPartNumber
        );

        if (exists === null || exists === undefined) {
            return {
                valid: true,
                status: this.STATUSES.UNVERIFIED,
                reason: 'Die Existenz der LDraw-Datei konnte nicht überprüft werden.',
                ...structure
            };
        }

        if (exists === false) {
            return {
                valid: true,
                status: this.STATUSES.MISSING,
                reason: 'Die zugehörige LDraw-Datei wurde nicht gefunden.',
                ...structure
            };
        }

        if (mapping.verified !== true) {
            return {
                valid: true,
                status: this.STATUSES.UNVERIFIED,
                reason: 'Die Datei existiert, aber die Zuordnung wurde noch nicht fachlich bestätigt.',
                ...structure
            };
        }

        return {
            valid: true,
            status: this.STATUSES.AVAILABLE,
            reason: null,
            ...structure
        };
    }

}
