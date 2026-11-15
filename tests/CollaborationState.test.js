/**
 * Tests für CollaborationState + CollaborationRole (Phase J – Kollaboration)
 *
 * Reine Wert-Objekt-Logik – keine Mocks notwendig.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    CollaborationState,
    CollaborationRole,
} from '../src/collaboration/CollaborationState.js';


// -----------------------------------------------------------------------
// Tests: CollaborationRole Konstanten
// -----------------------------------------------------------------------

describe('CollaborationRole', () => {

    it('OWNER ist definiert', () => {
        assert.ok(CollaborationRole.OWNER !== undefined);
    });

    it('EDITOR ist definiert', () => {
        assert.ok(CollaborationRole.EDITOR !== undefined);
    });

    it('VIEWER ist definiert', () => {
        assert.ok(CollaborationRole.VIEWER !== undefined);
    });

    it('Rollenwerte sind eindeutig', () => {
        const values = [CollaborationRole.OWNER, CollaborationRole.EDITOR, CollaborationRole.VIEWER];
        const unique  = new Set(values);
        assert.strictEqual(unique.size, values.length);
    });

});


// -----------------------------------------------------------------------
// Tests: CollaborationState.createLocal
// -----------------------------------------------------------------------

describe('CollaborationState.createLocal()', () => {

    it('erstellt einen Zustand', () => {
        const state = CollaborationState.createLocal();
        assert.ok(state !== null && state !== undefined);
    });

    it('hat keine Rolle (null oder undefined)', () => {
        const state = CollaborationState.createLocal();
        assert.ok(state.role === null || state.role === undefined,
            `role sollte null/undefined sein, ist aber: ${state.role}`);
    });

    it('isLocal ist true', () => {
        const state = CollaborationState.createLocal();
        assert.strictEqual(state.isLocal, true);
    });

    it('members ist ein leeres Array', () => {
        const state = CollaborationState.createLocal();
        assert.ok(Array.isArray(state.members), 'members muss ein Array sein');
        assert.strictEqual(state.members.length, 0);
    });

    it('projectId ist null oder undefined für lokale Projekte', () => {
        const state = CollaborationState.createLocal();
        assert.ok(state.projectId === null || state.projectId === undefined);
    });

});


// -----------------------------------------------------------------------
// Tests: Berechtigungsflags je Rolle
// -----------------------------------------------------------------------

describe('CollaborationState – canEdit', () => {

    it('owner kann bearbeiten', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.OWNER });
        assert.strictEqual(state.canEdit, true);
    });

    it('editor kann bearbeiten', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.EDITOR });
        assert.strictEqual(state.canEdit, true);
    });

    it('viewer kann nicht bearbeiten', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.VIEWER });
        assert.strictEqual(state.canEdit, false);
    });

    it('ohne Rolle kann nicht bearbeitet werden', () => {
        const state = CollaborationState.createLocal();
        assert.strictEqual(state.canEdit, false);
    });

});

describe('CollaborationState – canView', () => {

    it('owner kann ansehen', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.OWNER });
        assert.strictEqual(state.canView, true);
    });

    it('viewer kann ansehen', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.VIEWER });
        assert.strictEqual(state.canView, true);
    });

});

describe('CollaborationState – canManage', () => {

    it('owner kann verwalten', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.OWNER });
        assert.strictEqual(state.canManage, true);
    });

    it('editor kann nicht verwalten', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.EDITOR });
        assert.strictEqual(state.canManage, false);
    });

    it('viewer kann nicht verwalten', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.VIEWER });
        assert.strictEqual(state.canManage, false);
    });

});


// -----------------------------------------------------------------------
// Tests: with() – unveränderliche Updates
// -----------------------------------------------------------------------

describe('CollaborationState.with()', () => {

    it('with() erstellt einen neuen Zustand', () => {
        const original = CollaborationState.createLocal();
        const updated  = original.with({ role: CollaborationRole.EDITOR });
        assert.notStrictEqual(original, updated);
    });

    it('with() mutiert das Original nicht', () => {
        const original = CollaborationState.createLocal();
        original.with({ role: CollaborationRole.OWNER });
        assert.ok(
            original.role === null || original.role === undefined,
            'Original darf nicht mutiert werden'
        );
    });

    it('with() setzt das angegebene Feld', () => {
        const state = CollaborationState.createLocal().with({ role: CollaborationRole.EDITOR });
        assert.strictEqual(state.role, CollaborationRole.EDITOR);
    });

    it('with() behält nicht geänderte Felder bei', () => {
        const withProject = CollaborationState.createLocal().with({ projectId: 'proj-1' });
        const withRole    = withProject.with({ role: CollaborationRole.VIEWER });
        assert.strictEqual(withRole.projectId, 'proj-1');
    });

    it('with() kann members aktualisieren', () => {
        const members = [
            { userId: 'u1', role: CollaborationRole.OWNER },
            { userId: 'u2', role: CollaborationRole.EDITOR },
        ];
        const state = CollaborationState.createLocal().with({ members });
        assert.strictEqual(state.members.length, 2);
    });

});


// -----------------------------------------------------------------------
// Tests: toJSON / fromJSON Roundtrip
// -----------------------------------------------------------------------

describe('CollaborationState toJSON / fromJSON', () => {

    it('toJSON gibt ein serialisierbares Objekt zurück', () => {
        const state = CollaborationState.createLocal()
            .with({ role: CollaborationRole.OWNER, projectId: 'proj-42' });
        const json = state.toJSON();
        assert.ok(typeof json === 'object' && json !== null);
        // Muss JSON-serialisierbar sein
        assert.doesNotThrow(() => JSON.stringify(json));
    });

    it('fromJSON stellt den Zustand wieder her', () => {
        const original = CollaborationState.createLocal()
            .with({ role: CollaborationRole.EDITOR, projectId: 'proj-99' });
        const json      = original.toJSON();
        const restored  = CollaborationState.fromJSON(json);
        assert.strictEqual(restored.role,      original.role);
        assert.strictEqual(restored.projectId, original.projectId);
    });

    it('fromJSON Roundtrip für canEdit', () => {
        const original = CollaborationState.createLocal().with({ role: CollaborationRole.EDITOR });
        const restored = CollaborationState.fromJSON(original.toJSON());
        assert.strictEqual(restored.canEdit, true);
    });

    it('fromJSON Roundtrip für canManage', () => {
        const original = CollaborationState.createLocal().with({ role: CollaborationRole.OWNER });
        const restored = CollaborationState.fromJSON(original.toJSON());
        assert.strictEqual(restored.canManage, true);
    });

});
