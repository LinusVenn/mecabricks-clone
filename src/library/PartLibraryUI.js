
import { PartCatalog   } from './PartCatalog.js';
import { PartSearch    } from './PartSearch.js';
import { PartPreview   } from './PartPreview.js';
import { PART_CATEGORIES } from '../objects/PartCategories.js';

// =====================================================================
// PartLibraryUI
//
// Vollständige Bauteilbibliothek mit:
//   • Suchfeld
//   • Kategoriefilter
//   • Bauteilraster
//   • Detailansicht mit 3D-Vorschau
//   • Favoriten (localStorage)
//   • Zuletzt verwendete Bauteile (localStorage)
//
// Die Bibliothek fügt selbst KEINE Steine in die Szene ein.
// Sie übergibt nur die Bauteil-ID an onSelect(partId).
// =====================================================================

const FAV_KEY    = 'lego-editor-favorites';
const RECENT_KEY = 'lego-editor-recent';
const MAX_RECENT = 6;

export class PartLibraryUI {

    /**
     * @param {HTMLElement} container  – Das sidebar-Element
     * @param {function}    onSelect   – Callback(partId) wenn Bauteil gewählt
     */
    constructor(container, onSelect) {

        this._container = container;
        this._onSelect  = onSelect ?? (() => {});

        this._catalog   = PartCatalog.instance();
        this._search    = new PartSearch(this._catalog);

        this._query     = '';
        this._category  = '';
        this._selected  = null;

        this._favorites = this._loadFavorites();
        this._recent    = this._loadRecent();

        this._preview   = null;   // PartPreview-Instanz

        this._build();
    }


    // ----------------------------------------------------------------
    // DOM aufbauen
    // ----------------------------------------------------------------

    _build() {

        this._container.innerHTML = '';
        this._container.classList.add('part-library');

        // ── Suche ────────────────────────────────────────────────────
        const searchWrap = document.createElement('div');
        searchWrap.className = 'lib-search-wrap';

        this._searchInput = document.createElement('input');
        this._searchInput.type        = 'text';
        this._searchInput.placeholder = 'Bauteil suchen…';
        this._searchInput.className   = 'lib-search-input';
        this._searchInput.addEventListener('input', () => {
            this._query = this._searchInput.value;
            this._render();
        });

        const clearBtn = document.createElement('button');
        clearBtn.className   = 'lib-search-clear';
        clearBtn.textContent = '✕';
        clearBtn.title       = 'Suche zurücksetzen';
        clearBtn.addEventListener('click', () => {
            this._searchInput.value = '';
            this._query = '';
            this._render();
        });

        searchWrap.appendChild(this._searchInput);
        searchWrap.appendChild(clearBtn);
        this._container.appendChild(searchWrap);

        // ── Kategorietabs ─────────────────────────────────────────────
        this._categoryBar = document.createElement('div');
        this._categoryBar.className = 'lib-category-bar';
        this._buildCategoryTabs();
        this._container.appendChild(this._categoryBar);

        // ── Trefferzahl ───────────────────────────────────────────────
        this._countEl = document.createElement('div');
        this._countEl.className = 'lib-count';
        this._container.appendChild(this._countEl);

        // ── Bauteilraster ─────────────────────────────────────────────
        this._grid = document.createElement('div');
        this._grid.className = 'lib-grid';
        this._container.appendChild(this._grid);

        // ── Detailbereich ─────────────────────────────────────────────
        this._detail = document.createElement('div');
        this._detail.className = 'lib-detail';
        this._container.appendChild(this._detail);

        // Initiales Rendering
        this._render();
    }

    _buildCategoryTabs() {

        this._categoryBar.innerHTML = '';

        // "Alle"-Tab
        const allBtn = document.createElement('button');
        allBtn.className   = 'lib-cat-btn' + (this._category === '' ? ' active' : '');
        allBtn.textContent = 'Alle';
        allBtn.title       = 'Alle Kategorien anzeigen';
        allBtn.addEventListener('click', () => {
            this._category = '';
            this._updateCategoryTabs();
            this._render();
        });
        this._categoryBar.appendChild(allBtn);

        // Eine Schaltfläche je Kategorie
        for (const cat of Object.values(PART_CATEGORIES)) {
            const btn = document.createElement('button');
            btn.className   = 'lib-cat-btn' + (this._category === cat.id ? ' active' : '');
            btn.textContent = cat.name;
            btn.title       = cat.description ?? cat.name;
            btn.dataset.catId = cat.id;
            btn.addEventListener('click', () => {
                this._category = cat.id;
                this._updateCategoryTabs();
                this._render();
            });
            this._categoryBar.appendChild(btn);
        }
    }

    _updateCategoryTabs() {
        this._categoryBar.querySelectorAll('.lib-cat-btn').forEach(btn => {
            const id = btn.dataset.catId ?? '';
            btn.classList.toggle('active', id === this._category);
        });
    }


    // ----------------------------------------------------------------
    // Rendering (Raster neu aufbauen)
    // ----------------------------------------------------------------

    _render() {

        const results = this._search.filter({
            query:    this._query,
            category: this._category
        });

        // Trefferzahl
        this._countEl.textContent =
            `${results.length} Bauteil${results.length !== 1 ? 'e' : ''}`;

        // Raster
        this._grid.innerHTML = '';

        // Zuletzt verwendet (nur wenn keine Suche aktiv)
        if (!this._query && !this._category && this._recent.length > 0) {
            this._appendSection('Zuletzt verwendet',
                this._recent
                    .map(id => this._catalog.getPartById(id))
                    .filter(Boolean)
            );
        }

        // Bauteile nach Kategorie gruppieren
        const grouped = this._groupByCategory(results);

        for (const [catId, parts] of grouped) {
            const cat = PART_CATEGORIES[catId];
            const label = cat ? cat.name : catId;
            this._appendSection(label, parts);
        }

        if (results.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'lib-empty';
            empty.textContent = 'Keine Bauteile gefunden.';
            this._grid.appendChild(empty);
        }
    }

