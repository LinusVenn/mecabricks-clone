export class ComponentExporter {
    static toJSON(template) {
        if (!template || !template.id || !template.data) {
            throw new Error('Ungültige Vorlage: Export nicht möglich.');
        }
        return JSON.stringify({
            format: 'mecabricks-component-template',
            formatVersion: 1,
            template
        }, null, 2);
    }

    static exportTemplate(template) {
        const json = this.toJSON(template);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = (template.name || 'Komponente').replace(/[^a-z0-9_-]/gi, '_');
        link.href = url;
        link.download = `${safeName}.component.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return json;
    }

    static exportAll(templates) {
        const json = JSON.stringify({
            format: 'mecabricks-component-template-library',
            formatVersion: 1,
            templates
        }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mecabricks-component-library.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return json;
    }
}
