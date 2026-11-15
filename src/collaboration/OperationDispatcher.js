// =====================================================================
// OperationDispatcher – Phase J (Collaboration)
//
// Translates incoming Operation objects into method calls on the editor's
// domain managers (editor, connectionManager, groupManager, assemblyManager).
//
// Design contract:
//   • dispatch() is idempotent-safe: if the target object no longer exists
//     (e.g. another client already deleted it), the dispatcher logs a warning
//     and returns false without throwing.
//   • Each _dispatch* method returns true on success, false on skip.
// =====================================================================

import { OperationType } from './OperationQueue.js';
import { addClonedPartFromData } from '../modeling/PartCloneFactory.js';

export class OperationDispatcher {

    /**
     * @param {{
     *   editor?:             object
     *   library?:            object
     *   connectionManager?:  object
     *   groupManager?:       object
     *   assemblyManager?:    object
     * }} managers
     */
    constructor(managers = {}) {
        this._editor      = managers.editor             ?? null;
        this._library     = managers.library            ?? null;
        this._connections = managers.connectionManager  ?? null;
        this._groups      = managers.groupManager       ?? null;
        this._assembly    = managers.assemblyManager    ?? null;
    }


    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Route an incoming operation to the appropriate handler.
     *
     * @param {import('./OperationQueue.js').Operation} operation
     * @returns {Promise<boolean>} true if applied, false if skipped.
     */
    async dispatch(operation) {
        try {
            switch (operation.type) {
                case OperationType.PART_PLACED:
                    return await this._dispatchPartPlaced(operation);

                case OperationType.PART_REMOVED:
                    return await this._dispatchPartRemoved(operation);

                case OperationType.PART_TRANSFORMED:
                    return await this._dispatchPartTransformed(operation);

                case OperationType.PART_COLOR_CHANGED:
                    return await this._dispatchPartColorChanged(operation);

                case OperationType.PART_VARIANT_CHANGED:
                    return await this._dispatchPartVariantChanged(operation);

                case OperationType.GROUP_CREATED:
                    return await this._dispatchGroupCreated(operation);

                case OperationType.GROUP_UPDATED:
                    return await this._dispatchGroupUpdated(operation);

                case OperationType.GROUP_REMOVED:
                    return await this._dispatchGroupRemoved(operation);

                case OperationType.GROUPS_SPLIT:
                    return await this._dispatchGroupsSplit(operation);

                case OperationType.GROUP_MEMBERSHIP_CHANGED:
                    return await this._dispatchGroupMembershipChanged(operation);

                case OperationType.CONNECTION_CREATED:
                    return await this._dispatchConnectionCreated(operation);

                case OperationType.CONNECTION_REMOVED:
                    return await this._dispatchConnectionRemoved(operation);

                case OperationType.ASSEMBLY_UPDATED:
                    return await this._dispatchAssemblyUpdated(operation);

                // ── Phase K – Modellierungswerkzeuge ─────────────────────────
                case OperationType.PARTS_ALIGNED:
                    return await this._dispatchPartsAligned(operation);

                case OperationType.PARTS_DUPLICATED:
                    return await this._dispatchPartsDuplicated(operation);

                case OperationType.PARTS_REMOVED_BATCH:
                    return await this._dispatchPartsRemovedBatch(operation);

                case OperationType.PATTERN_CREATED:
                    return await this._dispatchPatternCreated(operation);

                case OperationType.ASSEMBLY_LOCKED:
                    return await this._dispatchAssemblyLocked(operation);

                case OperationType.ASSEMBLY_UNLOCKED:
                    return await this._dispatchAssemblyUnlocked(operation);

                default:
                    console.warn(`OperationDispatcher.dispatch: unknown operation type '${operation.type}'`);
                    return false;
            }
        } catch (err) {
            console.error(`OperationDispatcher.dispatch: error dispatching ${operation.type}`, err);
            return false;
        }
    }


    // ------------------------------------------------------------------
    // Part handlers
    // ------------------------------------------------------------------