    _groupByCategory(parts) {
        const map = new Map();

        for (const part of parts) {
            const cat = part.category ?? 'other';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat).push(part);
        }

        return map;
    }

    _appendSection(label, parts) {

        if (parts.length === 0) return;

        const section = document.createElement('div');
        section.className = 'lib-section';

        const title = document.createElement('div');
        title.className   = 'lib-section-title';
        title.textContent = label;
        section.appendChild(title);

        const row = document.createElement('div');
        row.className = 'lib-section-row';

        for (const part of parts) {
            row.appendChild(this._makeCard(part));
        }

        section.appendChild(row);
        this._grid.appendChild(section);
    }

    _makeCard(part) {

        const card = document.createElement('button');
        card.className = 'lib-card';
        card.title     = `${part.name}\n${part.description ?? ''}`;

        if (this._selected === part.id) {
            card.classList.add('selected');
        }

        // Favoriten-Stern
        const star = document.createElement('span');
        star.className   = 'lib-card-star';
        star.textContent = this._favorites.has(part.id) ? '★' : '☆';
        star.title       = 'Favorit';
        star.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleFavorite(part.id);
            star.textContent = this._favorites.has(part.id) ? '★' : '☆';
            star.classList.toggle('active', this._favorites.has(part.id));
        });
        if (this._favorites.has(part.id)) star.classList.add('active');

        // Abmessungen als kompaktes Label
        const dims = document.createElement('span');
        dims.className   = 'lib-card-dims';
        dims.textContent = `${part.depth}×${part.width}`;

        // Name
        const name = document.createElement('span');
        name.className   = 'lib-card-name';
        name.textContent = part.name;

        card.appendChild(star);
        card.appendChild(dims);
        card.appendChild(name);

        // Auswählen
        card.addEventListener('click', () => {
            this._selectPart(part.id);
        });

        return card;
    }


    // ----------------------------------------------------------------
    // Bauteil auswählen
    // ----------------------------------------------------------------

    _selectPart(partId) {

        this._selected = partId;

        // Ausgewählte Karte hervorheben
        this._grid.querySelectorAll('.lib-card').forEach(card => {
            card.classList.toggle(
                'selected',
                card.title.startsWith(
                    this._catalog.getPartById(partId)?.name ?? '---'
                )
            );
        });

        this._showDetail(partId);
        this._addToRecent(partId);
        this._onSelect(partId);
    }


    // ----------------------------------------------------------------
    // Detailansicht
    // ----------------------------------------------------------------

    _showDetail(partId) {

        const part = this._catalog.getPartById(partId);

        if (!part) {
            this._detail.innerHTML = '';
            return;
        }

        this._detail.innerHTML = '';

        // Titel
        const title = document.createElement('div');
        title.className   = 'lib-detail-title';
        title.textContent = part.name;
        this._detail.appendChild(title);

        // 3D-Vorschau
        const previewWrap = document.createElement('div');
        previewWrap.className = 'lib-detail-preview';
        this._detail.appendChild(previewWrap);

        if (this._preview) this._preview.dispose();
        this._preview = new PartPreview(previewWrap, 200, 130);
        this._preview.setPart(partId, 0x4488ff);
        this._preview.show();

        // Eigenschaften
        const props = [
            ['ID',        part.id],
            ['Kategorie', part.category],
            ['Geometrie', part.geometry],
            ['Maße',      `${part.depth} × ${part.width} × ${(part.height).toFixed(1)} Noppen`],
            ['Noppen',    part.studs ? 'Ja' : 'Nein'],
        ];

        const table = document.createElement('table');
        table.className = 'lib-detail-table';

        for (const [key, val] of props) {
            const tr = document.createElement('tr');
            const td1 = document.createElement('td');
            td1.textContent = key;
            td1.className   = 'lib-detail-key';
            const td2 = document.createElement('td');
            td2.textContent = val;
            tr.appendChild(td1);
            tr.appendChild(td2);
            table.appendChild(tr);
        }

        this._detail.appendChild(table);

        if (part.description) {
            const desc = document.createElement('div');
            desc.className   = 'lib-detail-desc';
            desc.textContent = part.description;
            this._detail.appendChild(desc);
        }

        // Platzieren-Button
        const btn = document.createElement('button');
        btn.className   = 'lib-detail-btn';
        btn.textContent = '▶ Platzieren';
        btn.addEventListener('click', () => this._onSelect(partId));
        this._detail.appendChild(btn);
    }


    // ----------------------------------------------------------------
    // Favoriten & zuletzt verwendet
    // ----------------------------------------------------------------

    _toggleFavorite(partId) {
        if (this._favorites.has(partId)) {
            this._favorites.delete(partId);
        } else {
            this._favorites.add(partId);
        }
        this._saveFavorites();
    }

    _addToRecent(partId) {
        this._recent = [partId,
            ...this._recent.filter(id => id !== partId)
        ].slice(0, MAX_RECENT);
        this._saveRecent();
    }

    _loadFavorites() {
        try {
            const raw = localStorage.getItem(FAV_KEY);
            return new Set(raw ? JSON.parse(raw) : []);
        } catch { return new Set(); }
    }

    _saveFavorites() {
        try {
            localStorage.setItem(FAV_KEY,
                JSON.stringify([...this._favorites]));
        } catch { /* quota oder nicht verfügbar */ }
    }

    _loadRecent() {
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    _saveRecent() {
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(this._recent));
        } catch { /* quota oder nicht verfügbar */ }
    }
}
