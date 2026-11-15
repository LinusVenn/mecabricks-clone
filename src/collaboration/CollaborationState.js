// =====================================================================
// CollaborationState – Phase J (Collaboration)
//
// Immutable value object that describes the current collaboration session.
// All mutations return a new instance (immutable update pattern via .with()).
//
// Member shape:
//   { userId: string, displayName: string, role: string, isOnline: boolean }
// =====================================================================


/**
 * The role a user can hold in a project.
 * @readonly
 * @enum {string}
 */
export const CollaborationRole = Object.freeze({
    OWNER:  'owner',
    EDITOR: 'editor',
    VIEWER: 'viewer',
});


export class CollaborationState {

    /**
     * @param {{
     *   projectId:      string|null
     *   role:           string|null   – one of CollaborationRole or null (local session)
     *   isConnected:    boolean
     *   members:        Array<{userId:string,displayName:string,role:string,isOnline:boolean}>
     *   sequenceNumber: number|null   – last confirmed server sequence number
     * }} params
     */
    constructor({
        projectId      = null,
        role           = null,
        isConnected    = false,
        members        = [],
        sequenceNumber = null,
    } = {}) {
        this._projectId      = projectId;
        this._role           = role;
        this._isConnected    = isConnected;
        this._members        = Object.freeze(members.map(m => Object.freeze({ ...m })));
        this._sequenceNumber = sequenceNumber;

        Object.freeze(this);
    }


    // ------------------------------------------------------------------
    // Accessors
    // ------------------------------------------------------------------

    /** @returns {string|null} */
    get projectId()      { return this._projectId; }

    /** @returns {string|null} */
    get role()           { return this._role; }

    /** @returns {boolean} */
    get isConnected()    { return this._isConnected; }

    /**
     * List of all project members (including current user).
     * @returns {ReadonlyArray<{userId:string,displayName:string,role:string,isOnline:boolean}>}
     */
    get members()        { return this._members; }

    /** @returns {number|null} */
    get sequenceNumber() { return this._sequenceNumber; }


    // ------------------------------------------------------------------
    // Derived permission flags
    // ------------------------------------------------------------------

    /** True if the current user can modify the project content. */
    get canEdit()           { return [CollaborationRole.OWNER, CollaborationRole.EDITOR].includes(this._role); }

    /** True if the current user can manage members and sharing. */
    get canManage()         { return this._role === CollaborationRole.OWNER; }

    /** True if the current user has any project access at all. */
    get canView()           { return !!this._role; }

    /** True if the current user can restore a previous version. */
    get canRestoreVersion() { return this._role === CollaborationRole.OWNER; }


    // ------------------------------------------------------------------
    // Immutable update
    // ------------------------------------------------------------------

    /**
     * Return a new CollaborationState with the supplied fields overridden.
     * All other fields are inherited from the current instance.
     *
     * @param {{
     *   projectId?:      string|null
     *   role?:           string|null
     *   isConnected?:    boolean
     *   members?:        object[]
     *   sequenceNumber?: number|null
     * }} updates
     * @returns {CollaborationState}
     */
    with(updates) {
        return new CollaborationState({
            projectId:      'projectId'      in updates ? updates.projectId      : this._projectId,
            role:           'role'           in updates ? updates.role           : this._role,
            isConnected:    'isConnected'    in updates ? updates.isConnected    : this._isConnected,
            members:        'members'        in updates ? updates.members        : Array.from(this._members),
            sequenceNumber: 'sequenceNumber' in updates ? updates.sequenceNumber : this._sequenceNumber,
        });
    }


    // ------------------------------------------------------------------
    // Serialisation
    // ------------------------------------------------------------------

    /** @returns {object} Plain JSON-serialisable object. */
    toJSON() {
        return {
            projectId:      this._projectId,
            role:           this._role,
            isConnected:    this._isConnected,
            members:        Array.from(this._members),
            sequenceNumber: this._sequenceNumber,
        };
    }

    /**
     * Reconstruct a CollaborationState from a plain object (e.g., from JSON.parse).
     * @param {object} json
     * @returns {CollaborationState}
     */
    static fromJSON(json) {
        return new CollaborationState({
            projectId:      json.projectId      ?? null,
            role:           json.role           ?? null,
            isConnected:    json.isConnected    ?? false,
            members:        json.members        ?? [],
            sequenceNumber: json.sequenceNumber ?? null,
        });
    }

    /**
     * Create the initial state for a local (non-collaborative) editing session.
     * projectId is null, role is null, isConnected is false.
     *
     * @returns {CollaborationState}
     */
    static createLocal() {
        return new CollaborationState({
            projectId:      null,
            role:           null,  // local session has no collaboration role
            isConnected:    false,
            members:        [],
            sequenceNumber: null,
        });
    }
}

