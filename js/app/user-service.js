/**
 * user-service.js — Capa de abstracción para gestión de usuarios
 * Almacena perfiles en localStorage bajo focusflow:users.
 * Cada perfil tiene estadísticas aisladas.
 *
 * NOTA DE ARQUITECTURA:
 * Esta capa envuelve StorageService con una interfaz orientada a usuarios.
 * Para migrar a un backend real (Firebase, Supabase, API propia), reemplazar
 * las implementaciones internas de cada método manteniendo la misma firma.
 * Ningún otro módulo accede a datos de usuario directamente; todos pasan por aquí.
 */
var UserService = (() => {
  'use strict';

  var USERS_KEY = 'users';
  var ACTIVE_KEY = 'active_user';

  // Iconos Font Awesome disponibles como avatar
  var AVATAR_OPTIONS = [
    'fa-user',
    'fa-laptop',
    'fa-rocket',
    'fa-bullseye',
    'fa-graduation-cap',
    'fa-lightbulb-o',
    'fa-star',
    'fa-bolt',
    'fa-leaf',
    'fa-paint-brush',
    'fa-coffee',
    'fa-book'
  ];

  // Preferencias por defecto para un nuevo usuario
  var DEFAULT_PREFERENCES = {
    defaultPreset: '25/5',
    soundEnabled: true,
    inactivityThreshold: 3,  // minutos
    theme: 'light'           // 'light' | 'dark'
  };

  // =====================================================================
  // CRUD de usuarios
  // =====================================================================

  /**
   * Obtener todos los usuarios registrados
   * @returns {Array<Object>}
   */
  function getAll() {
    return StorageService.get(USERS_KEY) || [];
  }

  /**
   * Obtener un usuario por su ID
   * @param {string} userId
   * @returns {Object|null}
   */
  function getById(userId) {
    var users = getAll();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) return users[i];
    }
    return null;
  }

  /**
   * Crear un nuevo usuario
   * @param {Object} data — { name, avatar }
   * @returns {Object} usuario creado
   */
  function create(data) {
    var users = getAll();

    // Validar nombre
    var name = (data.name || '').trim();
    if (!name) name = 'Usuario ' + (users.length + 1);
    // Limitar longitud del nombre
    if (name.length > 30) name = name.substring(0, 30);

    var user = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: name,
      avatar: data.avatar || AVATAR_OPTIONS[0],
      createdAt: new Date().toISOString()
    };

    users.push(user);
    StorageService.set(USERS_KEY, users);

    // Inicializar preferencias por defecto
    StorageService.setForUser(user.id, 'preferences', Object.assign({}, DEFAULT_PREFERENCES));

    // Inicializar sesiones vacías
    StorageService.setForUser(user.id, 'sessions', []);

    return user;
  }

  /**
   * Actualizar datos de un usuario existente
   * @param {string} userId
   * @param {Object} updates — campos a actualizar (name, avatar)
   * @returns {Object|null} usuario actualizado o null si no existe
   */
  function update(userId, updates) {
    var users = getAll();
    var found = false;

    for (var i = 0; i < users.length; i++) {
      if (users[i].id === userId) {
        if (updates.name !== undefined) {
          var name = (updates.name || '').trim();
          if (name && name.length <= 30) users[i].name = name;
        }
        if (updates.avatar !== undefined) {
          users[i].avatar = updates.avatar;
        }
        found = true;
        break;
      }
    }

    if (!found) return null;

    StorageService.set(USERS_KEY, users);
    return getById(userId);
  }

  /**
   * Eliminar un usuario y todos sus datos
   * No permite eliminar el último usuario.
   * @param {string} userId
   * @returns {boolean} éxito
   */
  function remove(userId) {
    var users = getAll();
    if (users.length <= 1) return false; // Siempre dejar al menos uno

    var filtered = users.filter(function (u) { return u.id !== userId; });
    if (filtered.length === users.length) return false; // No existía

    StorageService.set(USERS_KEY, filtered);

    // Limpiar datos asociados
    StorageService.removeForUser(userId, 'sessions');
    StorageService.removeForUser(userId, 'preferences');

    // Si era el usuario activo, cambiar al primero disponible
    if (getActiveUserId() === userId) {
      setActive(filtered[0].id);
    }

    return true;
  }

  // =====================================================================
  // Usuario activo
  // =====================================================================

  /**
   * Obtener ID del usuario activo
   * @returns {string}
   */
  function getActiveUserId() {
    return StorageService.get(ACTIVE_KEY) || 'default';
  }

  /**
   * Obtener objeto completo del usuario activo
   * @returns {Object}
   */
  function getActive() {
    return getById(getActiveUserId()) || getAll()[0] || { id: 'default', name: 'Usuario', avatar: 'fa-user' };
  }

  /**
   * Cambiar usuario activo
   * @param {string} userId
   * @returns {boolean}
   */
  function setActive(userId) {
    if (!getById(userId)) return false;
    StorageService.set(ACTIVE_KEY, userId);
    return true;
  }

  // =====================================================================
  // Preferencias del usuario activo
  // =====================================================================

  /**
   * Obtener preferencias del usuario activo
   * @returns {Object}
   */
  function getPreferences() {
    var prefs = StorageService.getForUser(getActiveUserId(), 'preferences');
    return Object.assign({}, DEFAULT_PREFERENCES, prefs || {});
  }

  /**
   * Actualizar preferencias del usuario activo (merge parcial)
   * @param {Object} updates
   * @returns {Object} preferencias actualizadas
   */
  function updatePreferences(updates) {
    var current = getPreferences();
    var merged = Object.assign({}, current, updates);

    // Validaciones de límites
    if (typeof merged.inactivityThreshold === 'number') {
      merged.inactivityThreshold = Math.max(1, Math.min(30, merged.inactivityThreshold));
    }
    if (['light', 'dark'].indexOf(merged.theme) === -1) {
      merged.theme = 'light';
    }

    StorageService.setForUser(getActiveUserId(), 'preferences', merged);
    return merged;
  }

  // =====================================================================
  // Estadísticas del usuario activo (lectura rápida)
  // =====================================================================

  /**
   * Obtener sesiones del usuario activo
   * @returns {Array}
   */
  function getSessions() {
    return StorageService.getForUser(getActiveUserId(), 'sessions') || [];
  }

  /**
   * Obtener resumen rápido de estadísticas del usuario activo
   */
  function getQuickStats() {
    var sessions = getSessions();
    var completed = sessions.filter(function (s) { return s.completed; });
    var today = new Date().toISOString().slice(0, 10);
    var todayCompleted = completed.filter(function (s) {
      return s.date && s.date.indexOf(today) === 0;
    });

    return {
      totalSessions: sessions.length,
      totalCompleted: completed.length,
      todayCompleted: todayCompleted.length
    };
  }

  // =====================================================================
  // Utilidades
  // =====================================================================

  /**
   * Obtener opciones de avatar disponibles
   */
  function getAvatarOptions() {
    return AVATAR_OPTIONS.slice();
  }

  /**
   * Obtener preferencias por defecto (para resetear)
   */
  function getDefaultPreferences() {
    return Object.assign({}, DEFAULT_PREFERENCES);
  }

  return {
    getAll:               getAll,
    getById:              getById,
    create:               create,
    update:               update,
    remove:               remove,
    getActiveUserId:      getActiveUserId,
    getActive:            getActive,
    setActive:            setActive,
    getPreferences:       getPreferences,
    updatePreferences:    updatePreferences,
    getSessions:          getSessions,
    getQuickStats:        getQuickStats,
    getAvatarOptions:     getAvatarOptions,
    getDefaultPreferences: getDefaultPreferences,
    AVATAR_OPTIONS:       AVATAR_OPTIONS
  };
})();
