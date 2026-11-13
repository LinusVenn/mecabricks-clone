import { ComponentStorage } from './ComponentStorage.js';
import { ComponentExporter } from './ComponentExporter.js';
import { ComponentImporter } from './ComponentImporter.js';

function makeId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function finitePosition(position, fallback = { x: 0, y: 0, z: 0 }) {
    const result = {
        x: Number(position?.x ?? fallback.x),
        y: Number(position?.y ?? fallback.y),
        z: Number(position?.z ?? fallback.z)
    };
    if (!Object.values(result).every(Number.isFinite)) throw new Error('Die Position ist ungültig.');
    return result;
}

/**
 * Verwaltung der projektunabhängigen Baugruppenvorlagen.
 * Die Vorlagen werden aus den logischen Phase-8.3-Gruppen erzeugt.
 * Beim Einsetzen werden Brick- und Connection-IDs neu vergeben; es wird
 * keine Komponente in der projektbezogenen ComponentLibrary angelegt.
 */
export class ComponentTemplateManager {
    constructor({ library, connectionManager, groupManager, assemblyManager, historyManager = null, editor = null, storage = new ComponentStorage() }) {
        if (!library || !connectionManager || !groupManager) {
            throw new Error('ComponentTemplateManager benötigt PartLibrary, ConnectionManager und GroupManager.');
        }
        this.library = library;
        this.connectionManager = connectionManager;
        this.groupManager = groupManager;
        this.assemblyManager = assemblyManager || null;
        this.historyManager = historyManager;
        this.editor = editor;
        this.storage = storage;
    }

    async initialize() {
        return this.getAllTemplates();
    }

    _getAssembly(assemblyId) {
        const group = this.assemblyManager?.get?.(assemblyId)
            || this.groupManager.getGroup?.(assemblyId);
        if (!group) throw new Error(`Baugruppe ${assemblyId} wurde nicht gefunden.`);
        return group;
    }

    _createTemplateData(assemblyId, metadata = {}) {
        const group = this._getAssembly(assemblyId);
        if (!Array.isArray(group.brickIds) || group.brickIds.length === 0) {
            throw new Error('Die ausgewählte Baugruppe enthält keine Bauteile.');
        }

        const bricks = group.brickIds.map(id => this.library.getById(id));
        if (bricks.some(brick => !brick)) throw new Error('Die Baugruppe enthält Verweise auf nicht vorhandene Bauteile.');

        const sourceData = bricks.map(brick => brick.toData());
        const anchor = { ...sourceData[0].position };
        const brickIds = new Set(group.brickIds);
        const brickData = sourceData.map(data => {
            data.position.x -= anchor.x;
            data.position.y -= anchor.y;
            data.position.z -= anchor.z;
            return data;
        });

        const connectionData = this.connectionManager.toData()
            .filter(connection => brickIds.has(connection.sourceBrickId) && brickIds.has(connection.targetBrickId))
            .map(connection => {
                const data = deepClone(connection);
                if (data.position) {
                    data.position.x -= anchor.x;
                    data.position.y -= anchor.y;
                    data.position.z -= anchor.z;
                }
                return data;
            });

        return {
            bricks: brickData,
            connections: connectionData,
            groupName: group.name || 'Baugruppe'
        };
    }

    async saveTemplate(assemblyId, metadata = {}) {
        const data = this._createTemplateData(assemblyId, metadata);
        const now = new Date().toISOString();
        const template = {
            id: makeId('template'),
            schemaVersion: 1,
            name: String(metadata.name || data.groupName).trim(),
            description: String(metadata.description || ''),
            category: String(metadata.category || 'Allgemein'),
            tags: Array.isArray(metadata.tags) ? metadata.tags.map(String).filter(Boolean) : [],
            createdAt: now,
            updatedAt: now,
            revision: 1,
            metadata: {
                brickCount: data.bricks.length,
                connectionCount: data.connections.length,
            },
            data: {
                bricks: data.bricks,
                connections: data.connections
            }
        };
        if (!template.name) throw new Error('Der Vorlagenname darf nicht leer sein.');
        return this.storage.put(template);
    }

    async saveTemplateFromAssembly(assemblyId, metadata = {}) {
        return this.saveTemplate(assemblyId, metadata);
    }

    async getAllTemplates() {
        const items = await this.storage.getAll();
        return items.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }

    async getTemplate(templateId) {
        return this.storage.get(templateId);
    }

    async deleteTemplate(templateId) {
        return this.storage.delete(templateId);
    }

    async duplicateTemplate(templateId, newName = null) {
        const source = await this.getTemplate(templateId);
        if (!source) throw new Error('Die Vorlage wurde nicht gefunden.');
        const now = new Date().toISOString();
        const copy = deepClone(source);
        copy.id = makeId('template');
        copy.name = String(newName || `${source.name} (Kopie)`).trim();
        if (!copy.name) throw new Error('Der Vorlagenname darf nicht leer sein.');
        copy.createdAt = now;
        copy.updatedAt = now;
        copy.revision = 1;
        copy.metadata = { ...copy.metadata, sourceTemplateId: source.id };
        return this.storage.put(copy);
    }

