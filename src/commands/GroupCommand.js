/**
 * @file GroupCommand.js
 * Exports GroupCommand, UngroupCommand, and MergeGroupsCommand.
 * All extend Command and provide full undo/redo + collaboration op export.
 */

import { Command } from './Command.js';

/**
 * @typedef {object} GroupDescriptor
 * @property {string}   id
 * @property {string}   name
 * @property {string[]} brickIds
 */

// ---------------------------------------------------------------------------
// GroupCommand
// ---------------------------------------------------------------------------

/**
 * Groups a set of bricks under a named group.
 * execute() calls createFn; undo() calls deleteFn.
 * @extends Command
 */
export class GroupCommand extends Command {
  /**
   * @param {object}                                    params
   * @param {object[]}                                  params.bricks      - Bricks to group.
   * @param {string}                                    params.groupName   - Display name.
   * @param {function(object[], string): object}        params.createFn    - Creates and returns group.
   * @param {function(string): void}                    params.deleteFn    - Deletes group by id.
   * @param {string}                                    [params.description]
   */
  constructor({ bricks, groupName, createFn, deleteFn, description = 'Group' }) {
    super();

    /** @type {object[]} */
    this.bricks = bricks;

    /** @type {string} */
    this.groupName = groupName;

    /** @type {function(object[], string): object} */
    this.createFn = createFn;

    /** @type {function(string): void} */
    this.deleteFn = deleteFn;

    /** @type {string} */
    this.description = description;

    /**
     * The group object returned by createFn, populated after execute().
     * @type {object|null}
     */
    this._group = null;
  }

  /**
   * Creates the group and stores it in this._group.
   * @returns {Promise<void>}
   */
  async execute() {
    this._group = this.createFn(this.bricks, this.groupName, this._group?.id);
  }

  /**
   * Deletes the previously created group.
   * @returns {Promise<void>}
   */
  async undo() {
    if (this._group !== null && this._group !== undefined) {
      this.deleteFn(this._group.id);
    }
  }

  /**
   * Collaboration operation for group creation.
   * @returns {{ type: string, payload: object }}
   */
  toOperation() {
    return {
      type: 'GROUP_CREATED',
      payload: {
        groupId: this._group ? this._group.id : null,
        name: this.groupName,
        instanceIds: this.bricks.map((b) => b.id),
      },
    };
  }

