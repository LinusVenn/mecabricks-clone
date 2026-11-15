const FORMAT = 'mecabricks-component-template';
const LIBRARY_FORMAT = 'mecabricks-component-template-library';

function isFiniteVector(value) {
    return value && ['x', 'y', 'z'].every(key => Number.isFinite(Number(value[key])));
}

function validateTemplate(template) {
    if (!template || typeof template !== 'object') throw new Error('Die Vorlagendaten sind kein Objekt.');
    if (typeof template.name !== 'string' || !template.name.trim()) throw new Error('Der Vorlagenname fehlt.');
    if (!template.data || !Array.isArray(template.data.bricks) || template.data.bricks.length === 0) {
        throw new Error('Die Vorlage enthält keine Bauteile.');
    }
    if (!Array.isArray(template.data.connections)) throw new Error('Die Verbindungsdaten fehlen oder sind ungültig.');

    const ids = new Set();
    for (const brick of template.data.bricks) {
        if (!brick?.id || !brick?.type || !Number.isFinite(Number(brick.color))) {
            throw new Error('Ein Bauteil enthält unvollständige Basisdaten.');
        }
        if (ids.has(brick.id)) throw new Error(`Doppelte Bauteil-ID in der Vorlage: ${brick.id}`);
        ids.add(brick.id);
        if (!isFiniteVector(brick.position) || !isFiniteVector(brick.rotation)) {
            throw new Error(`Ungültige Transformation für Bauteil ${brick.id}.`);
        }
    }

    for (const connection of template.data.connections) {
        if (!connection?.sourceBrickId || !connection?.targetBrickId || !connection?.type) {
            throw new Error('Eine Verbindung enthält unvollständige Daten.');
        }
        if (!ids.has(connection.sourceBrickId) || !ids.has(connection.targetBrickId)) {
            throw new Error('Eine Verbindung verweist auf ein Bauteil außerhalb der Vorlage.');
        }
        if (connection.sourceBrickId === connection.targetBrickId) {
            throw new Error('Eine Vorlage darf keine Selbstverbindung enthalten.');
        }
        if (connection.position != null && !isFiniteVector(connection.position)) {
            throw new Error('Eine Verbindung besitzt eine ungültige Position.');
        }
    }
    return true;
}

function normalizeTemplate(source) {
    const now = new Date().toISOString();
    const template = JSON.parse(JSON.stringify(source));
    template.id = null; // Beim Import wird immer eine neue Vorlagen-ID erzeugt.
    template.schemaVersion = 1;
    template.name = template.name.trim();
    template.description = typeof template.description === 'string' ? template.description : '';
    template.category = typeof template.category === 'string' ? template.category : 'Allgemein';
    template.tags = Array.isArray(template.tags) ? template.tags.filter(tag => typeof tag === 'string') : [];
    template.createdAt = now;
    template.updatedAt = now;
    template.revision = 1;
    template.metadata = template.metadata && typeof template.metadata === 'object' ? template.metadata : {};
    validateTemplate(template);
    return template;
}

export class ComponentImporter {
    static parse(jsonString) {
        let payload;
        try {
            payload = JSON.parse(jsonString);
        } catch {
            throw new Error('Die JSON-Datei ist ungültig.');
        }

        if (payload?.format === FORMAT) {
            if (payload.formatVersion !== 1) throw new Error(`Nicht unterstützte Vorlagen-Version: ${payload.formatVersion}`);
            return [normalizeTemplate(payload.template)];
        }

        if (payload?.format === LIBRARY_FORMAT) {
            if (payload.formatVersion !== 1) throw new Error(`Nicht unterstützte Bibliotheks-Version: ${payload.formatVersion}`);
            if (!Array.isArray(payload.templates)) throw new Error('Die Bibliotheksdatei enthält kein Vorlagen-Array.');
            return payload.templates.map(normalizeTemplate);
        }

        // Kompatibler Import einer einzelnen Vorlage ohne äußeren Container.
        if (payload?.data?.bricks) return [normalizeTemplate(payload)];
        throw new Error('Unbekanntes Dateiformat. Erwartet wird eine Mecabricks-Komponentenvorlage.');
    }

    static async readFile(file) {
        if (!file) throw new Error('Es wurde keine Datei ausgewählt.');
        if (!file.name?.toLowerCase().endsWith('.json')) throw new Error('Bitte eine JSON-Datei auswählen.');
        return this.parse(await file.text());
    }
}
