/**
 * Integrationstests – Baugruppen (Phase 8.9)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GroupManager } from '../src/editor/GroupManager.js';

// GroupManager.createGroup(bricks, name) – erster Arg sind Brick-Objekte mit .id
function makeFakeBrick(id) {
    return { id };
}


describe('GroupManager – Baugruppen-Integration', () => {

    let gm;

    beforeEach(() => {
        gm = new GroupManager();
    });

    it('createGroup erstellt eine Gruppe mit generierter ID', () => {
        const g = gm.createGroup(
            [makeFakeBrick('b1'), makeFakeBrick('b2')],
            'Testgruppe'
        );
        assert.ok(g.id);
        assert.strictEqual(g.name, 'Testgruppe');
        assert.ok(g.brickIds.includes('b1'));
        assert.ok(g.brickIds.includes('b2'));
    });

    it('getGroupByBrickId gibt Gruppe für enthaltenen Stein zurück', () => {
        gm.createGroup([makeFakeBrick('b1'), makeFakeBrick('b2')], 'G1');
        const g = gm.getGroupByBrickId('b1');
        assert.ok(g);
        assert.strictEqual(g.name, 'G1');
    });

    it('getGroupByBrickId gibt null zurück wenn kein Stein bekannt', () => {
        assert.strictEqual(gm.getGroupByBrickId('unknown'), null);
    });

    it('ungroup entfernt die Gruppe (Steine bleiben erhalten)', () => {
        const g = gm.createGroup([makeFakeBrick('b3')], 'G2');
        gm.ungroup(g.id);
        assert.strictEqual(gm.getGroupByBrickId('b3'), null);
    });

    it('deleteGroup löscht die Gruppe', () => {
        const g = gm.createGroup([makeFakeBrick('b4')], 'G3');
        gm.deleteGroup(g.id);
        assert.strictEqual(gm.getGroup(g.id), null);
    });

    it('renameGroup benennt die Gruppe um', () => {
        const g = gm.createGroup([makeFakeBrick('b5')], 'Alt');
        gm.renameGroup(g.id, 'Neu');
        const found = gm.getGroupByBrickId('b5');
        assert.strictEqual(found?.name, 'Neu');
    });

    it('getAllGroups gibt alle Gruppen zurück', () => {
        gm.createGroup([makeFakeBrick('b6')], 'G1');
        gm.createGroup([makeFakeBrick('b7')], 'G2');
        const all = gm.getAllGroups();
        assert.strictEqual(all.length, 2);
    });

    it('createGroup wirft Fehler wenn keine Steine übergeben', () => {
        assert.throws(() => gm.createGroup([], 'leer'));
    });

    it('addBrickToGroup fügt Stein zur Gruppe hinzu', () => {
        const g = gm.createGroup([makeFakeBrick('b8')], 'G4');
        gm.addBrickToGroup(g.id, 'b9');
        const found = gm.getGroupByBrickId('b9');
        assert.ok(found);
        assert.strictEqual(found.id, g.id);
    });

    it('removeBrickFromGroup entfernt Stein aus der Gruppe', () => {
        const g = gm.createGroup([makeFakeBrick('b10'), makeFakeBrick('b11')], 'G5');
        gm.removeBrickFromGroup(g.id, 'b10');
        assert.strictEqual(gm.getGroupByBrickId('b10'), null);
        assert.ok(gm.getGroupByBrickId('b11'));
    });

    it('isMemberOfGroup gibt true zurück für Gruppenmitglied', () => {
        gm.createGroup([makeFakeBrick('b12')], 'G6');
        assert.strictEqual(gm.isMemberOfGroup('b12'), true);
    });

    it('isMemberOfGroup gibt false zurück für Nicht-Mitglied', () => {
        assert.strictEqual(gm.isMemberOfGroup('notInGroup'), false);
    });
});
