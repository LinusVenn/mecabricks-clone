/**
 * Tests für CloudStorage (Phase 9.3)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CloudStorage } from '../src/cloud/CloudStorage.js';
import { CloudError, CloudErrorCodes } from '../src/cloud/CloudService.js';


class MockService {
    constructor() {
        this._projects = new Map();
        this._nextId = 1;
    }
    async listProjects() { return [...this._projects.values()]; }
    async getProject(id) { return this._projects.get(id) ?? null; }
    async createProject({ name, data }) {
        const id = `p${this._nextId++}`;
        const p = { id, name, data, projectVersion: 1, updatedAt: new Date().toISOString() };
        this._projects.set(id, p);
        return p;
    }
    async updateProject(id, { name, data, expectedVersion }) {
        const p = this._projects.get(id);
        if (!p) throw new CloudError('Not found', CloudErrorCodes.NOT_FOUND);
        if (expectedVersion !== undefined && p.projectVersion !== expectedVersion)
            throw new CloudError('Conflict', CloudErrorCodes.CONFLICT);
        const updated = { ...p, name: name ?? p.name, data,
                          projectVersion: p.projectVersion + 1,
                          updatedAt: new Date().toISOString() };
        this._projects.set(id, updated);
        return updated;
    }
    async deleteProject(id) { this._projects.delete(id); }
}

const JSON_DATA = JSON.stringify({ name: 'Proj', bricks: [] });

describe('CloudStorage', () => {

    let service, storage;

    beforeEach(() => {
        service = new MockService();
        storage = new CloudStorage(service);
    });

    it('save ohne ID legt neues Projekt an', async () => {
        await storage.save(null, JSON_DATA, undefined);
        assert.strictEqual(service._projects.size, 1);
    });

    it('save mit ID aktualisiert bestehendes Projekt', async () => {
        const p = await service.createProject({ name: 'A', data: {} });
        await storage.save(p.id, JSON_DATA, p.projectVersion);
        const updated = service._projects.get(p.id);
        assert.strictEqual(updated.projectVersion, 2);
    });

    it('load gibt CloudProject-Objekt zurück', async () => {
        const p = await service.createProject({ name: 'A', data: { bricks: [] } });
        const result = await storage.load(p.id);
        // CloudStorage.load() gibt das CloudProject-Objekt zurück (nicht JSON-String)
        assert.ok(result !== null, 'Ergebnis soll nicht null sein');
        assert.strictEqual(typeof result, 'object', 'Ergebnis soll ein Objekt sein');
        assert.ok('data' in result, 'Ergebnis soll ein data-Feld haben');
    });

    it('load gibt null zurück für unbekannte ID', async () => {
        const result = await storage.load('unbekannt');
        assert.strictEqual(result, null);
    });

    it('list gibt alle Projekte zurück', async () => {
        await service.createProject({ name: 'A', data: {} });
        await service.createProject({ name: 'B', data: {} });
        const list = await storage.list();
        assert.strictEqual(list.length, 2);
    });

    it('delete entfernt Projekt', async () => {
        const p = await service.createProject({ name: 'A', data: {} });
        await storage.delete(p.id);
        assert.strictEqual(service._projects.size, 0);
    });

    it('save wirft CONFLICT bei veralteter Version', async () => {
        const p = await service.createProject({ name: 'A', data: {} });
        await storage.save(p.id, JSON_DATA, p.projectVersion); // version 1 → 2
        await assert.rejects(
            () => storage.save(p.id, JSON_DATA, 1),             // erwartet version 1, ist 2
            e => e instanceof CloudError && e.code === CloudErrorCodes.CONFLICT
        );
    });

});
