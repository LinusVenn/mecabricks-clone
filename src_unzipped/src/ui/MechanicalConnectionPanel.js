/**
 * MechanicalConnectionPanel – Bearbeitet mechanische Verbindungen (Phase F.7)
 *
 * Erlaubt das Erstellen, Bearbeiten und Löschen von mechanischen Verbindungen.
 *
 * Events:
 *   'joint-create' → { type, partA, partB, axis, limits }
 *   'joint-delete' → { jointId }
 *   'joint-update' → { jointId, changes }
 */
import { MECHANICAL_CONNECTION_TYPES } from '../connections/MechanicalConnectionManager.js';

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
    min-width: 260px;
    user-select: none;
  `,
  header: `
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 9px 14px;
    background: #2a2a42;
    border-bottom: 1px solid #3a3a5c;
    color: #b0b0ff;
  `,
  details: `
    border-bottom: 1px solid #2e2e4e;
  `,
  summary: `
    cursor: pointer;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 600;
    color: #9898cc;
    background: #242438;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    outline: none;
  `,
  summaryHover: `background: #2e2e48;`,
  form: `
    padding: 10px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  label: `
    font-size: 12px;
    color: #9898cc;
    display: flex;
    flex-direction: column;
    gap: 3px;
  `,
  labelInline: `
    font-size: 12px;
    color: #9898cc;
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  select: `
    background: #2a2a42;
    border: 1px solid #4a4a7a;
    border-radius: 4px;
    color: #e0e0ff;
    font-size: 12px;
    padding: 4px 8px;
    cursor: pointer;
    outline: none;
  `,
  input: `
    background: #2a2a42;
    border: 1px solid #4a4a7a;
    border-radius: 4px;
    color: #e0e0ff;
    font-size: 12px;
    padding: 3px 7px;
    width: 64px;
    outline: none;
  `,
  axisRow: `
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  `,
  createBtn: `
    padding: 6px 16px;
    border: none;
    border-radius: 4px;
    background: #4a4aaa;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    align-self: flex-start;
    transition: background 0.15s;
  `,
  createBtnHover: `background: #6666cc;`,
  createBtnDisabled: `background: #2e2e4e; color: #555577; cursor: not-allowed;`,
  sectionInfo: `
    font-size: 11px;
    color: #666688;
    padding: 4px 14px 6px;
    font-style: italic;
  `,
  list: `
    list-style: none;
    margin: 0;
    padding: 6px 0;
  `,
  listItemBase: `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-bottom: 1px solid #2a2a3e;
    cursor: pointer;
    transition: background 0.12s;
  `,
  listItemHover: `background: #28283e;`,
  listItemActive: `background: #2e2e58;`,
  jointTypeBadge: `
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 999px;
    background: #3a3a6a;
    color: #9898ff;
    white-space: nowrap;
    min-width: 54px;
    text-align: center;
  `,
  listItemLabel: `
    flex: 1;
    font-size: 12px;
    color: #ccccee;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  editBtn: `
    padding: 2px 8px;
    border: 1px solid #4a4a7a;
    border-radius: 3px;
    background: transparent;
    color: #9898cc;
    font-size: 11px;
    cursor: pointer;
  `,
  deleteBtn: `
    padding: 2px 8px;
    border: 1px solid #884444;
    border-radius: 3px;
    background: transparent;
    color: #ff7777;
    font-size: 11px;
    cursor: pointer;
  `,
  emptyList: `
    padding: 12px 14px;
    color: #555577;
    font-size: 12px;
    font-style: italic;
    text-align: center;
  `,
  editSection: `
    padding: 10px 14px;
    background: #242438;
    border-top: 1px solid #2e2e4e;
  `,
  editTitle: `
    font-weight: 600;
    font-size: 12px;
    color: #b0b0ff;
    margin-bottom: 8px;
  `,
  editActions: `
    display: flex;
    gap: 8px;
    margin-top: 10px;
  `,
  saveBtn: `
    padding: 5px 14px;
    border: none;
    border-radius: 4px;
    background: #3a7a3a;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
  `,
  cancelBtn: `
    padding: 5px 14px;
    border: 1px solid #4a4a7a;
    border-radius: 4px;
    background: transparent;
    color: #9898cc;
    font-size: 12px;
    cursor: pointer;
  `,
  fieldset: `
    border: 1px solid #3a3a5c;
    border-radius: 4px;
    padding: 6px 10px;
    margin: 0;
  `,
  legend: `
    font-size: 11px;
    color: #7878aa;
    padding: 0 4px;
  `,
};

// ---------------------------------------------------------------------------
// Joint type configuration
// ---------------------------------------------------------------------------

/** Types that require an axis vector */
const AXIS_TYPES = new Set(['revolute', 'prismatic', 'axle']);

/** Types that require limit angles */
const LIMIT_TYPES = new Set(['revolute', 'prismatic']);

/** Human-readable labels for joint types */
const JOINT_LABELS = {
  rigid:      'Starr',
  revolute:   'Drehgelenk',
  prismatic:  'Schiebegelenk',
  ball:       'Kugelgelenk',
  gear:       'Zahnrad',
  axle:       'Achse',
};

// Build option list from MECHANICAL_CONNECTION_TYPES if available, else use defaults
const _fallbackTypes = Object.keys(JOINT_LABELS);
function resolvedTypes() {
  if (MECHANICAL_CONNECTION_TYPES && typeof MECHANICAL_CONNECTION_TYPES === 'object') {
    return Object.values(MECHANICAL_CONNECTION_TYPES);
  }
  return _fallbackTypes;
}

// ---------------------------------------------------------------------------
// MechanicalConnectionPanel
// ---------------------------------------------------------------------------

export class MechanicalConnectionPanel {
  /**
   * @param {object}      params
   * @param {HTMLElement} params.container
   * @param {object}      params.mechanicalManager
   * @param {object}      params.editor
   * @param {object}     [params.options]
   */
  constructor({ container, mechanicalManager, editor, options = {} }) {
    this._container          = container;
    this._mechanicalManager  = mechanicalManager;
    this._editor             = editor;
    this._options            = options;

    /** @type {string|null} */
    this._partAId = null;
    /** @type {string|null} */
    this._partBId = null;
    /** @type {string|null} */
    this._editingJointId = null;
    /** @type {boolean} */
    this._enabled = true;

    /** @type {HTMLElement|null} */
    this._root = null;

    // Bound handlers
    this._onTypeChange   = this._onTypeChange.bind(this);
    this._onFormSubmit   = this._onFormSubmit.bind(this);
    this._onSummaryHover = this._onSummaryHover.bind(this);
    this._onSummaryLeave = this._onSummaryLeave.bind(this);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Mounts the panel into the container element. */
  mount() {
    if (this._root) return;
    this._root = document.createElement('div');
    this._root.className = 'mcp-panel';
    this._applyStyle(this._root, S.panel);
    this._container.appendChild(this._root);
    this._render();
  }

  /** Removes the panel from the DOM. */
  unmount() {
    if (!this._root) return;
    this._container.removeChild(this._root);
    this._root = null;
    this._editingJointId = null;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Populates part IDs and shows the create-joint section.
   * @param {string} partAId
   * @param {string} partBId
   */
  showForParts(partAId, partBId) {
    this._partAId = partAId;
    this._partBId = partBId;
    this._editingJointId = null;
    this._render();

    // Auto-expand the create section
    if (this._createDetails) this._createDetails.open = true;
  }

  /** Shows the full list of all existing joints (collapses create section). */
  showAll() {
    this._partAId        = null;
    this._partBId        = null;
    this._editingJointId = null;
    this._render();

    if (this._listDetails)   this._listDetails.open   = true;
    if (this._createDetails) this._createDetails.open = false;
  }

  /**
   * Opens the edit form for a given joint.
   * @param {string} jointId
   */
  editJoint(jointId) {
    this._editingJointId = jointId;
    this._render();

    if (this._listDetails) this._listDetails.open = true;
  }

  /** Re-renders the panel with current state. */
  refresh() {
    if (!this._root) return;
    this._render();
  }

  /**
   * Returns the currently selected joint type from the create form.
   * @returns {string}
   */
  getSelectedType() {
    if (this._typeSelect) return this._typeSelect.value;
    return 'rigid';
  }

  /**
   * Enables or disables the panel's interactive elements.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!this._root) return;

    const interactables = this._root.querySelectorAll('button, select, input');
    for (const el of interactables) {
      el.disabled = !enabled;
    }

    if (this._createBtn) {
      this._applyStyle(
        this._createBtn,
        enabled ? S.createBtn : S.createBtn + S.createBtnDisabled
      );
    }
  }

  // -------------------------------------------------------------------------
  // Core render
  // -------------------------------------------------------------------------

  _render() {
    if (!this._root) return;
    this._root.innerHTML = '';
    this._typeSelect     = null;
    this._createBtn      = null;
    this._createDetails  = null;
    this._listDetails    = null;

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'mcp-header';
    this._applyStyle(hdr, S.header);
    hdr.textContent = 'Mechanische Verbindungen';
    this._root.appendChild(hdr);

    // Create section
    this._root.appendChild(this._buildCreateSection());

    // List section
    this._root.appendChild(this._buildListSection());

    // Inline edit section (if editing)
    if (this._editingJointId) {
      this._root.appendChild(this._buildEditSection(this._editingJointId));
    }
  }

  // -------------------------------------------------------------------------
  // Create section
  // -------------------------------------------------------------------------

  _buildCreateSection() {
    const details = document.createElement('details');
    details.className = 'mcp-create-section';
    this._applyStyle(details, S.details);
    details.open = true;
    this._createDetails = details;

    const summary = document.createElement('summary');
    this._applyStyle(summary, S.summary);
    summary.textContent = 'Neue Verbindung erstellen';
    summary.addEventListener('mouseenter', () => this._applyStyle(summary, S.summaryHover));
    summary.addEventListener('mouseleave', () => { summary.style.background = ''; });
    details.appendChild(summary);

    // Part info row
    if (this._partAId && this._partBId) {
      const info = document.createElement('div');
      this._applyStyle(info, S.sectionInfo);
      info.textContent = `${this._partAId} ↔ ${this._partBId}`;
      details.appendChild(info);
    }

    // Form
    const form = document.createElement('form');
    form.className = 'mcp-form';
    this._applyStyle(form, S.form);
    form.addEventListener('submit', this._onFormSubmit);

    // Type select
    form.appendChild(this._buildTypeSelect());

    // Axis fields (hidden by default — shown for revolute/prismatic/axle)
    const axisWrapper = this._buildAxisFields();
    form.appendChild(axisWrapper);
    this._axisFieldsWrapper = axisWrapper;

    // Limit fields (hidden by default — shown for revolute/prismatic)
    const limitsWrapper = this._buildLimitsFields();
    form.appendChild(limitsWrapper);
    this._limitsFieldsWrapper = limitsWrapper;

    // Update initial visibility based on default type
    this._updateDynamicFields();

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type      = 'submit';
    submitBtn.className = 'mcp-create-btn';
    this._applyStyle(submitBtn, S.createBtn);
    submitBtn.textContent = 'Verbindung erstellen';
    submitBtn.addEventListener('mouseenter', () => this._applyStyle(submitBtn, S.createBtnHover));
    submitBtn.addEventListener('mouseleave', () => { submitBtn.style.background = ''; });
    this._createBtn = submitBtn;
    form.appendChild(submitBtn);

    details.appendChild(form);
    return details;
  }

  _buildTypeSelect() {
    const labelEl = document.createElement('label');
    this._applyStyle(labelEl, S.label);
    labelEl.textContent = 'Gelenk-Typ:';

    const select = document.createElement('select');
    select.className = 'mcp-type-select';
    this._applyStyle(select, S.select);

    for (const typeVal of resolvedTypes()) {
      const opt   = document.createElement('option');
      opt.value   = typeVal;
      opt.textContent = JOINT_LABELS[typeVal] ?? typeVal;
      select.appendChild(opt);
    }

    select.addEventListener('change', this._onTypeChange);
    this._typeSelect = select;
    labelEl.appendChild(select);
    return labelEl;
  }

  _buildAxisFields() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'mcp-axis-fields';
    this._applyStyle(wrapper, S.fieldset);
    wrapper.hidden = true;

    const legend = document.createElement('legend');
    this._applyStyle(legend, S.legend);
    legend.textContent = 'Richtungsachse';
    wrapper.appendChild(legend);

    const row = document.createElement('div');
    this._applyStyle(row, S.axisRow);

    for (const axis of ['X', 'Y', 'Z']) {
      const lbl = document.createElement('label');
      this._applyStyle(lbl, S.labelInline);
      lbl.textContent = `${axis}:`;

      const inp = document.createElement('input');
      inp.type      = 'number';
      inp.className = `mcp-axis-${axis.toLowerCase()}`;
      this._applyStyle(inp, S.input);
      inp.value = axis === 'Y' ? '1' : '0';
      inp.step  = '0.1';
      inp.setAttribute('aria-label', `Achse ${axis}`);

      lbl.appendChild(inp);
      row.appendChild(lbl);
    }

    wrapper.appendChild(row);
    return wrapper;
  }

  _buildLimitsFields() {
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'mcp-limits-fields';
    this._applyStyle(wrapper, S.fieldset);
    wrapper.hidden = true;

    const legend = document.createElement('legend');
    this._applyStyle(legend, S.legend);
    legend.textContent = 'Grenzwerte';
    wrapper.appendChild(legend);

    const row = document.createElement('div');
    this._applyStyle(row, S.axisRow);

    // Min
    const minLbl = document.createElement('label');
    this._applyStyle(minLbl, S.labelInline);
    minLbl.textContent = 'Min (°):';
    const minInp = document.createElement('input');
    minInp.type      = 'number';
    minInp.className = 'mcp-limit-min';
    this._applyStyle(minInp, S.input);
    minInp.value = '-90';
    minInp.setAttribute('aria-label', 'Minimum-Winkel');
    minLbl.appendChild(minInp);

    // Max
    const maxLbl = document.createElement('label');
    this._applyStyle(maxLbl, S.labelInline);
    maxLbl.textContent = 'Max (°):';
    const maxInp = document.createElement('input');
    maxInp.type      = 'number';
    maxInp.className = 'mcp-limit-max';
    this._applyStyle(maxInp, S.input);
    maxInp.value = '90';
    maxInp.setAttribute('aria-label', 'Maximum-Winkel');
    maxLbl.appendChild(maxInp);

    row.appendChild(minLbl);
    row.appendChild(maxLbl);
    wrapper.appendChild(row);
    return wrapper;
  }

  // -------------------------------------------------------------------------
  // List section
  // -------------------------------------------------------------------------

  _buildListSection() {
    const joints = this._getAllJoints();

    const details = document.createElement('details');
    details.className = 'mcp-list-section';
    this._applyStyle(details, S.details);
    this._listDetails = details;

    const summary = document.createElement('summary');
    this._applyStyle(summary, S.summary);
    summary.textContent = `Vorhandene Verbindungen (${joints.length})`;
    summary.addEventListener('mouseenter', () => this._applyStyle(summary, S.summaryHover));
    summary.addEventListener('mouseleave', () => { summary.style.background = ''; });
    details.appendChild(summary);

    const ul = document.createElement('ul');
    ul.className = 'mcp-list';
    this._applyStyle(ul, S.list);

    if (joints.length === 0) {
      const empty = document.createElement('div');
      this._applyStyle(empty, S.emptyList);
      empty.textContent = 'Keine Verbindungen vorhanden.';
      ul.appendChild(empty);
    } else {
      for (const joint of joints) {
        ul.appendChild(this._buildJointListItem(joint));
      }
    }

    details.appendChild(ul);
    return details;
  }

  /**
   * Builds a single <li> row for a joint.
   * @param {object} joint
   * @returns {HTMLLIElement}
   */
  _buildJointListItem(joint) {
    const li = document.createElement('li');
    this._applyStyle(li, S.listItemBase);

    const isActive = joint.id === this._editingJointId;
    if (isActive) this._applyStyle(li, S.listItemActive);

    li.addEventListener('mouseenter', () => {
      if (joint.id !== this._editingJointId)
        this._applyStyle(li, S.listItemHover);
    });
    li.addEventListener('mouseleave', () => {
      li.style.background = isActive ? '#2e2e58' : '';
    });

    // Type badge
    const badge = document.createElement('span');
    this._applyStyle(badge, S.jointTypeBadge);
    badge.textContent = JOINT_LABELS[joint.type] ?? joint.type ?? '?';

    // Label
    const label = document.createElement('span');
    this._applyStyle(label, S.listItemLabel);
    const pA = joint.partA ?? joint.partAId ?? '?';
    const pB = joint.partB ?? joint.partBId ?? '?';
    label.title       = `${pA} ↔ ${pB}`;
    label.textContent = `${pA} ↔ ${pB}`;

    // Edit button
    const editBtn = document.createElement('button');
    this._applyStyle(editBtn, S.editBtn);
    editBtn.textContent = 'Bearb.';
    editBtn.type        = 'button';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.editJoint(joint.id);
    });

    // Delete button
    const delBtn = document.createElement('button');
    this._applyStyle(delBtn, S.deleteBtn);
    delBtn.textContent = '✕';
    delBtn.type        = 'button';
    delBtn.title       = 'Verbindung löschen';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._fireJointDelete(joint.id);
    });

    li.appendChild(badge);
    li.appendChild(label);
    li.appendChild(editBtn);
    li.appendChild(delBtn);

    return li;
  }

  // -------------------------------------------------------------------------
  // Edit section
  // -------------------------------------------------------------------------

  _buildEditSection(jointId) {
    const joint = this._mechanicalManager?.getJoint?.(jointId);

    const section = document.createElement('div');
    section.className = 'mcp-edit-section';
    this._applyStyle(section, S.editSection);

    const title = document.createElement('div');
    this._applyStyle(title, S.editTitle);
    title.textContent = `Verbindung bearbeiten: ${jointId}`;
    section.appendChild(title);

    if (!joint) {
      const msg = document.createElement('div');
      this._applyStyle(msg, 'color:#ff7777;font-size:12px;');
      msg.textContent = 'Verbindung nicht gefunden.';
      section.appendChild(msg);
      return section;
    }

    const form = document.createElement('form');
    this._applyStyle(form, S.form);

    // Type select (read-only display for edit; changing type would break physics)
    const typeRow = document.createElement('label');
    this._applyStyle(typeRow, S.label);
    typeRow.textContent = 'Gelenk-Typ:';
    const typeDisplay = document.createElement('span');
    this._applyStyle(typeDisplay, 'font-size:12px;color:#e0e0ff;');
    typeDisplay.textContent = JOINT_LABELS[joint.type] ?? joint.type ?? '–';
    typeRow.appendChild(typeDisplay);
    form.appendChild(typeRow);

    // Axis fields (if applicable)
    if (AXIS_TYPES.has(joint.type)) {
      const axisSection = this._buildAxisFields();
      axisSection.hidden = false;

      // Pre-fill from existing joint
      if (joint.axis) {
        const axX = axisSection.querySelector('.mcp-axis-x');
        const axY = axisSection.querySelector('.mcp-axis-y');
        const axZ = axisSection.querySelector('.mcp-axis-z');
        if (axX) axX.value = joint.axis.x ?? 0;
        if (axY) axY.value = joint.axis.y ?? 1;
        if (axZ) axZ.value = joint.axis.z ?? 0;
      }
      form.appendChild(axisSection);
      this._editAxisWrapper = axisSection;
    }

    // Limits fields (if applicable)
    if (LIMIT_TYPES.has(joint.type)) {
      const limitsSection = this._buildLimitsFields();
      limitsSection.hidden = false;

      if (joint.limits) {
        const minEl = limitsSection.querySelector('.mcp-limit-min');
        const maxEl = limitsSection.querySelector('.mcp-limit-max');
        if (minEl) minEl.value = joint.limits.min ?? -90;
        if (maxEl) maxEl.value = joint.limits.max ??  90;
      }
      form.appendChild(limitsSection);
      this._editLimitsWrapper = limitsSection;
    }

    // Action buttons
    const actions = document.createElement('div');
    this._applyStyle(actions, S.editActions);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    this._applyStyle(saveBtn, S.saveBtn);
    saveBtn.textContent = 'Speichern';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    this._applyStyle(cancelBtn, S.cancelBtn);
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.addEventListener('click', () => {
      this._editingJointId = null;
      this._render();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._onEditSave(joint);
    });

    section.appendChild(form);
    return section;
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /** Updates dynamic field visibility when the joint type changes. */
  _onTypeChange() {
    this._updateDynamicFields();
  }

  /** Updates axis / limits field visibility based on selected type. */
  _updateDynamicFields() {
    if (!this._typeSelect) return;
    const type = this._typeSelect.value;

    if (this._axisFieldsWrapper) {
      this._axisFieldsWrapper.hidden = !AXIS_TYPES.has(type);
    }
    if (this._limitsFieldsWrapper) {
      this._limitsFieldsWrapper.hidden = !LIMIT_TYPES.has(type);
    }
  }

  /** Handles create-form submission. */
  _onFormSubmit(e) {
    e.preventDefault();
    if (!this._enabled) return;

    const type = this._typeSelect?.value ?? 'rigid';

    const axis = AXIS_TYPES.has(type)
      ? this._readAxisFromWrapper(this._axisFieldsWrapper)
      : null;

    const limits = LIMIT_TYPES.has(type)
      ? this._readLimitsFromWrapper(this._limitsFieldsWrapper)
      : null;

    const detail = {
      type,
      partA:  this._partAId,
      partB:  this._partBId,
      axis,
      limits,
    };

    this._container.dispatchEvent(
      new CustomEvent('joint-create', { bubbles: true, detail })
    );
  }

  /** Handles edit-form save. */
  _onEditSave(joint) {
    if (!this._enabled) return;

    const changes = {};

    if (this._editAxisWrapper && AXIS_TYPES.has(joint.type)) {
      changes.axis = this._readAxisFromWrapper(this._editAxisWrapper);
    }

    if (this._editLimitsWrapper && LIMIT_TYPES.has(joint.type)) {
      changes.limits = this._readLimitsFromWrapper(this._editLimitsWrapper);
    }

    this._container.dispatchEvent(
      new CustomEvent('joint-update', {
        bubbles: true,
        detail:  { jointId: this._editingJointId, changes },
      })
    );

    this._editingJointId = null;
    this._render();
  }

  /** Fires a joint-delete event for the given joint ID. */
  _fireJointDelete(jointId) {
    this._container.dispatchEvent(
      new CustomEvent('joint-delete', {
        bubbles: true,
        detail:  { jointId },
      })
    );
  }

  // -------------------------------------------------------------------------
  // Data helpers
  // -------------------------------------------------------------------------

  /** Returns all joints from the mechanical manager, or [] on error. */
  _getAllJoints() {
    try {
      const joints = this._mechanicalManager?.getAllJoints?.()
                  ?? this._mechanicalManager?.getJoints?.()
                  ?? [];
      return Array.isArray(joints) ? joints : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Reads axis vector values from an axis-fields wrapper element.
   * @param {HTMLElement} wrapper
   * @returns {{x:number, y:number, z:number}}
   */
  _readAxisFromWrapper(wrapper) {
    if (!wrapper) return { x: 0, y: 1, z: 0 };
    const x = parseFloat(wrapper.querySelector('.mcp-axis-x')?.value ?? 0);
    const y = parseFloat(wrapper.querySelector('.mcp-axis-y')?.value ?? 1);
    const z = parseFloat(wrapper.querySelector('.mcp-axis-z')?.value ?? 0);
    return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 1 : y, z: isNaN(z) ? 0 : z };
  }

  /**
   * Reads limit values from a limits-fields wrapper element.
   * @param {HTMLElement} wrapper
   * @returns {{min:number, max:number}}
   */
  _readLimitsFromWrapper(wrapper) {
    if (!wrapper) return { min: -90, max: 90 };
    const min = parseFloat(wrapper.querySelector('.mcp-limit-min')?.value ?? -90);
    const max = parseFloat(wrapper.querySelector('.mcp-limit-max')?.value ??  90);
    return { min: isNaN(min) ? -90 : min, max: isNaN(max) ? 90 : max };
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
    el.style.cssText += styleStr.trim();
  }
}
