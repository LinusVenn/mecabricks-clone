
export class AdvancedSelectionManager {
    constructor({
        library,
        groupManager = null,
        multiSelectionManager,
        selectionManager = null,
        selectionFilter = null
    } = {}) {
        if (!library) {
            throw new Error('AdvancedSelectionManager: PartLibrary fehlt.');
        }

        if (!multiSelectionManager) {
            throw new Error('AdvancedSelectionManager: MultiSelectionManager fehlt.');
        }

        this.library = library;
        this.groupManager = groupManager;
        this.multiSelectionManager = multiSelectionManager;
        this.selectionManager = selectionManager;
        this.selectionFilter = selectionFilter;

        this.selectedBricks = [];
        this.onSelectionChange = null;
    }

    getAllBricks() {
        if (typeof this.library.getAll === 'function') {
            return this.library.getAll();
        }

        return Array.isArray(this.library.bricks)
            ? [...this.library.bricks]
            : [];
    }

    // --------------------------------------------------
    // Auswahl auslesen
    // --------------------------------------------------

    getSelection() {
        const selected = new Map();

        // Mehrfachauswahl über IDs auslesen.
        if (typeof this.multiSelectionManager.getSelectedIds === 'function') {
            for (const id of this.multiSelectionManager.getSelectedIds()) {
                const brick = this.library.getById(id);
                if (brick) selected.set(brick.id, brick);
            }
        } else if (Array.isArray(this.multiSelectionManager.selectedBricks)) {
            for (const brick of this.multiSelectionManager.selectedBricks) {
                if (brick?.id) selected.set(brick.id, brick);
            }
        } else if (typeof this.multiSelectionManager.getSelection === 'function') {
            for (const item of this.multiSelectionManager.getSelection()) {
                const brick = typeof item === 'string'
                    ? this.library.getById(item)
                    : item;

                if (brick?.id) selected.set(brick.id, brick);
            }
        }

        // Normale Einzelauswahl ergänzen.
        const selectedObject = this.selectionManager?.selectedObject;
        const singleId = this.getBrickId(selectedObject);

        if (singleId) {
            const brick = this.library.getById(singleId);
            if (brick) selected.set(brick.id, brick);
        }

        // Fallback für Implementierungen ohne öffentliche Getter.
        if (selected.size === 0 && this.selectedBricks.length > 0) {
            for (const brick of this.selectedBricks) {
                if (brick?.id) selected.set(brick.id, brick);
            }
        }

        this.selectedBricks = [...selected.values()];

        return [...this.selectedBricks];
    }

    // --------------------------------------------------
    // Auswahl setzen
    // --------------------------------------------------

    setSelection(bricks) {
        const validBricks = this.filterSelectable(bricks);

        this.selectedBricks = [
            ...new Map(validBricks.map(brick => [brick.id, brick])).values()
        ];

        const ids = this.selectedBricks.map(brick => brick.id);

        this.multiSelectionManager.setSelection(ids);

        // Falls die Editor-Callbacks keine Einzelauswahl setzen,
        // wird sie hier zusätzlich synchronisiert.
        if (this.selectionManager) {
            if (this.selectedBricks.length === 1) {
                const object = this.getObject(this.selectedBricks[0]);

                if (object) {
                    this.selectionManager.selectObject(object);
                }
            } else if (this.selectedBricks.length === 0) {
                this.selectionManager.clearSelection();
            } else {
                this.selectionManager.clearSelection();
            }
        }

        const result = this.getSelection();

        this.onSelectionChange?.(result);

        return result;
    }

    addToSelection(bricks) {
        return this.setSelection([
            ...this.getSelection(),
            ...(Array.isArray(bricks) ? bricks : [bricks])
        ]);
    }

    removeFromSelection(bricks) {
        const removeIds = new Set(
            (Array.isArray(bricks) ? bricks : [bricks])
                .filter(Boolean)
                .map(brick => brick.id)
        );

        return this.setSelection(
            this.getSelection().filter(brick => !removeIds.has(brick.id))
        );
    }

