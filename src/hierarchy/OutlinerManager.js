
import { HierarchyManager } from './HierarchyManager.js';
import { ObjectVisibilityManager } from './ObjectVisibilityManager.js';

export class OutlinerManager {

    
constructor(scene, options = {}) {
    this.scene = scene;

    this.library = options.library ?? null;
    this.groupManager = options.groupManager ?? null;
    this.connectionManager = options.connectionManager ?? null;

    this.hierarchyManager = new HierarchyManager(scene);

    // Gemeinsame Instanz für Outliner und IsolationManager.
    this.visibilityManager =
        options.visibilityManager ??
        new ObjectVisibilityManager(scene);

    this.ownsVisibilityManager = !options.visibilityManager;

    this.selectedObjects = [];
    this.listeners = new Set();

    this.onSelectionChange = options.onSelectionChange ?? null;
    this.onDeleteSelection = options.onDeleteSelection ?? null;
    this.onChange = options.onChange ?? null;

    this.isDisposed = false;
}


    // --------------------------------------------------
    // Listener
    // --------------------------------------------------

    subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('Listener muss eine Funktion sein.');
        }

        this.listeners.add(callback);

        return () => {
            this.listeners.delete(callback);
        };
    }

    notify(type = 'change', data = null) {
        const event = {
            type,
            data,
            selection: this.getSelection()
        };

        for (const listener of this.listeners) {
            listener(event);
        }

        this.onChange?.(event);
    }

    refresh() {
        this.notify('refresh');
    }

    // --------------------------------------------------
    // Szenenobjekte und Bauteile
    // --------------------------------------------------

    getBrickId(object) {
        let current = object;

        while (current) {
            if (current.userData?.brickId !== undefined) {
                return current.userData.brickId;
            }

            current = current.parent;
        }

        return null;
    }

    getBrickObject(brickId) {
        let result = null;

        this.scene.traverse(object => {
            if (
                !result &&
                object.userData?.brickId === brickId
            ) {
                result = object;
            }
        });

        return result;
    }

    getBrickObjects() {
        const result = [];

        this.scene.traverse(object => {
            if (object.userData?.brickId !== undefined) {
                result.push(object);
            }
        });

        return result;
    }

    getHierarchy() {
        const brickObjects = this.getBrickObjects();

        const groups = this.groupManager?.getAllGroups() ?? [];

        const groupedIds = new Set();

        const entries = [];

        // Logische Gruppen als virtuelle Outliner-Einträge
        for (const group of groups) {
            const children = [];

            for (const brickId of group.brickIds) {
                groupedIds.add(brickId);

                const object = this.getBrickObject(brickId);

                if (object) {
                    children.push({
                        kind: 'object',
                        id: object.uuid,
                        object,
                        name: this.hierarchyManager.getName(object),
                        children: []
                    });
                }
            }

            entries.push({
                kind: 'group',
                id: group.id,
                name: group.name,
                group,
                children
            });
        }

        // Nicht gruppierte Bauteile
        for (const object of brickObjects) {
            const brickId = this.getBrickId(object);

            if (groupedIds.has(brickId)) {
                continue;
            }

            entries.push({
                kind: 'object',
                id: object.uuid,
                object,
                name: this.hierarchyManager.getName(object),
                children: []
            });
        }

        // Weitere Szenenobjekte, beispielsweise zusätzliche
        // Mesh-Gruppen, die keine Bauteile sind.
        for (const object of this.scene.children) {
            if (this.hierarchyManager.isObjectExcluded(object)) {
                continue;
            }

            if (
                object.isLight ||
                object.isCamera ||
                object.isGridHelper ||
                object.isAxesHelper
            ) {
                continue;
            }

            if (this.getBrickId(object) !== null) {
                continue;
            }

            entries.push({
                kind: 'object',
                id: object.uuid,
                object,
                name: this.hierarchyManager.getName(object),
                children: this.hierarchyManager
                    .getChildren(object)
                    .map(child => ({
                        kind: 'object',
                        id: child.uuid,
                        object: child,
                        name: this.hierarchyManager.getName(child),
                        children: []
                    }))
            });
        }

        return entries;
    }

    // --------------------------------------------------
    // Auswahl
    // --------------------------------------------------

    getSelection() {
        return [...this.selectedObjects];
    }

    selectObject(object, additive = false) {
        if (!object) return;

        if (this.hierarchyManager.isObjectExcluded(object)) {
            return;
        }

        if (this.hierarchyManager.isLocked(object)) {
            return;
        }

        if (!additive) {
            this.selectedObjects = [object];
        } else if (!this.selectedObjects.includes(object)) {
            this.selectedObjects.push(object);
        }

        this._selectionChanged();
    }

    selectObjects(objects) {
        const validObjects = objects.filter(object =>
            object &&
            !this.hierarchyManager.isObjectExcluded(object) &&
            !this.hierarchyManager.isLocked(object)
        );

        this.selectedObjects = [...new Set(validObjects)];

        this._selectionChanged();
    }

    selectEntry(entry, additive = false) {
        if (!entry) return;

        if (entry.kind === 'group') {
            const objects = entry.children
                .map(child => child.object)
                .filter(Boolean);

            if (additive) {
                this.selectObjects([
                    ...this.selectedObjects,
                    ...objects
                ]);
            } else {
                this.selectObjects(objects);
            }

            return;
        }

        this.selectObject(entry.object, additive);
    }

    clearSelection() {
        this.selectedObjects = [];
        this._selectionChanged();
    }

    _selectionChanged() {
        const selection = this.getSelection();

        this.onSelectionChange?.(selection);

        this.notify('selection', selection);
    }

    // --------------------------------------------------
    // Umbenennen
    // --------------------------------------------------

    renameObject(object, newName) {
        const success = this.hierarchyManager.renameObject(
            object,
            newName
        );

        if (success) {
            this.notify('rename', object);
        }

        return success;
    }

    renameGroup(groupId, newName) {
        if (!this.groupManager) return false;

        const success = this.groupManager.renameGroup(
            groupId,
            newName
        );

        if (success) {
            this.notify('rename-group', {
                groupId,
                newName
            });
        }

        return success;
    }

    // --------------------------------------------------
    // Gruppenmitgliedschaft
    // --------------------------------------------------

    
