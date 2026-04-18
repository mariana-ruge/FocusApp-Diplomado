/**
 * storage.js — Wrapper versionado sobre localStorage
 * Prefijo focusflow: para aislar datos de la app.
 * Estructura versionada para migraciones futuras.
 */
const StorageService = (() => {
  'use strict';

  const PREFIX = 'focusflow:';
  const SCHEMA_KEY = PREFIX + 'schema_version';
  const CURRENT_VERSION = 1;

  /**
   * Inicializar esquema y ejecutar migraciones si corresponde
   */
  function _init() {
    const version = localStorage.getItem(SCHEMA_KEY);
    if (!version) {
      localStorage.setItem(SCHEMA_KEY, String(CURRENT_VERSION));
    } else if (parseInt(version, 10) < CURRENT_VERSION) {
      _migrate(parseInt(version, 10), CURRENT_VERSION);
    }
  }

  /**
   * Ruta de migración incremental entre versiones de esquema.
   * Agregar bloques if encadenados conforme evolucione la estructura.
   */
  function _migrate(fromVersion, toVersion) {
    // Ejemplo para futuras migraciones:
    // if (fromVersion < 2) { /* transformar datos de v1 a v2 */ }
    // if (fromVersion < 3) { /* transformar datos de v2 a v3 */ }
    console.log('[StorageService] Migración de esquema v' + fromVersion + ' → v' + toVersion);
    localStorage.setItem(SCHEMA_KEY, String(toVersion));
  }

  // --- Opcional: migración futura a IndexedDB ---
  // Si los datos superan ~5 MB (límite práctico de localStorage),
  // reemplazar este módulo por uno basado en IndexedDB manteniendo
  // la misma interfaz pública (get, set, getForUser, setForUser)
  // para que el resto de módulos no necesiten cambios.

  /**
   * Obtener valor parseado del almacenamiento
   * @param {string} key — clave sin prefijo
   * @returns {*} valor parseado o null
   */
  function get(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw !== null ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[StorageService] Error al leer "' + key + '":', e);
      return null;
    }
  }

  /**
   * Guardar valor serializado
   * @param {string} key — clave sin prefijo
   * @param {*} value — cualquier valor serializable a JSON
   * @returns {boolean} éxito
   */
  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[StorageService] Error al guardar "' + key + '":', e);
      return false;
    }
  }

  /**
   * Eliminar clave
   */
  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  /**
   * Construir clave específica de usuario
   */
  function getUserKey(userId, key) {
    return 'user:' + userId + ':' + key;
  }

  /**
   * Obtener dato asociado a un usuario
   */
  function getForUser(userId, key) {
    return get(getUserKey(userId, key));
  }

  /**
   * Guardar dato asociado a un usuario
   */
  function setForUser(userId, key, value) {
    return set(getUserKey(userId, key), value);
  }

  /**
   * Eliminar dato de usuario
   */
  function removeForUser(userId, key) {
    remove(getUserKey(userId, key));
  }

  /**
   * Obtener todas las claves y valores bajo un prefijo
   * @param {string} prefix — prefijo adicional (sin el PREFIX global)
   * @returns {Object} mapa clave→valor
   */
  function getAllWithPrefix(prefix) {
    var results = {};
    var fullPrefix = PREFIX + prefix;
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(fullPrefix) === 0) {
        try {
          results[key.replace(PREFIX, '')] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          // Valor no parseable, ignorar
        }
      }
    }
    return results;
  }

  /**
   * Exportar todos los datos de FocusFlow como objeto JSON
   */
  function exportAll() {
    return getAllWithPrefix('');
  }

  // Ejecutar inicialización al cargar
  _init();

  return {
    get: get,
    set: set,
    remove: remove,
    getForUser: getForUser,
    setForUser: setForUser,
    removeForUser: removeForUser,
    getUserKey: getUserKey,
    getAllWithPrefix: getAllWithPrefix,
    exportAll: exportAll,
    CURRENT_VERSION: CURRENT_VERSION
  };
})();
