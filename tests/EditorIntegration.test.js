/**
 * Integrationstests – Editor-Gesamtarchitektur (Phase 8.9)
 *
 * Testet, dass der Editor korrekt alle Sub-Manager initialisiert und
 * die öffentlichen Methoden vorhanden sind.
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// DOM-Polyfills
if (typeof globalThis.window === 'undefined') {
    globalThis.window = { addEventListener: () => {}, removeEventListener: () => {} };
}
if (typeof globalThis.HTMLInputElement === 'undefined')
    globalThis.HTMLInputElement = class {};
if (typeof globalThis.HTMLTextAreaElement === 'undefined')
    globalThis.HTMLTextAreaElement = class {};
if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        getElementById: () => ({
            innerHTML: '', querySelectorAll: () => [], appendChild: () => {},
            addEventListener: () => {}, disabled: false, textContent: '',
            classList: { add: () => {}, remove: () => {}, toggle: () => {} },
            style: {},
        }),
        createElement: () => ({
            textContent: '', dataset: {}, style: {},
            classList: { add: () => {}, remove: () => {}, toggle: () => {} },
            addEventListener: () => {}, appendChild: () => {}, remove: () => {},
        }),
        body: { appendChild: () => {}, removeChild: () => {} },
    };
}

import { Editor } from '../src/editor/Editor.js';

function makeSceneManager() {
    const domElement = {
        addEventListener: () => {}, removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        ownerDocument: { addEventListener: () => {}, removeEventListener: () => {} },
        style: { cursor: '' },
    };
    return {
        camera:   {
            isCamera: true, isPerspectiveCamera: true,
            matrixWorldInverse: { elements: new Float32Array(16) },
            projectionMatrix:   { elements: new Float32Array(16) },
        },
        renderer: { domElement },
        scene:    { add: mock.fn(), children: [] },
        controls: { enabled: true },
    };
}


describe('Editor – Integrationsprüfung', () => {

    let editor, library;

    beforeEach(() => {
        library = { getAll: mock.fn(() => []), addBrick: mock.fn(), removeBrick: mock.fn(), getById: mock.fn() };
        editor = new Editor(makeSceneManager(), library);
    });


    // ------------------------------------------------------------------
    // Sub-Manager vorhanden
    // ------------------------------------------------------------------

    it('selectionManager ist initialisiert', () => {
        assert.ok(editor.selectionManager);
    });

    it('transformManager ist initialisiert', () => {
        assert.ok(editor.transformManager);
    });

    it('multiSelectionManager ist initialisiert', () => {
        assert.ok(editor.multiSelectionManager);
    });

    it('groupManager ist initialisiert', () => {
        assert.ok(editor.groupManager);
    });

    it('connectionManager ist initialisiert', () => {
        assert.ok(editor.connectionManager);
    });

    it('collisionManager ist initialisiert', () => {
        assert.ok(editor.collisionManager);
    });

    it('placementManager ist initialisiert', () => {
        assert.ok(editor.placementManager);
    });

    it('groupTransformManager ist initialisiert', () => {
        assert.ok(editor.groupTransformManager);
    });

    it('assemblyManager ist initialisiert', () => {
        assert.ok(editor.assemblyManager);
    });

    it('componentLibrary ist initialisiert', () => {
        assert.ok(editor.componentLibrary);
    });

    it('componentManager ist initialisiert', () => {
        assert.ok(editor.componentManager);
    });

    it('precisionManager ist initialisiert', () => {
        assert.ok(editor.precisionManager);
    });

    it('transformGizmo ist initialisiert', () => {
        assert.ok(editor.transformGizmo);
    });

    it('transformInputManager ist initialisiert', () => {
        assert.ok(editor.transformInputManager);
    });

    it('historyManager ist initial null', () => {
        assert.strictEqual(editor.historyManager, null);
    });


    // ------------------------------------------------------------------
    // Öffentliche Methoden vorhanden
    // ------------------------------------------------------------------

    const REQUIRED_METHODS = [
        'deleteSelected',
        'groupSelected',
        'ungroupSelected',
        'copySelected',
        'pasteSelected',
        'duplicateSelected',
    ];

    for (const method of REQUIRED_METHODS) {
        it(`editor.${method} ist eine Funktion`, () => {
            assert.strictEqual(typeof editor[method], 'function');
        });
    }


    // ------------------------------------------------------------------
    // deleteSelected Kurztest
    // ------------------------------------------------------------------

    it('deleteSelected tut nichts wenn kein Objekt ausgewählt', () => {
        editor.selectionManager.selectedObject = null;
        assert.doesNotThrow(() => editor.deleteSelected());
        assert.strictEqual(library.removeBrick.mock.callCount(), 0);
    });
});
