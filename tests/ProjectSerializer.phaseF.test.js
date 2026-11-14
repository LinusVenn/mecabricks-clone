/**
 * ProjectSerializer – Phase F tests
 *
 * Coverage:
 *  - serialize() with mechanicalManager → output.mechanicalConnections is populated
 *  - serialize() without mechanicalManager → mechanicalConnections: []
 *  - Output version === 4
 *  - deserialize() with Phase F data → mechanicalManager.loadFromData() is called
 *  - deserialize() with old v3 data (no mechanicalConnections field) → works, no error
 *  - createProject() → includes mechanicalConnections: []
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PartLibrary }       from '../src/objects/PartLibrary.js';
import { ConnectionManager } from '../src/editor/ConnectionManager.js';
import { ProjectSerializer } from '../src/project/ProjectSerializer.js';

// ─── Mock helpers ────────────────────────────────────────────────────────────

/**
 * Creates a mock MechanicalConnectionManager for testing.
 * @param {Array} connections  The connection objects to return from toData().
 */
function makeMockMechManager(connections = []) {
    return {
        _loadCalls: [],
        _cleared: false,
        toData() { return { mechanicalConnections: connections }; },
        loadFromData(data, instanceIds) {
            this._loadCalls.push({ data, instanceIds });
            return { loaded: data?.length ?? 0, skipped: 0, errors: [] };
        },
        clear() { this._cleared = true; }
    };
}

// ─── Shared test data ─────────────────────────────────────────────────────────

const baseInfo = {
    id:        'proj-phaseF',
    name:      'Phase-F-Projekt',
    createdAt: '2024-11-01T00:00:00.000Z',
    updatedAt: '2024-11-01T00:00:00.000Z',
};

/** A minimal valid mechanical connection entry. */
const sampleMechConn = {
    id:    'mconn-1',
    type:  'rigid',
    partA: 'brick-a',
    partB: 'brick-b',
};

/**
 * Builds a minimal valid v4 project data object (plain object, not JSON string).
 * Optionally includes mechanicalConnections.
 */
function minimalV4Data(overrides = {}) {
    return {
        format:  'mecabricks-clone',
        version: 4,
        project: {
            id:        'proj-1',
            name:      'Testprojekt',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
        },
        bricks:      [],
        connections: [],
        groups:      [],
        components:  [],
        ...overrides,
    };
}

/**
 * Builds a minimal valid v3 project data object (no mechanicalConnections).
 */
function minimalV3Data(overrides = {}) {
    return {
        format:  'mecabricks-clone',
        version: 3,
        project: {
            id:        'proj-v3',
            name:      'V3-Projekt',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
        },
        bricks:      [],
        connections: [],
        groups:      [],
        components:  [],
        ...overrides,
    };
}

// ─── Environment factory ───────────────────────────────────────────────────────