    /**
     * Place a new part in the scene.
     * payload: { instanceId, partId, color, variant, matrix }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchPartPlaced(op) {
        if (!this._editor) {
            console.warn('OperationDispatcher._dispatchPartPlaced: no editor available, skipping.');
            return false;
        }

        const { instanceId, partId, color, variant, matrix } = op.payload;
        if (!instanceId || !partId) {
            console.warn('OperationDispatcher._dispatchPartPlaced: missing instanceId or partId in payload.', op.payload);
            return false;
        }

        try {
            await this._editor.addPart({ instanceId, partId, color, variant, matrix });
            return true;
        } catch (err) {
            console.warn('OperationDispatcher._dispatchPartPlaced: editor.addPart failed', err.message);
            return false;
        }
    }

    /**
     * Remove an existing part from the scene.
     * payload: { instanceId }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchPartRemoved(op) {
        if (!this._editor) {
            console.warn('OperationDispatcher._dispatchPartRemoved: no editor available, skipping.');
            return false;
        }

        const { instanceId } = op.payload;
        if (!instanceId) {
            console.warn('OperationDispatcher._dispatchPartRemoved: missing instanceId in payload.');
            return false;
        }

        try {
            await this._editor.removePart(instanceId);
            return true;
        } catch (err) {
            // The part may have been deleted by a concurrent operation – that's OK
            console.warn(`OperationDispatcher._dispatchPartRemoved: part '${instanceId}' not found or already removed.`, err.message);
            return false;
        }
    }

    /**
     * Move / rotate a part.
     * payload: { instanceId, matrix }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchPartTransformed(op) {
        const entries = Array.isArray(op.payload?.entries)
            ? op.payload.entries
            : [{ instanceId: op.payload?.instanceId, matrix: op.payload?.matrix }];
        let applied = 0;
        for (const entry of entries) {
            const brick = this._library?.getById?.(entry.instanceId);
            const matrix = entry.matrix;
            if (!brick?.group || !matrix) continue;
            try {
                if (matrix.position) brick.group.position.set(matrix.position.x, matrix.position.y, matrix.position.z);
                if (matrix.rotation) brick.group.rotation.set(matrix.rotation.x, matrix.rotation.y, matrix.rotation.z);
                if (matrix.scale) brick.group.scale.set(matrix.scale.x, matrix.scale.y, matrix.scale.z);
                brick.group.updateMatrix?.();
                brick.group.updateMatrixWorld?.(true);
                applied++;
            } catch (err) {
                console.warn(`OperationDispatcher: transform for '${entry.instanceId}' failed:`, err.message);
            }
        }
        return applied > 0;
    }

    /**
     * Change a part's colour.
     * payload: { instanceId, color }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchPartColorChanged(op) {
        if (!this._editor) return false;

        const { instanceId, color } = op.payload;
        if (!instanceId || color === undefined) {
            console.warn('OperationDispatcher._dispatchPartColorChanged: missing instanceId or color.');
            return false;
        }

        try {
            await this._editor.setPartColor(instanceId, color);
            return true;
        } catch (err) {
            console.warn(`OperationDispatcher._dispatchPartColorChanged: part '${instanceId}' not found.`, err.message);
            return false;
        }
    }

    /**
     * Change a part's variant (e.g., printed vs plain surface).
     * payload: { instanceId, variant }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchPartVariantChanged(op) {
        if (!this._editor) return false;

        const { instanceId, variant } = op.payload;
        if (!instanceId || variant === undefined) {
            console.warn('OperationDispatcher._dispatchPartVariantChanged: missing instanceId or variant.');
            return false;
        }

        try {
            await this._editor.setPartVariant(instanceId, variant);
            return true;
        } catch (err) {
            console.warn(`OperationDispatcher._dispatchPartVariantChanged: part '${instanceId}' not found.`, err.message);
            return false;
        }
    }


    // ------------------------------------------------------------------
    // Group handlers
    // ------------------------------------------------------------------

    /**
     * Create a new part group.
     * payload: { groupId, name, instanceIds, color? }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchGroupCreated(op) {
        if (!this._groups?.createGroupFromData) return false;
        const payload = op.payload ?? {};
        const group = this._groups.createGroupFromData({
            id: payload.groupId,
            name: payload.name,
            instanceIds: payload.instanceIds ?? [],
            parentGroupId: payload.parentGroupId ?? null
        }, this._library);
        return !!group;
    }

    /**
     * Update an existing group (rename, add/remove members).
     * payload: { groupId, updates: { name?, instanceIds? } }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchGroupUpdated(op) {
        if (!this._groups?.updateGroup) return false;
        const { groupId, updates } = op.payload ?? {};
        if (!groupId) return false;
        try { this._groups.updateGroup(groupId, updates ?? {}); return true; }
        catch (err) { console.warn('Group update fehlgeschlagen:', err.message); return false; }
    }

    /**
     * Remove a group (does NOT remove member parts).
     * payload: { groupId }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchGroupRemoved(op) {
        const groupId = op.payload?.groupId;
        if (!groupId || !this._groups?.deleteGroup) return false;
        return this._groups.deleteGroup(groupId);
    }

    async _dispatchGroupMembershipChanged(op) {
        const { brickId, groupId, previousGroupId } = op.payload ?? {};
        if (!brickId || !this._groups || !this._library?.hasId?.(brickId)) return false;
        if (previousGroupId && previousGroupId !== groupId) this._groups.removeBrickFromGroup(previousGroupId, brickId);
        if (groupId) return this._groups.addBrickToGroup(groupId, brickId);
        return true;
    }

    async _dispatchGroupsSplit(op) {
        if (!this._groups?.createGroupFromData) return false;
        const { mergedGroupId, restoredGroups = [] } = op.payload ?? {};
        if (mergedGroupId) this._groups.deleteGroup(mergedGroupId);
        let restored = 0;
        for (const group of restoredGroups) {
            const result = this._groups.createGroupFromData({
                id: group.groupId,
                name: group.name,
                instanceIds: group.instanceIds ?? []
            }, this._library);
            if (result) restored++;
        }
        for (const group of restoredGroups) {
            if (group.parentGroupId && this._groups.getGroup(group.groupId)) {
                try { this._groups.setParentGroup(group.groupId, group.parentGroupId); } catch (error) {
                    console.warn('Gruppenhierarchie konnte nach Split nicht wiederhergestellt werden:', error.message);
                }
            }
        }
        return restored > 0;
    }

    /**
     * Create a stud/hole connection between two parts.
     * payload: { connectionId, fromInstanceId, toInstanceId, fromStudId, toStudId }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchConnectionCreated(op) {
        if (!this._connections) {
            console.warn('OperationDispatcher._dispatchConnectionCreated: no connectionManager available, skipping.');
            return false;
        }

        const { connectionId } = op.payload;
        if (!connectionId) {
            console.warn('OperationDispatcher._dispatchConnectionCreated: missing connectionId in payload.');
            return false;
        }

        try {
            await this._connections.createConnection({ id: connectionId, ...op.payload });
            return true;
        } catch (err) {
            console.warn('OperationDispatcher._dispatchConnectionCreated: createConnection failed', err.message);
            return false;
        }
    }

    /**
     * Remove a stud/hole connection.
     * payload: { connectionId }
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchConnectionRemoved(op) {
        if (!this._connections) return false;

        const { connectionId } = op.payload;
        if (!connectionId) {
            console.warn('OperationDispatcher._dispatchConnectionRemoved: missing connectionId.');
            return false;
        }

        try {
            await this._connections.removeConnection(connectionId);
            return true;
        } catch (err) {
            console.warn(`OperationDispatcher._dispatchConnectionRemoved: connection '${connectionId}' not found.`, err.message);
            return false;
        }
    }


    // ------------------------------------------------------------------
    // Assembly handler
    // ------------------------------------------------------------------

    /**
     * Apply a full or partial assembly update.
     * payload: arbitrary assembly data object
     *
     * @param {import('./OperationQueue.js').Operation} op
     * @returns {Promise<boolean>}
     */
    async _dispatchAssemblyUpdated(op) {
        if (!this._assembly) {
            console.warn('OperationDispatcher._dispatchAssemblyUpdated: no assemblyManager available, skipping.');
            return false;
        }

        try {
            await this._assembly.updateAssembly(op.payload);
            return true;
        } catch (err) {
            console.warn('OperationDispatcher._dispatchAssemblyUpdated: updateAssembly failed', err.message);
            return false;
        }
    }


