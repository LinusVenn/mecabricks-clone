/**
 * PartVariantManager – Verwaltet alle Varianten aller Bauteile (Phase E.5)
 *
 * Zentrale Datenstruktur:
 *   Map<basePartId, Map<variantId, PartVariantDefinition>>
 *
 * Unterstützt:
 *  - Registrierung von Varianten
 *  - Abfrage aller Varianten eines Bauteils
 *  - Standard-Variante ermitteln
 *  - Varianten aus JSON laden
 *
 * @module catalog/variants/PartVariantManager
 */

import { PartVariantDefinition } from './PartVariantDefinition.js';

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Prüft, ob ein Wert ein nicht-leerer String ist.
 *
 * @param {*} val - Zu prüfender Wert.
 * @returns {boolean}
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Versucht, eine rohe JSON-Eingabe in ein Array von Rohdatenobjekten zu
 * konvertieren. Akzeptiert:
 *  - Einen JSON-String
 *  - Ein Objekt der Form `{ variants: [...] }`
 *  - Ein direktes Array
 *
 * @param {string|Object|Array} input - Roheingabe.
 * @returns {{ items: Object[], parseError: Error|null }}
 */
function parseVariantInput(input) {
  let parsed = input;

  // JSON-String auflösen
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      return { items: [], parseError: new SyntaxError(`Ungültiger JSON-String: ${err.message}`) };
    }
  }

  if (Array.isArray(parsed)) {
    return { items: parsed, parseError: null };
  }

  if (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.variants)) {
    return { items: parsed.variants, parseError: null };
  }

  return {
    items: [],
    parseError: new TypeError(
      'importFromJSON: Eingabe muss ein Array oder ein Objekt mit "variants"-Array sein.'
    ),
  };
}

// ---------------------------------------------------------------------------
// Klasse
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ManagerOptions
 * @property {boolean} [autoRegisterDefaults=false]
 *   Wenn `true`, wird für jedes bislang unbekannte Basis-Bauteil automatisch
 *   eine generische Standardvariante registriert, sobald eine erste Variante
 *   für es eingetragen wird.
 */

/**
 * @typedef {Object} ImportOptions
 * @property {boolean} [overwrite=false]
 *   Wenn `true`, werden bestehende Varianten bei gleichem basePartId+variantId
 *   überschrieben statt übersprungen.
 * @property {boolean} [stopOnError=false]
 *   Wenn `true`, wird beim ersten Fehler abgebrochen.
 */

/**
 * @typedef {Object} ImportResult
 * @property {number}  imported - Anzahl erfolgreich importierter Varianten.
 * @property {number}  skipped  - Anzahl übersprungener Varianten (Duplikate).
 * @property {Error[]} errors   - Aufgetretene Fehler.
 */

export class PartVariantManager {
  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  /**
   * Erstellt eine neue Instanz des Variantenmanagers.
   *
   * @param {ManagerOptions} [options={}] - Konfigurationsoptionen.
   *
   * @example
   * const manager = new PartVariantManager({ autoRegisterDefaults: false });
   */
  constructor(options = {}) {
    const { autoRegisterDefaults = false } = options;

    /**
     * Interne Hauptdatenstruktur:
     * Map< basePartId : string, Map< variantId : string, PartVariantDefinition > >
     *
     * @type {Map<string, Map<string, PartVariantDefinition>>}
     * @private
     */
    this._registry = new Map();

    /**
     * Gibt an, ob beim ersten Eintrag eines neuen Basis-Bauteils automatisch
     * eine generische Standardvariante registriert werden soll.
     *
     * @type {boolean}
     * @private
     */
    this._autoRegisterDefaults = Boolean(autoRegisterDefaults);
  }

  // -------------------------------------------------------------------------
  // Interne Hilfsmethoden
  // -------------------------------------------------------------------------

  /**
   * Gibt die innere Map für eine basePartId zurück.
   * Erstellt sie bei Bedarf neu.
   *
   * @param {string} basePartId
   * @returns {Map<string, PartVariantDefinition>}
   * @private
   */
  _getOrCreateInnerMap(basePartId) {
    if (!this._registry.has(basePartId)) {
      this._registry.set(basePartId, new Map());
    }
    return this._registry.get(basePartId);
  }

  /**
   * Registriert optional eine generische Standardvariante, wenn die Funktion
   * `autoRegisterDefaults` aktiv ist und das Bauteil noch keine Einträge hat.
   *
   * @param {string} basePartId
   * @private
   */
  _maybeAutoRegisterDefault(basePartId) {
    if (!this._autoRegisterDefaults) return;
    if (this._registry.has(basePartId)) return;

    const defaultVariant = new PartVariantDefinition({
      basePartId,
      variantId:   'standard',
      name:        'Standard',
      description: 'Automatisch registrierte Standardvariante.',
      isDefault:   true,
    });

    this._getOrCreateInnerMap(basePartId).set('standard', defaultVariant);
  }

