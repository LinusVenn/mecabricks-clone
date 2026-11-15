import { ComponentPreview } from '../component-library/ComponentPreview.js';

function createElement(tag, className, text = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

function makeButton(label, action, className = '') {
    const button = createElement('button', `component-library-button ${className}`, label);
    button.type = 'button';
    button.dataset.action = action;
    return button;
}

export class ComponentLibraryPanel {
    constructor(container, templateManager, groupManager, { onInsert = null, onChange = null } = {}) {
        if (!container || !templateManager || !groupManager) {
            throw new Error('ComponentLibraryPanel benötigt Container, TemplateManager und GroupManager.');
        }
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        if (!this.container) throw new Error('Der Container der Baugruppenbibliothek wurde nicht gefunden.');
        this.templateManager = templateManager;
        this.groupManager = groupManager;
        this.onInsert = onInsert;
        this.onChange = onChange;
        this.templates = [];
        this.selectedTemplateId = null;
        this.isDisposed = false;

        this._injectStyles();
        this._createLayout();
        this.preview = new ComponentPreview(this.previewContainer, { width: 340, height: 230 });
        this._bindEvents();
        this.refresh().catch(error => this._showError(error));
    }

    _injectStyles() {
        if (document.getElementById('component-library-panel-styles')) return;
        const style = createElement('style');
        style.id = 'component-library-panel-styles';
        style.textContent = `
            .component-library-panel{display:flex;flex-direction:column;gap:10px;color:#eee;font:13px Arial,sans-serif}
            .component-library-panel input,.component-library-panel select,.component-library-panel textarea{box-sizing:border-box;width:100%;padding:7px;background:#30343a;color:#eee;border:1px solid #555;border-radius:4px}
            .component-library-panel button{padding:7px 9px;border:1px solid #555;border-radius:4px;background:#3b424a;color:#fff;cursor:pointer}
            .component-library-panel button:hover{background:#505b66}
            .component-library-actions{display:flex;flex-wrap:wrap;gap:6px}
            .component-library-actions button{flex:1 1 115px}
            .component-library-list{display:flex;flex-direction:column;gap:5px;max-height:240px;overflow:auto}
            .component-library-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #444;border-radius:4px;background:#292e34;cursor:pointer;text-align:left;color:#eee}
            .component-library-item[aria-selected=true]{border-color:#65a9ef;background:#263c50}
            .component-library-item small{display:block;color:#aaa;margin-top:3px}
            .component-library-preview{width:100%;min-height:180px;overflow:hidden;border:1px solid #444;border-radius:4px;background:#20252b}
            .component-library-preview canvas{display:block;width:100%;height:auto}
            .component-library-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
            .component-library-label{display:flex;flex-direction:column;gap:4px;color:#bbb}
            .component-library-status{min-height:18px;color:#b8c5d1;white-space:pre-wrap}
            .component-library-error{color:#ff9b9b}
        `;
        document.head.appendChild(style);
    }

    _createLayout() {
        this.root = createElement('div', 'component-library-panel');
        this.root.innerHTML = '';
        this.searchInput = createElement('input');
        this.searchInput.type = 'search';
        this.searchInput.placeholder = 'Vorlagen suchen …';
        this.categorySelect = createElement('select');
        this.list = createElement('div', 'component-library-list');

        this.nameInput = createElement('input');
        this.nameInput.placeholder = 'Name der Vorlage';
        this.descriptionInput = createElement('textarea');
        this.descriptionInput.rows = 2;
        this.descriptionInput.placeholder = 'Beschreibung (optional)';
        this.categoryInput = createElement('input');
        this.categoryInput.placeholder = 'Kategorie, z. B. Fahrzeuge';
        this.tagsInput = createElement('input');
        this.tagsInput.placeholder = 'Tags, durch Komma getrennt';

        this.previewContainer = createElement('div', 'component-library-preview');
        this.positionInputs = createElement('div', 'component-library-row');
        this.positionX = this._numberInput('X', 0);
        this.positionY = this._numberInput('Y', 0);
        this.positionZ = this._numberInput('Z', 0);
        this.positionInputs.append(this.positionX.wrapper, this.positionY.wrapper, this.positionZ.wrapper);

        this.status = createElement('div', 'component-library-status');
        this.fileInput = createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.json,application/json';
        this.fileInput.hidden = true;

        this.root.append(
            createElement('strong', '', 'Vorlagenbibliothek'),
            this.searchInput,
            this.categorySelect,
            this.list,
            createElement('strong', '', 'Vorlagendetails'),
            this.nameInput,
            this.descriptionInput,
            this.categoryInput,
            this.tagsInput,
            this.previewContainer,
            createElement('strong', '', 'Einfügeposition'),
            this.positionInputs
        );

        const actions = createElement('div', 'component-library-actions');
        this.saveButton = makeButton('Baugruppe speichern', 'save', 'primary');
        this.updateButton = makeButton('Vorlage aktualisieren', 'update');
        this.insertButton = makeButton('Vorlage einsetzen', 'insert', 'primary');
        this.duplicateButton = makeButton('Duplizieren', 'duplicate');
        this.renameButton = makeButton('Umbenennen', 'rename');
        this.deleteButton = makeButton('Löschen', 'delete');
        this.exportButton = makeButton('Exportieren', 'export');
        this.exportAllButton = makeButton('Alle exportieren', 'export-all');
        this.importButton = makeButton('Importieren', 'import');
        actions.append(this.saveButton, this.updateButton, this.insertButton, this.duplicateButton,
            this.renameButton, this.deleteButton, this.exportButton, this.exportAllButton, this.importButton);
        this.root.append(actions, this.fileInput, this.status);
        this.container.appendChild(this.root);
    }

    _numberInput(labelText, value) {
        const wrapper = createElement('label', 'component-library-label');
        const label = createElement('span', '', labelText);
        const input = createElement('input');
        input.type = 'number';
        input.step = '0.5';
        input.value = String(value);
        wrapper.append(label, input);
        return { wrapper, input };
    }

    _bindEvents() {
        this._onClick = event => {
            const button = event.target.closest('button[data-action]');
            if (!button || !this.root.contains(button)) return;
            this._handleAction(button.dataset.action).catch(error => this._showError(error));
        };
        this._onSearch = () => this._renderList();
        this._onCategory = () => this._renderList();
        this._onFile = () => this._importSelectedFile().catch(error => this._showError(error));
        this._onListClick = event => {
            const item = event.target.closest('[data-template-id]');
            if (!item) return;
            this.selectTemplate(item.dataset.templateId).catch(error => this._showError(error));
        };
        this.root.addEventListener('click', this._onClick);
        this.searchInput.addEventListener('input', this._onSearch);
        this.categorySelect.addEventListener('change', this._onCategory);
        this.fileInput.addEventListener('change', this._onFile);
        this.list.addEventListener('click', this._onListClick);
    }

    async refresh() {
        this.templates = await this.templateManager.getAllTemplates();
        this._renderCategories();
        this._renderList();
        if (this.selectedTemplateId && this.templates.some(item => item.id === this.selectedTemplateId)) {
            await this.selectTemplate(this.selectedTemplateId);
        } else if (this.templates.length) {
            await this.selectTemplate(this.templates[0].id);
        } else {
            this.selectedTemplateId = null;
            this.preview.clear();
            this._setDetails(null);
        }
        this.onChange?.(this.templates);
        return this.templates;
    }

    _renderCategories() {
        const selected = this.categorySelect.value;
        const categories = [...new Set(this.templates.map(item => item.category || 'Allgemein'))].sort();
        this.categorySelect.replaceChildren();
        const all = createElement('option', '', 'Alle Kategorien');
        all.value = '';
        this.categorySelect.appendChild(all);
        for (const category of categories) {
            const option = createElement('option', '', category);
            option.value = category;
            this.categorySelect.appendChild(option);
        }
        this.categorySelect.value = categories.includes(selected) ? selected : '';
    }

    _renderList() {
        const query = this.searchInput.value.trim().toLocaleLowerCase('de');
        const category = this.categorySelect.value;
        const filtered = this.templates.filter(template => {
            const text = [template.name, template.description, template.category, ...(template.tags || [])].join(' ').toLocaleLowerCase('de');
            return (!query || text.includes(query)) && (!category || template.category === category);
        });
        this.list.replaceChildren();
        if (!filtered.length) {
            this.list.appendChild(createElement('div', 'component-library-status', 'Keine passenden Vorlagen gefunden.'));
            return;
        }
        for (const template of filtered) {
            const item = createElement('button', 'component-library-item');
            item.type = 'button';
            item.dataset.templateId = template.id;
            item.setAttribute('aria-selected', String(template.id === this.selectedTemplateId));
            const details = createElement('span');
            details.append(
                createElement('span', '', template.name),
                createElement('small', '', `${template.category || 'Allgemein'} · ${template.metadata?.brickCount ?? template.data.bricks.length} Bauteile`)
            );
            item.appendChild(details);
            this.list.appendChild(item);
        }
    }

    async selectTemplate(templateId) {
        const template = await this.templateManager.getTemplate(templateId);
        if (!template) throw new Error('Die ausgewählte Vorlage wurde nicht gefunden.');
        this.selectedTemplateId = template.id;
        this._setDetails(template);
        this.preview.show(template);
        this._renderList();
        this.status.textContent = `${template.revision || 1}. Version · ${template.data.bricks.length} Bauteile · ${(template.data.connections || []).length} Verbindungen`;
    }

    _setDetails(template) {
        this.nameInput.value = template?.name || '';
        this.descriptionInput.value = template?.description || '';
        this.categoryInput.value = template?.category || 'Allgemein';
        this.tagsInput.value = (template?.tags || []).join(', ');
    }

    async _handleAction(action) {
        this.status.classList.remove('component-library-error');
        if (action === 'save') {
            const groups = this.groupManager.getAllGroups();
            if (!groups.length) throw new Error('Es gibt keine Baugruppe, die gespeichert werden kann.');
            const groupId = this._chooseAssembly(groups);
            if (!groupId) return;
            const template = await this.templateManager.saveTemplate(groupId, this._readMetadata());
            this.selectedTemplateId = template.id;
            await this.refresh();
            this.status.textContent = `Vorlage „${template.name}“ gespeichert.`;
            return;
        }
        if (action === 'import') { this.fileInput.click(); return; }
        if (action === 'export-all') { await this.templateManager.exportAllTemplates(); return; }
        if (!this.selectedTemplateId) throw new Error('Bitte zuerst eine Vorlage auswählen.');

        if (action === 'insert') {
            const position = {
                x: Number(this.positionX.input.value),
                y: Number(this.positionY.input.value),
                z: Number(this.positionZ.input.value)
            };
            const result = await this.templateManager.insertTemplate(this.selectedTemplateId, position);
            this.onInsert?.(result);
            this.status.textContent = `${result.bricks.length} Bauteile wurden eingesetzt.`;
        } else if (action === 'duplicate') {
            const copy = await this.templateManager.duplicateTemplate(this.selectedTemplateId);
            this.selectedTemplateId = copy.id;
            await this.refresh();
        } else if (action === 'rename') {
            const updated = await this.templateManager.renameTemplate(this.selectedTemplateId, this.nameInput.value);
            this.selectedTemplateId = updated.id;
            await this.refresh();
        } else if (action === 'delete') {
            const selected = await this.templateManager.getTemplate(this.selectedTemplateId);
            if (!window.confirm(`Vorlage „${selected?.name || ''}“ wirklich löschen? Bereits eingesetzte Baugruppen bleiben erhalten.`)) return;
            await this.templateManager.deleteTemplate(this.selectedTemplateId);
            this.selectedTemplateId = null;
            await this.refresh();
        } else if (action === 'export') {
            await this.templateManager.exportTemplate(this.selectedTemplateId);
        } else if (action === 'update') {
            const groups = this.groupManager.getAllGroups();
            if (!groups.length) throw new Error('Es gibt keine Baugruppe zum Aktualisieren.');
            const groupId = this._chooseAssembly(groups);
            if (!groupId) return;
            await this.templateManager.updateTemplate(this.selectedTemplateId, groupId, this._readMetadata());
            await this.refresh();
            this.status.textContent = 'Vorlage aktualisiert. Bereits eingesetzte Baugruppen bleiben unverändert.';
        }
    }

    _chooseAssembly(groups) {
        if (groups.length === 1) return groups[0].id;
        const options = groups.map((group, index) => `${index + 1}: ${group.name} (${group.brickIds.length} Bauteile)`).join('\n');
        const answer = window.prompt(`Welche Baugruppe soll verwendet werden?\n${options}\n\nNummer eingeben:`, '1');
        if (answer === null) return null;
        const index = Number.parseInt(answer, 10) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= groups.length) throw new Error('Ungültige Baugruppenauswahl.');
        return groups[index].id;
    }

    _readMetadata() {
        return {
            name: this.nameInput.value.trim() || undefined,
            description: this.descriptionInput.value,
            category: this.categoryInput.value.trim() || 'Allgemein',
            tags: this.tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean)
        };
    }

    async _importSelectedFile() {
        const file = this.fileInput.files?.[0];
        if (!file) return;
        const imported = await this.templateManager.importFile(file);
        this.selectedTemplateId = imported[0]?.id || null;
        this.fileInput.value = '';
        await this.refresh();
        this.status.textContent = `${imported.length} Vorlage(n) importiert.`;
    }

    _showError(error) {
        console.error('Baugruppenbibliothek:', error);
        this.status.classList.add('component-library-error');
        this.status.textContent = error?.message || String(error);
    }

    dispose() {
        if (this.isDisposed) return;
        this.isDisposed = true;
        this.root.removeEventListener('click', this._onClick);
        this.searchInput.removeEventListener('input', this._onSearch);
        this.categorySelect.removeEventListener('change', this._onCategory);
        this.fileInput.removeEventListener('change', this._onFile);
        this.list.removeEventListener('click', this._onListClick);
        this.preview.dispose();
        this.root.remove();
    }
}
