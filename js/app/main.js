/**
 * main.js — Bootstrap principal de FocusFlow Work
 * Inicializa módulos comunes: usuario por defecto, modo enfoque,
 * permisos de notificación en primer uso.
 * Depende de: StorageService, FocusMode, NotificationService.
 */
var FocusFlowApp = (() => {
  'use strict';

  function init() {
    // Garantizar que exista al menos un usuario por defecto
    _ensureDefaultUser();

    // Inicializar modo enfoque (atajo de teclado, restaurar estado)
    FocusMode.init();

    // Cargar preferencias del usuario activo
    _applyUserPreferences();

    // Solicitar permisos de notificación en el primer uso (con delay amigable)
    var notifAsked = StorageService.get('notification_asked');
    if (!notifAsked) {
      setTimeout(function () {
        NotificationService.showPermissionModal().then(function () {
          StorageService.set('notification_asked', true);
        });
      }, 2500);
    }
  }

  /**
   * Crear usuario por defecto si no existe ninguno
   */
  function _ensureDefaultUser() {
    var users = StorageService.get('users') || [];
    var activeUser = StorageService.get('active_user');

    if (users.length === 0) {
      var defaultUser = {
        id: 'default',
        name: 'Usuario',
        avatar: 'fa-user',
        createdAt: new Date().toISOString()
      };
      users.push(defaultUser);
      StorageService.set('users', users);
    }

    if (!activeUser) {
      StorageService.set('active_user', users[0].id);
    }
  }

  /**
   * Aplicar preferencias del usuario activo al temporizador y otros módulos
   */
  function _applyUserPreferences() {
    var activeUser = StorageService.get('active_user') || 'default';
    var prefs = StorageService.getForUser(activeUser, 'preferences') || {};

    // Sonido
    if (typeof FocusTimer !== 'undefined') {
      FocusTimer.setSoundEnabled(prefs.soundEnabled !== false);
    }
  }

  return {
    init: init
  };
})();

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
  FocusFlowApp.init();
});
