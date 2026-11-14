// =====================================================================
// Assembly – Mechanische Baugruppe (Phase F.6)
//
// Eine Baugruppe ist eine Sammlung von Bauteilen, die als Einheit
// verwaltet werden.  Sie speichert:
//   - Referenz auf eine GroupManager-Gruppe  (groupId)
//   - Mechanische Verbindungen innerhalb der Gruppe
//     (MechanicalConnection-IDs)
//   - Unterbaugruppen-Referenzen
//   - Metadaten (Name, Beschreibung, Erstellungsdatum)
//
// Die Klasse ist ein reines Daten-/Domain-Objekt.  Sie hat KEINE
// direkte Abhängigkeit auf GroupManager oder MechanicalConnectionManager
// — die ID-basierte Verknüpfung wird vom AssemblyManager aufgelöst.
// =====================================================================

import { MECHANICAL_CONNECTION_TYPES } from '../connections/MechanicalConnectionManager.js';

// ---------------------------------------------------------------------------
// Hilfsfunktion – eindeutige Assembly-ID
// ---------------------------------------------------------------------------

function generateAssemblyId() {
    if (
        typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function'
    ) {
        return `assembly-${crypto.randomUUID()}`;
    }

    return `assembly-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export class Assembly {

    /**
     * @param {{
     *   id?:                      string,
     *   name:                     string,
     *   groupId:                  string,
     *   description?:             string,
     *   mechanicalConnectionIds?: string[],
     *   subAssemblyIds?:          string[],
     *   createdAt?:               string,
     * }} def
     */
    constructor(def) {
        if (!def || typeof def !== 'object') {
            throw new Error('Assembly: Definition-Objekt ist erforderlich.');
        }

        if (!def.name || typeof def.name !== 'string') {
            throw new Error('Assembly: name ist erforderlich.');
        }

        if (!def.groupId || typeof def.groupId !== 'string') {
            throw new Error('Assembly: groupId ist erforderlich.');
        }

        /** @type {string} */
        this._id = def.id || generateAssemblyId();

        /** @type {string} */
        this._name = def.name.trim();

        /** @type {string} */
        this._groupId = def.groupId;

        /** @type {string} */
        this._description = def.description ?? '';

        /**
         * Geordnete Liste der MechanicalConnection-IDs, die zu dieser
         * Baugruppe gehören.
         * @type {string[]}
         */
        this._mechanicalConnectionIds = Array.isArray(def.mechanicalConnectionIds)
            ? [...def.mechanicalConnectionIds]
            : [];

        /**
         * IDs von untergeordneten Baugruppen (Unterbaugruppen).
         * @type {string[]}
         */
        this._subAssemblyIds = Array.isArray(def.subAssemblyIds)
            ? [...def.subAssemblyIds]
            : [];

        /** @type {string} */
        this._createdAt = def.createdAt || new Date().toISOString();
    }


    // ------------------------------------------------------------------
    // Getter
    // ------------------------------------------------------------------

    /** @returns {string} */
    get id() { return this._id; }

    /** @returns {string} */
    get name() { return this._name; }

    /** @returns {string} */
    get groupId() { return this._groupId; }

    /** @returns {string} */
    get description() { return this._description; }

    /**
     * Schreibgeschützte Kopie der MechanicalConnection-ID-Liste.
     * @returns {string[]}
     */
    get mechanicalConnectionIds() { return [...this._mechanicalConnectionIds]; }

    /**
     * Schreibgeschützte Kopie der Unterbaugruppen-ID-Liste.
     * @returns {string[]}
     */
    get subAssemblyIds() { return [...this._subAssemblyIds]; }

    /** @returns {string} */
    get createdAt() { return this._createdAt; }


    // ------------------------------------------------------------------
    // Mechanische Verbindungen verwalten
    // ------------------------------------------------------------------

    /**
     * Mechanische Verbindung zur Baugruppe hinzufügen.
     * Doppelte Einträge werden stillschweigend ignoriert.
     *
     * @param {string} id  – ID einer MechanicalConnection
     * @returns {void}
     */
    addMechanicalConnection(id) {
        if (typeof id !== 'string' || !id) {
            throw new Error(
                'Assembly.addMechanicalConnection: id muss eine nicht-leere Zeichenkette sein.'
            );
        }

        if (!this._mechanicalConnectionIds.includes(id)) {
            this._mechanicalConnectionIds.push(id);
        }
    }

    /**
     * Mechanische Verbindung aus der Baugruppe entfernen.
     *
     * @param {string} id
     * @returns {boolean}  true wenn die ID vorhanden war und entfernt wurde
     */
    removeMechanicalConnection(id) {
        const index = this._mechanicalConnectionIds.indexOf(id);

        if (index === -1) return false;

        this._mechanicalConnectionIds.splice(index, 1);
        return true;
    }

    /**
     * Prüft ob eine MechanicalConnection-ID in dieser Baugruppe enthalten ist.
     *
     * @param {string} id
     * @returns {boolean}
     */
    hasMechanicalConnection(id) {
        return this._mechanicalConnectionIds.includes(id);
    }


    // ------------------------------------------------------------------
    // Unterbaugruppen verwalten
    // ------------------------------------------------------------------

    /**
     * Unterbaugruppe registrieren.
     * Doppelte Einträge werden stillschweigend ignoriert.
     * Eine Baugruppe kann sich nicht selbst als Unterbaugruppe enthalten.
     *
     * @param {string} id  – ID einer anderen Assembly
     * @returns {void}
     */
    addSubAssembly(id) {
        if (typeof id !== 'string' || !id) {
            throw new Error(
                'Assembly.addSubAssembly: id muss eine nicht-leere Zeichenkette sein.'
            );
        }

        if (id === this._id) {
            throw new Error(
                'Assembly.addSubAssembly: Eine Baugruppe kann nicht sich selbst als Unterbaugruppe enthalten.'
            );
        }

        if (!this._subAssemblyIds.includes(id)) {
            this._subAssemblyIds.push(id);
        }
    }

    /**
     * Unterbaugruppe aus der Liste entfernen.
     *
     * @param {string} id
     * @returns {boolean}  true wenn die ID vorhanden war und entfernt wurde
     */
    removeSubAssembly(id) {
        const index = this._subAssemblyIds.indexOf(id);

        if (index === -1) return false;

        this._subAssemblyIds.splice(index, 1);
        return true;
    }


    // ------------------------------------------------------------------
    // Serialisierung
    // ------------------------------------------------------------------

    /**
     * Gibt ein flaches, JSON-serialisierbares Objekt zurück.
     *
     * @returns {{
     *   id:                      string,
     *   name:                    string,
     *   groupId:                 string,
     *   description:             string,
     *   mechanicalConnectionIds: string[],
     *   subAssemblyIds:          string[],
     *   createdAt:               string,
     * }}
     */
    toData() {
        return {
            id:                      this._id,
            name:                    this._name,
            groupId:                 this._groupId,
            description:             this._description,
            mechanicalConnectionIds: [...this._mechanicalConnectionIds],
            subAssemblyIds:          [...this._subAssemblyIds],
            createdAt:               this._createdAt,
        };
    }

    /**
     * Erzeugt eine Assembly-Instanz aus serialisierten Daten.
     *
     * @param {object} obj
     * @returns {Assembly}
     */
    static fromData(obj) {
        if (!obj || typeof obj !== 'object') {
            throw new Error('Assembly.fromData: Ungültige Daten – kein Objekt.');
        }

        if (!obj.id || typeof obj.id !== 'string') {
            throw new Error(
                'Assembly.fromData: Pflichtfeld "id" fehlt oder ist kein String.'
            );
        }

        if (!obj.name || typeof obj.name !== 'string') {
            throw new Error(
                'Assembly.fromData: Pflichtfeld "name" fehlt oder ist kein String.'
            );
        }

        if (!obj.groupId || typeof obj.groupId !== 'string') {
            throw new Error(
                'Assembly.fromData: Pflichtfeld "groupId" fehlt oder ist kein String.'
            );
        }

        return new Assembly({
            id:                      obj.id,
            name:                    obj.name,
            groupId:                 obj.groupId,
            description:             obj.description ?? '',
            mechanicalConnectionIds: Array.isArray(obj.mechanicalConnectionIds)
                ? obj.mechanicalConnectionIds.filter(v => typeof v === 'string')
                : [],
            subAssemblyIds:          Array.isArray(obj.subAssemblyIds)
                ? obj.subAssemblyIds.filter(v => typeof v === 'string')
                : [],
            createdAt:               obj.createdAt ?? new Date().toISOString(),
        });
    }
}
