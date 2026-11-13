import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorPanelManager } from '../src/ui/EditorPanelManager.js';

if (typeof globalThis.sessionStorage === 'undefined') {
    globalThis.sessionStorage = {
        _data: {},
        getItem(k)    { return this._data[k] ?? null; },
        setItem(k, v) { this._data[k] = v; },
        removeItem(k) { delete this._data[k]; },
        clear()       { this._data = {}; }
    };
}

// FIXED: use closure instead of `this._classes`
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
        },
        // expose for assertions
        _isHidden() { return classes.has('hidden'); }
    };
}

function makePanel(updateFn = null) {
    return { update: updateFn ?? (() => {}) };
}


describe('EditorPanelManager', () => {

    let manager;

    beforeEach(() => {
        manager = new EditorPanelManager();
    });

    // ------------------------------------------------------------------
    // Registrierung
    // ------------------------------------------------------------------

    it('register gibt this zurück (Chaining)', () => {
        const result = manager.register('a', makePanel());
        assert.strictEqual(result, manager);
    });

    it('doppelte Registrierung derselben ID wird ignoriert', () => {
        const panel1 = makePanel();
        const panel2 = makePanel();
        manager.register('x', panel1);
        manager.register('x', panel2);
        assert.strictEqual(manager.getPanel('x'), panel1);
    });

    it('getPanel gibt null zurück für unbekannte ID', () => {
        assert.strictEqual(manager.getPanel('unknown'), null);
    });

    it('getPanel gibt die Panel-Instanz zurück', () => {
        const panel = makePanel();
        manager.register('p', panel);
        assert.strictEqual(manager.getPanel('p'), panel);
    });

    it('getIds gibt alle registrierten IDs zurück', () => {
        manager.register('a', makePanel());
        manager.register('b', makePanel());
        const ids = manager.getIds();
        assert.ok(ids.includes('a'));
        assert.ok(ids.includes('b'));
        assert.strictEqual(ids.length, 2);
    });

    it('unregister entfernt das Panel', () => {
        manager.register('z', makePanel());
        manager.unregister('z');
        assert.strictEqual(manager.getPanel('z'), null);
        assert.ok(!manager.getIds().includes('z'));
    });

    // ------------------------------------------------------------------
    // Sichtbarkeit
    // ------------------------------------------------------------------

    it('show gibt false zurück für unbekannte ID', () => {
        assert.strictEqual(manager.show('unknown'), false);
    });

    it('hide gibt false zurück für unbekannte ID', () => {
        assert.strictEqual(manager.hide('unknown'), false);
    });

    it('show / isVisible', () => {
        manager.register('p', makePanel());
        manager.show('p');
        assert.strictEqual(manager.isVisible('p'), true);
    });

    it('hide / isVisible', () => {
        manager.register('p', makePanel());
        manager.show('p');
        manager.hide('p');
        assert.strictEqual(manager.isVisible('p'), false);
    });

    it('toggle aktiviert nicht sichtbares Panel', () => {
        manager.register('p', makePanel());
        assert.strictEqual(manager.toggle('p'), true);
        assert.strictEqual(manager.isVisible('p'), true);
    });

    it('toggle versteckt sichtbares Panel', () => {
        manager.register('p', makePanel());
        manager.show('p');
        assert.strictEqual(manager.toggle('p'), false);
        assert.strictEqual(manager.isVisible('p'), false);
    });

    // ------------------------------------------------------------------
    // DOM-Container (CSS-Klassen)
    // ------------------------------------------------------------------

    it('show entfernt hidden-Klasse vom Container', () => {
        const container = makeContainer();
        container.classList.add('hidden');
        manager.register('c', makePanel(), container);
        manager.show('c');
        assert.ok(!container._isHidden());
    });

    it('hide fügt hidden-Klasse zum Container hinzu', () => {
        const container = makeContainer();
        manager.register('c', makePanel(), container);
        manager.show('c');
        manager.hide('c');
        assert.ok(container._isHidden());
    });

    it('register ohne Container wirft keinen Fehler', () => {
        assert.doesNotThrow(() => {
            manager.register('nocont', makePanel(), null);
            manager.show('nocont');
            manager.hide('nocont');
        });
    });

    // ------------------------------------------------------------------
    // update / updateAll
    // ------------------------------------------------------------------

    it('update ruft panel.update() auf', () => {
        let called = 0;
        manager.register('p', { update: () => { called++; } });
        manager.update('p');
        assert.strictEqual(called, 1);
    });

    it('update gibt false zurück für unbekannte ID', () => {
        assert.strictEqual(manager.update('nope'), false);
    });

    it('updateAll aktualisiert alle registrierten Panels', () => {
        let counts = [0, 0];
        manager.register('a', { update: () => counts[0]++ });
        manager.register('b', { update: () => counts[1]++ });
        manager.updateAll();
        assert.strictEqual(counts[0], 1);
        assert.strictEqual(counts[1], 1);
    });

    it('update normalisiert auf refresh() wenn kein update() vorhanden', () => {
        let called = 0;
        manager.register('r', { refresh: () => { called++; } });
        manager.update('r');
        assert.strictEqual(called, 1);
    });

    it('update normalisiert auf updateStatus() als Fallback', () => {
        let called = 0;
        manager.register('s', { updateStatus: () => { called++; } });
        manager.update('s');
        assert.strictEqual(called, 1);
    });

    it('update tut nichts für Panels ohne Update-Methode', () => {
        assert.doesNotThrow(() => {
            manager.register('empty', {});
            manager.update('empty');
        });
    });
});
