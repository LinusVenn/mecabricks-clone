/**
 * server/index.js – Phase J (Collaboration) Server Entry Point
 *
 * Starts an Express HTTP server and attaches:
 *   • REST API routes  (sharing, invitations, versions)
 *   • WebSocket server (real-time collaboration rooms)
 *
 * Environment variables required:
 *   PORT                    – HTTP port (default: 3001)
 *   SUPABASE_URL            – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Supabase service-role key (server-side only)
 *
 * Usage:
 *   node server/index.js
 */

import http                from 'node:http';
import express             from 'express';
import { createClient }    from '@supabase/supabase-js';

import { sharingRoutes }    from './routes/sharingRoutes.js';
import { invitationRoutes } from './routes/invitationRoutes.js';
import { versionRoutes }    from './routes/versionRoutes.js';

import { SharingService }    from './services/SharingService.js';
import { InvitationService } from './services/InvitationService.js';
import { VersionService }    from './services/VersionService.js';
import { PermissionService } from './services/PermissionService.js';
import { ActivityService }   from './services/ActivityService.js';

import { ProjectRoomManager } from './websocket/ProjectRoomManager.js';
import { MessageValidator }   from './websocket/MessageValidator.js';
import { MessageRouter }      from './websocket/MessageRouter.js';
import { PresenceService }    from './websocket/PresenceService.js';
import { WebSocketServer }    from './websocket/WebSocketServer.js';


// ── 1. Configuration ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[server] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
    process.exit(1);
}


// ── 2. Supabase admin client (service-role key, never sent to the browser) ───

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});


// ── 3. Services ───────────────────────────────────────────────────────────────

const permissionService  = new PermissionService(supabaseAdmin);
const activityService    = new ActivityService(supabaseAdmin);
const sharingService     = new SharingService(supabaseAdmin, permissionService, activityService);
const invitationService  = new InvitationService(supabaseAdmin, permissionService, activityService);
const versionService     = new VersionService(supabaseAdmin, permissionService);


// ── 4. Express app ────────────────────────────────────────────────────────────

const app = express();

app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// REST API
app.use('/api/sharing',     sharingRoutes(sharingService, permissionService));
app.use('/api/invitations', invitationRoutes(invitationService, permissionService));
app.use('/api/versions',    versionRoutes(versionService, permissionService));

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));


// ── 5. WebSocket layer ────────────────────────────────────────────────────────

const presenceService    = new PresenceService();
const projectRoomManager = new ProjectRoomManager(presenceService);
const messageValidator   = new MessageValidator();
const messageRouter      = new MessageRouter({
    projectRoomManager,
    permissionService,
    messageValidator,
    activityService,
});

const httpServer = http.createServer(app);

const wss = new WebSocketServer({
    server:              httpServer,
    supabaseAdminClient: supabaseAdmin,
    permissionService,
    projectRoomManager,
    messageRouter,
    path: '/ws',
});


// ── 6. Start ──────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
    console.log(`[server] HTTP  listening on http://localhost:${PORT}`);
    console.log(`[server] WS    listening on ws://localhost:${PORT}/ws`);
});

wss.start();


// ── 7. Graceful shutdown ──────────────────────────────────────────────────────

async function shutdown(signal) {
    console.info(`[server] Received ${signal}, shutting down…`);

    await wss.stop();

    httpServer.close(() => {
        console.info('[server] HTTP server closed.');
        process.exit(0);
    });

    // Force-exit after 10 s if connections are still open
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
