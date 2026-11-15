// Logische Gruppen mit optionaler, persistenter Verschachtelung.
export class GroupManager {
    constructor() { this._groups = new Map(); }

    createGroup(bricks, name = 'Gruppe', options = {}) {
        if (!Array.isArray(bricks) || bricks.length === 0) throw new Error('createGroup: mindestens ein Bauteil erforderlich.');
        const id = options.id ?? this._generateId();
        if (this._groups.has(id)) throw new Error(`Gruppe ${id} existiert bereits.`);
        const brickIds = new Set(bricks.map(brick => brick?.id).filter(Boolean));
        if (!brickIds.size) throw new Error('createGroup: keine gültigen Bauteil-IDs.');
        this._groups.set(id, { id, name: String(name || 'Gruppe'), brickIds, parentGroupId: null });
        if (options.parentGroupId) this.setParentGroup(id, options.parentGroupId);
        return this.getGroup(id);
    }

    createGroupFromData({ id, name, instanceIds = [], brickIds = [], parentGroupId = null }, library) {
        const ids = instanceIds.length ? instanceIds : brickIds;
        const bricks = ids.map(partId => library?.getById(partId)).filter(Boolean);
        if (!id || !bricks.length) return null;
        if (this._groups.has(id)) return this.getGroup(id);
        const group = this.createGroup(bricks, name, { id });
        if (parentGroupId && this._groups.has(parentGroupId)) this.setParentGroup(id, parentGroupId);
        return group;
    }

    deleteGroup(groupId) {
        const group = this._groups.get(groupId);
        if (!group) return false;
        for (const child of this._groups.values()) if (child.parentGroupId === groupId) child.parentGroupId = group.parentGroupId;
        return this._groups.delete(groupId);
    }

    removeGroup(groupId) { return this.deleteGroup(groupId); }
    getGroup(groupId) { const group = this._groups.get(groupId); return group ? this._toPlain(group) : null; }

    getGroupByBrickId(brickId) {
        for (const group of this._groups.values()) if (group.brickIds.has(brickId)) return this._toPlain(group);
        return null;
    }

    getAllGroups() { return [...this._groups.values()].map(group => this._toPlain(group)); }

    addBrickToGroup(groupId, brickId) {
        const group = this._groups.get(groupId);
        if (!group || !brickId) return false;
        for (const other of this._groups.values()) if (other.id !== groupId) other.brickIds.delete(brickId);
        group.brickIds.add(brickId);
        return true;
    }

    removeBrickFromGroup(groupId, brickId) {
        const group = this._groups.get(groupId);
        if (!group) return false;
        // Leere Gruppen bleiben erhalten, damit Undo/Redo und kollaborative
        // Mitgliedschaftsänderungen die Gruppen-ID stabil referenzieren können.
        return group.brickIds.delete(brickId);
    }

    ungroup(groupId) {
        const group = this._groups.get(groupId);
        if (!group) return null;
        const ids = [...group.brickIds];
        this.deleteGroup(groupId);
        return ids;
    }

    renameGroup(groupId, newName) {
        const group = this._groups.get(groupId);
        if (!group || typeof newName !== 'string' || !newName.trim()) return false;
        group.name = newName.trim();
        return true;
    }

    updateGroup(groupId, updates = {}) {
        const group = this._groups.get(groupId);
        if (!group) throw new Error(`Gruppe ${groupId} wurde nicht gefunden.`);
        if (updates.name !== undefined) this.renameGroup(groupId, updates.name);
        if (Array.isArray(updates.instanceIds ?? updates.brickIds)) {
            group.brickIds = new Set(updates.instanceIds ?? updates.brickIds);
        }
        if (updates.parentGroupId !== undefined) this.setParentGroup(groupId, updates.parentGroupId);
        return this.getGroup(groupId);
    }

    setParentGroup(childGroupId, parentGroupId = null) {
        const child = this._groups.get(childGroupId);
        if (!child) throw new Error(`Untergruppe ${childGroupId} existiert nicht.`);
        if (parentGroupId === childGroupId) throw new Error('Eine Gruppe kann nicht ihr eigener Elternknoten sein.');
        if (parentGroupId !== null && !this._groups.has(parentGroupId)) throw new Error(`Elterngruppe ${parentGroupId} existiert nicht.`);
        let cursor = parentGroupId;
        while (cursor) {
            if (cursor === childGroupId) throw new Error('Verschachtelung würde einen Hierarchiezyklus erzeugen.');
            cursor = this._groups.get(cursor)?.parentGroupId ?? null;
        }
        child.parentGroupId = parentGroupId;
        return this.getGroup(childGroupId);
    }

    getGroupTree() {
        const build = parentId => [...this._groups.values()]
            .filter(group => group.parentGroupId === parentId)
            .map(group => ({ ...this._toPlain(group), children: build(group.id) }));
        return build(null);
    }

    isMemberOfGroup(brickId) { return [...this._groups.values()].some(group => group.brickIds.has(brickId)); }
    toData() { return [...this._groups.values()].map(group => this._toPlain(group)); }

    loadFromData(data, library) {
        this._groups.clear();
        if (!Array.isArray(data)) return;
        for (const item of data) {
            if (!item?.id || !item?.name || !Array.isArray(item.brickIds)) continue;
            const validIds = item.brickIds.filter(id => library?.hasId?.(id));
            if (!validIds.length) continue;
            this._groups.set(item.id, {
                id: item.id,
                name: item.name,
                brickIds: new Set(validIds),
                parentGroupId: null
            });
        }
        for (const item of data) {
            if (item?.parentGroupId && this._groups.has(item.id) && this._groups.has(item.parentGroupId)) {
                try { this.setParentGroup(item.id, item.parentGroupId); }
                catch (error) { console.warn('[GroupManager] Ungültige Gruppenverschachtelung ignoriert:', error.message); }
            }
        }
    }

    clear() { this._groups.clear(); }
    getCount() { return this._groups.size; }

    _generateId() {
        return globalThis.crypto?.randomUUID ? `group-${globalThis.crypto.randomUUID()}` : `group-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    _toPlain(group) {
        return { id: group.id, name: group.name, brickIds: [...group.brickIds], parentGroupId: group.parentGroupId ?? null };
    }
}
