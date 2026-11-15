/**
 * PartVariantDefinition – Definiert eine Variante eines Bauteils (Phase E.5)
 *
 * Eine Variante ist eine alternative Version desselben Bauteils.
 * Beispiele:
 *   - Stein 2×4 mit Logo-Noppen vs. ohne Logo
 *   - Runder Stein 1×1 mit Achsloch vs. ohne
 *   - Platte 1×2 mit Schiene vs. ohne
 *
 * Jede Variante gehört zu einem Basis-Bauteil (basePartId) und
 * hat einen eindeutigen Bezeichner (variantId) sowie optionale
 * Unterschiede in: LDraw-Nummer, Tags, Beschreibung, Abmessungen.
 *
 * @module catalog/variants/PartVariantDefinition
 */

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Gibt einen tiefen, unveränderlichen Klon eines Objekts zurück.
 * Unterstützt einfache Objekte, Arrays, Strings, Zahlen und Booleans.
 *
 * @template T
 * @param {T} value - Der zu klonende Wert.
 * @returns {T} Unveränderlicher Klon.
 */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const arr = value.map(deepFreeze);
    return Object.freeze(arr);
  }
  const frozen = {};
  for (const key of Object.keys(value)) {
    frozen[key] = deepFreeze(value[key]);
  }
  return Object.freeze(frozen);
}

/**
 * Prüft, ob ein Wert ein nicht-leerer String ist.
 *
 * @param {*} val - Zu prüfender Wert.
 * @returns {boolean} `true` wenn nicht-leerer String.
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Klasse
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} VariantOverrides
 * @property {number} [width]    - Überschriebene Breite (in Basiseinheiten).
 * @property {number} [depth]    - Überschriebene Tiefe (in Basiseinheiten).
 * @property {number} [height]   - Überschriebene Höhe (in Basiseinheiten).
 * @property {Object} [geometry] - Beliebige geometrische Zusatzdaten.
 */

/**
 * @typedef {Object} VariantDefinitionInput
 * @property {string}           basePartId       - ID des Basis-Bauteils im Katalog.
 * @property {string}           variantId        - Eindeutiger Bezeichner dieser Variante.
 * @property {string}           name             - Anzeigename der Variante (Deutsch).
 * @property {string}           [description]    - Optionale Beschreibung.
 * @property {string|null}      [ldrawPartNumber]- LDraw-Teilnummer, falls abweichend.
 * @property {string[]}         [tags]           - Zusätzliche Suchbegriffe.
 * @property {VariantOverrides} [overrides]      - Überschreibende Eigenschaften.
 * @property {boolean}          [isDefault]      - Gibt an, ob dies die Standardvariante ist.
 */

/**
 * @typedef {Object} VariantMatchCriteria
 * @property {string}   [variantId]       - Exakter Bezeichner.
 * @property {string[]} [tags]            - Mindestens einer muss vorhanden sein.
 * @property {string}   [ldrawPartNumber] - Exakte LDraw-Nummer.
 */

export class PartVariantDefinition {
  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  /**
   * Erstellt eine neue, unveränderliche Variantendefinition.
   *
   * @param {VariantDefinitionInput} definition - Konfigurationsobjekt der Variante.
   * @throws {TypeError} Wenn Pflichtfelder fehlen oder ungültig sind.
   *
   * @example
   * const variant = new PartVariantDefinition({
   *   basePartId: 'brick_2x4',
   *   variantId:  'with-logo',
   *   name:       'Stein 2×4 mit Logo-Noppen',
   *   ldrawPartNumber: '3001',
   *   tags:       ['logo', 'standard'],
   *   isDefault:  true,
   * });
   */
  constructor(definition) {
    if (definition === null || typeof definition !== 'object') {
      throw new TypeError(
        'PartVariantDefinition: Das Konfigurationsobjekt muss ein Objekt sein.'
      );
    }

    const {
      basePartId,
      variantId,
      name,
      description    = '',
      ldrawPartNumber = null,
      tags            = [],
      overrides       = {},
      isDefault       = false,
    } = definition;

    // --- Pflichtfeldprüfung -------------------------------------------------
    if (!isNonEmptyString(basePartId)) {
      throw new TypeError(
        'PartVariantDefinition: "basePartId" muss ein nicht-leerer String sein.'
      );
    }
    if (!isNonEmptyString(variantId)) {
      throw new TypeError(
        'PartVariantDefinition: "variantId" muss ein nicht-leerer String sein.'
      );
    }
    if (!isNonEmptyString(name)) {
      throw new TypeError(
        'PartVariantDefinition: "name" muss ein nicht-leerer String sein.'
      );
    }

    // --- Typprüfungen -------------------------------------------------------
    if (ldrawPartNumber !== null && typeof ldrawPartNumber !== 'string') {
      throw new TypeError(
        'PartVariantDefinition: "ldrawPartNumber" muss ein String oder null sein.'
      );
    }
    if (!Array.isArray(tags)) {
      throw new TypeError(
        'PartVariantDefinition: "tags" muss ein Array sein.'
      );
    }
    if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
      throw new TypeError(
        'PartVariantDefinition: "overrides" muss ein Objekt sein.'
      );
    }

