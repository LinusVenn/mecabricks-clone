/**
 * @file DuplicateCommand.js
 * Exports DuplicateCommand and PatternCommand for duplicating bricks or
 * creating repeated patterns. Both support full undo/redo and collab ops.
 */

import { Command } from './Command.js';

/**
 * @typedef {object} BrickData
 * @property {string} id
 * @property {string} type
 * @property {string} color
 * @property {{ x: number, y: number, z: number }} position
 * @property {{ x: number, y: number, z: number }} rotation
 */

// ---------------------------------------------------------------------------
// DuplicateCommand
// ---------------------------------------------------------------------------

/**
 * Creates new bricks from data on execute() and removes them on undo().
 * @extends Command
 */
export class DuplicateCommand extends Command {
  /**
   * @param {object}                  params
   * @param {BrickData[]}             params.createdBricks  - Brick data to add.
   * @param {function(string): void}  params.removeFn       - Removes a brick by id.
   * @param {function(BrickData): object} params.addFn      - Adds a brick from data, returns brick.
   * @param {string}                  [params.description]  - Human-readable label.
   */
  constructor({ createdBricks, removeFn, addFn, description = 'Duplicate' }) {
    super();

    /** @type {BrickData[]} */
    this.createdBricks = createdBricks;

    /** @type {function(string): void} */
    this.removeFn = removeFn;

    /** @type {function(BrickData): object} */
    this.addFn = addFn;

    /** @type {string} */
    this.description = description;

    /**
     * Brick instances created by the most recent execute().
     * @type {object[]}
     */
    this._added = [];
  }

  /**
   * Adds each brick from createdBricks data.
   * @returns {Promise<void>}
   */
  async execute() {
    this._added = [];
    for (const brickData of this.createdBricks) {
      const brick = this.addFn(brickData);
      this._added.push(brick);
    }
  }

  /**
   * Removes all bricks that were created during execute().
   * @returns {Promise<void>}
   */
  async undo() {
    for (const brickData of this.createdBricks) {
      this.removeFn(brickData.id);
    }
    this._added = [];
  }

  /**
   * Collaboration operation for the forward duplicate.
   * @returns {{ type: string, payload: object }}
   */
  toOperation() {
    return {
      type: 'PARTS_DUPLICATED',
      payload: { createdBricks: this.createdBricks },
    };
  }

  /**
   * Collaboration operation for the undo (batch removal).
   * @returns {{ type: string, payload: object }}
   */
  toUndoOperation() {
    return {
      type: 'PARTS_REMOVED_BATCH',
      payload: { instanceIds: this.createdBricks.map((b) => b.id) },
    };
  }
}

// ---------------------------------------------------------------------------
// PatternCommand
// ---------------------------------------------------------------------------

/**
 * Like DuplicateCommand but carries a patternConfig and reports
 * a PATTERN_CREATED operation type.
 * @extends Command
 */
export class PatternCommand extends Command {
  /**
   * @param {object}                  params
   * @param {BrickData[]}             params.createdBricks  - Brick data to add.
   * @param {function(string): void}  params.removeFn       - Removes a brick by id.
   * @param {function(BrickData): object} params.addFn      - Adds a brick from data, returns brick.
   * @param {object}                  params.patternConfig  - Pattern configuration metadata.
   * @param {string}                  [params.description]  - Human-readable label.
   */
  constructor({ createdBricks, removeFn, addFn, patternConfig, description = 'Create Pattern' }) {
    super();

    /** @type {BrickData[]} */
    this.createdBricks = createdBricks;

    /** @type {function(string): void} */
    this.removeFn = removeFn;

    /** @type {function(BrickData): object} */
    this.addFn = addFn;

    /** @type {object} */
    this.patternConfig = patternConfig;

    /** @type {string} */
    this.description = description;

    /**
     * Brick instances created by the most recent execute().
     * @type {object[]}
     */
    this._added = [];
  }

  /**
   * Adds each brick from createdBricks data.
   * @returns {Promise<void>}
   */
  async execute() {
    this._added = [];
    for (const brickData of this.createdBricks) {
      const brick = this.addFn(brickData);
      this._added.push(brick);
    }
  }

  /**
   * Removes all bricks that were created during execute().
   * @returns {Promise<void>}
   */
  async undo() {
    for (const brickData of this.createdBricks) {
      this.removeFn(brickData.id);
    }
    this._added = [];
  }

  /**
   * Collaboration operation for the forward pattern creation.
   * @returns {{ type: string, payload: object }}
   */
  toOperation() {
    return {
      type: 'PATTERN_CREATED',
      payload: {
        createdBricks: this.createdBricks,
        patternConfig: this.patternConfig,
      },
    };
  }

  /**
   * Collaboration operation for the undo (batch removal).
   * @returns {{ type: string, payload: object }}
   */
  toUndoOperation() {
    return {
      type: 'PARTS_REMOVED_BATCH',
      payload: { instanceIds: this.createdBricks.map((b) => b.id) },
    };
  }
}
