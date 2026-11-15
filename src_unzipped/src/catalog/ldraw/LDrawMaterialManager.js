
/**
 * Lädt die offiziellen LDraw-Farbdefinitionen in einen LDrawLoader.
 *
 * Die eigentliche Verarbeitung der !COLOUR-Definitionen übernimmt
 * Three.js LDrawLoader.
 */
export class LDrawMaterialManager {

    constructor(pathResolver) {

        if (!pathResolver) {
            throw new Error(
                'LDrawMaterialManager: pathResolver fehlt.'
            );
        }

        this.pathResolver = pathResolver;

        /*
         * WeakMap:
         *
         * Loader -> Promise
         *
         * Verhindert mehrfaches Laden derselben LDConfig.ldr-Datei
         * für denselben Loader.
         */
        this.initializationPromises = new WeakMap();
    }

    /**
     * Lädt die offiziellen LDraw-Farbdefinitionen.
     *
     * @param {LDrawLoader} loader
     * @returns {Promise<void>}
     */
    async initialize(loader) {

        if (
            !loader ||
            typeof loader.preloadMaterials !== 'function' ||
            typeof loader.setPath !== 'function'
        ) {
            throw new TypeError(
                'LDrawMaterialManager: ungültiger LDrawLoader.'
            );
        }

        const existingPromise =
            this.initializationPromises.get(loader);

        if (existingPromise) {
            return existingPromise;
        }

        const root = this.pathResolver.getLibraryRoot();

        if (!root) {
            throw new Error(
                'LDrawMaterialManager: Bibliothekspfad fehlt.'
            );
        }

        /*
         * preloadMaterials() verwendet intern loader.path.
         * Daher muss setPath() vor dem Aufruf gesetzt werden.
         */
        loader.setPath(root);

        const initialization = (async () => {

            try {

                /*
                 * LDConfig.ldr enthält die offiziellen
                 * LDraw-Farbdefinitionen.
                 *
                 * Der Dateiname ist relativ zum gesetzten
                 * Loader-Pfad.
                 */
                await loader.preloadMaterials('LDConfig.ldr');

            } catch (error) {

                throw new Error(
                    `LDraw-Farbtabelle konnte nicht geladen werden: ${error.message}`,
                    { cause: error }
                );
            }

        })();

        this.initializationPromises.set(
            loader,
            initialization
        );

        try {

            await initialization;

        } catch (error) {

            /*
             * Nur den fehlgeschlagenen Initialisierungsvorgang
             * entfernen. Ein erneuter Versuch bleibt möglich.
             */
            if (
                this.initializationPromises.get(loader) ===
                initialization
            ) {
                this.initializationPromises.delete(loader);
            }

            throw error;
        }
    }

    /**
     * Prüft, ob ein Loader bereits initialisiert wurde.
     *
     * Hinweis:
     * Die Promise wird unmittelbar vor dem Start des Ladevorgangs
     * registriert. Diese Methode liefert deshalb auch während
     * einer laufenden Initialisierung true.
     */
    isInitialized(loader) {

        return Boolean(
            loader &&
            this.initializationPromises.has(loader)
        );
    }
}
