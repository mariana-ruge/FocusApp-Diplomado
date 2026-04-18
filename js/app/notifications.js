/**
 * notifications.js — Notification API con modal amigable y fallback visual
 * Usa Page Visibility API para decidir si enviar notificación nativa o in-page.
 */
var NotificationService = (() => {
  'use strict';

  var _permissionGranted = false;

  function _init() {
    if ('Notification' in window) {
      _permissionGranted = Notification.permission === 'granted';
    }
  }

  /**
   * Mostrar modal amigable explicando por qué se necesitan notificaciones.
   * Solo se muestra una vez; devuelve una Promise<boolean> con el resultado.
   */
  function showPermissionModal() {
    return new Promise(function (resolve) {
      // Si ya tiene permisos o el navegador no soporta notificaciones
      if (_permissionGranted) { resolve(true); return; }
      if (!('Notification' in window)) { resolve(false); return; }
      if (Notification.permission === 'denied') { resolve(false); return; }

      // Construir modal
      var overlay = document.createElement('div');
      overlay.className = 'ff-modal-overlay animated fadeIn';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Solicitud de permisos de notificación');
      overlay.innerHTML =
        '<div class="ff-modal animated zoomIn">' +
          '<div class="ff-modal-icon">\uD83D\uDD14</div>' +
          '<h3 class="ff-modal-title">\u00BFActivar notificaciones?</h3>' +
          '<p class="ff-modal-text">' +
            'FocusFlow puede avisarte cuando termine una sesi\u00F3n de enfoque o si ' +
            'detecta inactividad. Las notificaciones te ayudan a mantener tu ritmo de ' +
            'trabajo, especialmente si cambias de pesta\u00F1a.' +
          '</p>' +
          '<div class="ff-modal-actions">' +
            '<button class="ff-btn ff-btn-primary ff-modal-accept">S\u00ED, activar</button>' +
            '<button class="ff-btn ff-btn-secondary ff-modal-decline">Ahora no</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      // Foco al primer botón para accesibilidad
      var acceptBtn = overlay.querySelector('.ff-modal-accept');
      var declineBtn = overlay.querySelector('.ff-modal-decline');
      setTimeout(function () { acceptBtn.focus(); }, 100);

      acceptBtn.addEventListener('click', function () {
        Notification.requestPermission().then(function (permission) {
          _permissionGranted = permission === 'granted';
          _removeModal(overlay);
          resolve(_permissionGranted);
        });
      });

      declineBtn.addEventListener('click', function () {
        _removeModal(overlay);
        resolve(false);
      });

      // Cerrar con Escape
      function onEscape(e) {
        if (e.key === 'Escape') {
          _removeModal(overlay);
          document.removeEventListener('keydown', onEscape);
          resolve(false);
        }
      }
      document.addEventListener('keydown', onEscape);
    });
  }

  /**
   * Retirar modal con animación de salida
   */
  function _removeModal(overlay) {
    var modal = overlay.querySelector('.ff-modal');
    if (modal) {
      modal.classList.remove('zoomIn');
      modal.classList.add('zoomOut');
    }
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }

  /**
   * Enviar notificación. Usa nativa si la pestaña no tiene foco y hay permisos;
   * de lo contrario muestra fallback visual dentro de la página.
   * @param {string} title
   * @param {string} body
   * @param {Object} [options] — icon, tag, requireInteraction, onClick
   */
  function send(title, body, options) {
    options = options || {};

    // Intentar notificación nativa cuando la pestaña no está visible
    if (_permissionGranted && document.hidden) {
      try {
        var notification = new Notification(title, {
          body: body,
          icon: options.icon || 'images/fevicon.png',
          tag: options.tag || 'focusflow-' + Date.now(),
          requireInteraction: !!options.requireInteraction
        });

        if (options.onClick) {
          notification.onclick = function () {
            window.focus();
            notification.close();
            options.onClick();
          };
        }

        // Auto-cerrar tras 8 segundos
        setTimeout(function () { notification.close(); }, 8000);
        return;
      } catch (e) {
        console.warn('[NotificationService] Error con notificación nativa:', e);
      }
    }

    // Fallback: notificación visual dentro de la página
    _showInPageNotification(title, body);
  }

  /**
   * Notificación visual tipo toast (fallback o uso directo)
   */
  function _showInPageNotification(title, body) {
    // Eliminar notificación previa si existe
    var existing = document.querySelector('.ff-in-page-notification');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var el = document.createElement('div');
    el.className = 'ff-in-page-notification animated slideInRight';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="ff-notification-content">' +
        '<strong>' + _escapeHtml(title) + '</strong>' +
        '<p>' + _escapeHtml(body) + '</p>' +
      '</div>' +
      '<button class="ff-notification-close" aria-label="Cerrar notificaci\u00F3n">&times;</button>';

    document.body.appendChild(el);

    el.querySelector('.ff-notification-close').addEventListener('click', function () {
      _dismissNotification(el);
    });

    // Auto-cerrar tras 8 segundos
    setTimeout(function () {
      if (el.parentNode) _dismissNotification(el);
    }, 8000);
  }

  function _dismissNotification(el) {
    el.classList.remove('slideInRight');
    el.classList.add('slideOutRight');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }

  /**
   * Escapar HTML para prevenir inyección de contenido
   */
  function _escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Verificar si los permisos están concedidos
   */
  function isPermissionGranted() {
    return _permissionGranted;
  }

  _init();

  return {
    showPermissionModal: showPermissionModal,
    send: send,
    isPermissionGranted: isPermissionGranted,
    showInPage: _showInPageNotification
  };
})();
