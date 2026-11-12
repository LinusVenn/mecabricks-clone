
export class IsolationManager {

    constructor(scene, library) {
        if (!scene) {
            throw new Error(
                'IsolationManager: Three.js-Szene fehlt.'
            );
        }

        if (!library) {
            throw new Error(
                'IsolationManager: PartLibrary fehlt.'
            );
        }

        this.scene = scene;
        this.library = library;

        this.isolationActive = false;
        this.visibilitySnapshot = new Map();
    }

    // --------------------------------------------------
    // Isolation starten
    // --------------------------------------------------

    isolate(bricks) {
        if (!Array.isArray(bricks) || bricks.length === 0) {
            return false;
        }

        // Eine bestehende Isolation zuerst sauber beenden.
        this.exitIsolation();

        const selectedObjects = bricks
            .map(brick => this.getObject(brick))
            .filter(Boolean);

        if (selectedObjects.length === 0) {
            return false;
        }

        const selectedRoots = new Set(selectedObjects);

        // Alle ausgewählten Objekte und deren Eltern
        // müssen sichtbar bleiben.
        const allowedObjects = new Set();

        for (const object of selectedRoots) {
            let current = object;

            while (current) {
                allowedObjects.add(current);
                current = current.parent;
            }

            // Auch die untergeordneten Meshes bleiben sichtbar.
            object.traverse(child => {
                allowedObjects.add(child);
            });
        }

        // Ursprüngliche Sichtbarkeit sichern.
        this.scene.traverse(object => {
            this.visibilitySnapshot.set(
                object,
                object.visible
            );
        });

        // Alle nicht ausgewählten Szenenobjekte ausblenden.
        this.scene.traverse(object => {
            if (object === this.scene) return;

            if (this.isProtectedObject(object)) {
                return;
            }

            if (!allowedObjects.has(object)) {
                object.visible = false;
            }
        });

        this.isolationActive = true;

        return true;
    }

    // --------------------------------------------------
    // Isolation beenden
    // --------------------------------------------------

    exitIsolation() {
        if (!this.isolationActive) {
            return false;
        }

        for (const [object, visible] of this.visibilitySnapshot) {
            if (!object) continue;

            object.visible = visible;
        }

        this.visibilitySnapshot.clear();

        this.isolationActive = false;

        return true;
    }

    // --------------------------------------------------
    // Status
    // --------------------------------------------------

    isIsolating() {
        return this.isolationActive;
    }

    // --------------------------------------------------
    // Alle Objekte wieder anzeigen
    // --------------------------------------------------

    showAll() {
        this.exitIsolation();

        this.scene.traverse(object => {
            if (object === this.scene) return;

            if (this.isProtectedObject(object)) {
                return;
            }

            object.visible = true;
        });
    }

    // --------------------------------------------------
    // Geschützte Szenenobjekte
    // --------------------------------------------------

    isProtectedObject(object) {
        return (
            object.isLight ||
            object.isCamera ||
            object.isGridHelper ||
            object.isAxesHelper ||
            object.userData?.excludeFromOutliner === true ||
            object.userData?.keepVisibleDuringIsolation === true
        );
    }

    // --------------------------------------------------
    // Bauteilobjekt ermitteln
    // --------------------------------------------------

    getObject(brick) {
        if (!brick) return null;

        if (brick.group?.isObject3D) {
            return brick.group;
        }

        if (brick.object?.isObject3D) {
            return brick.object;
        }

        if (brick.mesh?.isObject3D) {
            return brick.mesh;
        }

        // Fallback: Bauteil anhand seiner ID in der Szene suchen.
        let result = null;

        this.scene.traverse(object => {
            if (
                !result &&
                object.userData?.brickId === brick.id
            ) {
                result = object;
            }
        });

        return result;
    }

    // --------------------------------------------------
    // Aufräumen
    // --------------------------------------------------

    dispose() {
        this.exitIsolation();

        this.visibilitySnapshot.clear();
    }
}
