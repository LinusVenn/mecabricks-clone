
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';

/**
 * Erstellt einen konfigurierten Three.js LDrawLoader.
 *
 * Loader.setPath():
 *   Pfad für die eigentliche LDraw-Datei.
 *
 * Loader.setPartsLibraryPath():
 *   Pfad für referenzierte Bauteile, Unterteile und Primitive.
 */
export class LDrawLoaderFactory {

    constructor({
        manager = undefined,
        pathResolver
    } = {}) {

        if (!pathResolver) {
            throw new Error(
                'LDrawLoaderFactory: pathResolver fehlt.'
            );
        }

        this.manager = manager;
        this.pathResolver = pathResolver;
    }

    /**
     * Erstellt eine neue LDrawLoader-Instanz.
     *
     * @returns {LDrawLoader}
     */
    create() {

        const root = this.pathResolver.getLibraryRoot();

        if (typeof root !== 'string' || !root.trim()) {
            throw new Error(
                'LDrawLoaderFactory: Ungültiger Bibliothekspfad.'
            );
        }

        const loader = new LDrawLoader(this.manager);

        // Hauptdateien werden relativ zum Bibliotheksverzeichnis geladen.
        loader.setPath(root);

        // Referenzierte Dateien werden ebenfalls aus der Bibliothek geladen.
        loader.setPartsLibraryPath(root);

        // Glatte Normalen für runde und gekrümmte Bauteilgeometrien.
        loader.smoothNormals = true;

        return loader;
    }
}