    // ------------------------------------------------------------------
    // Phase K – Handler
    // ------------------------------------------------------------------

    /**
     * Wendet eine PARTS_ALIGNED-Operation an (K.2).
     * payload: { entries: Array<{ instanceId, position: {x,y,z} }> }
     */
    async _dispatchPartsAligned(op) {
        const entries = op.payload?.entries ?? [];
        let applied = 0;
        for (const { instanceId, position } of entries) {
            const brick = this._library?.getById?.(instanceId);
            if (!brick?.group || !position) continue;
            brick.group.position.set(position.x, position.y, position.z);
            brick.group.updateMatrix?.();
            brick.group.updateMatrixWorld?.(true);
            applied++;
        }
        return applied > 0;
    }

    /**
     * Wendet eine PARTS_DUPLICATED-Operation an (K.3).
     * payload: { createdBricks: Array<{ instanceId, type, color, position, rotation }> }
     */
    async _dispatchPartsDuplicated(op) {
        if (!this._library?.addBrickFromData) return false;
        const createdBricks = op.payload?.createdBricks ?? [];
        let applied = 0;
        for (const data of createdBricks) {
            const normalized = {
                ...data,
                id: data.id ?? data.instanceId,
                type: data.type ?? data.partId,
                position: data.position,
                rotation: data.rotation ?? { x: 0, y: 0, z: 0 }
            };
            if (!normalized.id || !normalized.type || !normalized.position || this._library.hasId(normalized.id)) continue;
            try {
                addClonedPartFromData(this._library, normalized);
                applied++;
            } catch (err) {
                console.warn(`OperationDispatcher: duplicate '${normalized.id}' failed:`, err.message);
            }
        }
        return applied > 0;
    }

