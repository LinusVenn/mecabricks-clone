import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Polyfills für window, HTMLInputElement, HTMLTextAreaElement
if (typeof globalThis.window         === 'undefined') globalThis.window         = { addEventListener: () => {} };
if (typeof globalThis.HTMLInputElement   === 'undefined') globalThis.HTMLInputElement   = class {};
if (typeof globalThis.HTMLTextAreaElement === 'undefined') globalThis.HTMLTextAreaElement = class {};

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

});
