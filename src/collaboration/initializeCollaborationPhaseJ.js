// =====================================================================
// initializeCollaborationPhaseJ – Phase J (Collaboration)
//
// Factory / wiring function that instantiates every collaboration
// sub-manager and connects them together, returning a ready-to-use
// CollaborationManager plus the individual sub-managers for direct
// access by the UI layer.
//
// Usage (in main.js or App.js):
//
//   const collab = await initializeCollaborationPhaseJ({
//       supabaseClient,
//       authManager,
//       projectManager,
//       cloudSyncManager,
//       editor,
//       library,
//       connectionManager,
//       groupManager,
//       assemblyManager,
//   });
//
//   // Then join a project:
//   await collab.collaborationManager.joinProject(projectId);
// =====================================================================

import { PermissionManager }   from './PermissionManager.js';
import { SharingManager }      from './SharingManager.js';
import { VersionManager }      from './VersionManager.js';
import { OperationQueue }      from './OperationQueue.js';
import { CollaborationTransport } from './CollaborationTransport.js';
import { OperationDispatcher } from './OperationDispatcher.js';
import { ConflictManager }     from './ConflictManager.js';
import { PresenceManager }     from './PresenceManager.js';
import { CollaborationManager } from './CollaborationManager.js';


/**
 * Instantiate and wire all Phase J collaboration modules.
 *
 * @param {{
 *   supabaseClient:   object   – Supabase JS client (from createClient)
 *   authManager:      import('../auth/AuthManager.js').AuthManager
 *   projectManager:   object   – local ProjectManager
 *   cloudSyncManager: object   – CloudSyncManager from Phase I
 *   editor:           object   – 3D editor with addPart, removePart, etc.
 *   library:          object   – PartLibrary
 *   connectionManager: object  – manages brick connections
 *   groupManager:     object   – manages brick groups
 *   assemblyManager:  object   – manages named assemblies
 *   operationQueueOptions?: { maxSize?: number }
 * }} options
 *
 * @returns {Promise<{
 *   collaborationManager: CollaborationManager
 *   sharingManager:       SharingManager
 *   versionManager:       VersionManager
 *   permissionManager:    PermissionManager
 *   presenceManager:      PresenceManager
 * }>}
 */
export async function initializeCollaborationPhaseJ({
    supabaseClient,
    authManager,
    projectManager,
    cloudSyncManager,
    editor,
    library,
    connectionManager,
    groupManager,
    assemblyManager,
    operationQueueOptions = {},
}) {
    // ── Validate required dependencies ─────────────────────────────────
    if (!supabaseClient) throw new Error('initializeCollaborationPhaseJ: supabaseClient is required.');
    if (!authManager)    throw new Error('initializeCollaborationPhaseJ: authManager is required.');

    // ── 1. PermissionManager ────────────────────────────────────────────
    const permissionManager = new PermissionManager(supabaseClient);

    // ── 2. SharingManager ──────────────────────────────────────────────
    const sharingManager = new SharingManager(supabaseClient, permissionManager);

    // ── 3. VersionManager ──────────────────────────────────────────────
    const versionManager = new VersionManager(supabaseClient, permissionManager);

    // ── 4. OperationQueue ──────────────────────────────────────────────
    const operationQueue = new OperationQueue({
        maxSize: operationQueueOptions.maxSize ?? 100,
    });

    // ── 5. CollaborationTransport ──────────────────────────────────────
    const transport = new CollaborationTransport(supabaseClient, authManager);

    // ── 6. OperationDispatcher ─────────────────────────────────────────
    const dispatcher = new OperationDispatcher({
        editor,
        library,
        connectionManager,
        groupManager,
        assemblyManager,
    });

    // ── 7. ConflictManager ─────────────────────────────────────────────
    const conflictManager = new ConflictManager();

    // ── 8. PresenceManager ─────────────────────────────────────────────
    const presenceManager = new PresenceManager(transport, authManager);

    // ── 9. CollaborationManager (top-level coordinator) ────────────────
    const collaborationManager = new CollaborationManager({
        supabaseClient,
        authManager,
        projectManager,
        cloudSyncManager,
        permissionManager,
        sharingManager,
        versionManager,
        operationQueue,
        transport,
        dispatcher,
        conflictManager,
        presenceManager,
    });

    return {
        collaborationManager,
        sharingManager,
        versionManager,
        permissionManager,
        presenceManager,
    };
}
