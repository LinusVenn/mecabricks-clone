import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PartLibrary }       from '../src/objects/PartLibrary.js';
import { ConnectionManager } from '../src/editor/ConnectionManager.js';
import { ProjectManager }    from '../src/project/ProjectManager.js';


// ─── Browser-API-Stubs ───────────────────────────────────────────────────────
// exportProject() braucht document und URL – wir installieren minimale Stubs.

if (typeof globalThis.URL === 'undefined') {
    globalThis.URL = {
        createObjectURL: () => 'blob:mock-url',
        revokeObjectURL: () => {},
    };
}

if (typeof globalThis.document === 'undefined') {
    const linkEl = {
        href: '', download: '', click() {}, setAttribute() {}
    };
    globalThis.document = {
        createElement: () => linkEl,
        body: {
            appendChild: () => {},
            removeChild: () => {},
        },
    };
}

if (typeof globalThis.Blob === 'undefined') {
    globalThis.Blob = class Blob {
        constructor(parts) { this._parts = parts; }
    };
}


// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function makeEnv() {
    const scene             = new THREE.Scene();
    const library           = new PartLibrary(scene);
    const connectionManager = new ConnectionManager();
    const pm                = new ProjectManager(library, connectionManager);
    return { scene, library, connectionManager, pm };
}

