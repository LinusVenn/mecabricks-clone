
// =====================================================================
// GroupManager
//
// Verwaltet logische Gruppen von Bauteilen. Die einzelnen Steine
// bleiben eigenständige Objekte in der PartLibrary; eine Gruppe
// ist nur eine benannte ID-Sammlung.
//
// Gruppe (intern):
//   { id: string, name: string, brickIds: Set<string> }
//
// Gruppe (serialisiert / public):
//   { id: string, name: string, brickIds: string[] }
//
// Designentscheidung: Steine werden NICHT aus der PartLibrary entfernt
// oder zu Three.js-Parent-Objekten zusammengefasst. Das schützt
// Kollision, Verbindungen, Snap und Undo/Redo.
// =====================================================================

export class GroupManager {

    constructor() {
        /**
         * @type {Map<string, { id: string, name: string, brickIds: Set<string> }>}
         */
        this._groups = new Map();
    }


    // ------------------------------------------------------------------
    // Gruppe erstellen / entfernen
    // ------------------------------------------------------------------

    /**
     * Neue Gruppe aus einer Liste von Bricks erstellen.
     *
     * @param {import('../objects/Brick.js').Brick[]} bricks
     * @param {string} [name]
     * @returns {{ id: string, name: string, brickIds: string[] }}
     */
    createGroup(bricks, name = 'Gruppe') {
        if (!bricks || bricks.length === 0) {
            throw new Error('createGroup: mindestens ein Stein erforderlich.');
        }

        const id       = this._generateId();
        const brickIds = new Set(bricks.map(b => b.id));

        this._groups.set(id, { id, name, brickIds });
        return this._toPlain(this._groups.get(id));
    }

    /**
     * Gruppe entfernen (Steine bleiben erhalten).
     * @param {string} groupId
     * @returns {boolean}
     */
    deleteGroup(groupId) {
        return this._groups.delete(groupId);
    }

    /**
     * Gruppe anhand ID abrufen.
     * @param {string} groupId
     * @returns {{ id: string, name: string, brickIds: string[] } | null}
     */
    getGroup(groupId) {
        const g = this._groups.get(groupId);
        return g ? this._toPlain(g) : null;
    }

    /**
     * Gruppe eines Bauteils finden.
     * @param {string} brickId
     * @returns {{ id: string, name: string, brickIds: string[] } | null}
     */
    getGroupByBrickId(brickId) {
        for (const g of this._groups.values()) {
            if (g.brickIds.has(brickId)) return this._toPlain(g);
        }
        return null;
    }

    /**
     * Alle Gruppen zurückgeben.
     * @returns {Array<{ id: string, name: string, brickIds: string[] }>}
     */
    getAllGroups() {
        return [...this._groups.values()].map(g => this._toPlain(g));
    }


    // ------------------------------------------------------------------
    // Mitglieder verwalten
    // ------------------------------------------------------------------

    /**
     * Stein zu bestehender Gruppe hinzufügen.
     * @param {string} groupId
     * @param {string} brickId
     * @returns {boolean}
     */
    addBrickToGroup(groupId, brickId) {
        const g = this._groups.get(groupId);
        if (!g) return false;
        g.brickIds.add(brickId);
        return true;
    }

    /**
     * Stein aus Gruppe entfernen. Leere Gruppe wird automatisch gelöscht.
     * @param {string} groupId
     * @param {string} brickId
     * @returns {boolean}
     */
    removeBrickFromGroup(groupId, brickId) {
        const g = this._groups.get(groupId);
        if (!g) return false;
        g.brickIds.delete(brickId);
        if (g.brickIds.size === 0) this._groups.delete(groupId);
        return true;
    }

    /**
     * Gruppe auflösen — Steine bleiben erhalten.
     * @param {string} groupId
     * @returns {string[] | null} — brickIds der aufgelösten Gruppe (oder null)
     */
    ungroup(groupId) {
        const g = this._groups.get(groupId);
        if (!g) return null;
        const ids = [...g.brickIds];
        this._groups.delete(groupId);
        return ids;
    }

    /**
     * Gruppe umbenennen.
     * @param {string} groupId
     * @param {string} newName
     * @returns {boolean}
     */
    renameGroup(groupId, newName) {
        const g = this._groups.get(groupId);
        if (!g || !newName) return false;
        g.name = newName;
        return true;
    }

    /**
     * Prüft ob eine BrickId bereits in einer Gruppe ist.
     * @param {string} brickId
     * @returns {boolean}
     */
    isMemberOfGroup(brickId) {
        for (const g of this._groups.values()) {
            if (g.brickIds.has(brickId)) return true;
        }
        return false;
    }


    // ------------------------------------------------------------------
    // Serialisierung / Deserialisierung
    // ------------------------------------------------------------------

    /**
     * Alle Gruppen als serialisierbares Array zurückgeben.
     * @returns {Array<{ id: string, name: string, brickIds: string[] }>}
     */
    toData() {
        return [...this._groups.values()].map(g => ({
            id:       g.id,
            name:     g.name,
            brickIds: [...g.brickIds],
        }));
    }

    /**
     * Lädt Gruppen aus serialisierten Daten. Ignoriert Gruppen mit
     * ungültigen oder nicht mehr vorhandenen Brick-IDs.
     *
     * @param {Array} data
     * @param {import('../objects/PartLibrary.js').PartLibrary} library
     */
    loadFromData(data, library) {
        this._groups.clear();
        if (!Array.isArray(data)) return;

        for (const item of data) {
            if (!item?.id || !item?.name || !Array.isArray(item?.brickIds)) continue;

            // Nur Brick-IDs die wirklich in der Library existieren
            const validIds = item.brickIds.filter(id =>
                typeof id === 'string' && library.hasId(id)
            );
            if (validIds.length === 0) continue;

            this._groups.set(item.id, {
                id:       item.id,
                name:     item.name,
                brickIds: new Set(validIds),
            });
        }
    }

    /** Alle Gruppen löschen. */
    clear() {
        this._groups.clear();
    }

    /** @returns {number} */
    getCount() {
        return this._groups.size;
    }


    // ------------------------------------------------------------------
    // Intern
    // ------------------------------------------------------------------

    _generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `group-${crypto.randomUUID()}`;
        }
        return `group-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    /** @param {{ id, name, brickIds: Set<string> }} g */
    _toPlain(g) {
        return { id: g.id, name: g.name, brickIds: [...g.brickIds] };
    }
}