  /**
   * Collaboration operation for undo (group deletion).
   * @returns {{ type: string, payload: object }}
   */
  toUndoOperation() {
    return {
      type: 'GROUP_REMOVED',
      payload: {
        groupId: this._group ? this._group.id : null,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// UngroupCommand
// ---------------------------------------------------------------------------

/**
 * Dissolves an existing group back to individual bricks.
 * execute() calls ungroupFn; undo() re-creates the group via createFn.
 * @extends Command
 */
export class UngroupCommand extends Command {
  /**
   * @param {object}                             params
   * @param {GroupDescriptor}                    params.group       - The group to dissolve.
   * @param {function(string): void}             params.ungroupFn   - Dissolves group by id.
   * @param {function(object[], string): object} params.createFn    - Re-creates group.
   * @param {object}                             params.library     - Brick library for re-lookup.
   * @param {string}                             [params.description]
   */
  constructor({ group, ungroupFn, createFn, library, description = 'Ungroup' }) {
    super();

    /** @type {GroupDescriptor} */
    this.group = group;

    /** @type {function(string): void} */
    this.ungroupFn = ungroupFn;

    /** @type {function(object[], string): object} */
    this.createFn = createFn;

    /** @type {object} */
    this.library = library;

    /** @type {string} */
    this.description = description;

    /**
     * The restored group created during undo(), or null.
     * @type {object|null}
     */
    this._restoredGroup = null;
  }

  /**
   * Dissolves the group.
   * @returns {Promise<void>}
   */
  async execute() {
    this.ungroupFn(this.group.id);
    this._restoredGroup = null;
  }

  /**
   * Re-creates the group from the stored brickIds.
   * @returns {Promise<void>}
   */
  async undo() {
    const bricks = this.group.brickIds
      .map((id) => this.library.getById(id))
      .filter((b) => b !== null && b !== undefined);

    this._restoredGroup = this.createFn(bricks, this.group.name, this.group.id);
  }

  /**
   * Collaboration operation for dissolving the group.
   * @returns {{ type: string, payload: object }}
   */
  toOperation() {
    return {
      type: 'GROUP_REMOVED',
      payload: { groupId: this.group.id },
    };
  }

  /**
   * Collaboration operation for undoing (re-creating the group).
   * @returns {{ type: string, payload: object }}
   */
  toUndoOperation() {
    return {
      type: 'GROUP_CREATED',
      payload: {
        groupId: this._restoredGroup ? this._restoredGroup.id : null,
        name: this.group.name,
        instanceIds: this.group.brickIds,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// MergeGroupsCommand
// ---------------------------------------------------------------------------

/**
 * Merges multiple groups into a single new group.
 * execute() calls mergeFn; undo() calls splitFn.
 * @extends Command
 */
export class MergeGroupsCommand extends Command {
  /**
   * @param {object}                                   params
   * @param {GroupDescriptor[]}                        params.groups        - Groups to merge.
   * @param {string}                                   params.newGroupName  - Name for merged group.
   * @param {function(GroupDescriptor[]): object}      params.mergeFn       - Creates merged group.
   * @param {function(string, GroupDescriptor[]): void} params.splitFn      - Splits merged group back.
   * @param {string}                                   [params.description]
   */
  constructor({ groups, newGroupName, mergeFn, splitFn, description = 'Merge Groups' }) {
    super();

    /** @type {GroupDescriptor[]} */
    this.groups = groups;

    /** @type {string} */
    this.newGroupName = newGroupName;

    /** @type {function(GroupDescriptor[]): object} */
    this.mergeFn = mergeFn;

    /** @type {function(string, GroupDescriptor[]): void} */
    this.splitFn = splitFn;

    /** @type {string} */
    this.description = description;

    /**
     * The merged group returned by mergeFn, populated after execute().
     * @type {object|null}
     */
    this._mergedGroup = null;
  }

  /**
   * Merges all groups and stores the result.
   * @returns {Promise<void>}
   */
  async execute() {
    this._mergedGroup = this.mergeFn(this.groups, this._mergedGroup?.id);
  }

  /**
   * Splits the merged group back into the original groups.
   * @returns {Promise<void>}
   */
  async undo() {
    if (this._mergedGroup !== null && this._mergedGroup !== undefined) {
      this.splitFn(this._mergedGroup.id, this.groups);
    }
  }

  /**
   * Collaboration operation for the merge.
   * @returns {{ type: string, payload: object }}
   */
  toOperation() {
    return {
      type: 'GROUP_CREATED',
      payload: {
        groupId: this._mergedGroup ? this._mergedGroup.id : null,
        name: this.newGroupName,
        mergedFromIds: this.groups.map((g) => g.id),
        instanceIds: [...new Set(this.groups.flatMap(g => g.brickIds ?? []))],
      },
    };
  }

  /**
   * Collaboration operation for undoing the merge (split back).
   * @returns {{ type: string, payload: object }}
   */
  toUndoOperation() {
    return {
      type: 'GROUPS_SPLIT',
      payload: {
        mergedGroupId: this._mergedGroup ? this._mergedGroup.id : null,
        restoredGroups: this.groups.map((g) => ({ groupId: g.id, name: g.name, instanceIds: g.brickIds, parentGroupId: g.parentGroupId ?? null })),
      },
    };
  }
}

// Reversible Änderung der Gruppenhierarchie.
export class GroupHierarchyCommand extends Command {
  constructor({ groupManager, childGroupId, beforeParentId, afterParentId, description = 'Gruppenhierarchie ändern' }) {
    super(description);
    this.groupManager = groupManager;
    this.childGroupId = childGroupId;
    this.beforeParentId = beforeParentId ?? null;
    this.afterParentId = afterParentId ?? null;
  }
  async execute() { this.groupManager.setParentGroup(this.childGroupId, this.afterParentId); }
  async undo() { this.groupManager.setParentGroup(this.childGroupId, this.beforeParentId); }
  toOperation() { return { type: 'GROUP_UPDATED', payload: { groupId: this.childGroupId, updates: { parentGroupId: this.afterParentId } } }; }
  toUndoOperation() { return { type: 'GROUP_UPDATED', payload: { groupId: this.childGroupId, updates: { parentGroupId: this.beforeParentId } } }; }
}

// Mitgliedschaft eines Bauteils zwischen Gruppen verschieben bzw. entfernen.
export class GroupMembershipCommand extends Command {
  constructor({ groupManager, brickId, targetGroupId, previousGroupId = null, description = 'Gruppenmitgliedschaft ändern' }) {
    super(description);
    this.groupManager = groupManager;
    this.brickId = brickId;
    this.targetGroupId = targetGroupId ?? null;
    this.previousGroupId = previousGroupId ?? null;
  }
  async execute() {
    if (this.previousGroupId && this.previousGroupId !== this.targetGroupId) {
      this.groupManager.removeBrickFromGroup(this.previousGroupId, this.brickId);
    }
    if (this.targetGroupId) this.groupManager.addBrickToGroup(this.targetGroupId, this.brickId);
  }
  async undo() {
    if (this.targetGroupId) this.groupManager.removeBrickFromGroup(this.targetGroupId, this.brickId);
    if (this.previousGroupId) this.groupManager.addBrickToGroup(this.previousGroupId, this.brickId);
  }
  toOperation() {
    return { type: 'GROUP_MEMBERSHIP_CHANGED', payload: { brickId: this.brickId, groupId: this.targetGroupId, previousGroupId: this.previousGroupId } };
  }
  toUndoOperation() {
    return { type: 'GROUP_MEMBERSHIP_CHANGED', payload: { brickId: this.brickId, groupId: this.previousGroupId, previousGroupId: this.targetGroupId } };
  }
}