    clearSelection() {
        this.selectedBricks = [];

        this.multiSelectionManager.clearSelection?.();

        if (this.selectionManager) {
            this.selectionManager.clearSelection();
        }

        this.onSelectionChange?.([]);

        return [];
    }

    // --------------------------------------------------
    // Auswahlmöglichkeiten
    // --------------------------------------------------

    selectAll() {
        return this.setSelection(this.getAllBricks());
    }

    selectFiltered(criteria = {}) {
        if (!this.selectionFilter) {
            throw new Error('AdvancedSelectionManager: Kein SelectionFilter vorhanden.');
        }

        return this.setSelection(this.selectionFilter.filter(criteria));
    }

    selectByType(type) {
        return this.selectFiltered({ type });
    }

    selectByColor(color) {
        return this.selectFiltered({ color });
    }

    selectByMaterial(material) {
        return this.selectFiltered({ material });
    }

    selectByName(name) {
        return this.selectFiltered({ name });
    }

    selectBySpatialCriteria(spatial) {
        return this.selectFiltered({ spatial });
    }

    selectGroup(groupId) {
        if (!this.groupManager) return [];

        const group = this.groupManager.getGroup(groupId);
        if (!group) return [];

        const bricks = [...group.brickIds]
            .map(id => this.library.getById(id))
            .filter(Boolean);

        return this.setSelection(bricks);
    }

    // --------------------------------------------------
    // Auswahl umkehren
    // --------------------------------------------------

    invertSelection() {
        const currentIds = new Set(
            this.getSelection().map(brick => brick.id)
        );

        const selectable = this.filterSelectable(this.getAllBricks());

        return this.setSelection(
            selectable.filter(brick => !currentIds.has(brick.id))
        );
    }

    // --------------------------------------------------
    // Baugruppen erweitern
    // --------------------------------------------------

    expandSelection() {
        if (!this.groupManager) return this.getSelection();

        const expanded = new Map(
            this.getSelection().map(brick => [brick.id, brick])
        );

        for (const brick of [...expanded.values()]) {
            const group = this.groupManager.getGroupByBrickId(brick.id);
            if (!group) continue;

            for (const id of group.brickIds) {
                const groupBrick = this.library.getById(id);

                if (groupBrick) {
                    expanded.set(groupBrick.id, groupBrick);
                }
            }
        }

        return this.setSelection([...expanded.values()]);
    }

    // --------------------------------------------------
    // Teilweise ausgewählte Baugruppen reduzieren
    // --------------------------------------------------

    shrinkSelection() {
        if (!this.groupManager) return this.getSelection();

        const selection = this.getSelection();
        const selectedIds = new Set(selection.map(brick => brick.id));
        const removeIds = new Set();

        for (const group of this.groupManager.getAllGroups()) {
            const groupIds = [...group.brickIds];

            const selectedCount = groupIds.filter(
                id => selectedIds.has(id)
            ).length;

            if (selectedCount > 0 && selectedCount < groupIds.length) {
                for (const id of groupIds) {
                    removeIds.add(id);
                }
            }
        }

        return this.setSelection(
            selection.filter(brick => !removeIds.has(brick.id))
        );
    }

    // --------------------------------------------------
    // Gültigkeit
    // --------------------------------------------------

    filterSelectable(bricks) {
        if (!Array.isArray(bricks)) return [];

        return bricks.filter(brick => {
            if (!brick?.id) return false;

            const object = this.getObject(brick);

            if (
                brick.locked === true ||
                brick.userData?.locked === true
            ) {
                return false;
            }

            let current = object;

            while (current) {
                if (
                    current.visible === false ||
                    current.userData?.editorLocked === true ||
                    current.userData?.locked === true
                ) {
                    return false;
                }

                current = current.parent;
            }

            return brick.visible !== false;
        });
    }

    getObject(brick) {
        if (!brick) return null;

        if (brick.group?.isObject3D) return brick.group;
        if (brick.object?.isObject3D) return brick.object;
        if (brick.mesh?.isObject3D) return brick.mesh;

        return null;
    }

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

    setOnSelectionChange(callback) {
        this.onSelectionChange =
            typeof callback === 'function' ? callback : null;
    }
}
