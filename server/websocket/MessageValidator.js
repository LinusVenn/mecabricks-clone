/**
 * MessageValidator.js
 *
 * Validates the shape of incoming WebSocket messages before they are
 * dispatched to handlers.
 *
 * Every valid message must conform to the base envelope:
 *   {
 *     type:      string         (non-empty)
 *     projectId: string         (UUID v4)
 *     messageId: string         (UUID v4)
 *     clientId:  string         (UUID v4)
 *     payload?:  object         (optional, type-dependent)
 *   }
 *
 * Payload validation is type-specific — call the appropriate
 * `validateXxx(payload)` method after routing on `type`.
 */

/** Regex for UUID v4 validation. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function isUUID(v) {
    return typeof v === 'string' && UUID_RE.test(v);
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

/**
 * @typedef {{ valid: boolean, errors: string[] }} ValidationResult
 */

export class MessageValidator {
    // ----------------------------------------------------------------
    // Base envelope
    // ----------------------------------------------------------------

    /**
     * Validate the common message envelope.
     *
     * @param {unknown} message
     * @returns {ValidationResult}
     */
    validate(message) {
        const errors = [];

        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return { valid: false, errors: ['Message must be a JSON object.'] };
        }

        if (!isNonEmptyString(message.type)) {
            errors.push('`type` must be a non-empty string.');
        }

        // projectId is required for all routing but JOIN_PROJECT can set it via
        // the payload; we still require it in the envelope for uniform handling.
        if (!isUUID(message.projectId)) {
            errors.push('`projectId` must be a valid UUID v4.');
        }

        if (!isUUID(message.messageId)) {
            errors.push('`messageId` must be a valid UUID v4.');
        }

        if (!isUUID(message.clientId)) {
            errors.push('`clientId` must be a valid UUID v4.');
        }

        return { valid: errors.length === 0, errors };
    }

    // ----------------------------------------------------------------
    // PROJECT_EVENT payload
    // ----------------------------------------------------------------

    /**
     * Validate the payload of a PROJECT_EVENT message.
     *
     * Expected shape:
     *   {
     *     eventType: string       (non-empty)
     *     data:      object       (non-null)
     *     version?:  number       (positive integer)
     *   }
     *
     * @param {unknown} payload
     * @returns {ValidationResult}
     */
    validateProjectEvent(payload) {
        const errors = [];

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return { valid: false, errors: ['PROJECT_EVENT payload must be an object.'] };
        }

        if (!isNonEmptyString(payload.eventType)) {
            errors.push('payload.eventType must be a non-empty string.');
        }

        if (payload.data === null || payload.data === undefined || typeof payload.data !== 'object') {
            errors.push('payload.data must be a non-null object.');
        }

        if (payload.version !== undefined) {
            if (!Number.isInteger(payload.version) || payload.version < 0) {
                errors.push('payload.version must be a non-negative integer if provided.');
            }
        }

        return { valid: errors.length === 0, errors };
    }

    // ----------------------------------------------------------------
    // PRESENCE_UPDATE payload
    // ----------------------------------------------------------------

    /**
     * Validate the payload of a PRESENCE_UPDATE message.
     *
     * All fields are optional; at least one must be present.
     *
     * Expected shape (partial):
     *   {
     *     status?:      'active'|'idle'|'away'
     *     cursor?:      { x: number, y: number, z?: number }
     *     selection?:   string[]
     *     displayName?: string
     *     color?:       string  (CSS hex, e.g. '#ff0000')
     *   }
     *
     * @param {unknown} payload
     * @returns {ValidationResult}
     */
    validatePresenceUpdate(payload) {
        const errors = [];

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return { valid: false, errors: ['PRESENCE_UPDATE payload must be an object.'] };
        }

        const keys = Object.keys(payload);
        if (keys.length === 0) {
            errors.push('PRESENCE_UPDATE payload must contain at least one field.');
        }

        if (payload.status !== undefined) {
            const validStatuses = ['active', 'idle', 'away'];
            if (!validStatuses.includes(payload.status)) {
                errors.push(`payload.status must be one of: ${validStatuses.join(', ')}.`);
            }
        }

        if (payload.cursor !== undefined) {
            if (
                !payload.cursor ||
                typeof payload.cursor !== 'object' ||
                typeof payload.cursor.x !== 'number' ||
                typeof payload.cursor.y !== 'number'
            ) {
                errors.push('payload.cursor must be an object with numeric x and y fields.');
            }
        }

        if (payload.selection !== undefined) {
            if (!Array.isArray(payload.selection) || !payload.selection.every((s) => typeof s === 'string')) {
                errors.push('payload.selection must be an array of strings.');
            }
        }

        if (payload.displayName !== undefined && typeof payload.displayName !== 'string') {
            errors.push('payload.displayName must be a string.');
        }

        if (payload.color !== undefined) {
            if (typeof payload.color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(payload.color)) {
                errors.push("payload.color must be a CSS hex colour string (e.g. '#ff0000').");
            }
        }

        return { valid: errors.length === 0, errors };
    }
}
