/**
 * ConnectionInspector – Zeigt Details einer ausgewählten Verbindung (Phase F.7)
 *
 * Eigenständige DOM-Komponente ohne CSS-Framework.
 * Zeigt Verbindungstyp, Status und erlaubt das Löschen einer Verbindung.
 *
 * Events (Custom Events auf container):
 *   'connection-delete' → { connectionId: string }
 *   'connection-select' → { connectionId: string }
 */

// ---------------------------------------------------------------------------
// Inline style constants
// ---------------------------------------------------------------------------

const S = {
  panel: `
    font-family: system-ui, sans-serif;
    font-size: 13px;
    color: #e8e8e8;
    background: #1e1e2e;
    border: 1px solid #3a3a5c;
    border-radius: 6px;
    overflow: hidden;
    user-select: none;
    min-width: 240px;
  `,
  header: `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #2a2a42;
    border-bottom: 1px solid #3a3a5c;
  `,
  typeBadge: `
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    background: #4a4a7a;
    color: #b0b0ff;
    white-space: nowrap;
  `,
  title: `
    font-weight: 600;
    font-size: 13px;
    color: #c8c8e8;
    flex: 1;
  `,
  body: `
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  field: `
    display: flex;
    align-items: baseline;
    gap: 6px;
  `,
  fieldLabel: `
    color: #7878aa;
    min-width: 130px;
    font-size: 12px;
  `,
  fieldValue: `
    color: #ddddf8;
    font-family: 'Fira Code', monospace, sans-serif;
    font-size: 12px;
    word-break: break-all;
  `,
  actions: `
    padding: 8px 12px;
    border-top: 1px solid #3a3a5c;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  `,
  deleteBtn: `
    padding: 5px 14px;
    border: 1px solid #cc4444;
    border-radius: 4px;
    background: transparent;
    color: #ff8888;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  `,
  deleteBtnHover: `background: #cc4444; color: #fff;`,
  emptyState: `
    padding: 20px 12px;
    text-align: center;
    color: #555577;
    font-style: italic;
    font-size: 12px;
  `,
  sectionTitle: `
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7878aa;
    padding: 4px 0 2px;
    border-bottom: 1px solid #2e2e4e;
    margin-bottom: 4px;
  `,
  mechanicalBadge: `
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    background: #3a5a3a;
    color: #88ff88;
    white-space: nowrap;
  `,
};

// ---------------------------------------------------------------------------
// Type label helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS = {
  'stud-to-bottom':   'Stud → Anti-Stud',
  'stud-to-stud':     'Stud → Stud',
  'technic-pin':      'Technic Pin',
  'axle':             'Achse',
  'clip':             'Clip',
  'ball-joint':       'Kugelgelenk',
  'hinge':            'Scharnier',
};

function typeLabel(type) {
  return TYPE_LABELS[type] ?? type ?? '–';
}

// ---------------------------------------------------------------------------
// ConnectionInspector
// ---------------------------------------------------------------------------

