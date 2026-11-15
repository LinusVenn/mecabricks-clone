/**
 * ColorPickerUI – Farbauswahl-Komponente für die Teilepalette (Phase E.4)
 *
 * Erzeugt ein DOM-Element mit einer Farbpalette als Swatch-Raster.
 * Ermöglicht die Auswahl von Farben aus der ColorManager-Palette.
 * Unterstützt Gruppenansicht nach Farbfamilie und Suche.
 *
 * Ereignisse (custom events auf dem container-Element):
 *   'color-selected' → detail: { colorId: number, hex: string, color: ColorDefinition }
 *   'color-hovered'  → detail: { colorId: number, hex: string }
 *
 * Verwendung:
 *   const picker = new ColorPickerUI({ container: myDiv });
 *   picker.mount();
 *   myDiv.addEventListener('color-selected', e => console.log(e.detail));
 */

import { ColorManager } from '../catalog/colors/ColorManager.js';

// ─── Konstanten ───────────────────────────────────────────────────────────────

/** Reihenfolge der Farbfamilien in der Gruppenansicht */
const FAMILY_ORDER = [
    'white',
    'gray',
    'dark',
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'pink',
    'brown',
    'transparent',
    'metallic',
];

/** Deutsche Anzeigenamen für Farbfamilien */
const FAMILY_LABELS = {
    white:       'Weiß',
    gray:        'Grau',
    dark:        'Dunkel',
    red:         'Rot',
    orange:      'Orange',
    yellow:      'Gelb',
    green:       'Grün',
    blue:        'Blau',
    purple:      'Lila',
    pink:        'Pink',
    brown:       'Braun',
    transparent: 'Transparent',
    metallic:    'Metallic',
};

/** Pixelgrößen der Swatches */
const SWATCH_SIZES = {
    small:  18,
    medium: 24,
    large:  32,
};

// ─── Inline-Styles als <style>-Tag ────────────────────────────────────────────

const STYLE_ID = 'color-picker-ui-styles';

function ensureStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;

    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* ── ColorPickerUI ───────────────────────────────────────────────── */
.cp-root {
    font-family: system-ui, sans-serif;
    font-size: 12px;
    color: #ddd;
    user-select: none;
}

.cp-search-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
}

.cp-search-input {
    flex: 1;
    padding: 3px 6px;
    border: 1px solid #555;
    border-radius: 3px;
    background: #2a2a2a;
    color: #eee;
    font-size: 12px;
    outline: none;
}

.cp-search-input:focus {
    border-color: #4af;
}

.cp-search-clear {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 3px;
}

.cp-search-clear:hover {
    color: #eee;
    background: #444;
}

.cp-groups {
    overflow-y: auto;
    max-height: 320px;
}

.cp-family-group {
    margin-bottom: 8px;
}

.cp-family-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    margin-bottom: 3px;
    padding-left: 1px;
}

.cp-swatch-row {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
}

.color-swatch {
    border: 2px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 0.1s, transform 0.1s;
    flex-shrink: 0;
}

.color-swatch:hover {
    border-color: #fff;
    transform: scale(1.15);
    z-index: 1;
    position: relative;
}

.color-swatch.selected {
    border-color: #4af;
    box-shadow: 0 0 0 1px #4af;
}

.color-swatch.disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
}

