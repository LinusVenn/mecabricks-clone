
import { PartCatalog } from './PartCatalog.js';
import { PartSearch } from './PartSearch.js';
import { PartPreview } from './PartPreview.js';
import { ColorPickerUI } from './ColorPickerUI.js';
import { PART_CATEGORIES } from '../objects/PartCategories.js';
import { PART_DEFINITIONS } from '../objects/PartDefinitions.js';

const FAV_KEY = 'lego-editor-favorites';
const RECENT_KEY = 'lego-editor-recent';
const MAX_RECENT = 6;

export class PartLibraryUI {

    constructor(container, onSelect, options = {}) {
        if (!container) {
            throw new Error(
                'PartLibraryUI benötigt einen gültigen DOM-Container.'
            );
        }

        this._container = container;
        this._onSelect = typeof onSelect === 'function'
            ? onSelect
            : () => {};

        this._geometryProvider = options.geometryProvider ?? null;

        this._catalog = PartCatalog.instance();
        this._search = new PartSearch(this._catalog);

        this._query = '';
        this._category = '';
        this._selected = null;

        this._physicalOnly = true;
        this._verifiedOnly = false;
        this._placeableOnly = false;

        this._favorites = this._loadFavorites();
        this._recent = this._loadRecent();

        this._preview = null;
        this._disposed = false;

        /** @type {number|null} Aktuell gewählte LDraw-Farb-ID */
        this._selectedColorId = null;

        /** @type {ColorPickerUI|null} */
        this._colorPicker = null;

        this._build();
    }

    // =============================================================
    // DOM aufbauen
    // =============================================================

    _build() {
        this._container.innerHTML = '';
        this._container.classList.add('part-library');

        // Suche
        const searchWrap = document.createElement('div');
        searchWrap.className = 'lib-search-wrap';

        this._searchInput = document.createElement('input');
        this._searchInput.type = 'text';
        this._searchInput.placeholder = 'Bauteil suchen…';
        this._searchInput.className = 'lib-search-input';

        this._searchInput.addEventListener('input', () => {
            this._query = this._searchInput.value;
            this._render();
        });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'lib-search-clear';
        clearBtn.textContent = '✕';
        clearBtn.title = 'Suche zurücksetzen';

        clearBtn.addEventListener('click', () => {
            this._searchInput.value = '';
            this._query = '';
            this._render();
        });

        searchWrap.append(
            this._searchInput,
            clearBtn
        );

        this._container.appendChild(searchWrap);

        // Filter
        this._buildFilters();

        // Farbauswahl (einklappbar, Phase E.4)
        this._buildColorPickerSection();

        // Kategorien
        this._categoryBar = document.createElement('div');
        this._categoryBar.className = 'lib-category-bar';

        this._container.appendChild(this._categoryBar);
        this._buildCategoryTabs();

        // Trefferzahl
        this._countEl = document.createElement('div');
        this._countEl.className = 'lib-count';

        this._container.appendChild(this._countEl);

        // Bauteilraster
        this._grid = document.createElement('div');
        this._grid.className = 'lib-grid';

        this._container.appendChild(this._grid);

        // Detailansicht
        this._detail = document.createElement('div');
        this._detail.className = 'lib-detail';

        this._container.appendChild(this._detail);

        this._render();
    }

    _buildFilters() {
        this._filterWrap = document.createElement('div');
        this._filterWrap.className = 'lib-filter-wrap';

        this._physicalCheckbox = this._createFilterCheckbox(
            'Nur physische Bauteile',
            this._physicalOnly,
            checked => {
                this._physicalOnly = checked;
                this._render();
            }
        );

        this._verifiedCheckbox = this._createFilterCheckbox(
            'Nur verifizierte Bauteile',
            this._verifiedOnly,
            checked => {
                this._verifiedOnly = checked;
                this._render();
            }
        );

        this._placeableCheckbox = this._createFilterCheckbox(
            'Nur platzierbare Bauteile',
            this._placeableOnly,
            checked => {
                this._placeableOnly = checked;
                this._render();
            }
        );

        this._filterWrap.append(
            this._physicalCheckbox.wrapper,
            this._verifiedCheckbox.wrapper,
            this._placeableCheckbox.wrapper
        );

        this._container.appendChild(this._filterWrap);
    }

