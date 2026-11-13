import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Polyfills damit Editor und alle Sub-Manager importiert werden können
if (typeof globalThis.window === 'undefined') {
    globalThis.window = { addEventListener: () => {}, removeEventListener: () => {} };
}
if (typeof globalThis.HTMLInputElement   === 'undefined') globalThis.HTMLInputElement   = class {};
if (typeof globalThis.HTMLTextAreaElement === 'undefined') globalThis.HTMLTextAreaElement = class {};
if (typeof globalThis.document === 'undefined') {
    // Minimales DOM-Mock, das SelectionBox, GroupToolbar und andere
    // Phase-6-Klassen ohne echten Browser starten lässt.
    globalThis.document = {
        getElementById: () => ({
            innerHTML: '',
            querySelectorAll: () => [],
            appendChild: () => {},
            addEventListener: () => {},
            disabled: false,
            textContent: '',
            classList: { add: () => {}, remove: () => {}, toggle: () => {} },
            style: {},
        }),
        createElement: () => ({
            textContent: '',
            dataset: {},
            style: {},
            classList: { add: () => {}, remove: () => {}, toggle: () => {} },
            addEventListener: () => {},
            appendChild: () => {},
            remove: () => {},
        }),
        body: {
            appendChild: () => {},
            removeChild: () => {},
        },
    };
}

import { Editor } from '../src/editor/Editor.js';

// Minimaler sceneManager der alle Sub-Manager ohne echte THREE.js-Renderer-Instanz erstellt
function makeSceneManager() {
    const domElement = {
        addEventListener: () => {}, removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        ownerDocument: { addEventListener: () => {}, removeEventListener: () => {} },
        style: { cursor: '' },
    };
    return {
        camera: {
            isCamera: true, isPerspectiveCamera: true,
            matrixWorldInverse: { elements: new Float32Array(16) },
            projectionMatrix:   { elements: new Float32Array(16) },
        },
        renderer: { domElement },
        scene:    { add: mock.fn(), children: [] },
        controls: { enabled: true },
    };
}

describe('Editor – deleteSelected', () => {

    let editor, library, addedBrick;

    beforeEach(() => {
        addedBrick = {
            id:    'brick-test-id',
            group: { userData: { brickId: 'brick-test-id' } },
        };

        library = {
            getById:     mock.fn(),
            removeBrick: mock.fn(),
        };

        // Editor vollständig initialisieren
        editor = new Editor(makeSceneManager(), library);

        // Nach der Konstruktion ersetzen wir die internen Manager durch einfache Mocks,
        // damit deleteSelected() isoliert getestet werden kann
        editor.transformManager = {
            attach:         mock.fn(),
            detach:         mock.fn(),
            rotateSelected: mock.fn(),
            setMode:        mock.fn(),
        };
        editor.selectionManager = {
            selectedObject: null,
            // clearSelection() setzt selectedObject auf null und löst
            // das Gizmo (transformManager.detach) ab – wie die echte Klasse
            clearSelection: mock.fn(function () {
                editor.selectionManager.selectedObject = null;
                editor.transformManager.detach();
            }),
        };
    });

    it('tut nichts wenn kein Objekt ausgewählt ist', () => {
        editor.selectionManager.selectedObject = null;
        editor.deleteSelected();
        assert.strictEqual(library.removeBrick.mock.callCount(), 0);
    });

    it('tut nichts wenn die ID nicht in der Library vorhanden ist', () => {
        editor.selectionManager.selectedObject = { userData: { brickId: 'unbekannt' } };
        library.getById.mock.mockImplementation(() => undefined);
        editor.deleteSelected();
        assert.strictEqual(library.removeBrick.mock.callCount(), 0);
    });

    it('entfernt den gefundenen Baustein aus der Library', () => {
        editor.selectionManager.selectedObject = { userData: { brickId: addedBrick.id } };
        library.getById.mock.mockImplementation(() => addedBrick);
        editor.deleteSelected();
        assert.strictEqual(library.removeBrick.mock.callCount(), 1);
        assert.strictEqual(library.removeBrick.mock.calls[0].arguments[0], addedBrick);
    });

    it('setzt selectedObject nach dem Löschen auf null', () => {
        // removeBrick muss truthy zurückgeben, damit der Code
        // nach dem if(!removed)-Guard weiterläuft
        library.removeBrick.mock.mockImplementation(() => true);
        editor.selectionManager.selectedObject = { userData: { brickId: addedBrick.id } };
        library.getById.mock.mockImplementation(() => addedBrick);
        editor.deleteSelected();
        assert.strictEqual(editor.selectionManager.selectedObject, null);
    });

    it('löst das Gizmo nach dem Löschen (detach)', () => {
        library.removeBrick.mock.mockImplementation(() => true);
        editor.selectionManager.selectedObject = { userData: { brickId: addedBrick.id } };
        library.getById.mock.mockImplementation(() => addedBrick);
        editor.deleteSelected();
        // detach wird mindestens einmal aufgerufen (direkt + ggf. via clearSelection-Mock)
        assert.ok(editor.transformManager.detach.mock.callCount() >= 1);
    });

    it('sucht den Baustein anhand der korrekten brickId', () => {
        editor.selectionManager.selectedObject = { userData: { brickId: 'xyz-789' } };
        library.getById.mock.mockImplementation(() => undefined);
        editor.deleteSelected();
        assert.strictEqual(library.getById.mock.calls[0].arguments[0], 'xyz-789');
    });

});
