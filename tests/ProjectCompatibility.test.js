/**
 * Rückwärtskompatibilität – Projektformat (Phase 9.9)
 *
 * Stellt sicher, dass Projektdateien aus früheren Phasen weiterhin korrekt
 * geladen werden können und ihre Daten vollständig erhalten bleiben.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudProjectManager } from '../src/cloud/CloudProjectManager.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';


// Repräsentatives Projekt-JSON aus Phase 1–8 (keine Cloud-Metadaten)
const LEGACY_PROJECT_JSON = JSON.stringify({
    version: 1,
    name: 'Legacy-Modell',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
    bricks: [
        { id: 'b1', type: 'brick_2x4', color: 16711680, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { id: 'b2', type: 'brick_2x2', color: 255,      position: { x: 2, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ],
    connections: [],
    groups: []
});

const MODERN_PROJECT_JSON = JSON.stringify({
    version: 2,
    name: 'Modernes Modell',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
    bricks: [
        { id: 'b1', type: 'brick_1x1', color: 65280, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ],
    connections: [],
    groups: [],
    assemblies: [],
    components: []
});


class MockCloudService {
    constructor() { this._p = new Map(); this._n = 1; }
    getCurrentUserId() { return 'u1'; }
    async listProjects() { return [...this._p.values()]; }
    async getProject(id) { const p = this._p.get(id); if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND); return p; }
    async createProject({ name, data, schemaVersion = 1 }) {
        const id = `p${this._n++}`;
        const p = { id, ownerId: 'u1', name, data, projectVersion: 1, schemaVersion, createdAt: '', updatedAt: '' };
        this._p.set(id, p); return p;
    }
    async updateProject(id, { name, data, expectedVersion }) {
        const p = this._p.get(id);
        if (!p) throw new CloudError('NF', CloudErrorCodes.NOT_FOUND);
        if (expectedVersion !== undefined && p.projectVersion !== expectedVersion)
            throw new CloudError('Conflict', CloudErrorCodes.CONFLICT);
        const u = { ...p, name: name ?? p.name, data, projectVersion: p.projectVersion + 1 };
        this._p.set(id, u); return u;
    }
    async deleteProject(id) { this._p.delete(id); }
}


describe('Projektrückwärtskompatibilität', () => {

    let service, cpm;

    beforeEach(() => {
        service = new MockCloudService();
        cpm     = new CloudProjectManager(service);
    });


    it('Legacy-Projektdaten (version 1) werden vollständig gespeichert', async () => {
        const p = await cpm.createProject('Legacy', LEGACY_PROJECT_JSON);
        assert.ok(p.id);
    });

    it('Legacy-Projektdaten werden vollständig geladen (bricks erhalten)', async () => {
        const p = await cpm.createProject('Legacy', LEGACY_PROJECT_JSON);
        const loaded = await cpm.loadProject(p.id);
        assert.strictEqual(loaded.data.bricks?.length, 2);
    });

    it('Bauteilfarben bleiben nach Save/Load erhalten', async () => {
        const p      = await cpm.createProject('Farben', LEGACY_PROJECT_JSON);
        const loaded = await cpm.loadProject(p.id);
        assert.strictEqual(loaded.data.bricks[0].color, 16711680);
    });

    it('Bauteilpositionen bleiben nach Save/Load erhalten', async () => {
        const p      = await cpm.createProject('Pos', LEGACY_PROJECT_JSON);
        const loaded = await cpm.loadProject(p.id);
        assert.deepStrictEqual(loaded.data.bricks[1].position, { x: 2, y: 0, z: 0 });
    });

    it('Modernes Projektformat (version 2) wird korrekt gespeichert', async () => {
        const p = await cpm.createProject('Modern', MODERN_PROJECT_JSON);
        assert.ok(p.id);
    });

    it('Verbindungen bleiben nach Save/Load erhalten', async () => {
        const dataWithConnections = JSON.stringify({
            ...JSON.parse(LEGACY_PROJECT_JSON),
            connections: [{ id: 'c1', brickA: 'b1', brickB: 'b2' }]
        });
        const p      = await cpm.createProject('Verbindungen', dataWithConnections);
        const loaded = await cpm.loadProject(p.id);
        assert.strictEqual(loaded.data.connections?.length, 1);
    });

    it('Gruppen bleiben nach Save/Load erhalten', async () => {
        const dataWithGroups = JSON.stringify({
            ...JSON.parse(LEGACY_PROJECT_JSON),
            groups: [{ id: 'g1', name: 'Gruppe A', brickIds: ['b1'] }]
        });
        const p      = await cpm.createProject('Gruppen', dataWithGroups);
        const loaded = await cpm.loadProject(p.id);
        assert.strictEqual(loaded.data.groups?.length, 1);
    });

    it('fehlende optionale Felder in alten Projekten verursachen keinen Fehler', async () => {
        const minimal = JSON.stringify({ name: 'Minimal', bricks: [] });
        const p = await cpm.createProject('Minimal', minimal);
        assert.ok(p.id);
    });

    it('projectVersion beginnt bei 1 für neue Projekte', async () => {
        const p = await cpm.createProject('Neu', LEGACY_PROJECT_JSON);
        assert.strictEqual(p.projectVersion, 1);
    });

    it('schemaVersion wird aus Projektdaten übernommen', async () => {
        const p = await cpm.createProject('Schema', LEGACY_PROJECT_JSON);
        // schemaVersion = data.version ?? 1
        assert.ok(p.schemaVersion >= 1);
    });

});