    // =============================================================
    // Farbauswahl (Phase E.4)
    // =============================================================

    _buildColorPickerSection() {
        // <details> / <summary> für einklappbaren Bereich
        const details = document.createElement('details');
        details.className = 'lib-color-details';

        const summary = document.createElement('summary');
        summary.className = 'lib-color-summary';
        summary.textContent = 'Farbe wählen';

        this._colorPickerContainer = document.createElement('div');
        this._colorPickerContainer.className = 'lib-color-picker-wrap';

        details.append(summary, this._colorPickerContainer);
        this._container.appendChild(details);

        // ColorPickerUI initialisieren und mounten
        this._initColorPicker();
    }

    _initColorPicker() {
        if (this._colorPicker) {
            this._colorPicker.unmount();
            this._colorPicker = null;
        }

        this._colorPicker = new ColorPickerUI({
            container:      this._colorPickerContainer,
            selectedColorId: this._selectedColorId,
            options: {
                showFamilyGroups: true,
                showSearch:       true,
                showTooltips:     true,
                swatchSize:       'medium',
                columns:          8,
            },
        });

        this._colorPicker.mount();

        // Farb-Auswahl-Event abhören
        this._colorPickerContainer.addEventListener(
            'color-selected',
            (event) => {
                const { colorId, hex, color } = event.detail;

                this._selectedColorId = colorId;

                // Custom Event nach außen weiterleiten
                this._container.dispatchEvent(
                    new CustomEvent('color-changed', {
                        bubbles: true,
                        detail: { colorId, hex, color },
                    })
                );
            }
        );
    }

    _createFilterCheckbox(labelText, initialValue, onChange) {
        const wrapper = document.createElement('label');
        wrapper.className = 'lib-filter-option';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = initialValue;

        const text = document.createElement('span');
        text.textContent = labelText;

        input.addEventListener('change', () => {
            onChange(input.checked);
        });

        wrapper.append(input, text);

        return {
            wrapper,
            input
        };
    }

    // =============================================================
    // Kategorien
    // =============================================================

    _buildCategoryTabs() {
        this._categoryBar.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'lib-cat-btn';
        allBtn.textContent = 'Alle';
        allBtn.title = 'Alle Kategorien anzeigen';

        allBtn.addEventListener('click', () => {
            this._category = '';
            this._updateCategoryTabs();
            this._render();
        });

        this._categoryBar.appendChild(allBtn);

        for (const category of Object.values(PART_CATEGORIES)) {
            const btn = document.createElement('button');

            btn.type = 'button';
            btn.className = 'lib-cat-btn';
            btn.textContent = category.name;
            btn.title = category.description ?? category.name;
            btn.dataset.catId = category.id;

            btn.addEventListener('click', () => {
                this._category = category.id;
                this._updateCategoryTabs();
                this._render();
            });

            this._categoryBar.appendChild(btn);
        }

        this._updateCategoryTabs();
    }

    _updateCategoryTabs() {
        if (!this._categoryBar) return;

        this._categoryBar
            .querySelectorAll('.lib-cat-btn')
            .forEach(btn => {
                const id = btn.dataset.catId ?? '';

                btn.classList.toggle(
                    'active',
                    id === this._category
                );
            });
    }

    // =============================================================
    // Rendering
    // =============================================================

    _getResults() {
        return this._search.filter({
            query: this._query,
            category: this._category,

            physicalOnly: this._physicalOnly,
            verifiedOnly: this._verifiedOnly,
            placeableOnly: this._placeableOnly
        });
    }