    // --- Interne, unveränderliche Speicherung -------------------------------
    /** @type {string} @private */
    this._basePartId = basePartId.trim();

    /** @type {string} @private */
    this._variantId = variantId.trim();

    /** @type {string} @private */
    this._name = name.trim();

    /** @type {string} @private */
    this._description = typeof description === 'string' ? description.trim() : '';

    /** @type {string|null} @private */
    this._ldrawPartNumber = ldrawPartNumber !== null ? ldrawPartNumber.trim() : null;

    /** @type {ReadonlyArray<string>} @private */
    this._tags = deepFreeze(tags.map(t => String(t).trim()).filter(Boolean));

    /** @type {Readonly<VariantOverrides>} @private */
    this._overrides = deepFreeze(overrides);

    /** @type {boolean} @private */
    this._isDefault = Boolean(isDefault);

    // Gesamtes Objekt einfrieren, um externe Mutation zu verhindern
    Object.freeze(this);
  }

  // -------------------------------------------------------------------------
  // Getter (unveränderliche öffentliche API)
  // -------------------------------------------------------------------------

  /**
   * ID des Basis-Bauteils, zu dem diese Variante gehört.
   *
   * @returns {string}
   */
  get basePartId() {
    return this._basePartId;
  }

  /**
   * Eindeutiger Bezeichner dieser Variante innerhalb des Basis-Bauteils.
   *
   * @returns {string}
   */
  get variantId() {
    return this._variantId;
  }

  /**
   * Anzeigename der Variante.
   *
   * @returns {string}
   */
  get name() {
    return this._name;
  }

  /**
   * Optionale Beschreibung der Variante.
   *
   * @returns {string}
   */
  get description() {
    return this._description;
  }

  /**
   * LDraw-Teilnummer dieser Variante (kann von der Basis-Nummer abweichen).
   *
   * @returns {string|null}
   */
  get ldrawPartNumber() {
    return this._ldrawPartNumber;
  }

  /**
   * Zusätzliche Such-Tags dieser Variante.
   *
   * @returns {ReadonlyArray<string>}
   */
  get tags() {
    return this._tags;
  }

  /**
   * Eigenschaftsüberschreibungen gegenüber dem Basis-Bauteil.
   *
   * @returns {Readonly<VariantOverrides>}
   */
  get overrides() {
    return this._overrides;
  }

  /**
   * Gibt an, ob dies die Standard- bzw. kanonische Variante ist.
   *
   * @returns {boolean}
   */
  get isDefault() {
    return this._isDefault;
  }

  // -------------------------------------------------------------------------
  // Hilfsmethoden
  // -------------------------------------------------------------------------

  /**
   * Prüft, ob diese Variante den angegebenen Kriterien entspricht.
   *
   * Regeln:
   *  - `variantId`       → exakter Vergleich
   *  - `ldrawPartNumber` → exakter Vergleich
   *  - `tags`            → mindestens ein Tag muss übereinstimmen (OR-Semantik)
   * Alle angegebenen Kriterien müssen erfüllt sein (AND-Semantik über Felder).
   *
   * @param {VariantMatchCriteria} criteria - Suchkriterien.
   * @returns {boolean} `true` wenn alle Kriterien erfüllt sind.
   *
   * @example
   * variant.matches({ tags: ['logo'] });            // true/false
   * variant.matches({ variantId: 'smooth' });       // true/false
   * variant.matches({ ldrawPartNumber: '3001' });   // true/false
   */
  matches(criteria) {
    if (criteria === null || typeof criteria !== 'object') return false;

    const { variantId, tags, ldrawPartNumber } = criteria;

    if (variantId !== undefined) {
      if (this._variantId !== variantId) return false;
    }

    if (ldrawPartNumber !== undefined) {
      if (this._ldrawPartNumber !== ldrawPartNumber) return false;
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.length === 0) return false;
      const variantTagSet = new Set(this._tags);
      const hasAnyTag = tags.some(t => variantTagSet.has(t));
      if (!hasAnyTag) return false;
    }

    return true;
  }

  /**
   * Wendet die Varianten-Überschreibungen auf eine Basis-Bauteildefinition an
   * und gibt ein neues, zusammengeführtes Objekt zurück.
   *
   * Das Basis-Objekt wird **nicht** verändert.
   * Felder aus `overrides` überschreiben gleichnamige Felder im Basis-Objekt.
   * Zusätzlich werden `ldrawPartNumber`, `name` und `tags` aus der Variante
   * eingemischt, sofern in der Variante vorhanden.
   *
   * @param {Object} basePart - Basis-Bauteildefinition (z. B. NormalizedPart).
   * @returns {Object} Neues Objekt mit angewendeten Überschreibungen.
   * @throws {TypeError} Wenn `basePart` kein Objekt ist.
   *
   * @example
   * const resolved = variant.applyToPartDefinition(catalog.getPart('brick_2x4'));
   * // resolved enthält alle Felder von brick_2x4 plus die Varianten-Overrides
   */
  applyToPartDefinition(basePart) {
    if (basePart === null || typeof basePart !== 'object') {
      throw new TypeError(
        'PartVariantDefinition.applyToPartDefinition: "basePart" muss ein Objekt sein.'
      );
    }

    // Flaches Mischen: Basis zuerst, dann Überschreibungen
    const merged = Object.assign({}, basePart, this._overrides);

    // Variantenspezifische Metadaten einmischen
    merged.variantId   = this._variantId;
    merged.variantName = this._name;

    if (this._ldrawPartNumber !== null) {
      merged.ldrawPartNumber = this._ldrawPartNumber;
    }

    if (this._description) {
      merged.variantDescription = this._description;
    }

    if (this._tags.length > 0) {
      // Tags zusammenführen ohne Duplikate
      const baseTags = Array.isArray(basePart.tags) ? basePart.tags : [];
      const combined = [...new Set([...baseTags, ...this._tags])];
      merged.tags = combined;
    }

    merged.isVariant = true;

    return merged;
  }

  // -------------------------------------------------------------------------
  // Serialisierung
  // -------------------------------------------------------------------------

  /**
   * Serialisiert die Variante in ein einfaches JSON-kompatibles Objekt.
   *
   * @returns {Object} Serialisiertes Datenobjekt.
   *
   * @example
   * const data = variant.toData();
   * const json = JSON.stringify(data);
   */
  toData() {
    return {
      basePartId:       this._basePartId,
      variantId:        this._variantId,
      name:             this._name,
      description:      this._description,
      ldrawPartNumber:  this._ldrawPartNumber,
      tags:             [...this._tags],
      overrides:        JSON.parse(JSON.stringify(this._overrides)), // tiefer Klon
      isDefault:        this._isDefault,
    };
  }

  /**
   * Erstellt eine `PartVariantDefinition` aus einem serialisierten Datenobjekt.
   *
   * @param {Object} obj - Datenobjekt (z. B. aus `toData()` oder JSON).
   * @returns {PartVariantDefinition} Neue Variantendefinition.
   * @throws {TypeError} Wenn das Objekt ungültig ist.
   *
   * @example
   * const variant = PartVariantDefinition.fromData(JSON.parse(jsonString));
   */
  static fromData(obj) {
    if (obj === null || typeof obj !== 'object') {
      throw new TypeError(
        'PartVariantDefinition.fromData: Eingabe muss ein Objekt sein.'
      );
    }
    return new PartVariantDefinition(obj);
  }

  // -------------------------------------------------------------------------
  // Debughilfen
  // -------------------------------------------------------------------------

  /**
   * Gibt eine lesbare Darstellung der Variante zurück.
   *
   * @returns {string}
   */
  toString() {
    return `PartVariantDefinition(${this._basePartId} / ${this._variantId}: "${this._name}")`;
  }
}


