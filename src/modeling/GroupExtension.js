// =====================================================================
// GroupExtension.js – Phase K.4 (Erweiterte Gruppenverwaltung)
//
// Erweitert den bestehenden GroupManager (src/editor/GroupManager) um:
//   • mergeGroups(groups)               – mehrere Gruppen zusammenführen
//   • nestGroup(childId, parentId)      – Gruppen verschachteln
//   • getGroupTree()                    – verschachtelte Hierarchie ausgeben
//   • addToGroup / removeFromGroup      – mit Command-Tracking
//
// Alle Operationen erzeugen Commands für Undo/Redo + Kollaboration.
// =====================================================================

import {
    GroupCommand,
    UngroupCommand,
    MergeGroupsCommand,
    GroupHierarchyCommand,
    GroupMembershipCommand,
} from '../commands/GroupCommand.js';


export class GroupExtension {

    /**
     * @param {{
     *   groupManager:    import('../editor/GroupManager.js').GroupManager
     *   commandHistory:  import('../commands/Command.js').CommandHistory
     *   library:         import('../objects/PartLibrary.js').PartLibrary
     * }} options
     */
    constructor({ groupManager, commandHistory, library }) {
        if (!groupManager)   throw new Error('GroupExtension: groupManager is required.');
        if (!commandHistory) throw new Error('GroupExtension: commandHistory is required.');

        this._gm  = groupManager;
        this._cmd = commandHistory;
        this._lib = library;
    }


    // ─────────────────────────────────────────────────────────────────
    // Durchgereichte Methoden (mit Command-Wrapping)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Erstellt eine neue Gruppe aus einem Array von Bauteilen.
     *
     * @param {object[]} bricks
     * @param {string}   [name]
     * @returns {Promise<object>}  – neue Gruppe
     */
    async createGroup(bricks, name = 'Gruppe') {
        const cmd = new GroupCommand({
            bricks,
            groupName: name,
            createFn:  (b, n, id) => this._gm.createGroup(b, n, { id }),
            deleteFn:  (id)   => this._gm.deleteGroup(id),
            description: `Gruppe erstellen: ${name}`,
        });
        await this._cmd.execute(cmd);
        return cmd._group;
    }

    /**
     * Löst eine Gruppe auf.
     *
     * @param {string} groupId
     * @returns {Promise<string[]>}  – freigegebene BrickIds
     */
    async ungroup(groupId) {
        const group = this._gm.getGroup(groupId);
        if (!group) throw new Error(`GroupExtension.ungroup: group "${groupId}" not found.`);

        const cmd = new UngroupCommand({
            group,
            ungroupFn: (id) => this._gm.ungroup(id),
            createFn:  (bricks, name, id) => this._gm.createGroup(bricks, name, { id }),
            library:   this._lib,
            description: `Gruppe auflösen: ${group.name}`,
        });
        await this._cmd.execute(cmd);
        return group.brickIds ?? [];
    }


    async addToGroup(groupId, brickId) {
        const group = this._gm.getGroup(groupId);
        const brick = this._lib?.getById?.(brickId);
        if (!group || !brick) throw new Error('Gruppe oder Bauteil wurde nicht gefunden.');
        const previous = this._gm.getGroupByBrickId(brickId);
        if (previous?.id === groupId) return group;
        const command = new GroupMembershipCommand({
            groupManager: this._gm,
            brickId,
            targetGroupId: groupId,
            previousGroupId: previous?.id ?? null,
            description: 'Bauteil zu Gruppe hinzufügen'
        });
        await this._cmd.execute(command);
        return this._gm.getGroup(groupId);
    }

    async removeFromGroup(groupId, brickId) {
        const group = this._gm.getGroup(groupId);
        if (!group || !group.brickIds.includes(brickId)) return false;
        const command = new GroupMembershipCommand({
            groupManager: this._gm,
            brickId,
            targetGroupId: null,
            previousGroupId: groupId,
            description: 'Bauteil aus Gruppe entfernen'
        });
        await this._cmd.execute(command);
        return true;
    }

    // ─────────────────────────────────────────────────────────────────
    // Neue Methode: Gruppen zusammenführen
    // ─────────────────────────────────────────────────────────────────

