
export class OutlinerPanel {

    constructor(container, outlinerManager) {
        if (!container) {
            throw new Error(
                'OutlinerPanel: Kein gültiger Container übergeben.'
            );
        }

        if (!outlinerManager) {
            throw new Error(
                'OutlinerPanel: Kein OutlinerManager übergeben.'
            );
        }

        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!this.container) {
            throw new Error(
                'OutlinerPanel: Container wurde nicht gefunden.'
            );
        }

        this.outlinerManager = outlinerManager;

        this.expandedGroups = new Set();
        this.draggedObject = null;
        this.searchQuery = '';

        this.isDisposed = false;

        this.unsubscribe = null;

        this.injectStyles();
        this.createLayout();
        this.bindEvents();

        this.unsubscribe = this.outlinerManager.subscribe(() => {
            this.refresh();
        });

        this.refresh();
    }

    // --------------------------------------------------
    // Styles
    // --------------------------------------------------

    injectStyles() {
        if (document.getElementById('outliner-panel-styles')) {
            return;
        }

        const style = document.createElement('style');

        style.id = 'outliner-panel-styles';

        style.textContent = `
            .outliner-panel {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                min-height: 200px;
                color: #e5e7eb;
                background: #1e1e1e;
                font-family: Arial, sans-serif;
                font-size: 13px;
                overflow: hidden;
            }

            .outliner-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px;
                background: #292929;
                border-bottom: 1px solid #3c3c3c;
                font-weight: bold;
            }

            .outliner-header-title {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .outliner-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                padding: 8px;
                background: #252525;
                border-bottom: 1px solid #3c3c3c;
            }

            .outliner-search {
                width: calc(100% - 16px);
                margin: 8px;
                padding: 7px;
                box-sizing: border-box;
                color: #eee;
                background: #333;
                border: 1px solid #555;
                border-radius: 4px;
                outline: none;
            }

            .outliner-search:focus {
                border-color: #4b9eff;
            }

            .outliner-tree {
                flex: 1;
                overflow: auto;
                padding: 5px;
            }

            .outliner-entry {
                display: flex;
                align-items: center;
                min-height: 29px;
                padding: 2px 5px;
                margin: 1px 0;
                border-radius: 4px;
                cursor: pointer;
                user-select: none;
                gap: 5px;
            }

            .outliner-entry:hover {
                background: #343434;
            }

            .outliner-entry.selected {
                background: #31577e;
                color: white;
            }

            .outliner-entry.drag-over {
                background: #315d42;
                outline: 1px solid #4caf50;
            }

            .outliner-entry.locked {
                opacity: 0.65;
            }

            .outliner-entry.group-entry {
                font-weight: bold;
                color: #e6c875;
            }

            .outliner-entry.object-entry {
                font-weight: normal;
                color: #dedede;
            }

            .outliner-indent {
                display: flex;
                flex-direction: column;
                margin-left: 17px;
                border-left: 1px solid #444;
                padding-left: 5px;
            }

            .outliner-arrow {
                width: 15px;
                min-width: 15px;
                text-align: center;
                color: #aaa;
                cursor: pointer;
            }

            .outliner-icon {
                width: 17px;
                min-width: 17px;
                text-align: center;
            }

            .outliner-name {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .outliner-actions {
                display: flex;
                align-items: center;
                gap: 2px;
                opacity: 0.55;
            }

            .outliner-entry:hover .outliner-actions,
            .outliner-entry.selected .outliner-actions {
                opacity: 1;
            }

            .outliner-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 25px;
                height: 25px;
                padding: 3px 6px;
                color: #ddd;
                background: #383838;
                border: 1px solid #505050;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            .outliner-button:hover {
                background: #505050;
            }

            .outliner-button.danger:hover {
                background: #9c3434;
            }

            .outliner-button:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            .outliner-empty {
                padding: 20px 10px;
                color: #999;
                text-align: center;
            }

            .outliner-footer {
                display: flex;
                justify-content: space-between;
                padding: 7px 10px;
                background: #292929;
                border-top: 1px solid #3c3c3c;
                color: #aaa;
                font-size: 11px;
            }

            .outliner-entry input {
                flex: 1;
                min-width: 0;
                padding: 3px 5px;
                color: white;
                background: #333;
                border: 1px solid #4b9eff;
                border-radius: 3px;
                outline: none;
            }
        `;

        document.head.appendChild(style);
    }

    // --------------------------------------------------
    // Layout
    // --------------------------------------------------

    createLayout() {
        this.container.innerHTML = '';

        this.root = document.createElement('div');
        this.root.className = 'outliner-panel';

        this.root.innerHTML = `
            <div class="outliner-header">
                <div class="outliner-header-title">
                    <span>☷</span>
                    <span>Outliner</span>
                </div>

                <button
                    class="outliner-button"
                    data-action="refresh"
                    title="Aktualisieren"
                >↻</button>
            </div>

            <div class="outliner-toolbar">
                <button
                    class="outliner-button"
                    data-action="expand-all"
                    title="Alle Baugruppen ausklappen"
                >⊞</button>

                <button
                    class="outliner-button"
                    data-action="collapse-all"
                    title="Alle Baugruppen einklappen"
                >⊟</button>

                <button
                    class="outliner-button"
                    data-action="isolate"
                    title="Auswahl isolieren"
                >◉</button>

                <button
                    class="outliner-button"
                    data-action="show-all"
                    title="Alle Objekte anzeigen"
                >◌</button>

                <button
                    class="outliner-button danger"
                    data-action="delete"
                    title="Auswahl löschen"
                >✕</button>
            </div>

            <input
                class="outliner-search"
                type="text"
                placeholder="Objekte suchen ..."
            >

            <div class="outliner-tree"></div>

            <div class="outliner-footer">
                <span class="outliner-object-count">
                    0 Objekte
                </span>

                <span class="outliner-selection-count">
                    0 ausgewählt
                </span>
            </div>
        `;

        this.container.appendChild(this.root);

        this.treeElement = this.root.querySelector(
            '.outliner-tree'
        );

        this.searchInput = this.root.querySelector(
            '.outliner-search'
        );

        this.objectCountElement = this.root.querySelector(
            '.outliner-object-count'
        );

        this.selectionCountElement = this.root.querySelector(
            '.outliner-selection-count'
        );
    }

    // --------------------------------------------------
    // Events
    // --------------------------------------------------

    bindEvents() {
        this.root.addEventListener('click', event => {
            const button = event.target.closest(
                '[data-action]'
            );

            if (button && this.root.contains(button)) {
                event.stopPropagation();

                this.handleToolbarAction(
                    button.dataset.action
                );

                return;
            }

            const entryElement = event.target.closest(
                '[data-entry-id]'
            );

            if (!entryElement) return;

            const actionButton = event.target.closest(
                '[data-entry-action]'
            );

            if (actionButton) {
                event.stopPropagation();

                this.handleEntryAction(
                    actionButton.dataset.entryAction,
                    entryElement
                );

                return;
            }

            if (
                event.target.closest('.outliner-arrow')
            ) {
                this.toggleExpanded(entryElement);
                return;
            }

            const entry = this.findEntry(
                entryElement.dataset.entryId
            );

            if (!entry) return;

            this.outlinerManager.selectEntry(
                entry,
                event.ctrlKey || event.metaKey
            );

            this.refreshSelection();
        });

        this.root.addEventListener('dblclick', event => {
            const entryElement = event.target.closest(
                '[data-entry-id]'
            );

            if (!entryElement) return;

            const entry = this.findEntry(
                entryElement.dataset.entryId
            );

            if (entry) {
                this.startRename(entry, entryElement);
            }
        });

        this.searchInput.addEventListener('input', event => {
            this.searchQuery = event.target.value
                .trim()
                .toLowerCase();

            this.refresh();
        });

        this.root.addEventListener('dragstart', event => {
            const entryElement = event.target.closest(
                '[data-entry-id]'
            );

            if (!entryElement) return;

            const entry = this.findEntry(
                entryElement.dataset.entryId
            );

            if (!entry || entry.kind !== 'object') {
                event.preventDefault();
                return;
            }

            this.draggedObject = entry.object;

            event.dataTransfer.effectAllowed = 'move';

            event.dataTransfer.setData(
                'text/plain',
                entry.id
            );
        });

        this.root.addEventListener('dragover', event => {
            const entryElement = event.target.closest(
                '[data-entry-id]'
            );

            if (!entryElement) return;

            const entry = this.findEntry(
                entryElement.dataset.entryId
            );

            if (!entry || entry.kind !== 'group') {
                return;
            }

            event.preventDefault();

            event.dataTransfer.dropEffect = 'move';

            entryElement.classList.add('drag-over');
        });

        this.root.addEventListener('dragleave', event => {
            const entryElement = event.target.closest(
                '[data-entry-id]'
            );

            if (entryElement) {
                entryElement.classList.remove('drag-over');
            }
        });

        this.root.addEventListener('drop', event => {
            const entryElement = event.target.closest(
                '[data-entry-id]'
            );

            if (!entryElement) return;

            entryElement.classList.remove('drag-over');

            const targetEntry = this.findEntry(
                entryElement.dataset.entryId
            );

            if (
                !targetEntry ||
                targetEntry.kind !== 'group' ||
                !this.draggedObject
            ) {
                return;
            }

            event.preventDefault();

            try {
                const success = this.outlinerManager.moveObject(
                    this.draggedObject,
                    targetEntry
                );

                if (!success) {
                    console.warn(
                        'Bauteil konnte nicht verschoben werden.'
                    );
                }
            } catch (error) {
                console.error(
                    'Fehler beim Verschieben des Bauteils:',
                    error
                );
            }

            this.draggedObject = null;

            this.refresh();
        });

        this.root.addEventListener('dragend', () => {
            this.draggedObject = null;

            this.root.querySelectorAll('.drag-over')
                .forEach(element => {
                    element.classList.remove('drag-over');
                });
        });
    }

    // --------------------------------------------------
    // Toolbar
    // --------------------------------------------------

    handleToolbarAction(action) {
        try {
            switch (action) {
                case 'refresh':
                    this.refresh();
                    break;

                case 'expand-all':
                    this.expandAll();
                    break;

                case 'collapse-all':
                    this.collapseAll();
                    break;

                case 'isolate':
                    this.outlinerManager.isolateSelection();
                    break;

                case 'show-all':
                    this.outlinerManager.showAll();
                    break;

                case 'delete':
                    this.deleteSelection();
                    break;
            }
        } catch (error) {
            console.error(
                'Outliner-Aktion fehlgeschlagen:',
                error
            );
        }

        this.refresh();
    }

    deleteSelection() {
        const selection = this.outlinerManager.getSelection();

        if (selection.length === 0) {
            return;
        }

        const confirmed = window.confirm(
            `Möchtest du ${selection.length} ausgewählte(s) Objekt(e) löschen?`
        );

        if (!confirmed) return;

        this.outlinerManager.removeSelection();
    }

    // --------------------------------------------------
    // Entry Actions
    // --------------------------------------------------

    handleEntryAction(action, entryElement) {
        const entry = this.findEntry(
            entryElement.dataset.entryId
        );

        if (!entry) return;

        try {
            switch (action) {
                case 'visibility':
                    this.outlinerManager.toggleVisibility(entry);
                    break;

                case 'lock':
                    this.outlinerManager.toggleLock(entry);
                    break;

                case 'rename':
                    this.startRename(entry, entryElement);
                    break;

                case 'isolate':
                    this.outlinerManager.selectEntry(entry);
                    this.outlinerManager.isolateSelection();
                    break;
            }
        } catch (error) {
            console.error(
                'Outliner-Eintragsaktion fehlgeschlagen:',
                error
            );
        }

        this.refresh();
    }

    // --------------------------------------------------
    // Rendering
    // --------------------------------------------------

    refresh() {
        if (this.isDisposed) return;

        const hierarchy = this.outlinerManager.getHierarchy();

        this.treeElement.innerHTML = '';

        const filteredHierarchy = this.filterHierarchy(
            hierarchy
        );

        if (filteredHierarchy.length === 0) {
            const empty = document.createElement('div');

            empty.className = 'outliner-empty';

            empty.textContent = this.searchQuery
                ? 'Keine passenden Objekte gefunden.'
                : 'Keine Objekte vorhanden.';

            this.treeElement.appendChild(empty);
        } else {
            for (const entry of filteredHierarchy) {
                this.renderEntry(entry, this.treeElement);
            }
        }

        this.updateFooter(hierarchy);

        this.refreshSelection();
    }

    renderEntry(entry, parentElement) {
        const entryElement = document.createElement('div');

        const entryId = this.getEntryKey(entry);

        entryElement.className =
            `outliner-entry ${
                entry.kind === 'group'
                    ? 'group-entry'
                    : 'object-entry'
            }`;

        entryElement.dataset.entryId = entryId;

        entryElement.draggable = entry.kind === 'object';

        const locked = entry.kind === 'group'
            ? entry.children.length > 0 &&
                entry.children.every(child =>
                    this.outlinerManager.isLocked(child.object)
                )
            : this.outlinerManager.isLocked(entry.object);

        if (locked) {
            entryElement.classList.add('locked');
        }

        const visible = entry.kind === 'group'
            ? entry.children.length > 0 &&
                entry.children.every(child =>
                    this.outlinerManager.isVisible(child.object)
                )
            : this.outlinerManager.isVisible(entry.object);

        const hasChildren = Array.isArray(entry.children) &&
            entry.children.length > 0;

        const isExpanded = this.searchQuery
            ? true
            : this.expandedGroups.has(entryId);

        const arrow = document.createElement('span');

        arrow.className = 'outliner-arrow';

        arrow.textContent = hasChildren
            ? (isExpanded ? '▾' : '▸')
            : '';

        const icon = document.createElement('span');

        icon.className = 'outliner-icon';

        icon.textContent = entry.kind === 'group'
            ? '▣'
            : '◈';

        const name = document.createElement('span');

        name.className = 'outliner-name';

        name.textContent = entry.name || 'Unbenannt';

        const actions = document.createElement('div');

        actions.className = 'outliner-actions';

        actions.appendChild(
            this.createActionButton(
                'visibility',
                visible ? '◉' : '○',
                visible
                    ? 'Objekt ausblenden'
                    : 'Objekt anzeigen'
            )
        );

        actions.appendChild(
            this.createActionButton(
                'lock',
                locked ? '🔒' : '🔓',
                locked
                    ? 'Objekt entsperren'
                    : 'Objekt sperren'
            )
        );

        actions.appendChild(
            this.createActionButton(
                'rename',
                '✎',
                'Umbenennen'
            )
        );

        if (entry.kind === 'object') {
            entryElement.appendChild(arrow);
            entryElement.appendChild(icon);
            entryElement.appendChild(name);
            entryElement.appendChild(actions);
        } else {
            entryElement.appendChild(arrow);
            entryElement.appendChild(icon);
            entryElement.appendChild(name);
            entryElement.appendChild(actions);
        }

        parentElement.appendChild(entryElement);

        if (hasChildren && isExpanded) {
            const childrenContainer = document.createElement('div');

            childrenContainer.className = 'outliner-indent';

            parentElement.appendChild(childrenContainer);

            for (const child of entry.children) {
                this.renderEntry(
                    child,
                    childrenContainer
                );
            }
        }
    }

    createActionButton(action, label, title) {
        const button = document.createElement('button');

        button.className = 'outliner-button';

        button.type = 'button';

        button.textContent = label;

        button.title = title;

        button.dataset.entryAction = action;

        return button;
    }

    // --------------------------------------------------
    // Suche
    // --------------------------------------------------

    filterHierarchy(entries) {
        if (!this.searchQuery) {
            return entries;
        }

        const result = [];

        for (const entry of entries) {
            const nameMatches = (
                entry.name || ''
            ).toLowerCase().includes(this.searchQuery);

            const filteredChildren = entry.children
                ? this.filterHierarchy(entry.children)
                : [];

            if (nameMatches || filteredChildren.length > 0) {
                result.push({
                    ...entry,
                    children: nameMatches
                        ? entry.children
                        : filteredChildren
                });
            }
        }

        return result;
    }

    // --------------------------------------------------
    // Auswahl
    // --------------------------------------------------

    refreshSelection() {
        if (!this.root) return;

        const selectedObjects = this.outlinerManager.getSelection();

        const selectedIds = new Set(
            selectedObjects.map(object => object.uuid)
        );

        this.root.querySelectorAll('[data-entry-id]')
            .forEach(element => {
                const entry = this.findEntry(
                    element.dataset.entryId
                );

                let selected = false;

                if (entry?.kind === 'object') {
                    selected = selectedIds.has(
                        entry.object.uuid
                    );
                }

                if (entry?.kind === 'group') {
                    selected = entry.children.length > 0 &&
                        entry.children.every(child =>
                            selectedIds.has(child.object.uuid)
                        );
                }

                element.classList.toggle(
                    'selected',
                    selected
                );
            });

        this.selectionCountElement.textContent =
            `${selectedObjects.length} ausgewählt`;
    }

    // --------------------------------------------------
    // Umbenennen
    // --------------------------------------------------

    startRename(entry, entryElement) {
        if (!entry || !entryElement) return;

        const nameElement = entryElement.querySelector(
            '.outliner-name'
        );

        if (!nameElement) return;

        const input = document.createElement('input');

        input.type = 'text';

        input.value = entry.name || '';

        nameElement.replaceWith(input);

        input.focus();
        input.select();

        let finished = false;

        const finish = save => {
            if (finished) return;

            finished = true;

            const newName = input.value.trim();

            if (save && newName) {
                if (entry.kind === 'group') {
                    this.outlinerManager.renameGroup(
                        entry.group.id,
                        newName
                    );
                } else {
                    this.outlinerManager.renameObject(
                        entry.object,
                        newName
                    );
                }
            }

            this.refresh();
        };

        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                finish(true);
            }

            if (event.key === 'Escape') {
                finish(false);
            }
        });

        input.addEventListener('blur', () => {
            finish(true);
        });
    }

    // --------------------------------------------------
    // Baugruppen
    // --------------------------------------------------

    toggleExpanded(entryElement) {
        const entryId = entryElement.dataset.entryId;

        if (this.expandedGroups.has(entryId)) {
            this.expandedGroups.delete(entryId);
        } else {
            this.expandedGroups.add(entryId);
        }

        this.refresh();
    }

    expandAll() {
        const hierarchy = this.outlinerManager.getHierarchy();

        const visit = entries => {
            for (const entry of entries) {
                if (entry.kind === 'group') {
                    this.expandedGroups.add(
                        this.getEntryKey(entry)
                    );
                }

                if (entry.children?.length) {
                    visit(entry.children);
                }
            }
        };

        visit(hierarchy);

        this.refresh();
    }

    collapseAll() {
        this.expandedGroups.clear();

        this.refresh();
    }

    // --------------------------------------------------
    // Hilfsmethoden
    // --------------------------------------------------

    getEntryKey(entry) {
        return `${entry.kind}:${entry.id}`;
    }

    findEntry(entryId) {
        if (!entryId) return null;

        const hierarchy = this.outlinerManager.getHierarchy();

        const visit = entries => {
            for (const entry of entries) {
                if (this.getEntryKey(entry) === entryId) {
                    return entry;
                }

                if (entry.children?.length) {
                    const found = visit(entry.children);

                    if (found) return found;
                }
            }

            return null;
        };

        return visit(hierarchy);
    }

    updateFooter(hierarchy) {
        let objectCount = 0;

        const countObjects = entries => {
            for (const entry of entries) {
                if (entry.kind === 'object') {
                    objectCount++;
                }

                if (entry.children?.length) {
                    countObjects(entry.children);
                }
            }
        };

        countObjects(hierarchy);

        this.objectCountElement.textContent =
            `${objectCount} Objekte`;
    }

    // --------------------------------------------------
    // Aufräumen
    // --------------------------------------------------

    dispose() {
        if (this.isDisposed) return;

        this.unsubscribe?.();

        this.container.innerHTML = '';

        this.expandedGroups.clear();

        this.draggedObject = null;

        this.isDisposed = true;
    }
}
