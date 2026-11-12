
export class ObjectVisibilityManager {

    constructor(scene) {

        if (!scene) {
            throw new Error('ObjectVisibilityManager benötigt eine Szene.');
        }

        this.scene = scene;

        this.hiddenObjects = new Set();
        this.lockedObjects = new Set();

        this.isolationActive = false;
        this.isolatedObjects = new Set();

        this.visibilityBeforeIsolation = new Map();
    }


    // ==========================================
    // Sichtbarkeit ändern
    // ==========================================

    setVisible(object, visible) {

        if (!object || object === this.scene) {
            return false;
        }

        object.visible = Boolean(visible);

        if (object.visible) {
            this.hiddenObjects.delete(object);
        } else {
            this.hiddenObjects.add(object);
        }

        return true;
    }


    // ==========================================
    // Sichtbarkeit umschalten
    // ==========================================

    toggleVisibility(object) {

        if (!object) {
            return false;
        }

        return this.setVisible(object, !object.visible);
    }


    // ==========================================
    // Objekt sperren
    // ==========================================

    setLocked(object, locked) {

        if (!object || object === this.scene) {
            return false;
        }

        const value = Boolean(locked);

        object.userData.editorLocked = value;

        if (value) {
            this.lockedObjects.add(object);
        } else {
            this.lockedObjects.delete(object);
        }

        return true;
    }


    // ==========================================
    // Sperrstatus umschalten
    // ==========================================

    toggleLocked(object) {

        if (!object) {
            return false;
        }

        return this.setLocked(
            object,
            !this.isLocked(object)
        );
    }


    // ==========================================
    // Sperrstatus prüfen
    // ==========================================

    
isLocked(object) {

    let current = object;

    while (current && current !== this.scene) {

        if (current.userData?.editorLocked === true) {
            return true;
        }

        current = current.parent;
    }

    return false;
}



    // ==========================================
    // Sichtbarkeit prüfen
    // ==========================================

    isVisible(object) {

        return object?.visible === true;
    }


    // ==========================================
    // Alle Objekte einer Gruppe ausblenden
    // ==========================================

    hideHierarchy(object) {

        if (!object) {
            return;
        }

        object.traverse(child => {
            this.setVisible(child, false);
        });
    }


    // ==========================================
    // Alle Objekte einer Gruppe einblenden
    // ==========================================

    showHierarchy(object) {

        if (!object) {
            return;
        }

        object.traverse(child => {
            this.setVisible(child, true);
        });
    }


    // ==========================================
    // Isolationsmodus aktivieren
    // ==========================================

    isolate(objects) {

        this.exitIsolation();

        const selected = Array.isArray(objects)
            ? objects
            : [objects];

        const validObjects = selected.filter(
            object => object && object !== this.scene
        );

        if (validObjects.length === 0) {
            return false;
        }

        this.isolationActive = true;

        this.isolatedObjects.clear();

        // Die ausgewählten Objekte und ihre Vorfahren
        // bleiben sichtbar.

        for (const object of validObjects) {

            let current = object;

            while (current && current !== this.scene) {

                this.isolatedObjects.add(current);

                current = current.parent;
            }

            // Auch alle Nachfahren der Auswahl bleiben sichtbar.

            object.traverse(child => {
                this.isolatedObjects.add(child);
            });
        }

        // Ursprüngliche Sichtbarkeit speichern.

        this.scene.traverse(object => {

            if (object === this.scene) {
                return;
            }

            this.visibilityBeforeIsolation.set(
                object,
                object.visible
            );

            object.visible = this.isolatedObjects.has(object);
        });

        return true;
    }


    // ==========================================
    // Isolationsmodus beenden
    // ==========================================

    exitIsolation() {

        if (!this.isolationActive) {
            return;
        }

        for (const [object, visible] of this.visibilityBeforeIsolation) {

            object.visible = visible;
        }

        this.visibilityBeforeIsolation.clear();

        this.isolatedObjects.clear();

        this.isolationActive = false;
    }


    // ==========================================
    // Status Isolationsmodus
    // ==========================================

    isIsolating() {

        return this.isolationActive;
    }


    // ==========================================
    // Sichtbarkeit aller Objekte zurücksetzen
    // ==========================================

    resetVisibility() {

        this.exitIsolation();

        this.scene.traverse(object => {

            if (object === this.scene) {
                return;
            }

            this.setVisible(object, true);
        });
    }


    // ==========================================
    // Aufräumen
    // ==========================================

    dispose() {

        this.exitIsolation();

        this.hiddenObjects.clear();
        this.lockedObjects.clear();
    }

}
