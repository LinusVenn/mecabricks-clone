/**
 * PartVariantResolver – Löst Variantenanfragen auf (Phase E.5)
 *
 * Verbindet PartVariantManager und PartCatalog:
 * Gegeben ein Bauteil-ID + variantId → gibt vollständige Bauteildefinition zurück.
 *
 * Beispiele:
 *   resolve('brick_2x4', 'logo')
 *     → gibt NormalizedPart für brick_2x4 mit Logo-Override zurück
 *   resolve('brick_2x4', null)
 *     → gibt Standard-Variante zurück (oder Default-Part wenn keine Variante)
 *
 * @module catalog/variants/PartVariantResolver
 */

import { PartVariantManager } from './PartVariantManager.js'; // eslint-disable-line no-unused-vars

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
 * Prüft, ob ein Objekt eine minimale PartCatalog-ähnliche Schnittstelle besitzt
 * (duck-typing: muss mindestens `getPart(id)` bereitstellen).
 *
 * @param {*} catalog - Zu prüfendes Objekt.
 * @returns {boolean}
 */
function isCatalogLike(catalog) {
  return (
    catalog !== null &&
    typeof catalog === 'object' &&
    typeof catalog.getPart === 'function'
  );
}

/**
 * Prüft, ob ein Objekt eine minimale PartVariantManager-ähnliche Schnittstelle
 * besitzt (duck-typing).
 *
 * @param {*} manager - Zu prüfendes Objekt.
 * @returns {boolean}
 */
function isVariantManagerLike(manager) {
  return (
    manager !== null &&
    typeof manager === 'object' &&
    typeof manager.getVariants       === 'function' &&
    typeof manager.getVariant        === 'function' &&
    typeof manager.getDefaultVariant === 'function'
  );
}

// ---------------------------------------------------------------------------
// Klasse
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ResolverDependencies
 * @property {Object} catalog        - PartCatalog-Instanz (muss `getPart(id)` bereitstellen).
 * @property {Object} variantManager - PartVariantManager-Instanz.
 */

export class PartVariantResolver {
  // -------------------------------------------------------------------------
  // Konstruktor
  // -------------------------------------------------------------------------

  /**
   * Erstellt einen neuen PartVariantResolver.
   *
   * @param {ResolverDependencies} dependencies - Abhängigkeiten (Katalog + Variantenmanager).
   * @throws {TypeError} Wenn `catalog` oder `variantManager` nicht die erwartete
   *                     Schnittstelle besitzen.
   *
   * @example
   * const resolver = new PartVariantResolver({
   *   catalog:        PartCatalog.instance(),
   *   variantManager: PartVariantManager.instance(),
   * });
   */
  constructor({ catalog, variantManager } = {}) {
    if (!isCatalogLike(catalog)) {
      throw new TypeError(
        'PartVariantResolver: "catalog" muss ein Objekt mit einer "getPart(id)"-Methode sein.'
      );
    }
    if (!isVariantManagerLike(variantManager)) {
      throw new TypeError(
        'PartVariantResolver: "variantManager" muss eine PartVariantManager-Instanz ' +
        'oder ein kompatibles Objekt sein.'
      );
    }

    /**
     * Katalogreferenz.
     *
     * @type {Object}
     * @private
     */
    this._catalog = catalog;

    /**
     * Variantenmanager-Referenz.
     *
     * @type {PartVariantManager}
     * @private
     */
    this._variantManager = variantManager;
  }

  // -------------------------------------------------------------------------
  // Interne Hilfsmethoden
  // -------------------------------------------------------------------------

  /**
   * Gibt das Basis-Bauteil aus dem Katalog zurück.
   * Gibt `null` zurück, wenn es nicht gefunden werden kann.
   *
   * @param {string} basePartId
   * @returns {Object|null}
   * @private
   */
  _fetchBasePart(basePartId) {
    try {
      return this._catalog.getPart(basePartId) ?? null;
    } catch {
      // Katalog-Fehler defensiv abfangen
      return null;
    }
  }

  /**
   * Erstellt eine WarningsProducing-Ausgabe auf der Konsole.
   * Zentralisiert, damit es in Tests leicht überschrieben werden kann.
   *
   * @param {string} message - Warnungsnachricht.
   * @private
   */
  _warn(message) {
    // eslint-disable-next-line no-console
    console.warn(`[PartVariantResolver] ${message}`);
  }

  // -------------------------------------------------------------------------
  // Öffentliche Methoden
  // -------------------------------------------------------------------------