moveObjectToGroup(object, targetGroupId = null) {
    if (!this.groupManager || !object) return false;

    const brickId = this.getBrickId(object);

    if (brickId === null || brickId === undefined) return false;

    const currentGroup = this.groupManager.getGroupByBrickId(brickId);

    if (currentGroup?.id === targetGroupId) return false;

    // Zielgruppe zuerst validieren.
    if (targetGroupId && !this.groupManager.getGroup(targetGroupId)) {
        return false;
    }

    // Erst nach erfolgreicher Validierung die alte Gruppe ändern.
    if (currentGroup) {
        this.groupManager.removeBrickFromGroup(
            currentGroup.id,
            brickId
        );
    }

    if (targetGroupId) {
        const success = this.groupManager.addBrickToGroup(
            targetGroupId,
            brickId
        );

        if (!success) {
            // Rollback, falls das Hinzufügen unerwartet fehlschlägt.
            if (currentGroup) {
                this.groupManager.addBrickToGroup(
                    currentGroup.id,
                    brickId
                );
            }

            return false;
        }
    }

    this.notify('group-membership', {
        object,
        targetGroupId
    });

    return true;
}


    moveObject(object, target) {
        if (!object || !target) return false;

        if (target.kind === 'group') {
            return this.moveObjectToGroup(
                object,
                target.group.id
            );
        }

        return false;
    }

    // --------------------------------------------------
    // Sichtbarkeit
    // --------------------------------------------------

    isVisible(object) {
        return this.visibilityManager.isVisible(object);
    }

    toggleVisibility(entry) {
        if (!entry) return false;

        if (entry.kind === 'group') {
            const objects = entry.children
                .map(child => child.object)
                .filter(Boolean);

            if (objects.length === 0) return false;

            const allVisible = objects.every(
                object => this.isVisible(object)
            );

            for (const object of objects) {
                this.visibilityManager.setVisible(
                    object,
                    !allVisible
                );
            }

            this.notify('visibility-group', {
                group: entry.group,
                visible: !allVisible
            });

            return !allVisible;
        }

        const visible = this.visibilityManager.toggleVisibility(
            entry.object
        );

        this.notify('visibility', {
            object: entry.object,
            visible
        });

        return visible;
    }

    // --------------------------------------------------
    // Sperren
    // --------------------------------------------------

    isLocked(object) {
        return this.visibilityManager.isLocked(object);
    }

    toggleLock(entry) {
        if (!entry) return false;

        if (entry.kind === 'group') {
            const objects = entry.children
                .map(child => child.object)
                .filter(Boolean);

            if (objects.length === 0) return false;

            const allLocked = objects.every(
                object => this.isLocked(object)
            );

            for (const object of objects) {
                this.visibilityManager.setLocked(
                    object,
                    !allLocked
                );
            }

            this.selectedObjects = this.selectedObjects.filter(
                selected => !objects.includes(selected)
            );

            this._selectionChanged();

            this.notify('lock-group', {
                group: entry.group,
                locked: !allLocked
            });

            return !allLocked;
        }

        const locked = this.visibilityManager.toggleLocked(
            entry.object
        );

        if (locked) {
            this.selectedObjects = this.selectedObjects.filter(
                selected => selected !== entry.object
            );

            this._selectionChanged();
        }

        this.notify('lock', {
            object: entry.object,
            locked
        });

        return locked;
    }

    // --------------------------------------------------
    // Isolation
    // --------------------------------------------------

    isolateSelection() {
        if (this.selectedObjects.length === 0) {
            return false;
        }

        this.visibilityManager.isolate(this.selectedObjects);

        this.notify('isolate');

        return true;
    }

    exitIsolation() {
        this.visibilityManager.exitIsolation();

        this.notify('isolation-ended');
    }

    isIsolating() {
        return this.visibilityManager.isIsolating();
    }

    showAll() {
        this.visibilityManager.resetVisibility();

        this.notify('visibility-reset');
    }

    // --------------------------------------------------
    // Löschen
    // --------------------------------------------------

    removeSelection() {
        if (this.selectedObjects.length === 0) {
            return false;
        }

        if (typeof this.onDeleteSelection !== 'function') {
            console.warn(
                'OutlinerManager: Kein Lösch-Callback registriert.'
            );

            return false;
        }

        this.onDeleteSelection(this.getSelection());

        this.notify('delete-selection');

        return true;
    }

    removeObject(object) {
        if (!object) return false;

        this.selectObject(object);

        return this.removeSelection();
    }

    // --------------------------------------------------
    // Aufräumen
    // --------------------------------------------------

    
    dispose() {
        if (this.isDisposed) return;

        this.listeners.clear();
        this.selectedObjects = [];

        if (this.ownsVisibilityManager) {
            this.visibilityManager.dispose();
        }

        this.isDisposed = true;
    }

}
