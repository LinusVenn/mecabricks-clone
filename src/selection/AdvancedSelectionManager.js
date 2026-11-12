
export class AdvancedSelectionManager {

    constructor({
        library,
        groupManager = null,
        multiSelectionManager,
        selectionFilter = null
    } = {}) {
        if (!library) {
            throw new Error(
                'AdvancedSelectionManager: PartLibrary fehlt.'
            );
        }

        if (!multiSelectionManager) {
            throw new Error(
                'AdvancedSelectionManager: MultiSelectionManager fehlt.'
            );
        }

        this.library = library;
        this.groupManager = groupManager;
        this.multiSelectionManager = multiSelectionManager;
        this.selectionFilter = selectionFilter;

        this.selectedBricks = [];
        this.onSelectionChange = null;
    }

    // --------------------------------------------------
    // Auswahl auslesen
    // --------------------------------------------------

    getAllBricks() {
        if (typeof this.library.getAll === 'function') {
            return this.library.getAll();
        }

        return Array.isArray(this.library.bricks)
            ? [...this.library.bricks]
            : [];
    }

    getSelection() {
        if (
            typeof this.multiSelectionManager.getSelection === 'function'
        ) {
            const selection =
                this.multiSelectionManager.getSelection();

            if (Array.isArray(selection)) {
                this.selectedBricks = selection;
                return [...selection];
            }
        }

        if (
            Array.isArray(this.multiSelectionManager.selectedBricks)
        ) {
            this.selectedBricks = [
                ...this.multiSelectionManager.selectedBricks
            ];

            return [...this.selectedBricks];
        }

        return [...this.selectedBricks];
    }

    // --------------------------------------------------
    // Auswahl setzen
    // --------------------------------------------------

    setSelection(bricks) {
        const validBricks = this.filterSelectable(bricks);

        this.selectedBricks = [
            ...new Map(
                validBricks.map(brick => [brick.id, brick])
            ).values()
        ];

        this.multiSelectionManager.setSelection(
            this.selectedBricks
        );

        this.onSelectionChange?.(
            this.getSelection()
        );

        return this.getSelection();
    }

    addToSelection(bricks) {
        return this.setSelection([
            ...this.getSelection(),
            ...bricks
        ]);
    }

    removeFromSelection(bricks) {
        const removeIds = new Set(
            bricks.map(brick => brick.id)
        );

        return this.setSelection(
            this.getSelection().filter(
                brick => !removeIds.has(brick.id)
            )
        );
    }

    clearSelection() {
        this.selectedBricks = [];

        if (
            typeof this.multiSelectionManager.clearSelection === 'function'
        ) {
            this.multiSelectionManager.clearSelection();
        } else {
            this.multiSelectionManager.setSelection([]);
        }

        this.onSelectionChange?.([]);

        return [];
    }

    // --------------------------------------------------
    // Auswahlmöglichkeiten
    // --------------------------------------------------

    selectAll() {
        return this.setSelection(
            this.getAllBricks()
        );
    }

    selectFiltered(criteria = {}) {
        if (!this.selectionFilter) {
            throw new Error(
                'AdvancedSelectionManager: Kein SelectionFilter vorhanden.'
            );
        }

        const results = this.selectionFilter.filter(criteria);

        return this.setSelection(results);
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

    selectGroup(groupId) {
        if (!this.groupManager) return [];

        const group = this.groupManager.getGroup(groupId);

        if (!group) return [];

        const bricks = group.brickIds
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

        const remaining = this.getAllBricks().filter(
            brick => !currentIds.has(brick.id)
        );

        return this.setSelection(remaining);
    }

    // --------------------------------------------------
    // Baugruppen erweitern
    // --------------------------------------------------

    expandSelection() {
        if (!this.groupManager) {
            return this.getSelection();
        }

        const selection = this.getSelection();

        const expanded = new Map(
            selection.map(brick => [brick.id, brick])
        );

        for (const brick of selection) {
            const group = this.groupManager.getGroupByBrickId(
                brick.id
            );

            if (!group) continue;

            for (const brickId of group.brickIds) {
                const groupBrick = this.library.getById(brickId);

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
        if (!this.groupManager) {
            return this.getSelection();
        }

        const selection = this.getSelection();

        const selectedIds = new Set(
            selection.map(brick => brick.id)
        );

        const groups = this.groupManager.getAllGroups();

        const removeIds = new Set();

        for (const group of groups) {
            const groupIds = group.brickIds;

            const selectedCount = groupIds.filter(
                id => selectedIds.has(id)
            ).length;

            const isPartiallySelected =
                selectedCount > 0 &&
                selectedCount < groupIds.length;

            if (isPartiallySelected) {
                for (const id of groupIds) {
                    removeIds.add(id);
                }
            }
        }

        return this.setSelection(
            selection.filter(
                brick => !removeIds.has(brick.id)
            )
        );
    }

    // --------------------------------------------------
    // Auswahl filtern
    // --------------------------------------------------

    filterSelectable(bricks) {
        if (!Array.isArray(bricks)) return [];

        return bricks.filter(brick => {
            if (!brick || !brick.id) return false;

            const object = this.getObject(brick);

            const locked =
                brick.locked === true ||
                brick.userData?.locked === true ||
                object?.userData?.locked === true;

            if (locked) return false;

            if (brick.visible === false) return false;

            if (object) {
                let current = object;

                while (current) {
                    if (current.visible === false) {
                        return false;
                    }

                    current = current.parent;
                }
            }

            return true;
        });
    }

    // --------------------------------------------------
    // Three.js-Objekt ermitteln
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

        return null;
    }

    // --------------------------------------------------
    // Callback
    // --------------------------------------------------

    setOnSelectionChange(callback) {
        this.onSelectionChange =
            typeof callback === 'function'
                ? callback
                : null;
    }
}