  /**
   * Löst eine einzelne Variantenanfrage auf und gibt die vollständige,
   * zusammengeführte Bauteildefinition zurück.
   *
   * Logik:
   *  1. Basis-Bauteil aus Katalog laden (→ `null` wenn unbekannt)
   *  2. Wenn `variantId` angegeben:
   *     a. Variante suchen → Überschreibungen anwenden
   *     b. Nicht gefunden → Warnung + Fallback auf Basis-Bauteil
   *  3. Wenn `variantId === null`:
   *     a. Standard-Variante des Managers ermitteln und anwenden
   *     b. Keine Varianten vorhanden → Basis-Bauteil zurückgeben
   *
   * @param {string}      basePartId        - ID des Basis-Bauteils im Katalog.
   * @param {string|null} [variantId=null]  - ID der gewünschten Variante.
   * @returns {Object|null}
   *   Zusammengeführte Bauteildefinition oder `null` wenn das Bauteil unbekannt ist.
   *
   * @example
   * const part = resolver.resolve('brick_2x4', 'with-logo');
   * // → { id: 'brick_2x4', name: 'Stein 2×4 mit Logo-Noppen', isVariant: true, ... }
   *
   * const defaultPart = resolver.resolve('brick_2x4');
   * // → Standard-Variante oder Basis-Bauteil
   */
  resolve(basePartId, variantId = null) {
    if (!isNonEmptyString(basePartId)) {
      this._warn(`resolve() aufgerufen mit ungültiger basePartId: ${String(basePartId)}`);
      return null;
    }

    const basePart = this._fetchBasePart(basePartId);

    if (basePart === null) {
      this._warn(`Bauteil "${basePartId}" nicht im Katalog gefunden.`);
      return null;
    }

    // --- Fall 1: Explizite variantId angegeben ---
    if (isNonEmptyString(variantId)) {
      const variantDef = this._variantManager.getVariant(basePartId, variantId);

      if (variantDef === null) {
        this._warn(
          `Variante "${variantId}" für Bauteil "${basePartId}" nicht gefunden. ` +
          `Fallback auf Basis-Bauteil.`
        );
        return basePart;
      }

      return variantDef.applyToPartDefinition(basePart);
    }

    // --- Fall 2: Keine variantId → Standard-Variante ---
    const defaultVariant = this._variantManager.getDefaultVariant(basePartId);

    if (defaultVariant === null) {
      // Keine Varianten bekannt → unverändertes Basis-Bauteil zurückgeben
      return basePart;
    }

    return defaultVariant.applyToPartDefinition(basePart);
  }

  /**
   * Löst alle registrierten Varianten eines Bauteils auf.
   *
   * Gibt für jede registrierte Variante das vollständig zusammengeführte
   * Bauteildefinitions-Objekt zurück. Ist das Basis-Bauteil unbekannt,
   * wird ein leeres Array zurückgegeben.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @returns {Object[]} Array aufgelöster Bauteildefinitionen (eine pro Variante).
   *
   * @example
   * const allVariants = resolver.resolveAll('brick_2x4');
   * allVariants.forEach(v => console.log(v.variantId, v.name));
   */
  resolveAll(basePartId) {
    if (!isNonEmptyString(basePartId)) return [];

    const basePart = this._fetchBasePart(basePartId);
    if (basePart === null) {
      this._warn(`resolveAll(): Bauteil "${basePartId}" nicht im Katalog gefunden.`);
      return [];
    }

    const variants = this._variantManager.getVariants(basePartId);
    if (variants.length === 0) return [];

    return variants.map(variantDef => variantDef.applyToPartDefinition(basePart));
  }

  /**
   * Gibt an, ob ein Bauteil prinzipiell aufgelöst werden kann —
   * d. h. ob es im Katalog existiert.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @returns {boolean}
   *
   * @example
   * if (resolver.canResolve('brick_2x4')) {
   *   const part = resolver.resolve('brick_2x4', 'with-logo');
   * }
   */
  canResolve(basePartId) {
    if (!isNonEmptyString(basePartId)) return false;
    return this._fetchBasePart(basePartId) !== null;
  }

  /**
   * Gibt alle registrierten Variant-IDs für ein gegebenes Basis-Bauteil zurück.
   * Liefert ein leeres Array, wenn das Bauteil keine Varianten hat oder
   * im Katalog nicht bekannt ist.
   *
   * @param {string} basePartId - ID des Basis-Bauteils.
   * @returns {string[]} Array der Variant-IDs in Einfügereihenfolge.
   *
   * @example
   * resolver.getResolvableVariantIds('brick_2x4');
   * // → ['standard', 'with-logo', 'smooth']
   */
  getResolvableVariantIds(basePartId) {
    if (!isNonEmptyString(basePartId)) return [];
    return this._variantManager
      .getVariants(basePartId)
      .map(v => v.variantId);
  }

  // -------------------------------------------------------------------------
  // Debughilfen
  // -------------------------------------------------------------------------

  /**
   * Gibt eine lesbare Darstellung des Resolvers zurück.
   *
   * @returns {string}
   */
  toString() {
    const resolvable = this._variantManager.getAllBasePartIds().length;
    return `PartVariantResolver(${resolvable} Bauteile mit Varianten)`;
  }
}