    _render() {
        if (this._disposed) return;

        const results = this._getResults();

        this._countEl.textContent =
            `${results.length} Bauteil${results.length !== 1 ? 'e' : ''}`;

        this._grid.innerHTML = '';

        // Zuletzt verwendete Bauteile
        if (
            !this._query &&
            !this._category &&
            this._recent.length > 0
        ) {
            const recentParts = this._recent
                .map(id => this._catalog.getPartById(id))
                .filter(Boolean)
                .filter(part => {
                    if (this._physicalOnly && !part.isPhysical) {
                        return false;
                    }

                    if (this._verifiedOnly && !part.isVerified) {
                        return false;
                    }

                    if (
                        this._placeableOnly &&
                        !this._isPlaceable(part)
                    ) {
                        return false;
                    }

                    return true;
                });

            this._appendSection(
                'Zuletzt verwendet',
                recentParts
            );
        }

        const grouped = this._groupByCategory(results);

        for (const [categoryId, parts] of grouped) {
            const category = PART_CATEGORIES[categoryId];

            this._appendSection(
                category?.name ?? categoryId,
                parts
            );
        }

        if (results.length === 0) {
            const empty = document.createElement('div');

            empty.className = 'lib-empty';
            empty.textContent = 'Keine Bauteile gefunden.';

            this._grid.appendChild(empty);
        }

        this._updateCategoryTabs();
    }

    _groupByCategory(parts) {
        const map = new Map();

        for (const part of parts) {
            const category = part.category ?? 'other';

            if (!map.has(category)) {
                map.set(category, []);
            }

            map.get(category).push(part);
        }

        return map;
    }

    _appendSection(label, parts) {
        if (!parts.length) return;

        const section = document.createElement('div');
        section.className = 'lib-section';

        const title = document.createElement('div');
        title.className = 'lib-section-title';
        title.textContent = label;

        const row = document.createElement('div');
        row.className = 'lib-section-row';

        for (const part of parts) {
            row.appendChild(this._makeCard(part));
        }

        section.append(title, row);
        this._grid.appendChild(section);
    }

    // =============================================================
    // Platzierbarkeit
    // =============================================================

    _isPlaceable(part) {
        if (!part) return false;

        // Lokal verfügbar (immer platzierbar wenn definiert)
        if (Object.prototype.hasOwnProperty.call(PART_DEFINITIONS, part.id)) {
            return true;
        }

        // LDraw-Bauteil: platzierbar wenn geometryProvider konfiguriert
        if (part.ldrawPartNumber) {
            return this._geometryProvider
                ? this._geometryProvider.canProvideGeometry(part.id)
                : false;
        }

        return false;
    }

    _getPlacementStatus(part) {
        if (!part) return 'Geometrie noch nicht verfügbar';

        // Lokal definiertes Bauteil
        if (Object.prototype.hasOwnProperty.call(PART_DEFINITIONS, part.id)) {
            return 'Direkt platzierbar';
        }

        // LDraw-Bauteil
        if (part.ldrawPartNumber) {
            if (this._isPlaceable(part)) {
                return 'LDraw-Bauteil (platzierbar)';
            }
            return 'LDraw-Zuordnung vorhanden – kein Geometrie-Provider konfiguriert';
        }

        return 'Geometrie noch nicht verfügbar';
    }

    // =============================================================
    // Bauteilkarten
    // =============================================================

    _makeCard(part) {
        const card = document.createElement('button');

        card.type = 'button';
        card.className = 'lib-card';
        card.dataset.partId = part.id;

        card.title = [
            part.name,
            part.description ?? '',
            this._getPlacementStatus(part)
        ].filter(Boolean).join('\n');

        if (this._selected === part.id) {
            card.classList.add('selected');
        }

        if (!this._isPlaceable(part)) {
            card.classList.add('not-placeable');
        }

        // Favoriten
        const star = document.createElement('span');

        star.className = 'lib-card-star';
        star.textContent = this._favorites.has(part.id)
            ? '★'
            : '☆';

        star.title = 'Favorit';

        if (this._favorites.has(part.id)) {
            star.classList.add('active');
        }

        star.addEventListener('click', event => {
            event.stopPropagation();

            this._toggleFavorite(part.id);

            star.textContent = this._favorites.has(part.id)
                ? '★'
                : '☆';

            star.classList.toggle(
                'active',
                this._favorites.has(part.id)
            );
        });

        // Abmessungen
        const dims = document.createElement('span');

        dims.className = 'lib-card-dims';

        if (part.width != null && part.depth != null) {
            dims.textContent = `${part.depth}×${part.width}`;
        } else {
            dims.textContent = 'Maße unbekannt';
        }

        // Name
        const name = document.createElement('span');

        name.className = 'lib-card-name';
        name.textContent = part.name;

        // Platzierungsstatus
        const status = document.createElement('span');

        status.className = 'lib-card-status';
        status.textContent = this._isPlaceable(part)
            ? 'Platzierbar'
            : 'Nicht platzierbar';

        card.append(
            star,
            dims,
            name,
            status
        );

        card.addEventListener('click', () => {
            this._selectPart(part.id);
        });

        return card;
    }

