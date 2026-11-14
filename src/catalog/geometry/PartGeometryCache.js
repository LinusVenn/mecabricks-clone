export class PartGeometryCache {

    constructor() {
        /** @type {Map<string, object>} */
        this._entries = new Map();
    }

    /**
     * Speichert ein Geometrie-Ergebnis unter der angegebenen Bauteil-ID.
     *
     * @param {string} partId
     * @param {object} data
     */
    set(partId, data) {
        this._entries.set(String(partId), data);
    }

    /**
     * Gibt das gespeicherte Ergebnis für eine Bauteil-ID zurück,
     * oder null wenn kein Eintrag vorhanden ist.
     *
     * @param {string} partId
     * @returns {object|null}
     */
    get(partId) {
        return this._entries.get(String(partId)) ?? null;
    }

    /**
     * Prüft, ob ein Eintrag für die angegebene Bauteil-ID vorhanden ist.
     *
     * @param {string} partId
     * @returns {boolean}
     */
    has(partId) {
        return this._entries.has(String(partId));
    }

    /**
     * Entfernt den Eintrag für die angegebene Bauteil-ID aus dem Cache.
     *
     * @param {string} partId
     */
    evict(partId) {
        this._entries.delete(String(partId));
    }

    /**
     * Leert den gesamten Cache.
     */
    clear() {
        this._entries.clear();
    }

    /**
     * Gibt die aktuelle Anzahl der Cache-Einträge zurück.
     *
     * @returns {number}
     */
    size() {
        return this._entries.size;
    }
}
