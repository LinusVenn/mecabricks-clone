// =====================================================================
// ConflictManager – Phase J (Collaboration)
//
// Detects and resolves conflicts between incoming remote operations and
// pending local (unacknowledged) operations.
//
// Conflict detection rules:
//   1. Different targets                     -> no conflict -> APPLY
//   2. PART_REMOVED + any op on same part    -> PART_REMOVED wins -> SKIP the other
//   3. PART_TRANSFORMED + PART_TRANSFORMED on same part (different props) -> MERGE
//   4. COLOR_CHANGE + COLOR_CHANGE on same part -> last writer wins -> APPLY/SKIP by seq
// =====================================================================

import { OperationType } from './OperationQueue.js';

export const ConflictResolution = Object.freeze({
    APPLY:    'apply',    // apply the incoming operation as-is
    SKIP:     'skip',     // discard the incoming operation (obsolete / overridden)
    MERGE:    'merge',    // both ops modify different properties – both should apply
    ASK_USER: 'ask_user', // ambiguous – surface to the user for a decision
});


/** Operations that target a specific part instance. */
const PART_OPS = new Set([
    OperationType.PART_PLACED,
    OperationType.PART_REMOVED,
    OperationType.PART_TRANSFORMED,
    OperationType.PART_COLOR_CHANGED,
    OperationType.PART_VARIANT_CHANGED,
]);

/** Operations that target a specific group. */
const GROUP_OPS = new Set([
    OperationType.GROUP_CREATED,
    OperationType.GROUP_UPDATED,
    OperationType.GROUP_REMOVED,
]);

/** Operations that target a specific connection. */
const CONNECTION_OPS = new Set([
    OperationType.CONNECTION_CREATED,
    OperationType.CONNECTION_REMOVED,
]);


export class ConflictManager {

    constructor() {
        // stateless – no constructor arguments required
    }


    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Check whether an incoming remote operation conflicts with any of the
     * pending local (unacknowledged) operations.
     *
     * Returns the most severe ConflictResolution found across all pending ops.
     * Priority: ASK_USER > SKIP > MERGE > APPLY
     *
     * @param {import('./OperationQueue.js').Operation} incomingOp
     * @param {import('./OperationQueue.js').Operation[]} pendingLocalOps
     * @returns {ConflictResolution}
     */
    checkConflict(incomingOp, pendingLocalOps) {
        if (!pendingLocalOps || pendingLocalOps.length === 0) {
            return ConflictResolution.APPLY;
        }

        let result = ConflictResolution.APPLY;

        for (const localOp of pendingLocalOps) {
            if (!this._sameTarget(incomingOp, localOp)) continue;

            const resolution = this.resolve(incomingOp, localOp);

            // Escalate to the most severe result
            result = this._escalate(result, resolution);

            if (result === ConflictResolution.ASK_USER) break; // can't get worse
        }

        return result;
    }

    /**
     * Resolve a direct conflict between an incoming operation and ONE local op
     * that targets the same resource.
     *
     * @param {import('./OperationQueue.js').Operation} incomingOp
     * @param {import('./OperationQueue.js').Operation} conflictingLocalOp
     * @returns {ConflictResolution}
     */
    resolve(incomingOp, conflictingLocalOp) {
        const inType  = incomingOp.type;
        const locType = conflictingLocalOp.type;

        // ── Rule 2: DELETE always wins ──────────────────────────────────
        if (inType === OperationType.PART_REMOVED) {
            // Incoming DELETE: the part is being removed remotely.
            // Any local op that assumed the part exists should be skipped.
            return ConflictResolution.APPLY;   // incoming delete → apply it
        }
        if (locType === OperationType.PART_REMOVED) {
            // Local DELETE: we have already deleted the part locally.
            // Incoming non-delete on the same part is now obsolete.
            return ConflictResolution.SKIP;
        }

        // ── Rule 6: GROUP_REMOVED wins ──────────────────────────────────
        if (inType === OperationType.GROUP_REMOVED) {
            return ConflictResolution.APPLY;
        }
        if (locType === OperationType.GROUP_REMOVED && GROUP_OPS.has(inType)) {
            return ConflictResolution.SKIP;
        }

        // ── Rule 3/4: TRANSFORM + TRANSFORM or COLOR + COLOR  ──────────
        if (inType === locType) {
            if (
                inType === OperationType.PART_TRANSFORMED ||
                inType === OperationType.PART_COLOR_CHANGED ||
                inType === OperationType.PART_VARIANT_CHANGED
            ) {
                return this._lastWriterWins(incomingOp, conflictingLocalOp);
            }
        }

        // ── Rule 5: TRANSFORM + COLOR (orthogonal properties) ──────────
        const orthogonalPairs = [
            [OperationType.PART_TRANSFORMED, OperationType.PART_COLOR_CHANGED],
            [OperationType.PART_TRANSFORMED, OperationType.PART_VARIANT_CHANGED],
            [OperationType.PART_COLOR_CHANGED, OperationType.PART_VARIANT_CHANGED],
        ];
        for (const [a, b] of orthogonalPairs) {
            if ((inType === a && locType === b) || (inType === b && locType === a)) {
                return ConflictResolution.MERGE;
            }
        }

        // ── Fallback: ambiguous ─────────────────────────────────────────
        return ConflictResolution.ASK_USER;
    }

