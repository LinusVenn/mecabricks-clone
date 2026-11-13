import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Polyfills für window, HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement
if (typeof globalThis.window               === 'undefined') globalThis.window               = { addEventListener: () => {} };
if (typeof globalThis.HTMLInputElement     === 'undefined') globalThis.HTMLInputElement     = class {};
if (typeof globalThis.HTMLTextAreaElement  === 'undefined') globalThis.HTMLTextAreaElement  = class {};
if (typeof globalThis.HTMLSelectElement    === 'undefined') globalThis.HTMLSelectElement    = class {};

import { InputManager } from '../src/editor/InputManager.js';

describe('InputManager', () => {

    let editor, manager;

    const pressKey = (key, target = {}) =>
        manager.handleKey({ key, target });

    beforeEach(() => {
        editor = {
            transformManager:  {
                rotateSelected: mock.fn(),
                setMode:        mock.fn(),
                detach:         mock.fn(),
            },
            selectionManager:  { selectedObject: { userData: { brickId: 1 } } },
            placementManager:  { cancelPlacement: mock.fn() },
            deleteSelected:    mock.fn(),
        };
        manager = new InputManager(editor);
    });

    it('Taste R ruft rotateSelected auf', () => {
        pressKey('r');
        assert.strictEqual(editor.transformManager.rotateSelected.mock.callCount(), 1);
    });

    it('Taste R (Großbuchstabe) wird ebenfalls erkannt', () => {
        pressKey('R');
        assert.strictEqual(editor.transformManager.rotateSelected.mock.callCount(), 1);
    });

    it('Taste Delete ruft deleteSelected auf', () => {
        pressKey('Delete');
        assert.strictEqual(editor.deleteSelected.mock.callCount(), 1);
    });

    it('Taste Escape setzt selectedObject auf null', () => {
        pressKey('Escape');
        assert.strictEqual(editor.selectionManager.selectedObject, null);
    });

    it('Taste Escape ruft transformManager.detach auf', () => {
        pressKey('Escape');
        assert.strictEqual(editor.transformManager.detach.mock.callCount(), 1);
    });

    it('Taste G setzt Modus auf translate', () => {
        pressKey('g');
        assert.strictEqual(editor.transformManager.setMode.mock.callCount(), 1);
        assert.strictEqual(editor.transformManager.setMode.mock.calls[0].arguments[0], 'translate');
    });

    it('Taste V ruft cancelPlacement und detach auf', () => {
        pressKey('v');
        assert.strictEqual(editor.placementManager.cancelPlacement.mock.callCount(), 1);
        assert.strictEqual(editor.transformManager.detach.mock.callCount(), 1);
        assert.strictEqual(editor.selectionManager.selectedObject, null);
    });

    it('Taste in einem Eingabefeld (HTMLInputElement) wird ignoriert', () => {
        pressKey('r', new globalThis.HTMLInputElement());
        assert.strictEqual(editor.transformManager.rotateSelected.mock.callCount(), 0);
    });

    it('unbekannte Tasten lösen keine Aktion aus', () => {
        pressKey('x');
        assert.strictEqual(editor.transformManager.rotateSelected.mock.callCount(), 0);
        assert.strictEqual(editor.deleteSelected.mock.callCount(), 0);
    });


    // ── Phase-6-Erweiterungen ─────────────────────────────────────────────────

    describe('Phase 6 – Strg/Cmd-Kombinationen', () => {

        let editorFull;
        let mgr;

        const pressCtrl = (key, shift = false) =>
            mgr.handleKey({ key, ctrlKey: true, metaKey: false, shiftKey: shift,
                            preventDefault: () => {}, target: {} });

        beforeEach(() => {
            editorFull = {
                transformManager:       { rotateSelected: mock.fn(), setMode: mock.fn(), detach: mock.fn() },
                selectionManager:       { selectedObject: null },
                placementManager:       { cancelPlacement: mock.fn() },
                deleteSelected:         mock.fn(),
                groupSelected:          mock.fn(),
                ungroupSelected:        mock.fn(),
                copySelected:           mock.fn(),
                pasteSelected:          mock.fn(),
                duplicateSelected:      mock.fn(),
                multiSelectionManager:  { hasSelection: () => false, clearSelection: mock.fn() },
                groupTransformManager:  { rotateSelection: mock.fn(), detach: mock.fn() },
            };
            mgr = new InputManager(editorFull);
        });

        it('Strg+G ruft groupSelected() auf', () => {
            pressCtrl('g');
            assert.strictEqual(editorFull.groupSelected.mock.callCount(), 1);
        });

        it('Strg+Shift+G ruft ungroupSelected() auf', () => {
            pressCtrl('g', true);
            assert.strictEqual(editorFull.ungroupSelected.mock.callCount(), 1);
        });

        it('Strg+Shift+G ruft NICHT groupSelected() auf', () => {
            pressCtrl('g', true);
            assert.strictEqual(editorFull.groupSelected.mock.callCount(), 0);
        });

        it('Strg+C ruft copySelected() auf', () => {
            pressCtrl('c');
            assert.strictEqual(editorFull.copySelected.mock.callCount(), 1);
        });

        it('Strg+V ruft pasteSelected() auf', () => {
            pressCtrl('v');
            assert.strictEqual(editorFull.pasteSelected.mock.callCount(), 1);
        });

        it('Strg+D ruft duplicateSelected() auf', () => {
            pressCtrl('d');
            assert.strictEqual(editorFull.duplicateSelected.mock.callCount(), 1);
        });

        it('Strg-Kombination in Eingabefeld wird ignoriert', () => {
            mgr.handleKey({ key: 'g', ctrlKey: true, shiftKey: false,
                            preventDefault: () => {}, target: new globalThis.HTMLInputElement() });
            assert.strictEqual(editorFull.groupSelected.mock.callCount(), 0);
        });
    });


    describe('Phase 6 – Taste R mit Mehrfachauswahl', () => {

        let editorMulti;
        let mgrMulti;

        beforeEach(() => {
            editorMulti = {
                transformManager:       { rotateSelected: mock.fn(), setMode: mock.fn(), detach: mock.fn() },
                selectionManager:       { selectedObject: null },
                placementManager:       { cancelPlacement: mock.fn() },
                deleteSelected:         mock.fn(),
                multiSelectionManager:  { hasSelection: () => true, clearSelection: mock.fn() },
                groupTransformManager:  { rotateSelection: mock.fn(), detach: mock.fn() },
            };
            mgrMulti = new InputManager(editorMulti);
        });

        it('R mit Mehrfachauswahl ruft groupTransformManager.rotateSelection() auf', () => {
            mgrMulti.handleKey({ key: 'r', ctrlKey: false, shiftKey: false, target: {} });
            assert.strictEqual(editorMulti.groupTransformManager.rotateSelection.mock.callCount(), 1);
        });

        it('R mit Mehrfachauswahl ruft NICHT transformManager.rotateSelected() auf', () => {
            mgrMulti.handleKey({ key: 'r', ctrlKey: false, shiftKey: false, target: {} });
            assert.strictEqual(editorMulti.transformManager.rotateSelected.mock.callCount(), 0);
        });
    });


    describe('Phase 6 – Escape und V löschen Mehrfachauswahl', () => {

        let editorEsc;
        let mgrEsc;

        beforeEach(() => {
            editorEsc = {
                transformManager:       { rotateSelected: mock.fn(), setMode: mock.fn(), detach: mock.fn() },
                selectionManager:       { selectedObject: { userData: { brickId: 1 } } },
                placementManager:       { cancelPlacement: mock.fn() },
                deleteSelected:         mock.fn(),
                multiSelectionManager:  { hasSelection: () => true, clearSelection: mock.fn() },
                groupTransformManager:  { rotateSelection: mock.fn(), detach: mock.fn() },
            };
            mgrEsc = new InputManager(editorEsc);
        });

        it('Escape ruft multiSelectionManager.clearSelection() auf', () => {
            mgrEsc.handleKey({ key: 'Escape', ctrlKey: false, shiftKey: false, target: {} });
            assert.strictEqual(editorEsc.multiSelectionManager.clearSelection.mock.callCount(), 1);
        });

        it('Escape ruft groupTransformManager.detach() auf', () => {
            mgrEsc.handleKey({ key: 'Escape', ctrlKey: false, shiftKey: false, target: {} });
            assert.strictEqual(editorEsc.groupTransformManager.detach.mock.callCount(), 1);
        });

        it('V ruft multiSelectionManager.clearSelection() auf', () => {
            mgrEsc.handleKey({ key: 'v', ctrlKey: false, shiftKey: false, target: {} });
            assert.strictEqual(editorEsc.multiSelectionManager.clearSelection.mock.callCount(), 1);
        });

        it('HTMLSelectElement-Target wird ignoriert', () => {
            mgrEsc.handleKey({ key: 'Delete', ctrlKey: false, shiftKey: false,
                               target: new globalThis.HTMLSelectElement() });
            assert.strictEqual(editorEsc.deleteSelected.mock.callCount(), 0);
        });
    });

});