  // -------------------------------------------------------------------------
  // Öffentliche Methoden – Registrierung
  // -------------------------------------------------------------------------

  /**
   * Registriert eine Variantendefinition.
   *
   * @param {PartVariantDefinition} variantDef - Die zu registrierende Variante.
   * @param {{ overwrite?: boolean }} [options={}]
   *   - `overwrite`: Wenn `true`, wird ein bestehendes Duplikat überschrieben.
   * @returns {void}
   * @throws {TypeError}  Wenn `variantDef` keine `PartVariantDefinition`-Instanz ist.
   * @throws {RangeError} Wenn basePartId+variantId bereits registriert und
   *                      `overwrite` nicht gesetzt ist.
   *
   * @example
   * manager.registerVariant(new PartVariantDefinition({
   *   basePartId: 'brick_2x4',
   *   variantId:  'with-logo',
   *   name:       'Mit Logo-Noppen',
   *   isDefault:  true,
   * }));
   */
  registerVariant(variantDef, options = {}) {
    if (!(variantDef instanceof PartVariantDefinition)) {
      throw new TypeError(
        'PartVariantManager.registerVariant: Argument muss eine PartVariantDefinition-Instanz sein.'
      );
    }

    const { overwrite = false } = options;
    const { basePartId, variantId } = variantDef;

    // Automatische Standardvariante ggf. einmalig registrieren
    this._maybeAutoRegisterDefault(basePartId);

    const innerMap = this._getOrCreateInnerMap(basePartId);

    if (innerMap.has(variantId) && !overwrite) {
      throw new RangeError(
        `PartVariantManager.registerVariant: Variante "${variantId}" für Bauteil ` +
        `"${basePartId}" ist bereits registriert. Verwende { overwrite: true } zum Überschreiben.`
      );
    }

    innerMap.set(variantId, variantDef);
  }

  // -------------------------------------------------------------------------
  // Öffentliche Methoden – Abfragen
  // -------------------------------------------------------------------------

  /**
   * Gibt alle Varianten eines Basis-Bauteils zurück.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @returns {PartVariantDefinition[]} Alle registrierten Varianten (ggf. leer).
   *
   * @example
   * const variants = manager.getVariants('brick_2x4');
   */
  getVariants(basePartId) {
    if (!isNonEmptyString(basePartId)) return [];
    const innerMap = this._registry.get(basePartId);
    if (!innerMap) return [];
    return Array.from(innerMap.values());
  }

  /**
   * Gibt eine einzelne Variante zurück oder `null`, wenn sie nicht existiert.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @param {string} variantId  - Bezeichner der Variante.
   * @returns {PartVariantDefinition|null}
   *
   * @example
   * const v = manager.getVariant('brick_2x4', 'with-logo');
   */
  getVariant(basePartId, variantId) {
    if (!isNonEmptyString(basePartId) || !isNonEmptyString(variantId)) return null;
    const innerMap = this._registry.get(basePartId);
    if (!innerMap) return null;
    return innerMap.get(variantId) ?? null;
  }

  /**
   * Gibt die Standardvariante eines Bauteils zurück.
   *
   * Priorität:
   *  1. Erste Variante mit `isDefault === true`
   *  2. Erste registrierte Variante (nach Einfügereihenfolge)
   *  3. `null` wenn keine Variante vorhanden
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @returns {PartVariantDefinition|null}
   *
   * @example
   * const def = manager.getDefaultVariant('brick_2x4');
   */
  getDefaultVariant(basePartId) {
    const variants = this.getVariants(basePartId);
    if (variants.length === 0) return null;

    const explicit = variants.find(v => v.isDefault);
    return explicit ?? variants[0];
  }

  /**
   * Gibt an, ob für ein Basis-Bauteil Varianten registriert sind.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @returns {boolean}
   */
  hasVariants(basePartId) {
    if (!isNonEmptyString(basePartId)) return false;
    const innerMap = this._registry.get(basePartId);
    return innerMap !== undefined && innerMap.size > 0;
  }

  /**
   * Gibt alle Basis-Bauteil-IDs zurück, für die Varianten registriert sind.
   *
   * @returns {string[]}
   */
  getAllBasePartIds() {
    return Array.from(this._registry.keys());
  }

