import { PartCatalog } from './PartCatalog.js';

export class PartLibraryImporter {

    constructor(catalog = PartCatalog.instance()) {
        this.catalog = catalog;
    }

    async importFile(file, options = {}) {
        if (!(file instanceof Blob)) {
            throw new TypeError('Es wurde keine gültige Datei übergeben.');
        }

        const fileName = String(file.name ?? '').toLowerCase();
        const content = await file.text();

        if (fileName.endsWith('.json')) {
            return this.catalog.importJSON(content, options);
        }

        if (fileName.endsWith('.csv')) {
            return this.catalog.importCSV(content, options);
        }

        throw new Error(
            'Nicht unterstütztes Dateiformat. Erlaubt sind CSV und JSON.'
        );
    }

    importJSON(content, options = {}) {
        return this.catalog.importJSON(content, options);
    }

    importCSV(content, options = {}) {
        return this.catalog.importCSV(content, options);
    }

    exportJSON(options = {}) {
        return this.catalog.exportJSON(options);
    }
}