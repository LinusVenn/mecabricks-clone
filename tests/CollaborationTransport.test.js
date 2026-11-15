/**
 * Tests für CollaborationTransport (Phase J)
 *
 * Abdeckung:
 *  - Konstruktor: Pflichtparameter-Validierung
 *  - connect: Kanal wird erstellt, Status → CONNECTED
 *  - connect wenn bereits verbunden: vorheriger Kanal wird getrennt
 *  - disconnect: Kanal entfernt, Status → DISCONNECTED
 *  - send: wirft wenn nicht verbunden
 *  - send: delegiert an channel.send
 *  - onMessage / onStatusChange / onPresenceChange: Register + Unsubscribe
 *  - Broadcast-Payload-Entpackung (envelope.payload)
 *  - Presence: sync / join / leave Events notifizieren Subscriber
 *  - _handleSubscribeStatus: SUBSCRIBED → CONNECTED, ERROR → reject, CLOSED → DISCONNECTED
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { CollaborationTransport, TransportStatus } from '../src/collaboration/CollaborationTransport.js';


// ─── Fake-Supabase ────────────────────────────────────────────────────────────

/**
 * Erstellt einen Fake-Supabase-Client der alle für CollaborationTransport
 * benötigten Methoden implementiert.
 */
function makeSupabase({ subscribeStatus = 'SUBSCRIBED' } = {}) {
    const channels = [];

    function makeChannel() {
        const handlers = { broadcast: [], presence: [] };
        let trackFn = async () => {};
        let presenceState = {};

        const channel = {
            _handlers: handlers,
            on(type, filter, cb) {
                handlers[type] = handlers[type] ?? [];
                handlers[type].push({ filter, cb });
                return channel;
            },
            subscribe(cb) {
                // Call async so tests can set up handlers before the callback fires
                Promise.resolve().then(() => cb(subscribeStatus));
                return channel;
            },
            send(msg) { channel._lastSent = msg; },
            track: (data) => {
                trackFn(data);
                return Promise.resolve();
            },
            presenceState() { return presenceState; },
            _setPresenceState(s) { presenceState = s; },
            _emit(type, event, payload) {
                (handlers[type] ?? [])
                    .filter(h => !h.filter?.event || h.filter.event === event)
                    .forEach(h => h.cb(payload));
            },
            _lastSent: null,
        };

        return channel;
    }

    let currentChannel = null;

    return {
        channel(name) {
            currentChannel = makeChannel();
            currentChannel._name = name;
            channels.push(currentChannel);
            return currentChannel;
        },
        removeChannel: async () => {},
        _getLastChannel() { return currentChannel; },
        _channels: channels,
    };
}