    // =============================================================
    // Bauteil auswählen
    // =============================================================

    _selectPart(partId) {
        const part = this._catalog.getPartById(partId);

        if (!part) return;

        this._selected = partId;

        this._grid
            .querySelectorAll('.lib-card')
            .forEach(card => {
                card.classList.toggle(
                    'selected',
                    card.dataset.partId === partId
                );
            });

        this._showDetail(partId);
        this._addToRecent(partId);

        // Nur tatsächlich platzierbare Teile an den
        // PlacementManager weitergeben.
        if (this._isPlaceable(part)) {
            this._onSelect(partId);
        } else {
            // Eine eventuell noch aktive Platzierung abbrechen.
            this._onSelect(null);
        }
    }

    // =============================================================
    // Detailansicht
    // =============================================================

    _showDetail(partId) {
        const part = this._catalog.getPartById(partId);

        if (!part) {
            this._clearPreview();
            this._detail.innerHTML = '';
            return;
        }

        this._clearPreview();
        this._detail.innerHTML = '';

        const title = document.createElement('div');

        title.className = 'lib-detail-title';
        title.textContent = part.name;

        this._detail.appendChild(title);

        // Vorschau für lokale Bauteile sowie LDraw-Bauteile
        // (PartPreview übernimmt das asynchrone Laden von LDraw-Geometrien).
        const previewWrap = document.createElement('div');

        previewWrap.className = 'lib-detail-preview';
        this._detail.appendChild(previewWrap);

        if (this._isPlaceable(part)) {
            try {
                this._preview = new PartPreview(
                    previewWrap,
                    200,
                    130
                );

                this._preview.setPart(
                    part.id,
                    0x4488ff
                );

                this._preview.show();

            } catch (error) {
                console.warn(
                    `Vorschau für "${part.id}" konnte nicht erstellt werden:`,
                    error
                );

                this._preview?.dispose();
                this._preview = null;

                previewWrap.textContent =
                    '3D-Vorschau nicht verfügbar.';
            }
        } else {
            previewWrap.textContent =
                'Für dieses Bauteil ist noch keine integrierte 3D-Vorschau verfügbar.';
        }

        // Eigenschaften
        const dimensions = [
            part.depth,
            part.width,
            part.height
        ];

        const dimensionText = dimensions.every(
            value => value !== null && value !== undefined
        )
            ? `${part.depth} × ${part.width} × ${part.height}`
            : 'Nicht vollständig bekannt';

        const properties = [
            ['Interne ID', part.id],
            ['Kategorie', PART_CATEGORIES[part.category]?.name ?? part.category],
            ['Geometrie', part.geometryType ?? part.geometry ?? 'Unbekannt'],
            ['Maße', dimensionText],
            ['Noppen', part.studs === true ? 'Ja' : part.studs === false ? 'Nein' : 'Unbekannt'],
            ['BrickLink-ID', part.brickLinkId ?? 'Nicht zugeordnet'],
            ['LDraw-Nummer', part.ldrawPartNumber ?? 'Nicht zugeordnet'],
            ['Physisches Teil', part.isPhysical ? 'Ja' : 'Nein'],
            ['Verifiziert', part.isVerified ? 'Ja' : 'Nein'],
            ['Platzierung', this._getPlacementStatus(part)]
        ];

        const table = document.createElement('table');

        table.className = 'lib-detail-table';

        for (const [key, value] of properties) {
            const tr = document.createElement('tr');

            const keyCell = document.createElement('td');
            keyCell.className = 'lib-detail-key';
            keyCell.textContent = key;

            const valueCell = document.createElement('td');
            valueCell.textContent = String(value);

            tr.append(keyCell, valueCell);
            table.appendChild(tr);
        }

        this._detail.appendChild(table);

        // Beschreibung
        if (part.description) {
            const description = document.createElement('div');

            description.className = 'lib-detail-desc';
            description.textContent = part.description;

            this._detail.appendChild(description);
        }

        // Tags und Aliase
        if (part.tags?.length || part.aliases?.length) {
            const metadata = document.createElement('div');

            metadata.className = 'lib-detail-metadata';

            if (part.tags?.length) {
                const tags = document.createElement('div');

                tags.textContent =
                    `Tags: ${part.tags.join(', ')}`;

                metadata.appendChild(tags);
            }

            if (part.aliases?.length) {
                const aliases = document.createElement('div');

                aliases.textContent =
                    `Alternative Namen: ${part.aliases.join(', ')}`;

                metadata.appendChild(aliases);
            }

            this._detail.appendChild(metadata);
        }

        // Platzieren-Button
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'lib-detail-btn';

        if (this._isPlaceable(part)) {
            button.textContent = '▶ Platzieren';

            button.addEventListener('click', () => {
                this._selectPart(partId);
            });
        } else {
            button.textContent = 'Noch nicht platzierbar';
            button.disabled = true;
            button.title = this._getPlacementStatus(part);
        }

        this._detail.appendChild(button);
    }

