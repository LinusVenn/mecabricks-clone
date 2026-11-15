/**
 * Tests für PresenceManager (Phase J)
 *
 * Abdeckung:
 *  - Konstruktor: Pflichtparameter-Validierung
 *  - start: Presence-Listener registriert, _trackSelf aufgerufen
 *  - stop: Listener entfernt, users geleert, Subscriber benachrichtigt
 *  - updateSelection: lokale Map aktualisiert + transport.trackPresence
 *  - _handlePresenceSync: User-Map wird komplett neu aufgebaut
 *  - _handlePresenceJoin: neue User werden hinzugefügt
 *  - _handlePresenceLeave: User wird als offline markiert (nicht entfernt)
 *  - onlineUsers: gibt korrekte Liste zurück
 *  - subscribe / unsubscribe
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { PresenceManager } from '../src/collaboration/PresenceManager.js';


// ─── Fake-Infrastruktur ────────────────────────────────────────────────────────

function makeTransport(connected = true) {
    const presenceHandlers = new Set();
    return {
        isConnected: connected,
        trackPresence: mock.fn(async () => {}),
        onPresenceChange: (cb) => {
            presenceHandlers.add(cb);
            return () => presenceHandlers.delete(cb);
        },
        _emitPresence: (event) => presenceHandlers.forEach(cb => cb(event)),
    };
}

function makeAuth(userId = 'u1', email = 'alice@example.com') {
    return { currentUser: { id: userId, email } };
}


// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PresenceManager', () => {

    // ------------------------------------------------------------------
    // Konstruktor
    // ------------------------------------------------------------------

    describe('Konstruktor', () => {

        it('wirft ohne transport', () => {
            assert.throws(
                () => new PresenceManager(null, makeAuth()),
                /transport is required/
            );
        });

        it('wirft ohne authManager', () => {
            assert.throws(
                () => new PresenceManager(makeTransport(), null),
                /authManager is required/
            );
        });

        it('startet mit leerer onlineUsers-Liste', () => {
            const pm = new PresenceManager(makeTransport(), makeAuth());
            assert.deepEqual(pm.onlineUsers, []);
        });
    });


    // ------------------------------------------------------------------
    // start / stop
    // ------------------------------------------------------------------

    describe('start', () => {

        it('registriert Presence-Listener beim Transport', () => {
            const transport = makeTransport();
            const pm = new PresenceManager(transport, makeAuth());

            // Spy on onPresenceChange
            let registered = false;
            const origOnPresenceChange = transport.onPresenceChange.bind(transport);
            transport.onPresenceChange = (cb) => { registered = true; return origOnPresenceChange(cb); };

            pm.start('proj-1');
            assert.equal(registered, true);
        });

        it('ruft transport.trackPresence für aktuellen User auf (isConnected=true)', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth('u1', 'alice@example.com'));

            pm.start('proj-1');

            assert.equal(transport.trackPresence.mock.calls.length, 1);
            const payload = transport.trackPresence.mock.calls[0].arguments[0];
            assert.equal(payload.userId, 'u1');
        });

        it('kein trackPresence wenn Transport nicht verbunden', () => {
            const transport = makeTransport(false);
            const pm = new PresenceManager(transport, makeAuth());

            pm.start('proj-1');

            assert.equal(transport.trackPresence.mock.calls.length, 0);
        });
    });


    describe('stop', () => {

        it('löscht alle User und benachrichtigt Subscriber', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());

            pm.start('proj-1');
            // Simuliere einen join
            transport._emitPresence({
                event: 'join',
                presences: [{ userId: 'u2', displayName: 'Bob' }],
            });

            const notifications = [];
            pm.subscribe(users => notifications.push([...users]));

            pm.stop();

            assert.deepEqual(pm.onlineUsers, []);
            // Letzte Benachrichtigung ist die leere Liste
            const last = notifications[notifications.length - 1];
            assert.deepEqual(last, []);
        });
    });


    // ------------------------------------------------------------------
    // updateSelection
    // ------------------------------------------------------------------

    describe('updateSelection', () => {

        it('aktualisiert lokale Map sofort', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth('u1'));

            pm.start('proj-1');
            // User zunächst in Map eintragen (via sync)
            transport._emitPresence({
                event: 'sync',
                state: {
                    key1: [{ userId: 'u1', displayName: 'Alice' }],
                },
            });

            pm.updateSelection('brick-42');

            const user = pm.onlineUsers.find(u => u.userId === 'u1');
            assert.equal(user?.selectedInstanceId, 'brick-42');
        });

        it('ruft transport.trackPresence mit neuer Selektion auf', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth('u1'));

            pm.start('proj-1');
            transport.trackPresence.mock.resetCalls?.();

            pm.updateSelection('brick-99');

            assert.equal(transport.trackPresence.mock.calls.length >= 1, true);
            const lastCall = transport.trackPresence.mock.calls[transport.trackPresence.mock.calls.length - 1];
            assert.equal(lastCall.arguments[0].selectedInstanceId, 'brick-99');
        });

        it('no-op wenn kein currentUser', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, { currentUser: null });

            pm.start('proj-1');
            transport.trackPresence.mock.resetCalls?.();

            pm.updateSelection('brick-1'); // sollte keinen Fehler werfen

            assert.equal(transport.trackPresence.mock.calls.length, 0);
        });
    });


    // ------------------------------------------------------------------
    // Presence-Events
    // ------------------------------------------------------------------

    describe('_handlePresenceSync', () => {

        it('baut User-Map komplett neu auf', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());

            pm.start('proj-1');

            transport._emitPresence({
                event: 'sync',
                state: {
                    key1: [{ userId: 'u2', displayName: 'Bob' }],
                    key2: [{ userId: 'u3', displayName: 'Carol' }],
                },
            });

            const users = pm.onlineUsers;
            assert.equal(users.length, 2);
            assert.ok(users.some(u => u.userId === 'u2'));
            assert.ok(users.some(u => u.userId === 'u3'));
        });

        it('überschreibt vorherige User-Map', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());

            pm.start('proj-1');

            transport._emitPresence({
                event: 'sync',
                state: { k1: [{ userId: 'u2', displayName: 'Bob' }] },
            });
            assert.equal(pm.onlineUsers.length, 1);

            // Zweites sync – komplett neuer Stand
            transport._emitPresence({
                event: 'sync',
                state: { k2: [{ userId: 'u3', displayName: 'Carol' }] },
            });
            assert.equal(pm.onlineUsers.length, 1);
            assert.equal(pm.onlineUsers[0].userId, 'u3');
        });
    });


    describe('_handlePresenceJoin', () => {

        it('fügt neue User zur Map hinzu', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());

            pm.start('proj-1');

            transport._emitPresence({
                event: 'join',
                presences: [
                    { userId: 'u2', displayName: 'Bob' },
                    { userId: 'u3', displayName: 'Carol' },
                ],
            });

            const users = pm.onlineUsers;
            assert.equal(users.length, 2);
            assert.ok(users.every(u => u.isOnline === true));
        });

        it('Subscriber wird benachrichtigt', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());
            pm.start('proj-1');

            const received = [];
            pm.subscribe(users => received.push(users.length));

            transport._emitPresence({
                event: 'join',
                presences: [{ userId: 'u2', displayName: 'Bob' }],
            });

            assert.ok(received.length > 0);
            assert.equal(received[received.length - 1], 1);
        });
    });


    describe('_handlePresenceLeave', () => {

        it('markiert User als offline (nicht löschen)', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());

            pm.start('proj-1');

            transport._emitPresence({
                event: 'join',
                presences: [{ userId: 'u2', displayName: 'Bob' }],
            });

            transport._emitPresence({
                event: 'leave',
                presences: [{ userId: 'u2' }],
            });

            const users = pm.onlineUsers;
            // User bleibt in der Liste, aber als offline
            assert.equal(users.length, 1);
            assert.equal(users[0].userId, 'u2');
            assert.equal(users[0].isOnline, false);
            assert.ok(users[0].lastSeen);
        });

        it('Subscriber wird benachrichtigt', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());
            pm.start('proj-1');

            transport._emitPresence({
                event: 'join',
                presences: [{ userId: 'u2', displayName: 'Bob' }],
            });

            const received = [];
            pm.subscribe(users => received.push(users.map(u => u.isOnline)));

            transport._emitPresence({
                event: 'leave',
                presences: [{ userId: 'u2' }],
            });

            const lastSnapshot = received[received.length - 1];
            assert.ok(lastSnapshot.includes(false));
        });
    });


    // ------------------------------------------------------------------
    // subscribe / unsubscribe
    // ------------------------------------------------------------------

    describe('subscribe', () => {

        it('Unsubscribe verhindert weitere Benachrichtigungen', () => {
            const transport = makeTransport(true);
            const pm = new PresenceManager(transport, makeAuth());
            pm.start('proj-1');

            const received = [];
            const unsub = pm.subscribe(users => received.push(users));
            unsub();

            transport._emitPresence({
                event: 'join',
                presences: [{ userId: 'u2', displayName: 'Bob' }],
            });

            assert.equal(received.length, 0);
        });
    });
});