.cp-empty {
    color: #666;
    font-style: italic;
    padding: 6px 0;
}
/* ── /ColorPickerUI ──────────────────────────────────────────────── */
`;

    (doc.head || doc.documentElement).appendChild(style);
}

// ─── Klasse ───────────────────────────────────────────────────────────────────

export class ColorPickerUI {

    /**
     * @param {{
     *   container?:       HTMLElement,
     *   colorManager?:    import('../catalog/colors/ColorManager.js').ColorManager,
     *   selectedColorId?: number|null,
     *   options?:         {
     *     showFamilyGroups?: boolean,
     *     showSearch?:       boolean,
     *     showTooltips?:     boolean,
     *     swatchSize?:       'small'|'medium'|'large',
     *     columns?:          number,
     *   }
     * }} [params]
     */
    constructor({
        container       = null,
        colorManager    = null,
        selectedColorId = null,
        options         = {},
    } = {}) {
        this._container    = container;
        this._colorManager = colorManager || ColorManager.instance();
        this._selectedId   = selectedColorId;
        this._enabled      = true;
        this._mounted      = false;
        this._root         = null;
        this._searchInput  = null;
        this._filterText   = '';

        // Optionen mit Standardwerten
        this._opts = {
            showFamilyGroups: options.showFamilyGroups !== false,
            showSearch:       options.showSearch       === true,
            showTooltips:     options.showTooltips     !== false,
            swatchSize:       options.swatchSize       || 'medium',
            columns:          typeof options.columns === 'number'
                                  ? options.columns
                                  : 8,
        };

        // Gebundene Handler für späteres removeEventListener
        this._onSwatchClick = this._onSwatchClick.bind(this);
        this._onSwatchEnter = this._onSwatchEnter.bind(this);
    }

    // ─── Öffentliche API ─────────────────────────────────────────────────────

    /**
     * Rendert die Farbpalette in den Container.
     * Kann mehrfach aufgerufen werden (idempotent bei bereits gemounteter UI).
     */
    mount() {
        if (!this._container) return;

        if (this._mounted) {
            this.refresh();
            return;
        }

        const doc = this._container.ownerDocument || document;
        ensureStyles(doc);

        this._root = doc.createElement('div');
        this._root.className = 'cp-root';

        this._container.appendChild(this._root);
        this._mounted = true;

        this._render();
    }

    /**
     * Entfernt das DOM-Element und gibt Ressourcen frei.
     */
    unmount() {
        if (!this._mounted) return;

        if (this._root && this._root.parentNode) {
            this._root.parentNode.removeChild(this._root);
        }

        this._root        = null;
        this._mounted     = false;
        this._searchInput = null;
    }

    /**
     * Wählt eine Farbe programmatisch aus (ohne Event zu feuern).
     * @param {number|null} colorId  LDraw-Farb-ID
     */
    selectColor(colorId) {
        this._selectedId = colorId;

        if (!this._root) return;

        this._root.querySelectorAll('.color-swatch').forEach(el => {
            el.classList.toggle(
                'selected',
                Number(el.dataset.colorId) === colorId
            );
        });
    }

    /**
     * Gibt die aktuell gewählte LDraw-Farb-ID zurück.
     * @returns {number|null}
     */
    getSelectedColorId() {
        return this._selectedId;
    }

    /**
     * Aktiviert oder deaktiviert die gesamte UI.
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = Boolean(enabled);

        if (!this._root) return;

        this._root.querySelectorAll('.color-swatch').forEach(el => {
            el.classList.toggle('disabled', !this._enabled);
        });

        if (this._searchInput) {
            this._searchInput.disabled = !this._enabled;
        }
    }

    /**
     * Rendert die Palette neu (z. B. nach einem Palettenwechsel).
     */
    refresh() {
        if (!this._mounted || !this._root) return;

        this._render();
    }

    // ─── Internes Rendering ──────────────────────────────────────────────────

    _render() {
        if (!this._root) return;

        this._root.innerHTML = '';

        // Optionales Suchfeld
        if (this._opts.showSearch) {
            this._root.appendChild(this._buildSearchField());
        }

        // Container für Farbraster
        const groupsWrap = document.createElement('div');
        groupsWrap.className = 'cp-groups';
        this._root.appendChild(groupsWrap);

        const colors = this._getFilteredColors();

        if (colors.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'cp-empty';
            empty.textContent = 'Keine Farben gefunden.';
            groupsWrap.appendChild(empty);
            return;
        }

        if (this._opts.showFamilyGroups) {
            this._renderGrouped(groupsWrap, colors);
        } else {
            this._renderFlat(groupsWrap, colors);
        }
    }

    /**
     * Erzeugt das Suchfeld-DOM.
     * @returns {HTMLElement}
     */
    _buildSearchField() {
        const wrap = document.createElement('div');
        wrap.className = 'cp-search-wrap';

        this._searchInput = document.createElement('input');
        this._searchInput.type        = 'text';
        this._searchInput.placeholder = 'Farbe suchen…';
        this._searchInput.className   = 'cp-search-input';
        this._searchInput.value       = this._filterText;
        this._searchInput.disabled    = !this._enabled;

        this._searchInput.addEventListener('input', () => {
            this._filterText = this._searchInput.value;
            this._render();
        });

        const clearBtn = document.createElement('button');
        clearBtn.type        = 'button';
        clearBtn.className   = 'cp-search-clear';
        clearBtn.textContent = '✕';
        clearBtn.title       = 'Suche zurücksetzen';

        clearBtn.addEventListener('click', () => {
            this._filterText = '';

            if (this._searchInput) {
                this._searchInput.value = '';
            }

            this._render();
        });

        wrap.append(this._searchInput, clearBtn);
        return wrap;
    }

    /**
     * Rendert Farben gruppiert nach Farbfamilie.
     * @param {HTMLElement} parent
     * @param {ColorDefinition[]} colors
     */
    _renderGrouped(parent, colors) {
        // Farben in Familien aufteilen
        const familyMap = new Map();

        for (const color of colors) {
            const fam = (color.family || 'other').toLowerCase();

            if (!familyMap.has(fam)) {
                familyMap.set(fam, []);
            }

            familyMap.get(fam).push(color);
        }

        // Familien in definierter Reihenfolge ausgeben, Rest alphabetisch
        const orderedFamilies = [
            ...FAMILY_ORDER.filter(f => familyMap.has(f)),
            ...[...familyMap.keys()]
                .filter(f => !FAMILY_ORDER.includes(f))
                .sort(),
        ];

        for (const family of orderedFamilies) {
            const familyColors = familyMap.get(family);

            if (!familyColors || familyColors.length === 0) continue;

            const group = document.createElement('div');
            group.className = 'cp-family-group';

            const label = document.createElement('div');
            label.className   = 'cp-family-label';
            label.textContent = FAMILY_LABELS[family] || family;

            const swatchRow = document.createElement('div');
            swatchRow.className = 'cp-swatch-row';

            for (const color of familyColors) {
                swatchRow.appendChild(this._buildSwatch(color));
            }

            group.append(label, swatchRow);
            parent.appendChild(group);
        }
    }

    /**
     * Rendert alle Farben in einem einzigen Raster ohne Gruppenüberschriften.
     * @param {HTMLElement} parent
     * @param {ColorDefinition[]} colors
     */
    _renderFlat(parent, colors) {
        const row = document.createElement('div');
        row.className = 'cp-swatch-row';

        for (const color of colors) {
            row.appendChild(this._buildSwatch(color));
        }

        parent.appendChild(row);
    }

    /**
     * Erzeugt ein einzelnes Farb-Swatch-Element.
     * @param {ColorDefinition} color
     * @returns {HTMLElement}
     */
    _buildSwatch(color) {
        const size = SWATCH_SIZES[this._opts.swatchSize] || SWATCH_SIZES.medium;

        const swatch = document.createElement('div');
        swatch.className         = 'color-swatch';
        swatch.dataset.colorId   = String(color.id);
        swatch.style.width           = `${size}px`;
        swatch.style.height          = `${size}px`;
        swatch.style.backgroundColor = color.hex;

        if (color.id === this._selectedId) {
            swatch.classList.add('selected');
        }

        if (!this._enabled) {
            swatch.classList.add('disabled');
        }

        if (this._opts.showTooltips) {
            // Tooltip: bevorzugt deutschen Namen, dann englischen, dann Fallback
            const name =
                color.nameDE  ||
                color.nameDe  ||
                color.nameEn  ||
                color.name    ||
                `ID ${color.id}`;

            swatch.title = `${name}  (ID ${color.id})`;
        }

        swatch.addEventListener('click',      this._onSwatchClick);
        swatch.addEventListener('mouseenter', this._onSwatchEnter);

        return swatch;
    }

    // ─── Event-Handler ───────────────────────────────────────────────────────

    /**
     * Handler für Klick auf einen Swatch.
     * Aktualisiert Selektion und feuert 'color-selected'.
     * @param {MouseEvent} event
     */
    _onSwatchClick(event) {
        if (!this._enabled) return;

        const swatch  = event.currentTarget;
        const colorId = Number(swatch.dataset.colorId);
        const color   = this._colorManager.getColorById(colorId);
        const hex     = color ? color.hex : swatch.style.backgroundColor;

        // Selektierung im DOM aktualisieren
        if (this._root) {
            this._root.querySelectorAll('.color-swatch').forEach(el => {
                el.classList.toggle(
                    'selected',
                    Number(el.dataset.colorId) === colorId
                );
            });
        }

        this._selectedId = colorId;

        // Custom Event auf Container dispatchen
        if (this._container) {
            this._container.dispatchEvent(
                new CustomEvent('color-selected', {
                    bubbles: true,
                    detail:  { colorId, hex, color },
                })
            );
        }
    }

    /**
     * Handler für mouseenter auf einem Swatch.
     * Feuert 'color-hovered'.
     * @param {MouseEvent} event
     */
    _onSwatchEnter(event) {
        if (!this._enabled) return;

        const swatch  = event.currentTarget;
        const colorId = Number(swatch.dataset.colorId);
        const color   = this._colorManager.getColorById(colorId);
        const hex     = color ? color.hex : swatch.style.backgroundColor;

        if (this._container) {
            this._container.dispatchEvent(
                new CustomEvent('color-hovered', {
                    bubbles: true,
                    detail:  { colorId, hex },
                })
            );
        }
    }

    // ─── Hilfsmethoden ───────────────────────────────────────────────────────

    /**
     * Gibt alle Farben zurück, die dem aktuellen Suchfilter entsprechen.
     * Ohne Filter werden alle Farben zurückgegeben.
     * @returns {import('../catalog/colors/ColorDefinition.js').ColorDefinition[]}
     */
    _getFilteredColors() {
        const all = this._colorManager.getAllColors();

        if (!this._filterText) {
            return all;
        }

        const query = this._filterText.toLowerCase().trim();

        return all.filter(color => {
            const id     = String(color.id);
            const nameEn = (color.nameEn || color.name  || '').toLowerCase();
            const nameDE = (color.nameDE || color.nameDe || '').toLowerCase();
            const hex    = (color.hex    || '').toLowerCase();

            return (
                id.includes(query)     ||
                nameEn.includes(query) ||
                nameDE.includes(query) ||
                hex.includes(query)
            );
        });
    }
}