    async renameTemplate(templateId, newName) {
        if (typeof newName !== 'string' || !newName.trim()) throw new Error('Der Vorlagenname darf nicht leer sein.');
        const template = await this.getTemplate(templateId);
        if (!template) throw new Error('Die Vorlage wurde nicht gefunden.');
        template.name = newName.trim();
        template.updatedAt = new Date().toISOString();
        template.revision = Number(template.revision || 1) + 1;
        return this.storage.put(template);
    }

    async updateTemplate(templateId, assemblyId, metadata = {}) {
        const template = await this.getTemplate(templateId);
        if (!template) throw new Error('Die Vorlage wurde nicht gefunden.');
        const data = this._createTemplateData(assemblyId, metadata);
        template.data = { bricks: data.bricks, connections: data.connections };
        template.metadata = {
            ...template.metadata,
            brickCount: data.bricks.length,
            connectionCount: data.connections.length,
        };
        if (metadata.name != null) {
            const nextName = String(metadata.name).trim();
            if (!nextName) throw new Error('Der Vorlagenname darf nicht leer sein.');
            template.name = nextName;
        }
        if (metadata.description != null) template.description = String(metadata.description);
        if (metadata.category != null) template.category = String(metadata.category);
        if (metadata.tags != null) template.tags = Array.isArray(metadata.tags) ? metadata.tags.map(String) : [];
        template.updatedAt = new Date().toISOString();
        template.revision = Number(template.revision || 1) + 1;
        return this.storage.put(template);
    }

    async insertTemplate(templateId, position = { x: 0, y: 0, z: 0 }) {
        const template = await this.getTemplate(templateId);
        if (!template) throw new Error('Die Vorlage wurde nicht gefunden.');
        const target = finitePosition(position);
        const data = deepClone(template.data);
        if (!Array.isArray(data?.bricks) || data.bricks.length === 0) throw new Error('Die Vorlage enthält keine Bauteile.');

        const idMap = new Map();
        const generatedIds = new Set();
        for (const brick of data.bricks) {
            let id;
            do { id = makeId('brick'); } while (generatedIds.has(id) || this.library.hasId?.(id));
            generatedIds.add(id);
            idMap.set(brick.id, id);
        }

        const createdBricks = [];
        let createdGroup = null;
        try {
            for (const source of data.bricks) {
                const brickData = deepClone(source);
                brickData.id = idMap.get(source.id);
                brickData.position = {
                    x: target.x + Number(source.position.x),
                    y: target.y + Number(source.position.y),
                    z: target.z + Number(source.position.z)
                };
                createdBricks.push(this.library.addBrickFromData(brickData));
            }

            for (const connection of data.connections || []) {
                const sourceId = idMap.get(connection.sourceBrickId);
                const targetId = idMap.get(connection.targetBrickId);
                if (!sourceId || !targetId) throw new Error('Eine Vorlagenverbindung verweist auf eine unbekannte Bauteil-ID.');
                const connectionPosition = connection.position
                    ? {
                        x: target.x + Number(connection.position.x),
                        y: target.y + Number(connection.position.y),
                        z: target.z + Number(connection.position.z)
                    }
                    : null;
                this.connectionManager.createConnection(
                    sourceId,
                    targetId,
                    connectionPosition,
                    connection.type
                );
            }

            createdGroup = this.groupManager.createGroup(createdBricks, template.name);
            this.historyManager?.saveState();
            this.editor?.multiSelectionManager?.setSelection?.(createdBricks);
            this.editor?._notifyGroupUI?.();
            return { template, group: createdGroup, bricks: createdBricks, idMap };
        } catch (error) {
            for (const brick of createdBricks) {
                this.connectionManager.removeConnections(brick.id);
                const group = this.groupManager.getGroupByBrickId?.(brick.id);
                if (group) this.groupManager.removeBrickFromGroup(group.id, brick.id);
                this.library.removeBrick(brick);
            }
            if (createdGroup?.id) this.groupManager.ungroup(createdGroup.id);
            throw error;
        }
    }

    async exportTemplate(templateId) {
        const template = await this.getTemplate(templateId);
        if (!template) throw new Error('Die Vorlage wurde nicht gefunden.');
        return ComponentExporter.exportTemplate(template);
    }

    async exportAllTemplates() {
        return ComponentExporter.exportAll(await this.getAllTemplates());
    }

    async importFile(file) {
        const imported = await ComponentImporter.readFile(file);
        const saved = [];
        for (const template of imported) {
            template.id = makeId('template');
            template.updatedAt = new Date().toISOString();
            saved.push(await this.storage.put(template));
        }
        return saved;
    }

    async importJSON(jsonString) {
        const imported = ComponentImporter.parse(jsonString);
        const saved = [];
        for (const template of imported) {
            template.id = makeId('template');
            template.updatedAt = new Date().toISOString();
            saved.push(await this.storage.put(template));
        }
        return saved;
    }
}
