import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MultiSelectionManager } from '../src/editor/MultiSelectionManager.js';

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

/**
 * Erstellt ein Brick-Mock mit echter THREE.Group, damit _addHighlight()
 * korrekt funktioniert (group.add wird benötigt).
 */
function makeBrick(id, width = 2, depth = 1, height = 1.2) {
    const group = new THREE.Group();
    group.userData.brickId = id;
    return { id, width, depth, height, group };
}

/** Minimaler Library-Stub für getSelectedBricks() */
function makeLibrary(bricks = []) {
    const map = new Map(bricks.map(b => [b.id, b]));
    return { getById: (id) => map.get(id) ?? null };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('MultiSelectionManager', () => {

    let msm;

    beforeEach(() => {
        msm = new MultiSelectionManager();
    });


    // ── Konstruktor ──────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('startet ohne ausgewählte Steine', () => {
            assert.strictEqual(msm.getSelectionCount(), 0);
        });

        it('hasSelection() ist false', () => {
            assert.strictEqual(msm.hasSelection(), false);
        });

        it('getSelectedIds() gibt leeres Array zurück', () => {
            assert.deepStrictEqual(msm.getSelectedIds(), []);
        });

        it('onSelectionChanged ist null', () => {
            assert.strictEqual(msm.onSelectionChanged, null);
        });
    });


    // ── addSelection ─────────────────────────────────────────────────────────

    describe('addSelection()', () => {

        it('fügt einen Stein zur Auswahl hinzu', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            assert.strictEqual(msm.getSelectionCount(), 1);
        });

        it('getSelectedIds() enthält die ID', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            assert.ok(msm.getSelectedIds().includes('b1'));
        });

        it('ruft onSelectionChanged auf', () => {
            let called = 0;
            msm.onSelectionChanged = () => called++;
            msm.addSelection(makeBrick('b1'));
            assert.strictEqual(called, 1);
        });

        it('übergibt die aktuellen IDs an onSelectionChanged', () => {
            let ids = [];
            msm.onSelectionChanged = (arr) => { ids = arr; };
            msm.addSelection(makeBrick('b1'));
            assert.ok(ids.includes('b1'));
        });

        it('ignoriert null ohne Crash', () => {
            assert.doesNotThrow(() => msm.addSelection(null));
            assert.strictEqual(msm.getSelectionCount(), 0);
        });

        it('doppeltes Hinzufügen erhöht Anzahl nicht', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            msm.addSelection(b);
            assert.strictEqual(msm.getSelectionCount(), 1);
        });

        it('doppeltes Hinzufügen feuert Callback nur einmal', () => {
            let called = 0;
            msm.onSelectionChanged = () => called++;
            const b = makeBrick('b1');
            msm.addSelection(b);
            msm.addSelection(b);
            assert.strictEqual(called, 1);
        });

        it('fügt Highlight-LineSegments dem brick.group hinzu', () => {
            const b = makeBrick('b1');
            const before = b.group.children.length;
            msm.addSelection(b);
            assert.ok(b.group.children.length > before, 'Kein Highlight hinzugefügt');
        });

        it('Highlight hat userData.isHighlight = true', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            const highlight = b.group.children.find(c => c.userData?.isHighlight);
            assert.ok(highlight !== undefined, 'Kein isHighlight-Objekt gefunden');
        });
    });


    // ── removeSelection ───────────────────────────────────────────────────────

    describe('removeSelection()', () => {

        it('entfernt einen Stein aus der Auswahl', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            msm.removeSelection(b);
            assert.strictEqual(msm.getSelectionCount(), 0);
        });

        it('ruft onSelectionChanged auf', () => {
            let called = 0;
            const b = makeBrick('b1');
            msm.addSelection(b);
            msm.onSelectionChanged = () => called++;
            msm.removeSelection(b);
            assert.strictEqual(called, 1);
        });

        it('ignoriert nicht-ausgewählten Stein ohne Crash', () => {
            assert.doesNotThrow(() => msm.removeSelection(makeBrick('b99')));
        });

        it('ignoriert null ohne Crash', () => {
            assert.doesNotThrow(() => msm.removeSelection(null));
        });

        it('entfernt das Highlight aus brick.group', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            msm.removeSelection(b);
            const highlight = b.group.children.find(c => c.userData?.isHighlight);
            assert.strictEqual(highlight, undefined);
        });
    });


    // ── toggleSelection ───────────────────────────────────────────────────────

    describe('toggleSelection()', () => {

        it('fügt hinzu wenn nicht ausgewählt', () => {
            const b = makeBrick('b1');
            msm.toggleSelection(b);
            assert.strictEqual(msm.isSelected(b), true);
        });

        it('entfernt wenn bereits ausgewählt', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            msm.toggleSelection(b);
            assert.strictEqual(msm.isSelected(b), false);
        });

        it('zweifaches Toggle gibt ursprünglichen Zustand zurück', () => {
            const b = makeBrick('b1');
            msm.toggleSelection(b);
            msm.toggleSelection(b);
            assert.strictEqual(msm.isSelected(b), false);
        });
    });


    // ── setSelection ──────────────────────────────────────────────────────────

    describe('setSelection()', () => {

        it('ersetzt die gesamte Auswahl', () => {
            msm.addSelection(makeBrick('b1'));
            const b2 = makeBrick('b2');
            const b3 = makeBrick('b3');
            msm.setSelection([b2, b3]);
            assert.deepStrictEqual(msm.getSelectedIds().sort(), ['b2', 'b3'].sort());
        });

        it('alte Auswahl wird entfernt (Highlights)', () => {
            const b1 = makeBrick('b1');
            msm.addSelection(b1);
            const b2 = makeBrick('b2');
            msm.setSelection([b2]);
            // b1 sollte kein Highlight mehr haben
            const hl = b1.group.children.find(c => c.userData?.isHighlight);
            assert.strictEqual(hl, undefined);
        });

        it('übergibt neue IDs an onSelectionChanged', () => {
            let ids = [];
            msm.onSelectionChanged = (arr) => { ids = arr; };
            msm.setSelection([makeBrick('b5'), makeBrick('b6')]);
            assert.ok(ids.includes('b5'));
            assert.ok(ids.includes('b6'));
        });

        it('leere Liste leert die Auswahl', () => {
            msm.addSelection(makeBrick('b1'));
            msm.setSelection([]);
            assert.strictEqual(msm.getSelectionCount(), 0);
        });

        it('ignoriert null-Elemente in der Liste', () => {
            msm.setSelection([null, makeBrick('b1'), null]);
            assert.strictEqual(msm.getSelectionCount(), 1);
        });
    });


    // ── clearSelection ────────────────────────────────────────────────────────

    describe('clearSelection()', () => {

        it('leert die Auswahl', () => {
            msm.addSelection(makeBrick('b1'));
            msm.addSelection(makeBrick('b2'));
            msm.clearSelection();
            assert.strictEqual(msm.getSelectionCount(), 0);
        });

        it('feuert onSelectionChanged mit leerem Array', () => {
            let ids = ['initial'];
            msm.onSelectionChanged = (arr) => { ids = arr; };
            msm.addSelection(makeBrick('b1'));
            msm.clearSelection();
            assert.deepStrictEqual(ids, []);
        });

        it('entfernt alle Highlights', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            msm.addSelection(b1);
            msm.addSelection(b2);
            msm.clearSelection();
            assert.strictEqual(b1.group.children.filter(c => c.userData?.isHighlight).length, 0);
            assert.strictEqual(b2.group.children.filter(c => c.userData?.isHighlight).length, 0);
        });

        it('zweifaches clearSelection wirft keinen Fehler', () => {
            assert.doesNotThrow(() => {
                msm.clearSelection();
                msm.clearSelection();
            });
        });
    });


    // ── isSelected / getSelectionCount / hasSelection ──────────────────────────

    describe('isSelected() / getSelectionCount() / hasSelection()', () => {

        it('isSelected() gibt true zurück für ausgewählten Stein', () => {
            const b = makeBrick('b1');
            msm.addSelection(b);
            assert.strictEqual(msm.isSelected(b), true);
        });

        it('isSelected() gibt false zurück für nicht-ausgewählten Stein', () => {
            assert.strictEqual(msm.isSelected(makeBrick('b1')), false);
        });

        it('getSelectionCount() zählt exakt', () => {
            msm.addSelection(makeBrick('b1'));
            msm.addSelection(makeBrick('b2'));
            assert.strictEqual(msm.getSelectionCount(), 2);
        });

        it('hasSelection() true wenn mindestens ein Stein ausgewählt', () => {
            msm.addSelection(makeBrick('b1'));
            assert.strictEqual(msm.hasSelection(), true);
        });

        it('hasSelection() false nach clearSelection()', () => {
            msm.addSelection(makeBrick('b1'));
            msm.clearSelection();
            assert.strictEqual(msm.hasSelection(), false);
        });
    });


    // ── getSelectedBricks ─────────────────────────────────────────────────────

    describe('getSelectedBricks(library)', () => {

        it('gibt Brick-Instanzen aus der Library zurück', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            const lib = makeLibrary([b1, b2]);
            msm.addSelection(b1);
            msm.addSelection(b2);
            const bricks = msm.getSelectedBricks(lib);
            assert.strictEqual(bricks.length, 2);
        });

        it('überspringt IDs die in der Library nicht mehr vorhanden sind', () => {
            const b1 = makeBrick('b1');
            const lib = makeLibrary([b1]);
            msm.addSelection(b1);
            // b2 wird hinzugefügt aber ist nicht in lib
            msm.addSelection(makeBrick('b2'));
            const bricks = msm.getSelectedBricks(lib);
            assert.strictEqual(bricks.length, 1);
            assert.strictEqual(bricks[0].id, 'b1');
        });

        it('gibt leeres Array zurück wenn keine Auswahl', () => {
            assert.deepStrictEqual(msm.getSelectedBricks(makeLibrary()), []);
        });
    });


    // ── disposeAllHighlights ──────────────────────────────────────────────────

    describe('disposeAllHighlights()', () => {

        it('entfernt alle Highlights und leert Auswahl', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            msm.addSelection(b1);
            msm.addSelection(b2);
            msm.disposeAllHighlights();
            assert.strictEqual(msm.getSelectionCount(), 0);
            const hl1 = b1.group.children.find(c => c.userData?.isHighlight);
            const hl2 = b2.group.children.find(c => c.userData?.isHighlight);
            assert.strictEqual(hl1, undefined);
            assert.strictEqual(hl2, undefined);
        });

        it('kein Crash bei leerem Zustand', () => {
            assert.doesNotThrow(() => msm.disposeAllHighlights());
        });
    });

});
