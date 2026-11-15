
export class HierarchyManager {

    
constructor(scene, options = {}) {

    if (!scene) {
        throw new Error('HierarchyManager benötigt eine Szene.');
    }

    this.scene = scene;

    this.isExcluded = options.isExcluded ?? ((object) => {
        return (
            object.userData?.editorHelper === true ||
            object.userData?.excludeFromOutliner === true ||
            object.userData?.isHighlight === true ||
            object.isLight === true ||
            object.isCamera === true ||
            object.isHelper === true
        );
    });
}



    // ==========================================
    // Objekte der Szene abrufen
    // ==========================================

    getAllObjects() {

        const objects = [];

        const traverse = (object) => {

            if (this.isExcluded(object)) {
                return;
            }

            if (object !== this.scene) {
                objects.push(object);
            }

            for (const child of object.children) {
                traverse(child);
            }
        };

        for (const child of this.scene.children) {
            traverse(child);
        }

        return objects;
    }


    // ==========================================
    // Direkte Kinder abrufen
    // ==========================================

    getChildren(parent = this.scene) {

        return parent.children.filter(
            child => !this.isExcluded(child)
        );
    }


    // ==========================================
    // Elternobjekt abrufen
    // ==========================================

    getParent(object) {

        if (!object) {
            return null;
        }

        return object.parent;
    }


    // ==========================================
    // Objekt anhand seiner UUID finden
    // ==========================================

    getObjectById(uuid) {

        if (!uuid) {
            return null;
        }

        return this.getAllObjects().find(
            object => object.uuid === uuid
        ) ?? null;
    }


    // ==========================================
    // Objektnamen ermitteln
    // ==========================================

    getName(object) {

        if (!object) {
            return '';
        }

        return object.name || object.type || 'Unbenanntes Objekt';
    }


    // ==========================================
    // Objekt umbenennen
    // ==========================================

    renameObject(object, newName) {

        if (!object || object === this.scene) {
            return false;
        }

        if (this.isLocked(object)) {
            return false;
        }

        const name = String(newName).trim();

        if (!name) {
            return false;
        }

        object.name = name;

        return true;
    }


    // ==========================================
    // Prüfen, ob ein Objekt gesperrt ist
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
    // Prüfen, ob Verschieben erlaubt ist
    // ==========================================

    canReparent(object, newParent) {

        if (!object || !newParent) {
            return false;
        }

        if (object === this.scene || object === newParent) {
            return false;
        }

        if (object === this.scene || this.isLocked(object)) {
            return false;
        }

        if (this.isLocked(newParent)) {
            return false;
        }

        if (this.isExcluded(object) || this.isExcluded(newParent)) {
            return false;
        }

        // Das neue Elternobjekt darf nicht das Objekt selbst
        // oder ein Nachfahre des Objekts sein.

        let current = newParent;

        while (current) {

            if (current === object) {
                return false;
            }

            current = current.parent;
        }

        return true;
    }


    // ==========================================
    // Objekt in eine andere Gruppe verschieben
    // ==========================================

    reparentObject(object, newParent) {

        if (!this.canReparent(object, newParent)) {
            return false;
        }

        // Welttransformation vor dem Verschieben aktualisieren.

        this.scene.updateMatrixWorld(true);

        // attach erhält die Welttransformation des Objekts.

        newParent.attach(object);

        this.scene.updateMatrixWorld(true);

        return true;
    }


    // ==========================================
    // Objekt zurück zur Szene verschieben
    // ==========================================

    moveToRoot(object) {

        return this.reparentObject(object, this.scene);
    }


    // ==========================================
    // Gruppen erkennen
    // ==========================================

    isGroup(object) {

        return object?.isGroup === true;
    }


    // ==========================================
    // Objektart für den Outliner bestimmen
    // ==========================================

    getObjectType(object) {

        if (object.isGroup) {
            return 'Gruppe';
        }

        if (object.isMesh) {
            return 'Bauteil';
        }

        if (object.isLight) {
            return 'Licht';
        }

        if (object.isCamera) {
            return 'Kamera';
        }

        return object.type || 'Objekt';
    }


    // ==========================================
    // Anzahl aller Objekte ermitteln
    // ==========================================

    getObjectCount() {

        return this.getAllObjects().length;
    }


    // ==========================================
    // Prüfen, ob ein Objekt ausgeschlossen ist
    // ==========================================

    isObjectExcluded(object) {

        return this.isExcluded(object);
    }

}
