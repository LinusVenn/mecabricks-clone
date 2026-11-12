
export class SelectionPanel {

    constructor(
        container,
        advancedSelectionManager,
        selectionFilter,
        isolationManager
    ) {
        if (!container) {
            throw new Error(
                'SelectionPanel: Container fehlt.'
            );
        }

        if (!advancedSelectionManager) {
            throw new Error(
                'SelectionPanel: AdvancedSelectionManager fehlt.'
            );
        }

        if (!selectionFilter) {
            throw new Error(
                'SelectionPanel: SelectionFilter fehlt.'
            );
        }

        if (!isolationManager) {
            throw new Error(
                'SelectionPanel: IsolationManager fehlt.'
            );
        }

        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!this.container) {
            throw new Error(
                'SelectionPanel: Container wurde nicht gefunden.'
            );
        }

        this.advancedSelectionManager =
            advancedSelectionManager;

        this.selectionFilter = selectionFilter;

        this.isolationManager = isolationManager;

        this.isDisposed = false;

        this.injectStyles();
        this.createLayout();
        this.bindEvents();
        this.updateOptions();
        this.updateStatus();
    }

    // --------------------------------------------------
    // Styles
    // --------------------------------------------------

    injectStyles() {
        if (document.getElementById('selection-panel-styles')) {
            return;
        }

        const style = document.createElement('style');

        style.id = 'selection-panel-styles';

        style.textContent = `
            .selection-panel {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 12px;
                color: #eee;
                background: #242424;
                font-family: Arial, sans-serif;
                font-size: 13px;
                box-sizing: border-box;
            }

            .selection-panel h3 {
                margin: 0;
                font-size: 15px;
            }

            .selection-section {
                display: flex;
                flex-direction: column;
                gap: 7px;
                padding-bottom: 10px;
                border-bottom: 1px solid #444;
            }

            .selection-section-title {
                font-weight: bold;
                color: #ccc;
            }

            .selection-panel label {
                display: flex;
                flex-direction: column;
                gap: 4px;
                color: #bbb;
            }

            .selection-panel input,
            .selection-panel select {
                width: 100%;
                min-width: 0;
                padding: 7px;
                box-sizing: border-box;
                color: #eee;
                background: #353535;
                border: 1px solid #555;
                border-radius: 4px;
            }

            .selection-panel input:focus,
            .selection-panel select:focus {
                outline: none;
                border-color: #4b9eff;
            }

            .selection-button-row {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .selection-panel button {
                flex: 1;
                min-width: 100px;
                padding: 8px;
                color: white;
                background: #3b3b3b;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
            }

            .selection-panel button:hover {
                background: #505050;
            }

            .selection-panel button.primary {
                background: #285a86;
                border-color: #397bb5;
            }

            .selection-panel button.primary:hover {
                background: #3475ad;
            }

            .selection-panel button.danger {
                background: #713535;
                border-color: #984848;
            }

            .selection-panel button:disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }

            .selection-status {
                padding: 9px;
                color: #b8d8ff;
                background: #303c49;
                border-radius: 4px;
            }

            .selection-isolation-status {
                color: #e6c875;
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

        this.root.className = 'selection-panel';

        this.root.innerHTML = `
            <h3>Erweiterte Auswahl</h3>

            <div class="selection-section">
                <div class="selection-section-title">
                    Auswahl filtern
                </div>

                <label>
                    Name
                    <input
                        type="text"
                        data-filter="name"
                        placeholder="Bauteilname ..."
                    >
                </label>

                <label>
                    Bauteiltyp
                    <select data-filter="type">
                        <option value="">Alle Typen</option>
                    </select>
                </label>

                <label>
                    Farbe
                    <select data-filter="color">
                        <option value="">Alle Farben</option>
                    </select>
                </label>

                <label>
                    Material
                    <select data-filter="material">
                        <option value="">Alle Materialien</option>
                    </select>
                </label>

                <label>
                    Baugruppe
                    <select data-filter="groupId">
                        <option value="">Alle Baugruppen</option>
                    </select>
                </label>

                <div class="selection-button-row">
                    <button
                        class="primary"
                        data-action="apply-filter"
                    >
                        Auswahl anwenden
                    </button>

                    <button data-action="clear-filter">
                        Filter zurücksetzen
                    </button>
                </div>
            </div>

            <div class="selection-section">
                <div class="selection-section-title">
                    Auswahl bearbeiten
                </div>

                <div class="selection-button-row">
                    <button data-action="select-all">
                        Alle auswählen
                    </button>

                    <button data-action="invert">
                        Auswahl umkehren
                    </button>
                </div>

                <div class="selection-button-row">
                    <button data-action="expand">
                        Baugruppen erweitern
                    </button>

                    <button data-action="shrink">
                        Baugruppen reduzieren
                    </button>
                </div>

                <div class="selection-button-row">
                    <button data-action="clear-selection">
                        Auswahl aufheben
                    </button>
                </div>
            </div>

            <div class="selection-section">
                <div class="selection-section-title">
                    Isolationsmodus
                </div>

                <div class="selection-button-row">
                    <button
                        class="primary"
                        data-action="isolate"
                    >
                        Auswahl isolieren
                    </button>

                    <button
                        class="danger"
                        data-action="exit-isolation"
                    >
                        Isolation beenden
                    </button>
                </div>
            </div>

            <div class="selection-status" data-status>
                0 Bauteile ausgewählt
            </div>

            <div
                class="selection-isolation-status"
                data-isolation-status
            >
                Isolation nicht aktiv
            </div>
        `;

        this.container.appendChild(this.root);

        this.statusElement = this.root.querySelector(
            '[data-status]'
        );

        this.isolationStatusElement = this.root.querySelector(
            '[data-isolation-status]'
        );
    }

    // --------------------------------------------------
    // Optionen laden
    // --------------------------------------------------

    updateOptions() {
        this.updateSelect(
            'type',
            this.selectionFilter.getAvailableTypes(),
            'Alle Typen'
        );

        this.updateSelect(
            'color',
            this.selectionFilter.getAvailableColors(),
            'Alle Farben'
        );

        this.updateSelect(
            'material',
            this.selectionFilter.getAvailableMaterials(),
            'Alle Materialien'
        );

        const groups =
            this.selectionFilter.getAvailableGroups();

        const groupSelect = this.getFilterElement('groupId');

        groupSelect.innerHTML = '';

        groupSelect.add(
            new Option('Alle Baugruppen', '')
        );

        for (const group of groups) {
            groupSelect.add(
                new Option(
                    group.name || 'Unbenannte Baugruppe',
                    group.id
                )
            );
        }
    }

    updateSelect(filterName, values, defaultLabel) {
        const select = this.getFilterElement(filterName);

        const previousValue = select.value;

        select.innerHTML = '';

        select.add(
            new Option(defaultLabel, '')
        );

        for (const value of values) {
            select.add(
                new Option(value, value)
            );
        }

        if (values.includes(previousValue)) {
            select.value = previousValue;
        }
    }

    getFilterElement(name) {
        return this.root.querySelector(
            `[data-filter="${name}"]`
        );
    }

    getFilterCriteria() {
        return {
            name: this.getFilterElement('name').value,
            type: this.getFilterElement('type').value,
            color: this.getFilterElement('color').value,
            material: this.getFilterElement('material').value,
            groupId: this.getFilterElement('groupId').value
        };
    }

    // --------------------------------------------------
    // Events
    // --------------------------------------------------

    bindEvents() {
        this.root.addEventListener('click', event => {
            const button = event.target.closest(
                '[data-action]'
            );

            if (!button) return;

            this.handleAction(button.dataset.action);
        });
    }

    // --------------------------------------------------
    // Aktionen
    // --------------------------------------------------

    handleAction(action) {
        try {
            switch (action) {
                case 'apply-filter':
                    this.applyFilter();
                    break;

                case 'clear-filter':
                    this.clearFilter();
                    break;

                case 'select-all':
                    this.advancedSelectionManager.selectAll();
                    break;

                case 'invert':
                    this.advancedSelectionManager.invertSelection();
                    break;

                case 'expand':
                    this.advancedSelectionManager.expandSelection();
                    break;

                case 'shrink':
                    this.advancedSelectionManager.shrinkSelection();
                    break;

                case 'clear-selection':
                    this.advancedSelectionManager.clearSelection();
                    break;

                case 'isolate':
                    this.isolateSelection();
                    break;

                case 'exit-isolation':
                    this.isolationManager.exitIsolation();
                    break;
            }
        } catch (error) {
            console.error(
                'SelectionPanel: Aktion fehlgeschlagen:',
                error
            );

            window.alert(error.message);
        }

        this.updateStatus();
    }

    // --------------------------------------------------
    // Filter
    // --------------------------------------------------

    applyFilter() {
        const criteria = this.getFilterCriteria();

        this.advancedSelectionManager.selectFiltered(
            criteria
        );
    }

    clearFilter() {
        this.getFilterElement('name').value = '';
        this.getFilterElement('type').value = '';
        this.getFilterElement('color').value = '';
        this.getFilterElement('material').value = '';
        this.getFilterElement('groupId').value = '';

        this.advancedSelectionManager.clearSelection();

        this.updateOptions();
    }

    // --------------------------------------------------
    // Isolation
    // --------------------------------------------------

    isolateSelection() {
        const selection =
            this.advancedSelectionManager.getSelection();

        if (selection.length === 0) {
            window.alert(
                'Bitte wähle zuerst mindestens ein Bauteil aus.'
            );

            return;
        }

        this.isolationManager.isolate(selection);
    }

    // --------------------------------------------------
    // Status
    // --------------------------------------------------

    updateStatus() {
        const selection =
            this.advancedSelectionManager.getSelection();

        this.statusElement.textContent =
            `${selection.length} Bauteile ausgewählt`;

        const isolationActive =
            this.isolationManager.isIsolating();

        this.isolationStatusElement.textContent =
            isolationActive
                ? 'Isolation ist aktiv'
                : 'Isolation nicht aktiv';
    }

    // --------------------------------------------------
    // Aufräumen
    // --------------------------------------------------

    dispose() {
        if (this.isDisposed) return;

        this.container.innerHTML = '';

        this.isDisposed = true;
    }
}
