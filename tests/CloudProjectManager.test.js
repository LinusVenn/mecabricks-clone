/**
 * Tests für CloudProjectManager (Phase 9.3)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudProjectManager } from '../src/cloud/CloudProjectManager.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';


// -----------------------------------------------------------------------
// Mock-CloudService
// -----------------------------------------------------------------------

class MockCloudService {
    constructor() {
        this._projects = new Map();
        this._userId = 'user-1';
        this._nextId = 1;
    }
    getCurrentUserId() { return this._userId; }
    async listProjects() { return [...this._projects.values()]; }
    async getProject(id) { return this._projects.get(id) ?? null; }
    async createProject({ name, data, schemaVersion = 1 }) {
        const id = `p${this._nextId++}`;
        const p = { id, ownerId: this._userId, name, data,
                    projectVersion: 1, schemaVersion,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString() };
        this._projects.set(id, p);
        return p;
    }
    async updateProject(id, { name, data, expectedVersion } = {}) {
        const p = this._projects.get(id);
        if (!p) throw new CloudError('Not found', CloudErrorCodes.NOT_FOUND);
        if (expectedVersion !== undefined && p.projectVersion !== expectedVersion) {
            throw new CloudError('Conflict', CloudErrorCodes.CONFLICT);
        }
        const updated = { ...p, name: name ?? p.name, data: data ?? p.data,
                          projectVersion: p.projectVersion + 1,
                          updatedAt: new Date().toISOString() };
        this._projects.set(id, updated);
        return updated;
    }
    async deleteProject(id) { this._projects.delete(id); }
}

const SAMPLE_JSON = JSON.stringify({ name: 'TestProjekt', version: 1, bricks: [] });


describe('CloudProjectManager', () => {

    let service, manager;

    beforeEach(() => {
        service = new MockCloudService();
        manager = new CloudProjectManager(service);
    });


    // ------------------------------------------------------------------
    // getAllProjects
    // ------------------------------------------------------------------

    it('getAllProjects gibt leere Liste zurück wenn keine Projekte vorhanden', async () => {
        const list = await manager.getAllProjects();
        assert.strictEqual(list.length, 0);
    });

    it('getAllProjects gibt alle Projekte zurück', async () => {
        await manager.createProject('P1', SAMPLE_JSON);
        await manager.createProject('P2', SAMPLE_JSON);
        const list = await manager.getAllProjects();
        assert.strictEqual(list.length, 2);
    });


    // ------------------------------------------------------------------
    // createProject
    // ------------------------------------------------------------------

    it('createProject legt ein Projekt an', async () => {
        const p = await manager.createProject('MeinProjekt', SAMPLE_JSON);
        assert.ok(p.id);
        assert.strictEqual(p.name, 'MeinProjekt');
    });

    it('createProject setzt projectVersion auf 1', async () => {
        const p = await manager.createProject('neu', SAMPLE_JSON);
        assert.strictEqual(p.projectVersion, 1);
    });


    // ------------------------------------------------------------------
    // loadProject
    // ------------------------------------------------------------------

    it('loadProject gibt Projekt zurück', async () => {
        const created = await manager.createProject('Laden', SAMPLE_JSON);
        const loaded  = await manager.loadProject(created.id);
        assert.strictEqual(loaded.id, created.id);
    });

    it('loadProject wirft bei unbekannter ID', async () => {
        await assert.rejects(
            () => manager.loadProject('unbekannt'),
            e => e instanceof CloudError && e.code === CloudErrorCodes.NOT_FOUND
        );
    });


    // ------------------------------------------------------------------
    // saveProject
    // ------------------------------------------------------------------

    it('saveProject aktualisiert projectVersion', async () => {
        const p  = await manager.createProject('Sparen', SAMPLE_JSON);
        const p2 = await manager.saveProject(p.id, SAMPLE_JSON, p.projectVersion);
        assert.strictEqual(p2.projectVersion, 2);
    });

    it('saveProject wirft CONFLICT bei veralteter Version', async () => {
        const p = await manager.createProject('Konflikt', SAMPLE_JSON);
        await manager.saveProject(p.id, SAMPLE_JSON, p.projectVersion);
        await assert.rejects(
            () => manager.saveProject(p.id, SAMPLE_JSON, p.projectVersion), // alte Version
            e => e instanceof CloudError && e.code === CloudErrorCodes.CONFLICT
        );
    });


    // ------------------------------------------------------------------
    // renameProject
    // ------------------------------------------------------------------

    it('renameProject ändert den Namen', async () => {
        const p     = await manager.createProject('Alt', SAMPLE_JSON);
        const p2    = await manager.renameProject(p.id, 'Neu');
        assert.strictEqual(p2.name, 'Neu');
    });


    // ------------------------------------------------------------------
    // deleteProject
    // ------------------------------------------------------------------

    it('deleteProject entfernt das Projekt', async () => {
        const p = await manager.createProject('Löschen', SAMPLE_JSON);
        await manager.deleteProject(p.id);
        const list = await manager.getAllProjects();
        assert.strictEqual(list.length, 0);
    });

});
