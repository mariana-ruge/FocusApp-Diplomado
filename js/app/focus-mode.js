/**
 * focus-mode.js — Modo enfoque minimalista ("cinema mode")
 * Oculta menús, footer, elementos no esenciales y deja solo el temporizador.
 * Atajo de teclado: F para entrar/salir.
 * Depende de: StorageService.
 */
var FocusMode = (() => {
  'use strict';

  var _isActive = false;

  /** Alternar modo enfoque */
  function toggle() {
    if (_isActive) {
      deactivate();
    } else {
      activate();
    }
  }

  /** Activar modo enfoque */
  function activate() {
    if (_isActive) return;
    _isActive = true;

    document.body.classList.add('ff-focus-mode');

    // Animación de entrada con Animate.css
    var timerArea = document.querySelector('.ff-timer-area');
    if (timerArea) {
      timerArea.classList.add('animated', 'fadeIn');
      setTimeout(function () {
        timerArea.classList.remove('animated', 'fadeIn');
      }, 1000);
    }

    StorageService.set('focus_mode', true);

    // Anunciar a lectores de pantalla
    _announce('Modo enfoque activado. Pulsa F para salir.');
  }

  /** Desactivar modo enfoque */
  function deactivate() {
    if (!_isActive) return;
    _isActive = false;

    document.body.classList.remove('ff-focus-mode');

    StorageService.set('focus_mode', false);
    _announce('Modo enfoque desactivado.');
  }

  /** Verificar si está activo */
  function isActive() {
    return _isActive;
  }

  /**
   * Anunciar mensaje para lectores de pantalla
   */
  function _announce(message) {
    var announcer = document.getElementById('ff-timer-announcer');
    if (announcer) announcer.textContent = message;
  }

  /**
   * Registrar atajo de teclado F
   * No se activa si el usuario está escribiendo en un campo de texto.
   */
  function _initKeyboardShortcut() {
    document.addEventListener('keydown', function (e) {
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target.isContentEditable) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggle();
      }
    });
  }

  /** Inicializar: registrar atajo y restaurar estado previo */
  function init() {
    _initKeyboardShortcut();

    // Restaurar estado si estaba en modo enfoque al recargar
    if (StorageService.get('focus_mode') === true) {
      activate();
    }
  }

  return {
    init:       init,
    toggle:     toggle,
    activate:   activate,
    deactivate: deactivate,
    isActive:   isActive
  };
})();