    /**
     * Führt mehrere Gruppen in einer neuen Gruppe zusammen.
     * Die alten Gruppen werden dabei aufgelöst.
     *
     * @param {string[]} groupIds     – IDs der zusammenzuführenden Gruppen
     * @param {string}   [newName]    – Name der neuen Gruppe
     * @returns {Promise<object>}     – neu erstellte Gruppe
     */
    async mergeGroups(groupIds, newName = 'Zusammengeführte Gruppe') {
        if (!groupIds?.length) throw new Error('GroupExtension.mergeGroups: groupIds required.');

        const groups = groupIds.map(id => {
            const g = this._gm.getGroup(id);
            if (!g) throw new Error(`GroupExtension.mergeGroups: group "${id}" not found.`);
            return g;
        });

        const cmd = new MergeGroupsCommand({
            groups,
            newGroupName: newName,
            mergeFn: (originalGroups, mergedGroupId) => {
                // 1. Alle Brick-IDs einsammeln
                const allBrickIds = originalGroups.flatMap(g => g.brickIds ?? []);
                // 2. Alte Gruppen auflösen
                for (const g of originalGroups) this._gm.ungroup(g.id);
                // 3. Neue Gruppe erstellen
                const bricks = allBrickIds
                    .map(id => this._lib?.getById?.(id))
                    .filter(Boolean);
                return this._gm.createGroup(bricks, newName, { id: mergedGroupId });
            },
            splitFn: (mergedId, originalGroups) => {
                // Zusammengeführte Gruppe auflösen
                this._gm.ungroup(mergedId);
                // Originalgruppen wiederherstellen
                for (const og of originalGroups) {
                    const bricks = (og.brickIds ?? [])
                        .map(id => this._lib?.getById?.(id))
                        .filter(Boolean);
                    if (bricks.length > 0) {
                        this._gm.createGroup(bricks, og.name, { id: og.id, parentGroupId: og.parentGroupId ?? null });
                    }
                }
            },
            description: `${groups.length} Gruppen zusammenführen`,
        });

        await this._cmd.execute(cmd);
        return cmd._mergedGroup;
    }


    // ─────────────────────────────────────────────────────────────────
    // Neue Methode: Gruppen-Verschachtelung (konzeptionell)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Markiert eine Gruppe als Untergruppe einer anderen.
     * Da der bestehende GroupManager keine echte Hierarchie kennt,
     * wird die Beziehung in den Gruppennamen kodiert: "Parent > Child".
     *
     * Für eine tiefere Verschachtelung kann dieser Mechanismus später
     * durch einen echten Hierarchie-Manager ersetzt werden.
     *
     * @param {string} childGroupId
     * @param {string} parentGroupId
     * @returns {Promise<void>}
     */
    async nestGroup(childGroupId, parentGroupId) {
        const child = this._gm.getGroup(childGroupId);
        if (!child) throw new Error(`GroupExtension.nestGroup: child "${childGroupId}" not found.`);
        if (parentGroupId && !this._gm.getGroup(parentGroupId)) throw new Error(`GroupExtension.nestGroup: parent "${parentGroupId}" not found.`);
        const command = new GroupHierarchyCommand({
            groupManager: this._gm,
            childGroupId,
            beforeParentId: child.parentGroupId ?? null,
            afterParentId: parentGroupId ?? null,
            description: 'Gruppe verschachteln'
        });
        await this._cmd.execute(command);
        return this._gm.getGroup(childGroupId);
    }

    /**
     * Gibt alle Gruppen mit ihrer übergeordneten Gruppe zurück.
     * Nutzt die Name-Kodierung "Parent > Child" zur Hierarchieerkennung.
     *
     * @returns {Array<{ id:string, name:string, parentName:string|null, brickIds:string[] }>}
     */
    getGroupTree() {
        return this._gm.getGroupTree();
    }


    // ─────────────────────────────────────────────────────────────────
    // Direkt-Delegation (ohne Command)
    // ─────────────────────────────────────────────────────────────────

    getGroup(id)              { return this._gm.getGroup(id); }
    getAllGroups()             { return this._gm.getAllGroups(); }
    getGroupByBrickId(id)     { return this._gm.getGroupByBrickId(id); }
    addBrickToGroup(gId, bId) { return this.addToGroup(gId, bId); }
    removeBrickFromGroup(gId, bId) { return this.removeFromGroup(gId, bId); }
    renameGroup(gId, name)    { return this._gm.renameGroup(gId, name); }
    isMemberOfGroup(bId)      { return this._gm.isMemberOfGroup(bId); }
}