    /**
     * Wendet eine PARTS_REMOVED_BATCH-Operation an (K.3 Undo-Gegenstück).
     * payload: { instanceIds: string[] }
     */
    async _dispatchPartsRemovedBatch(op) {
        if (!this._library) return false;
        let applied = 0;
        for (const instanceId of (op.payload?.instanceIds ?? [])) {
            const brick = this._library.getById(instanceId);
            if (!brick) continue;
            this._library.removeBrick(brick);
            applied++;
        }
        return applied > 0;
    }

    /**
     * Wendet eine PATTERN_CREATED-Operation an (K.3).
     * Delegiert an PARTS_DUPLICATED (gleiche Struktur, reicherer Payload).
     */
    async _dispatchPatternCreated(op) {
        return this._dispatchPartsDuplicated(op);
    }

    /**
     * Sperrt eine Baugruppe auf allen Clients (K.5).
     * payload: { assemblyId: string }
     */
    async _dispatchAssemblyLocked(op) {
        const { assemblyId } = op.payload ?? {};
        if (!assemblyId) return false;

        // Delegiert an assemblyEditingManager falls vorhanden
        const aem = this._assemblyEditingManager;
        if (aem?.lockAssembly) {
            aem.lockAssembly({ id: assemblyId }, { broadcast: false });
            return true;
        }

        console.debug(`OperationDispatcher._dispatchAssemblyLocked: no assemblyEditingManager, ignoring lock for "${assemblyId}".`);
        return false;
    }

    /**
     * Entsperrt eine Baugruppe auf allen Clients (K.5).
     * payload: { assemblyId: string }
     */
    async _dispatchAssemblyUnlocked(op) {
        const { assemblyId } = op.payload ?? {};
        if (!assemblyId) return false;

        const aem = this._assemblyEditingManager;
        if (aem?.unlockAssembly) {
            aem.unlockAssembly({ id: assemblyId }, { broadcast: false });
            return true;
        }

        console.debug(`OperationDispatcher._dispatchAssemblyUnlocked: no assemblyEditingManager, ignoring unlock for "${assemblyId}".`);
        return false;
    }
}
