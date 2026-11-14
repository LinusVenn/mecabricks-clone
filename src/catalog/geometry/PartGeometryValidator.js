export class PartGeometryValidator {

    /**
     * Wirft einen Fehler wenn das Ergebnis-Objekt nicht die erwartete
     * Struktur { partId, source, object3D, dimensions, release } hat.
     *
     * @param {object} result
     * @returns {true}
     */
    static validate(result) {
        if (!result || typeof result !== 'object') {
            throw new Error(
                'Ungültiges Geometrie-Ergebnis: kein Objekt übergeben.'
            );
        }

        if (typeof result.partId !== 'string' || !result.partId) {
            throw new Error(
                'Ungültiges Geometrie-Ergebnis: partId fehlt oder ist kein String.'
            );
        }

        if (result.source !== 'local' && result.source !== 'ldraw') {
            throw new Error(
                'Ungültiges Geometrie-Ergebnis: source muss "local" oder "ldraw" sein.'
            );
        }

        if (!result.object3D) {
            throw new Error(
                'Ungültiges Geometrie-Ergebnis: object3D fehlt.'
            );
        }

        if (!result.dimensions || typeof result.dimensions !== 'object') {
            throw new Error(
                'Ungültiges Geometrie-Ergebnis: dimensions-Objekt fehlt.'
            );
        }

        const { width, depth, height } = result.dimensions;

        if (!Number.isFinite(width) || !Number.isFinite(depth) || !Number.isFinite(height)) {
            throw new Error(
                'Ungültiges Geometrie-Ergebnis: dimensions muss endliche Zahlen für width, depth und height enthalten.'
            );
        }

        if (typeof result.release !== 'function') {
            throw new Error(
                'Ungültiges Geometrie-Ergebnis: release muss eine Funktion sein.'
            );
        }

        return true;
    }

    /**
     * Gibt true zurück wenn das Ergebnis-Objekt gültig ist, andernfalls false.
     *
     * @param {object} result
     * @returns {boolean}
     */
    static isValid(result) {
        try {
            return this.validate(result) === true;
        } catch {
            return false;
        }
    }
}