export class ConnectionInspector {
  /**
   * @param {object}       params
   * @param {HTMLElement}  params.container
   * @param {object}       params.connectionManager
   * @param {object|null} [params.mechanicalManager]
   * @param {object}      [params.options]
   */
  constructor({ container, connectionManager, mechanicalManager = null, options = {} }) {
    this._container          = container;
    this._connectionManager  = connectionManager;
    this._mechanicalManager  = mechanicalManager;
    this._options            = options;

    /** @type {string|null} */
    this._currentConnectionId = null;
    /** @type {boolean} */
    this._mechanical = false;

    /** @type {HTMLElement|null} */
    this._root = null;

    // Bound event handlers (kept for proper removeEventListener)
    this._onDeleteClick  = this._onDeleteClick.bind(this);
    this._onDeleteHover  = this._onDeleteHover.bind(this);
    this._onDeleteLeave  = this._onDeleteLeave.bind(this);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Mounts the inspector into the container. */
  mount() {
    if (this._root) return;          // already mounted
    this._root = document.createElement('div');
    this._applyStyle(this._root, S.panel);
    this._container.appendChild(this._root);
    this._renderEmpty();
  }

  /** Removes the inspector from the DOM. */
  unmount() {
    if (!this._root) return;
    this._detachDeleteListeners();
    this._container.removeChild(this._root);
    this._root = null;
    this._currentConnectionId = null;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Inspects and displays a standard connection.
   * @param {string} connectionId
   */
  inspect(connectionId) {
    this._currentConnectionId = connectionId;
    this._mechanical          = false;
    this._render();
  }

  /**
   * Inspects and displays a mechanical connection.
   * @param {string} connectionId
   */
  inspectMechanical(connectionId) {
    this._currentConnectionId = connectionId;
    this._mechanical          = true;
    this._render();
  }

  /** Resets to the empty state. */
  clear() {
    this._currentConnectionId = null;
    this._mechanical          = false;
    if (this._root) this._renderEmpty();
  }

  /** Re-renders the currently inspected connection. */
  refresh() {
    if (!this._currentConnectionId) {
      this._renderEmpty();
    } else {
      this._render();
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  _renderEmpty() {
    if (!this._root) return;
    this._detachDeleteListeners();
    this._root.innerHTML = '';

    const empty = document.createElement('div');
    this._applyStyle(empty, S.emptyState);
    empty.textContent = 'Keine Verbindung ausgewählt.';
    this._root.appendChild(empty);
  }

  _render() {
    if (!this._root) return;
    this._detachDeleteListeners();
    this._root.innerHTML = '';

    if (!this._currentConnectionId) {
      this._renderEmpty();
      return;
    }

    let conn = null;
    if (this._mechanical && this._mechanicalManager) {
      conn = this._mechanicalManager.getConnection?.(this._currentConnectionId)
          ?? this._mechanicalManager.getJoint?.(this._currentConnectionId)
          ?? null;
    } else {
      conn = this._connectionManager.getConnection?.(this._currentConnectionId)
          ?? null;
    }

    if (!conn) {
      this._renderNotFound();
      return;
    }

    this._mechanical ? this._renderMechanical(conn) : this._renderStandard(conn);
  }

  /** Renders a standard (stud/technic) connection. */
  _renderStandard(conn) {
    const typeBadgeText = conn.type ?? 'unknown';
    const badgeStyle    = S.typeBadge;

    // --- header ---
    const header = this._makeHeader(typeBadgeText, 'Verbindung', badgeStyle);
    this._root.appendChild(header);

    // --- body ---
    const body = document.createElement('div');
    this._applyStyle(body, S.body);

    const fields = [
      { label: 'Von:',                  value: conn.partA        ?? conn.fromPartId ?? '–' },
      { label: 'Nach:',                 value: conn.partB        ?? conn.toPartId   ?? '–' },
      { label: 'Typ:',                  value: typeLabel(conn.type) },
      { label: 'Verbindungspunkt A:',   value: conn.pointA       ?? conn.cpIdA      ?? '–' },
      { label: 'Verbindungspunkt B:',   value: conn.pointB       ?? conn.cpIdB      ?? '–' },
    ];

    // Optional extra fields
    if (conn.status)    fields.push({ label: 'Status:',    value: conn.status });
    if (conn.force != null) fields.push({ label: 'Kraft:',  value: `${conn.force} N` });

    for (const f of fields) {
      body.appendChild(this._makeField(f.label, f.value));
    }
    this._root.appendChild(body);

    // --- actions ---
    this._root.appendChild(this._makeActions(this._currentConnectionId));
  }

  /** Renders a mechanical (joint) connection. */
  _renderMechanical(conn) {
    const typeBadgeText = conn.type ?? 'mechanical';

    // --- header ---
    const header = this._makeHeader(typeBadgeText, 'Mech. Verbindung', S.mechanicalBadge);
    this._root.appendChild(header);

    // --- body ---
    const body = document.createElement('div');
    this._applyStyle(body, S.body);

    // Section: Teile
    body.appendChild(this._makeSectionTitle('Teile'));
    body.appendChild(this._makeField('Teil A:', conn.partA ?? conn.partAId ?? '–'));
    body.appendChild(this._makeField('Teil B:', conn.partB ?? conn.partBId ?? '–'));

    // Section: Gelenk-Eigenschaften
    body.appendChild(this._makeSectionTitle('Eigenschaften'));
    body.appendChild(this._makeField('Gelenk-Typ:', typeLabel(conn.type)));

    if (conn.axis) {
      const ax = conn.axis;
      const axStr = `(${+ax.x.toFixed(3)}, ${+ax.y.toFixed(3)}, ${+ax.z.toFixed(3)})`;
      body.appendChild(this._makeField('Achse:', axStr));
    }

    if (conn.limits) {
      const { min, max } = conn.limits;
      body.appendChild(this._makeField('Grenzwerte:', `${min}° … ${max}°`));
    }

    if (conn.stiffness != null) {
      body.appendChild(this._makeField('Steifigkeit:', String(conn.stiffness)));
    }
    if (conn.damping != null) {
      body.appendChild(this._makeField('Dämpfung:', String(conn.damping)));
    }

    this._root.appendChild(body);

    // --- actions ---
    this._root.appendChild(this._makeActions(this._currentConnectionId));
  }

  _renderNotFound() {
    const empty = document.createElement('div');
    this._applyStyle(empty, S.emptyState);
    empty.textContent = `Verbindung „${this._currentConnectionId}" nicht gefunden.`;
    this._root.appendChild(empty);
  }

  // -------------------------------------------------------------------------
  // DOM builders
  // -------------------------------------------------------------------------

  /**
   * @param {string} badgeText
   * @param {string} title
   * @param {string} badgeStyle  Inline style string for the badge
   * @returns {HTMLElement}
   */
  _makeHeader(badgeText, title, badgeStyle) {
    const header = document.createElement('div');
    this._applyStyle(header, S.header);

    const badge = document.createElement('span');
    badge.className = 'ci-type-badge';
    this._applyStyle(badge, badgeStyle);
    badge.textContent = badgeText;

    const titleEl = document.createElement('span');
    titleEl.className = 'ci-title';
    this._applyStyle(titleEl, S.title);
    titleEl.textContent = title;

    header.appendChild(badge);
    header.appendChild(titleEl);
    return header;
  }

  /**
   * @param {string} labelText
   * @param {string} valueText
   * @returns {HTMLElement}
   */
  _makeField(labelText, valueText) {
    const row = document.createElement('div');
    row.className = 'ci-field';
    this._applyStyle(row, S.field);

    const label = document.createElement('label');
    this._applyStyle(label, S.fieldLabel);
    label.textContent = labelText;

    const value = document.createElement('span');
    this._applyStyle(value, S.fieldValue);
    value.textContent = String(valueText);

    row.appendChild(label);
    row.appendChild(value);
    return row;
  }

  /**
   * @param {string} text
   * @returns {HTMLElement}
   */
  _makeSectionTitle(text) {
    const el = document.createElement('div');
    this._applyStyle(el, S.sectionTitle);
    el.textContent = text;
    return el;
  }

  /**
   * @param {string} connectionId
   * @returns {HTMLElement}
   */
  _makeActions(connectionId) {
    const actions = document.createElement('div');
    actions.className = 'ci-actions';
    this._applyStyle(actions, S.actions);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ci-delete-btn';
    this._applyStyle(deleteBtn, S.deleteBtn);
    deleteBtn.textContent = 'Verbindung löschen';
    deleteBtn.dataset.connectionId = connectionId;

    // Hover effect
    deleteBtn.addEventListener('mouseenter', this._onDeleteHover);
    deleteBtn.addEventListener('mouseleave', this._onDeleteLeave);
    deleteBtn.addEventListener('click',      this._onDeleteClick);
    this._deleteBtn = deleteBtn;

    actions.appendChild(deleteBtn);
    return actions;
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  _onDeleteClick(e) {
    const btn          = e.currentTarget;
    const connectionId = btn.dataset.connectionId;
    if (!connectionId) return;

    this._container.dispatchEvent(
      new CustomEvent('connection-delete', {
        bubbles: true,
        detail:  { connectionId },
      })
    );
  }

  _onDeleteHover(e) {
    Object.assign(e.currentTarget.style, this._parseInlineStyle(S.deleteBtnHover));
  }

  _onDeleteLeave(e) {
    // Restore base delete button style (only the properties that were overridden)
    e.currentTarget.style.background = '';
    e.currentTarget.style.color      = '#ff8888';
  }

  _detachDeleteListeners() {
    if (this._deleteBtn) {
      this._deleteBtn.removeEventListener('mouseenter', this._onDeleteHover);
      this._deleteBtn.removeEventListener('mouseleave', this._onDeleteLeave);
      this._deleteBtn.removeEventListener('click',      this._onDeleteClick);
      this._deleteBtn = null;
    }
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /**
   * Applies a multi-line inline style string to an element.
   * @param {HTMLElement} el
   * @param {string}      styleStr
   */
  _applyStyle(el, styleStr) {
    const trimmed = styleStr.trim();
    // Append rather than replace, so callers can layer styles
    el.style.cssText += trimmed;
  }

  /**
   * Parses an inline style string into an object (for Object.assign to style).
   * @param {string} styleStr
   * @returns {object}
   */
  _parseInlineStyle(styleStr) {
    const result = {};
    for (const declaration of styleStr.split(';')) {
      const [prop, val] = declaration.split(':');
      if (prop && val) {
        // Convert kebab-case to camelCase
        const camel = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        result[camel] = val.trim();
      }
    }
    return result;
  }
}