function makeEnv() {
    const scene             = new THREE.Scene();
    const library           = new PartLibrary(scene);
    const connectionManager = new ConnectionManager();
    const serializer        = new ProjectSerializer();
    return { scene, library, connectionManager, serializer };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectSerializer – Phase F', () => {

    let library, connectionManager, serializer;

    beforeEach(() => {
        ({ library, connectionManager, serializer } = makeEnv());
    });


    // ── createProject() ───────────────────────────────────────────────────────

    describe('createProject()', () => {

        it('enthält mechanicalConnections: [] (leeres Array) als Standard', () => {
            const data = serializer.createProject(library, connectionManager, baseInfo);
            assert.ok(Object.prototype.hasOwnProperty.call(data, 'mechanicalConnections'),
                'mechanicalConnections-Feld muss vorhanden sein');
            assert.deepStrictEqual(data.mechanicalConnections, []);
        });

        it('gibt version === 4 zurück', () => {
            const data = serializer.createProject(library, connectionManager, baseInfo);
            assert.strictEqual(data.version, 4);
        });

        it('gibt format === "mecabricks-clone" zurück', () => {
            const data = serializer.createProject(library, connectionManager, baseInfo);
            assert.strictEqual(data.format, 'mecabricks-clone');
        });

    });


    // ── serialize() ──────────────────────────────────────────────────────────

    describe('serialize()', () => {

        it('gibt version 4 in der JSON-Ausgabe zurück', () => {
            const json = serializer.serialize(library, connectionManager, baseInfo);
            const parsed = JSON.parse(json);
            assert.strictEqual(parsed.version, 4);
        });

        it('Ausgabe ohne mechanicalManager enthält mechanicalConnections: []', () => {
            const json   = serializer.serialize(library, connectionManager, baseInfo);
            const parsed = JSON.parse(json);
            assert.ok(Object.prototype.hasOwnProperty.call(parsed, 'mechanicalConnections'),
                'mechanicalConnections-Feld muss vorhanden sein');
            assert.deepStrictEqual(parsed.mechanicalConnections, []);
        });

        it('Ausgabe mit mechanicalManager (leer) enthält mechanicalConnections: []', () => {
            const mechManager = makeMockMechManager([]);
            const json   = serializer.serialize(
                library, connectionManager, baseInfo,
                null, null, mechManager
            );
            const parsed = JSON.parse(json);
            assert.deepStrictEqual(parsed.mechanicalConnections, []);
        });

        it('Ausgabe mit mechanicalManager (1 Eintrag) enthält mechanicalConnections-Array', () => {
            const mechManager = makeMockMechManager([sampleMechConn]);
            const json   = serializer.serialize(
                library, connectionManager, baseInfo,
                null, null, mechManager
            );
            const parsed = JSON.parse(json);
            assert.strictEqual(parsed.mechanicalConnections.length, 1);
        });

        it('Mechanische Verbindung im Output hat die richtigen Felder', () => {
            const mechManager = makeMockMechManager([sampleMechConn]);
            const json   = serializer.serialize(
                library, connectionManager, baseInfo,
                null, null, mechManager
            );
            const parsed = JSON.parse(json);
            const mc = parsed.mechanicalConnections[0];
            assert.strictEqual(mc.id,    sampleMechConn.id);
            assert.strictEqual(mc.type,  sampleMechConn.type);
            assert.strictEqual(mc.partA, sampleMechConn.partA);
            assert.strictEqual(mc.partB, sampleMechConn.partB);
        });

        it('Ausgabe mit mehreren mechanischen Verbindungen', () => {
            const twoConns = [
                { id: 'mc-1', type: 'rigid',    partA: 'p1', partB: 'p2' },
                { id: 'mc-2', type: 'revolute', partA: 'p2', partB: 'p3' },
            ];
            const mechManager = makeMockMechManager(twoConns);
            const json   = serializer.serialize(
                library, connectionManager, baseInfo,
                null, null, mechManager
            );
            const parsed = JSON.parse(json);
            assert.strictEqual(parsed.mechanicalConnections.length, 2);
            assert.strictEqual(parsed.mechanicalConnections[1].type, 'revolute');
        });

        it('gibt gültigen JSON-String zurück (JSON.parse wirft nicht)', () => {
            const mechManager = makeMockMechManager([sampleMechConn]);
            const json = serializer.serialize(
                library, connectionManager, baseInfo,
                null, null, mechManager
            );
            assert.doesNotThrow(() => JSON.parse(json));
        });

        it('null als mechanicalManager → mechanicalConnections: []', () => {
            const json   = serializer.serialize(library, connectionManager, baseInfo, null, null, null);
            const parsed = JSON.parse(json);
            assert.deepStrictEqual(parsed.mechanicalConnections, []);
        });

    });


    // ── deserialize() ────────────────────────────────────────────────────────

    describe('deserialize()', () => {

        it('akzeptiert v4-Daten mit leerem mechanicalConnections-Array', async () => {
            const data = minimalV4Data({ mechanicalConnections: [] });
            const mechManager = makeMockMechManager();
            await assert.doesNotReject(
                () => serializer.deserialize(data, library, connectionManager, null, null, mechManager)
            );
        });

        it('ruft mechManager.loadFromData() mit dem Array aus den Daten auf', async () => {
            const data = minimalV4Data({ mechanicalConnections: [sampleMechConn] });
            const mechManager = makeMockMechManager();
            await serializer.deserialize(data, library, connectionManager, null, null, mechManager);
            assert.strictEqual(mechManager._loadCalls.length, 1,
                'loadFromData() soll genau einmal aufgerufen werden');
            assert.deepStrictEqual(mechManager._loadCalls[0].data, [sampleMechConn]);
        });

        it('übergibt instanceIds als Set an loadFromData()', async () => {
            const data = minimalV4Data({
                bricks: [],
                mechanicalConnections: [sampleMechConn],
            });
            const mechManager = makeMockMechManager();
            await serializer.deserialize(data, library, connectionManager, null, null, mechManager);
            const { instanceIds } = mechManager._loadCalls[0];
            assert.ok(instanceIds instanceof Set, 'instanceIds soll ein Set sein');
        });

        it('ruft mechManager.clear() auf', async () => {
            const data = minimalV4Data({ mechanicalConnections: [] });
            const mechManager = makeMockMechManager();
            await serializer.deserialize(data, library, connectionManager, null, null, mechManager);
            assert.strictEqual(mechManager._cleared, true, 'clear() soll aufgerufen werden');
        });

        it('ohne mechanicalManager → wirft nicht (mechanicalConnections wird ignoriert)', async () => {
            const data = minimalV4Data({ mechanicalConnections: [sampleMechConn] });
            await assert.doesNotReject(
                () => serializer.deserialize(data, library, connectionManager, null, null, null)
            );
        });

        it('gibt project-Objekt zurück (Projektmetadaten)', async () => {
            const data = minimalV4Data({ mechanicalConnections: [] });
            const mechManager = makeMockMechManager();
            const result = await serializer.deserialize(data, library, connectionManager, null, null, mechManager);
            assert.ok(result && typeof result === 'object',
                'Rückgabewert soll ein Objekt sein');
            assert.strictEqual(result.name, 'Testprojekt');
        });


        // ── Rückwärtskompatibilität: v3-Daten ohne mechanicalConnections ─────

        it('akzeptiert v3-Daten ohne mechanicalConnections-Feld', async () => {
            const data = minimalV3Data();    // kein mechanicalConnections-Feld
            const mechManager = makeMockMechManager();
            await assert.doesNotReject(
                () => serializer.deserialize(data, library, connectionManager, null, null, mechManager)
            );
        });

        it('lädt v3-Daten ohne mechanicalConnections: loadFromData() wird nicht aufgerufen', async () => {
            const data = minimalV3Data();    // kein mechanicalConnections-Feld
            const mechManager = makeMockMechManager();
            await serializer.deserialize(data, library, connectionManager, null, null, mechManager);
            assert.strictEqual(mechManager._loadCalls.length, 0,
                'loadFromData() darf bei fehlendem Feld nicht aufgerufen werden');
        });

        it('akzeptiert v3-Daten ohne mechanicalManager', async () => {
            const data = minimalV3Data();
            await assert.doesNotReject(
                () => serializer.deserialize(data, library, connectionManager, null, null, null)
            );
        });

    });

});
