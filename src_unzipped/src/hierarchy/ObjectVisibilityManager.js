
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

    // --------------------------------------------------
    // Sichtbarkeit
    // --------------------------------------------------

    setVisible(object, visible) {
        if (!object || object === this.scene) return false;

        const value = Boolean(visible);

        if (value) {
            this.hiddenObjects.delete(object);
        } else {
            this.hiddenObjects.add(object);
        }

        if (this.isolationActive) {
            // Snapshot enthält während der Isolation den gewünschten
            // Zustand nach Beendigung der Isolation.
            this.visibilityBeforeIsolation.set(object, value);

            object.visible = value && this.isolatedObjects.has(object);
        } else {
            object.visible = value;
        }

        return true;
    }

    toggleVisibility(object) {
        if (!object) return false;

        const currentValue = this.isolationActive &&
            this.visibilityBeforeIsolation.has(object)
            ? this.visibilityBeforeIsolation.get(object)
            : object.visible;

        const nextValue = !currentValue;

        this.setVisible(object, nextValue);

        return nextValue;
    }

    isVisible(object) {
        if (!object) return false;

        let current = object;

        while (current) {
            if (current.visible === false) return false;
            current = current.parent;
        }

        return true;
    }

    hideHierarchy(object) {
        if (!object) return;

        object.traverse(child => {
            if (child !== this.scene) {
                this.setVisible(child, false);
            }
        });
    }

    showHierarchy(object) {
        if (!object) return;

        object.traverse(child => {
            if (child !== this.scene) {
                this.setVisible(child, true);
            }
        });
    }

    // --------------------------------------------------
    // Sperren
    // --------------------------------------------------

    setLocked(object, locked) {
        if (!object || object === this.scene) return false;

        const value = Boolean(locked);

        object.userData.editorLocked = value;

        if (value) {
            this.lockedObjects.add(object);
        } else {
            this.lockedObjects.delete(object);
        }

        return true;
    }

    toggleLocked(object) {
        if (!object) return false;

        const nextValue = !this.isLocked(object);

        this.setLocked(object, nextValue);

        return nextValue;
    }

    isLocked(object) {
        let current = object;

        while (current && current !== this.scene) {
            if (
                current.userData?.editorLocked === true ||
                current.userData?.locked === true
            ) {
                return true;
            }

            current = current.parent;
        }

        return false;
    }

    // --------------------------------------------------
    // Isolation
    // --------------------------------------------------

    isolate(objects) {
        this.exitIsolation();

        const selected = Array.isArray(objects) ? objects : [objects];

        const validObjects = selected.filter(
            object => object && object !== this.scene
        );

        if (validObjects.length === 0) return false;

        this.isolatedObjects.clear();

        for (const object of validObjects) {
            // Ausgewählte Objekte und alle Vorfahren zulassen.
            let current = object;

            while (current && current !== this.scene) {
                this.isolatedObjects.add(current);
                current = current.parent;
            }

            // Alle Nachfahren ebenfalls zulassen.
            object.traverse(child => {
                this.isolatedObjects.add(child);
            });
        }

        // Geschützte Objekte und ihre Vorfahren sichtbar halten.
        this.scene.traverse(object => {
            if (!this.isProtectedObject(object)) return;

            let current = object;

            while (current && current !== this.scene) {
                this.isolatedObjects.add(current);
                current = current.parent;
            }

            object.traverse(child => {
                this.isolatedObjects.add(child);
            });
        });

        this.visibilityBeforeIsolation.clear();

        this.scene.traverse(object => {
            if (object === this.scene) return;

            this.visibilityBeforeIsolation.set(
                object,
                object.visible
            );
        });

        this.isolationActive = true;

        this.scene.traverse(object => {
            if (object === this.scene) return;

            const originallyVisible =
                this.visibilityBeforeIsolation.get(object);

            object.visible =
                originallyVisible &&
                this.isolatedObjects.has(object);
        });

        return true;
    }

    exitIsolation() {
        if (!this.isolationActive) return false;

        for (const [object, visible] of this.visibilityBeforeIsolation) {
            if (!object) continue;

            object.visible = visible;
        }

        this.visibilityBeforeIsolation.clear();
        this.isolatedObjects.clear();
        this.isolationActive = false;

        return true;
    }

    isIsolating() {
        return this.isolationActive;
    }

    // --------------------------------------------------
    // Alles einblenden
    // --------------------------------------------------

    resetVisibility() {
        this.exitIsolation();

        this.hiddenObjects.clear();

        this.scene.traverse(object => {
            if (object === this.scene) return;

            object.visible = true;
        });
    }

    // --------------------------------------------------
    // Aufräumen
    // --------------------------------------------------

    dispose() {
        this.exitIsolation();

        this.hiddenObjects.clear();
        this.lockedObjects.clear();
        this.isolatedObjects.clear();
        this.visibilityBeforeIsolation.clear();
    }

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
}