    /**
     * Returns true if an operation's target resource no longer exists in the
     * current scene state.  Used to quickly discard stale operations.
     *
     * @param {import('./OperationQueue.js').Operation} operation
     * @param {{ existingInstanceIds: Set<string>, existingGroupIds: Set<string> }} currentState
     * @returns {boolean}
     */
    isObsolete(operation, currentState) {
        const { existingInstanceIds = new Set(), existingGroupIds = new Set() } = currentState ?? {};

        if (PART_OPS.has(operation.type) && operation.type !== OperationType.PART_PLACED) {
            const instanceId = operation.payload?.instanceId;
            if (instanceId && !existingInstanceIds.has(instanceId)) {
                return true;
            }
        }

        if (GROUP_OPS.has(operation.type) && operation.type !== OperationType.GROUP_CREATED) {
            const groupId = operation.payload?.groupId;
            if (groupId && !existingGroupIds.has(groupId)) {
                return true;
            }
        }

        return false;
    }


    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /**
     * Returns true if two operations target the same resource.
     *
     * @param {import('./OperationQueue.js').Operation} a
     * @param {import('./OperationQueue.js').Operation} b
     * @returns {boolean}
     */
    _sameTarget(a, b) {
        // Must act on the same project
        if (a.projectId !== b.projectId) return false;

        // Part-level targeting
        if (PART_OPS.has(a.type) && PART_OPS.has(b.type)) {
            const idA = a.payload?.instanceId;
            const idB = b.payload?.instanceId;
            return idA && idB && idA === idB;
        }

        // Group-level targeting
        if (GROUP_OPS.has(a.type) && GROUP_OPS.has(b.type)) {
            const idA = a.payload?.groupId;
            const idB = b.payload?.groupId;
            return idA && idB && idA === idB;
        }

        // Connection-level targeting
        if (CONNECTION_OPS.has(a.type) && CONNECTION_OPS.has(b.type)) {
            const idA = a.payload?.connectionId;
            const idB = b.payload?.connectionId;
            return idA && idB && idA === idB;
        }

        // Assembly – only one assembly per project; any two assembly ops conflict
        if (a.type === OperationType.ASSEMBLY_UPDATED && b.type === OperationType.ASSEMBLY_UPDATED) {
            return true;
        }

        return false;
    }

    /**
     * Last-writer-wins resolution based on sequence numbers.
     * Higher sequence number = more recent = wins.
     * If both are unacknowledged (null), the incoming op wins (optimistic).
     *
     * @param {import('./OperationQueue.js').Operation} incomingOp
     * @param {import('./OperationQueue.js').Operation} localOp
     * @returns {ConflictResolution}
     */
    _lastWriterWins(incomingOp, localOp) {
        const seqIn  = incomingOp.sequenceNumber;
        const seqLoc = localOp.sequenceNumber;

        if (seqIn === null && seqLoc === null) return ConflictResolution.APPLY;
        if (seqIn === null)  return ConflictResolution.SKIP;   // local is confirmed; incoming is older
        if (seqLoc === null) return ConflictResolution.APPLY;  // incoming is confirmed; local is pending

        return seqIn >= seqLoc ? ConflictResolution.APPLY : ConflictResolution.SKIP;
    }

    /**
     * Returns the "higher priority" resolution of two.
     * Priority: ASK_USER (4) > SKIP (3) > MERGE (2) > APPLY (1)
     *
     * @param {ConflictResolution} current
     * @param {ConflictResolution} candidate
     * @returns {ConflictResolution}
     */
    _escalate(current, candidate) {
        const priority = {
            [ConflictResolution.APPLY]:    1,
            [ConflictResolution.MERGE]:    2,
            [ConflictResolution.SKIP]:     3,
            [ConflictResolution.ASK_USER]: 4,
        };
        return (priority[candidate] ?? 0) > (priority[current] ?? 0) ? candidate : current;
    }
}