  /**
   * Gibt die Gesamtanzahl aller registrierten Varianten zurück
   * (über alle Bauteile hinweg).
   *
   * @returns {number}
   */
  getVariantCount() {
    let total = 0;
    for (const innerMap of this._registry.values()) {
      total += innerMap.size;
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Öffentliche Methoden – Entfernen
  // -------------------------------------------------------------------------

  /**
   * Entfernt eine einzelne Variante.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @param {string} variantId  - Bezeichner der zu entfernenden Variante.
   * @returns {boolean} `true` wenn die Variante gefunden und entfernt wurde.
   *
   * @example
   * const removed = manager.removeVariant('brick_2x4', 'with-logo');
   */
  removeVariant(basePartId, variantId) {
    if (!isNonEmptyString(basePartId) || !isNonEmptyString(variantId)) return false;
    const innerMap = this._registry.get(basePartId);
    if (!innerMap) return false;

    const deleted = innerMap.delete(variantId);

    // Leere innere Map aufräumen
    if (innerMap.size === 0) {
      this._registry.delete(basePartId);
    }

    return deleted;
  }

  /**
   * Entfernt alle Varianten eines Basis-Bauteils.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @returns {void}
   *
   * @example
   * manager.clearVariants('brick_2x4');
   */
  clearVariants(basePartId) {
    if (!isNonEmptyString(basePartId)) return;
    this._registry.delete(basePartId);
  }

  // -------------------------------------------------------------------------
  // Öffentliche Methoden – Import / Export
  // -------------------------------------------------------------------------

  /**
   * Importiert Varianten aus einem JSON-String oder einem kompatiblen Objekt.
   *
   * Akzeptierte Formate:
   *  - JSON-String, der ein Array `[...]` oder `{ variants: [...] }` darstellt
   *  - Ein JS-Array mit Rohdatenobjekten
   *  - Ein JS-Objekt `{ variants: [...] }`
   *
   * @param {string|Object|Array} json - Eingabe.
   * @param {ImportOptions} [options={}] - Importoptionen.
   * @returns {ImportResult} Zusammenfassung des Imports.
   *
   * @example
   * const result = manager.importFromJSON('[{"basePartId":"brick_2x4","variantId":"logo",...}]');
   * console.log(result.imported, result.skipped, result.errors);
   */
  importFromJSON(json, options = {}) {
    const { overwrite = false, stopOnError = false } = options;

    /** @type {ImportResult} */
    const result = { imported: 0, skipped: 0, errors: [] };

    const { items, parseError } = parseVariantInput(json);

    if (parseError) {
      result.errors.push(parseError);
      return result;
    }

    for (const rawItem of items) {
      let variantDef;
      try {
        variantDef = PartVariantDefinition.fromData(rawItem);
      } catch (err) {
        result.errors.push(err);
        if (stopOnError) return result;
        continue;
      }

      const { basePartId, variantId } = variantDef;
      const alreadyExists = this.getVariant(basePartId, variantId) !== null;

      if (alreadyExists && !overwrite) {
        result.skipped++;
        continue;
      }

      try {
        this.registerVariant(variantDef, { overwrite });
        result.imported++;
      } catch (err) {
        result.errors.push(err);
        if (stopOnError) return result;
      }
    }

    return result;
  }

  /**
   * Exportiert alle registrierten Varianten als serialisierbares Objekt.
   *
   * @returns {{ variants: Object[] }} Flach-serialisierte Variantenliste.
   *
   * @example
   * const data = manager.toData();
   * const json = JSON.stringify(data, null, 2);
   */
  toData() {
    const variants = [];
    for (const innerMap of this._registry.values()) {
      for (const variantDef of innerMap.values()) {
        variants.push(variantDef.toData());
      }
    }
    return { variants };
  }

  // -------------------------------------------------------------------------
  // Singleton-Verwaltung
  // -------------------------------------------------------------------------

  /**
   * Gibt die gemeinsame Singleton-Instanz zurück.
   * Erstellt sie beim ersten Aufruf mit Standardoptionen.
   *
   * @param {ManagerOptions} [options={}]
   *   Wird nur beim allerersten Aufruf ausgewertet.
   * @returns {PartVariantManager}
   *
   * @example
   * const manager = PartVariantManager.instance();
   */
  static instance(options = {}) {
    if (!PartVariantManager._singletonInstance) {
      PartVariantManager._singletonInstance = new PartVariantManager(options);
    }
    return PartVariantManager._singletonInstance;
  }

  /**
   * Setzt die Singleton-Instanz zurück (primär für Tests).
   *
   * @returns {void}
   *
   * @example
   * afterEach(() => PartVariantManager.resetInstance());
   */
  static resetInstance() {
    PartVariantManager._singletonInstance = null;
  }

  // -------------------------------------------------------------------------
  // Debughilfen
  // -------------------------------------------------------------------------

  /**
   * Gibt eine lesbare Darstellung des Managers zurück.
   *
   * @returns {string}
   */
  toString() {
    const partCount    = this._registry.size;
    const variantCount = this.getVariantCount();
    return `PartVariantManager(${partCount} Bauteile, ${variantCount} Varianten gesamt)`;
  }
}

/** @type {PartVariantManager|null} */
PartVariantManager._singletonInstance = null;