    _clearPreview() {
        if (!this._preview) return;

        this._preview.dispose();
        this._preview = null;
    }

    // =============================================================
    // Favoriten
    // =============================================================

    _toggleFavorite(partId) {
        if (this._favorites.has(partId)) {
            this._favorites.delete(partId);
        } else {
            this._favorites.add(partId);
        }

        this._saveFavorites();
    }

    _loadFavorites() {
        try {
            const raw = localStorage.getItem(FAV_KEY);
            const parsed = raw ? JSON.parse(raw) : [];

            return new Set(
                Array.isArray(parsed) ? parsed : []
            );
        } catch {
            return new Set();
        }
    }

    _saveFavorites() {
        try {
            localStorage.setItem(
                FAV_KEY,
                JSON.stringify([...this._favorites])
            );
        } catch {
            // localStorage kann deaktiviert oder voll sein.
        }
    }

    // =============================================================
    // Zuletzt verwendet
    // =============================================================

    _addToRecent(partId) {
        this._recent = [
            partId,
            ...this._recent.filter(id => id !== partId)
        ].slice(0, MAX_RECENT);

        this._saveRecent();
    }

    _loadRecent() {
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            const parsed = raw ? JSON.parse(raw) : [];

            return Array.isArray(parsed)
                ? parsed.filter(id => typeof id === 'string')
                : [];
        } catch {
            return [];
        }
    }

    _saveRecent() {
        try {
            localStorage.setItem(
                RECENT_KEY,
                JSON.stringify(this._recent)
            );
        } catch {
            // localStorage kann deaktiviert oder voll sein.
        }
    }

    // =============================================================
    // Öffentliche Methoden
    // =============================================================

    refresh() {
        this._render();

        if (this._selected) {
            this._showDetail(this._selected);
        }
    }

    getSelectedPart() {
        return this._selected
            ? this._catalog.getPartById(this._selected)
            : null;
    }

    /**
     * Gibt die aktuell gewählte LDraw-Farb-ID zurück.
     * @returns {number|null}
     */
    getSelectedColorId() {
        return this._selectedColorId;
    }

    setQuery(query) {
        this._query = String(query ?? '');

        if (this._searchInput) {
            this._searchInput.value = this._query;
        }

        this._render();
    }

    clearSelection() {
        this._selected = null;
        this._clearPreview();

        if (this._detail) {
            this._detail.innerHTML = '';
        }

        this._grid
            ?.querySelectorAll('.lib-card')
            .forEach(card => {
                card.classList.remove('selected');
            });
    }

    dispose() {
        if (this._disposed) return;

        this._disposed = true;

        this._clearPreview();

        if (this._colorPicker) {
            this._colorPicker.unmount();
            this._colorPicker = null;
        }

        this._container.innerHTML = '';
        this._container.classList.remove('part-library');
    }
}
