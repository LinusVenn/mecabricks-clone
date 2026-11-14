/**
 * Erweiterte Tests für EditorPanelManager – dispose()
 *
 * Abdeckung von Lücken:
 *  - dispose() löscht Registry und Sichtbarkeitsstatus
 *  - dispose() mit _persist:true → sessionStorage.removeItem() wird aufgerufen
 *  - dispose() mit _persist:false → sessionStorage.removeItem() NICHT aufgerufen
 *  - Doppeltes dispose() wirft nicht
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorPanelManager } from '../src/ui/EditorPanelManager.js';


// ─── sessionStorage-Polyfill (falls nicht vorhanden) ─────────────────────────

if (typeof globalThis.sessionStorage === 'undefined') {
    globalThis.sessionStorage = {
        _data: {},
        getItem(k)    { return this._data[k] ?? null; },
        setItem(k, v) { this._data[k] = v; },
        removeItem(k) { delete this._data[k]; },
        clear()       { this._data = {}; }
    };
}


// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function makePanel() {
    return { update: () => {} };
}

function makeContainer() {
    const classes = new Set();
    return {
        classList: {
            add(c)    { classes.add(c); },
            remove(c) { classes.delete(c); },
            contains(c) { return classes.has(c); },
            toggle(c, force) {
                if (force === false || (force === undefined && classes.has(c))) {
                    classes.delete(c);
                } else {
                    classes.add(c);
                }
            }
        }
    };
}


// ═══════════════════════════════════════════════════════════════════════════════
// dispose() – Basisverhalten
// ═══════════════════════════════════════════════════════════════════════════════

describe('EditorPanelManager – dispose()', () => {

    let manager;

    beforeEach(() => {
        manager = new EditorPanelManager();
    });

    it('löscht alle registrierten Panels', () => {
        manager.register('panel-a', makePanel());
        manager.register('panel-b', makePanel());

        manager.dispose();

        assert.strictEqual(manager.getPanel('panel-a'), null);
        assert.strictEqual(manager.getPanel('panel-b'), null);
        assert.strictEqual(manager.getIds().length, 0);
    });

    it('löscht den Sichtbarkeitsstatus aller Panels', () => {
        const container = makeContainer();
        manager.register('panel-a', makePanel());
        manager.show('panel-a', container);

        manager.dispose();

        // Nach dispose() ist der Sichtbarkeitsstatus weg
        assert.strictEqual(manager.getIds().length, 0);
    });

    it('doppeltes dispose() wirft nicht', () => {
        manager.register('panel-x', makePanel());

        manager.dispose();
        assert.doesNotThrow(() => manager.dispose());
    });

    it('getPanel() gibt null zurück nach dispose()', () => {
        manager.register('p', makePanel());
        manager.dispose();
        assert.strictEqual(manager.getPanel('p'), null);
    });

    it('getIds() gibt leeres Array zurück nach dispose()', () => {
        manager.register('a', makePanel());
        manager.register('b', makePanel());
        manager.dispose();
        assert.deepStrictEqual(manager.getIds(), []);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// dispose() – sessionStorage-Verhalten
// ═══════════════════════════════════════════════════════════════════════════════

describe('EditorPanelManager – dispose() sessionStorage', () => {

    it('ruft sessionStorage.removeItem() auf wenn persist: true', () => {
        let removeItemCalled = false;
        const origRemoveItem = globalThis.sessionStorage.removeItem.bind(
            globalThis.sessionStorage
        );
        globalThis.sessionStorage.removeItem = (key) => {
            removeItemCalled = true;
            origRemoveItem(key);
        };

        const manager = new EditorPanelManager({ persist: true });
        manager.dispose();

        globalThis.sessionStorage.removeItem = origRemoveItem;

        assert.strictEqual(removeItemCalled, true,
            'sessionStorage.removeItem() muss bei persist:true aufgerufen werden');
    });

    it('ruft sessionStorage.removeItem() NICHT auf wenn persist: false (Standard)', () => {
        let removeItemCalled = false;
        const origRemoveItem = globalThis.sessionStorage.removeItem.bind(
            globalThis.sessionStorage
        );
        globalThis.sessionStorage.removeItem = (key) => {
            removeItemCalled = true;
            origRemoveItem(key);
        };

        const manager = new EditorPanelManager({ persist: false });
        manager.dispose();

        globalThis.sessionStorage.removeItem = origRemoveItem;

        assert.strictEqual(removeItemCalled, false,
            'sessionStorage.removeItem() darf bei persist:false nicht aufgerufen werden');
    });
});