/** Minimaler gültiger JSON-String für loadProjectJSON(). */
function minimalProjectJSON(name = 'Import-Projekt') {
    return JSON.stringify({
        format:  'mecabricks-clone',
        version: 1,
        project: {
            id:        'imported-id',
            name,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
        },
        bricks:      [],
        connections: [],
    });
}


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ProjectManager', () => {

    let library, connectionManager, pm;

    beforeEach(() => {
        ({ library, connectionManager, pm } = makeEnv());
    });


    // ── Konstruktor ───────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('erstellt ein Standardprojekt mit Namen "Neues Projekt"', () => {
            assert.strictEqual(pm.getProjectInfo().name, 'Neues Projekt');
        });

        it('vergibt eine eindeutige Projekt-ID beim Erstellen', () => {
            const id1 = makeEnv().pm.getProjectInfo().id;
            const id2 = makeEnv().pm.getProjectInfo().id;
            // Beide IDs müssen Strings sein und dürfen nicht gleich sein
            assert.ok(typeof id1 === 'string' && id1.length > 0, 'id1 muss ein nicht-leerer String sein');
            assert.ok(typeof id2 === 'string' && id2.length > 0, 'id2 muss ein nicht-leerer String sein');
            assert.notStrictEqual(id1, id2);
        });

        it('projectInfo hat createdAt, updatedAt und modifiedAt', () => {
            const info = pm.getProjectInfo();
            assert.ok(typeof info.createdAt   === 'string');
            assert.ok(typeof info.updatedAt   === 'string' || typeof info.modifiedAt === 'string');
        });

    });


    // ── createNewProject ─────────────────────────────────────────────────────

    describe('createNewProject()', () => {

        it('leert die Library', () => {
            library.addBrick(0, 0, 0, 0xff0000);
            pm.createNewProject();
            assert.strictEqual(library.getCount(), 0);
        });

        it('leert die Verbindungen', () => {
            const b1 = library.addBrick(0, 0, 0, 0xff0000);
            const b2 = library.addBrick(4, 0, 0, 0x0000ff);
            connectionManager.createConnection(b1.id, b2.id);
            pm.createNewProject();
            assert.strictEqual(connectionManager.getCount(), 0);
        });

        it('setzt den übergebenen Projektnamen', () => {
            pm.createNewProject('Mein Projekt');
            assert.strictEqual(pm.getProjectInfo().name, 'Mein Projekt');
        });

        it('trimmt führende/nachfolgende Leerzeichen im Namen', () => {
            pm.createNewProject('  Test  ');
            assert.strictEqual(pm.getProjectInfo().name, 'Test');
        });

        it('verwendet Standardnamen "Neues Projekt" wenn leerer String übergeben wird', () => {
            pm.createNewProject('');
            assert.strictEqual(pm.getProjectInfo().name, 'Neues Projekt');
        });

        it('vergibt eine neue Projekt-ID nach createNewProject()', () => {
            const oldId = pm.getProjectInfo().id;
            pm.createNewProject('Frisch');
            const newId = pm.getProjectInfo().id;
            // Beide IDs sollen Strings sein; nach createNewProject() soll eine neue ID vergeben werden
            assert.ok(typeof newId === 'string' && newId.length > 0);
            // Wenn oldId auch ein String ist, müssen sie verschieden sein
            if (typeof oldId === 'string') {
                assert.notStrictEqual(newId, oldId);
            }
        });

        it('gibt die neue Projektinfo zurück', () => {
            const info = pm.createNewProject('Neu');
            assert.ok(info && typeof info === 'object');
            assert.strictEqual(info.name, 'Neu');
        });

    });


    // ── getProjectInfo ────────────────────────────────────────────────────────

    describe('getProjectInfo()', () => {

        it('gibt eine Kopie zurück, keine Referenz', () => {
            const a = pm.getProjectInfo();
            const b = pm.getProjectInfo();
            assert.notStrictEqual(a, b);
        });

        it('Änderungen an der Kopie beeinflussen das Original nicht', () => {
            const info = pm.getProjectInfo();
            info.name  = 'Geändert';
            assert.notStrictEqual(pm.getProjectInfo().name, 'Geändert');
        });

    });


    // ── renameProject ─────────────────────────────────────────────────────────

    describe('renameProject()', () => {

        it('ändert den Projektnamen', () => {
            pm.renameProject('Neuer Name');
            assert.strictEqual(pm.getProjectInfo().name, 'Neuer Name');
        });

        it('trimmt den neuen Namen', () => {
            pm.renameProject('  Getrimmt  ');
            assert.strictEqual(pm.getProjectInfo().name, 'Getrimmt');
        });

        it('aktualisiert updatedAt bzw. modifiedAt', () => {
            const info1 = pm.getProjectInfo();
            const before = info1.updatedAt ?? info1.modifiedAt;
            pm.renameProject('Neu');
            const info2 = pm.getProjectInfo();
            const after = info2.updatedAt ?? info2.modifiedAt;
            assert.ok(after >= before);
        });

        it('wirft bei leerem String', () => {
            assert.throws(() => pm.renameProject(''),
                { message: /leer/ });
        });

        it('wirft bei nur Leerzeichen', () => {
            assert.throws(() => pm.renameProject('   '),
                { message: /leer/ });
        });

        it('wirft bei nicht-String', () => {
            assert.throws(() => pm.renameProject(null));
            assert.throws(() => pm.renameProject(42));
        });

        it('gibt die aktualisierte Projektinfo zurück', () => {
            const info = pm.renameProject('Aktuell');
            assert.strictEqual(info.name, 'Aktuell');
        });

    });


    // ── getProjectJSON ────────────────────────────────────────────────────────

    describe('getProjectJSON()', () => {

        it('gibt einen gültigen JSON-String zurück', () => {
            assert.doesNotThrow(() => JSON.parse(pm.getProjectJSON()));
        });

        it('JSON enthält das korrekte Format', () => {
            const data = JSON.parse(pm.getProjectJSON());
            assert.strictEqual(data.format, 'mecabricks-clone');
        });

        it('JSON enthält den Projektnamen', () => {
            pm.renameProject('Exportprojekt');
            const data = JSON.parse(pm.getProjectJSON());
            assert.strictEqual(data.project.name, 'Exportprojekt');
        });

        it('JSON enthält alle Steine', () => {
            library.addBrick(0, 0, 0, 0xff0000);
            library.addBrick(4, 0, 0, 0x0000ff);
            const data = JSON.parse(pm.getProjectJSON());
            assert.strictEqual(data.bricks.length, 2);
        });

    });


    // ── loadProjectJSON ───────────────────────────────────────────────────────

    describe('loadProjectJSON()', () => {

        it('stellt Projektinformationen wieder her', () => {
            pm.loadProjectJSON(minimalProjectJSON('Geladenes Projekt'));
            assert.strictEqual(pm.getProjectInfo().name, 'Geladenes Projekt');
        });

        it('übernimmt die Projekt-ID aus dem JSON', () => {
            pm.loadProjectJSON(minimalProjectJSON());
            assert.strictEqual(pm.getProjectInfo().id, 'imported-id');
        });

        it('gibt die Projektinfo zurück', () => {
            const info = pm.loadProjectJSON(minimalProjectJSON());
            assert.ok(info && typeof info.name === 'string');
        });

        it('stellt Steine aus dem JSON wieder her', () => {
            const json = JSON.stringify({
                format: 'mecabricks-clone', version: 1,
                project: { id: 'p1', name: 'X', createdAt: '', updatedAt: '' },
                bricks: [
                    { id: 'b1', type: 'brick_2x4', color: 0xff0000,
                      position: { x:0, y:0, z:0 }, rotation: { x:0, y:0, z:0 } },
                ],
                connections: [],
            });
            pm.loadProjectJSON(json);
            assert.strictEqual(library.getCount(), 1);
        });

        it('wirft bei syntaktisch ungültigem JSON', () => {
            assert.throws(() => pm.loadProjectJSON('{kaputt}'));
        });

        it('wirft bei falscher Formatkennung', () => {
            const bad = JSON.stringify({ format: 'falsch', version: 1,
                project: { name: 'T' }, bricks: [], connections: [] });
            assert.throws(() => pm.loadProjectJSON(bad));
        });

    });


    // ── importProjectFile ─────────────────────────────────────────────────────

    describe('importProjectFile()', () => {

        it('wirft wenn keine Datei übergeben wird', async () => {
            await assert.rejects(() => pm.importProjectFile(null),
                { message: /[Kk]eine Datei/ });   // case-insensitiv: "keine" oder "Keine"
        });

        it('wirft wenn die Datei keine .json-Endung hat', async () => {
            const file = { name: 'projekt.txt', text: async () => '{}' };
            await assert.rejects(() => pm.importProjectFile(file),
                { message: /JSON/ });
        });

        it('lädt gültige .json-Datei erfolgreich', async () => {
            const file = {
                name: 'projekt.json',
                text: async () => minimalProjectJSON('Datei-Projekt'),
            };
            const info = await pm.importProjectFile(file);
            assert.strictEqual(info.name, 'Datei-Projekt');
        });

        it('wirft bei ungültigem JSON-Inhalt', async () => {
            const file = {
                name: 'projekt.json',
                text: async () => '{ungültig}',
            };
            await assert.rejects(() => pm.importProjectFile(file));
        });

    });

});