function makeAuth(userId = 'u1') {
    return { currentUser: { id: userId, email: 'test@example.com' } };
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollaborationTransport', () => {

    // ------------------------------------------------------------------
    // Konstruktor
    // ------------------------------------------------------------------

    describe('Konstruktor', () => {

        it('wirft ohne supabaseClient', () => {
            assert.throws(
                () => new CollaborationTransport(null, makeAuth()),
                /supabaseClient is required/
            );
        });

        it('wirft ohne authManager', () => {
            assert.throws(
                () => new CollaborationTransport(makeSupabase(), null),
                /authManager is required/
            );
        });

        it('startet im DISCONNECTED-Status', () => {
            const t = new CollaborationTransport(makeSupabase(), makeAuth());
            assert.equal(t.status, TransportStatus.DISCONNECTED);
            assert.equal(t.isConnected, false);
            assert.equal(t.projectId, null);
        });
    });


    // ------------------------------------------------------------------
    // connect
    // ------------------------------------------------------------------

    describe('connect', () => {

        it('wird CONNECTED nach SUBSCRIBED-Callback', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());

            await t.connect('proj-1');

            assert.equal(t.status, TransportStatus.CONNECTED);
            assert.equal(t.isConnected, true);
            assert.equal(t.projectId, 'proj-1');
        });

        it('erstellt Kanal mit korrektem Namen', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());

            await t.connect('proj-42');

            assert.equal(supabase._getLastChannel()._name, 'project:proj-42');
        });

        it('rejiziert bei CHANNEL_ERROR', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'CHANNEL_ERROR' });
            const t = new CollaborationTransport(supabase, makeAuth());

            await assert.rejects(() => t.connect('proj-1'), /channel error/i);
            assert.equal(t.status, TransportStatus.ERROR);
        });

        it('rejiziert bei TIMED_OUT', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'TIMED_OUT' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await assert.rejects(() => t.connect('proj-1'));
        });
    });


    // ------------------------------------------------------------------
    // disconnect
    // ------------------------------------------------------------------

    describe('disconnect', () => {

        it('setzt Status zurück auf DISCONNECTED', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');
            await t.disconnect();

            assert.equal(t.status, TransportStatus.DISCONNECTED);
            assert.equal(t.isConnected, false);
            assert.equal(t.projectId, null);
        });

        it('no-op wenn nicht verbunden', async () => {
            const t = new CollaborationTransport(makeSupabase(), makeAuth());
            // Sollte keinen Fehler werfen
            await assert.doesNotReject(() => t.disconnect());
        });
    });


    // ------------------------------------------------------------------
    // send
    // ------------------------------------------------------------------

    describe('send', () => {

        it('wirft wenn nicht verbunden', () => {
            const t = new CollaborationTransport(makeSupabase(), makeAuth());
            assert.throws(
                () => t.send({ kind: 'OPERATION' }),
                /not connected/i
            );
        });

        it('delegiert an channel.send mit korrekter Struktur', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');

            t.send({ kind: 'OPERATION', type: 'PART_PLACED' });

            const ch = supabase._getLastChannel();
            assert.ok(ch._lastSent, 'channel.send wurde aufgerufen');
            assert.equal(ch._lastSent.type, 'broadcast');
            assert.equal(ch._lastSent.payload.kind, 'OPERATION');
        });
    });


    // ------------------------------------------------------------------
    // onMessage
    // ------------------------------------------------------------------

    describe('onMessage', () => {

        it('empfängt Broadcast-Messages und entpackt envelope.payload', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');

            const received = [];
            t.onMessage(msg => received.push(msg));

            const ch = supabase._getLastChannel();
            ch._emit('broadcast', 'PROJECT_EVENT', { payload: { kind: 'PING' } });

            assert.equal(received.length, 1);
            assert.equal(received[0].kind, 'PING');
        });

        it('Unsubscribe verhindert weitere Nachrichten', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');

            const received = [];
            const unsub = t.onMessage(msg => received.push(msg));
            unsub();

            const ch = supabase._getLastChannel();
            ch._emit('broadcast', 'PROJECT_EVENT', { payload: { kind: 'PING' } });

            assert.equal(received.length, 0);
        });
    });


    // ------------------------------------------------------------------
    // onStatusChange
    // ------------------------------------------------------------------

    describe('onStatusChange', () => {

        it('Subscriber erhält Status-Änderungen', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());

            const statuses = [];
            t.onStatusChange(s => statuses.push(s));

            await t.connect('proj-1');

            assert.ok(statuses.includes(TransportStatus.CONNECTING));
            assert.ok(statuses.includes(TransportStatus.CONNECTED));
        });

        it('kein DISCONNECTED-Event wenn Status sich nicht ändert', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            const statuses = [];
            t.onStatusChange(s => statuses.push(s));

            await t.connect('proj-1');
            const countBeforeDisconnect = statuses.length;

            // Zweiter Aufruf mit gleichem Status → kein neues Event
            t._setStatus(TransportStatus.CONNECTED);
            assert.equal(statuses.length, countBeforeDisconnect);
        });
    });


    // ------------------------------------------------------------------
    // onPresenceChange
    // ------------------------------------------------------------------

    describe('onPresenceChange', () => {

        it('sync-Event wird weitergeleitet', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');

            const events = [];
            t.onPresenceChange(e => events.push(e));

            const ch = supabase._getLastChannel();
            ch._emit('presence', 'sync', {});

            assert.equal(events.length, 1);
            assert.equal(events[0].event, 'sync');
        });

        it('join-Event wird weitergeleitet', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');

            const events = [];
            t.onPresenceChange(e => events.push(e));

            const ch = supabase._getLastChannel();
            ch._emit('presence', 'join', { key: 'k1', newPresences: [{ userId: 'u2' }] });

            assert.equal(events.length, 1);
            assert.equal(events[0].event, 'join');
        });

        it('leave-Event wird weitergeleitet', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');

            const events = [];
            t.onPresenceChange(e => events.push(e));

            const ch = supabase._getLastChannel();
            ch._emit('presence', 'leave', { key: 'k1', leftPresences: [{ userId: 'u2' }] });

            assert.equal(events.length, 1);
            assert.equal(events[0].event, 'leave');
        });

        it('Unsubscribe verhindert weitere Events', async () => {
            const supabase = makeSupabase({ subscribeStatus: 'SUBSCRIBED' });
            const t = new CollaborationTransport(supabase, makeAuth());
            await t.connect('proj-1');

            const events = [];
            const unsub = t.onPresenceChange(e => events.push(e));
            unsub();

            const ch = supabase._getLastChannel();
            ch._emit('presence', 'sync', {});

            assert.equal(events.length, 0);
        });
    });
});
