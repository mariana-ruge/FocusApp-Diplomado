/**
 * inactivity.js — Detección de inactividad durante sesiones de enfoque
 * Monitorea mousemove, keydown, scroll, touchstart, click y visibilitychange.
 * Registra cada evento de inactividad con timestamp para el panel de seguimiento.
 */
var InactivityDetector = (() => {
  'use strict';

  // Umbral por defecto: 3 minutos (en milisegundos)
  var _threshold = 3 * 60 * 1000;
  var _timer = null;
  var _isActive = true;
  var _isMonitoring = false;
  var _onInactivity = null;
  var _onActivity = null;
  var _events = [];

  var TRACKED_EVENTS = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

  /**
   * Reiniciar el temporizador de inactividad al detectar actividad del usuario
   */
  function _resetTimer() {
    if (!_isMonitoring) return;

    // Si estaba inactivo, notificar que volvió
    if (!_isActive) {
      _isActive = true;
      if (_onActivity) _onActivity();
    }

    clearTimeout(_timer);
    _timer = setTimeout(function () {
      _isActive = false;
      var event = {
        type: 'inactivity',
        timestamp: new Date().toISOString(),
        thresholdMs: _threshold
      };
      _events.push(event);
      if (_onInactivity) _onInactivity(event);
    }, _threshold);
  }

  /**
   * Manejar cambios de visibilidad de la pestaña (Page Visibility API)
   */
  function _handleVisibilityChange() {
    if (!_isMonitoring) return;

    if (document.hidden) {
      // Pestaña oculta: registrar evento y usar umbral reducido
      _events.push({
        type: 'tab_hidden',
        timestamp: new Date().toISOString()
      });

      clearTimeout(_timer);
      _timer = setTimeout(function () {
        _isActive = false;
        var event = {
          type: 'inactivity_hidden',
          timestamp: new Date().toISOString(),
          thresholdMs: _threshold
        };
        _events.push(event);
        if (_onInactivity) _onInactivity(event);
      }, Math.min(_threshold, 60000)); // Máximo 1 minuto para pestañas ocultas
    } else {
      // Pestaña visible de nuevo: reiniciar detección
      _events.push({
        type: 'tab_visible',
        timestamp: new Date().toISOString()
      });
      _resetTimer();
    }
  }

  /**
   * Iniciar monitoreo de inactividad
   * @param {Object} options
   * @param {number} [options.threshold] — umbral en ms (defecto: 180000)
   * @param {Function} [options.onInactivity] — callback al detectar inactividad
   * @param {Function} [options.onActivity] — callback al volver a detectar actividad
   */
  function start(options) {
    if (_isMonitoring) stop(); // Reiniciar si ya estaba activo

    options = options || {};
    _threshold = options.threshold || _threshold;
    _onInactivity = options.onInactivity || null;
    _onActivity = options.onActivity || null;
    _isMonitoring = true;
    _isActive = true;

    TRACKED_EVENTS.forEach(function (eventName) {
      document.addEventListener(eventName, _resetTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', _handleVisibilityChange);
    _resetTimer();
  }

  /**
   * Detener monitoreo
   */
  function stop() {
    _isMonitoring = false;
    _isActive = true;
    clearTimeout(_timer);
    _timer = null;

    TRACKED_EVENTS.forEach(function (eventName) {
      document.removeEventListener(eventName, _resetTimer);
    });
    document.removeEventListener('visibilitychange', _handleVisibilityChange);
  }

  /**
   * Actualizar umbral de inactividad en caliente
   * @param {number} ms — nuevo umbral en milisegundos
   */
  function setThreshold(ms) {
    _threshold = ms;
    if (_isMonitoring) _resetTimer();
  }

  /**
   * Obtener lista de eventos registrados
   * @param {boolean} [clear=false] — limpiar eventos después de leer
   * @returns {Array}
   */
  function getEvents(clear) {
    var copy = _events.slice();
    if (clear) _events = [];
    return copy;
  }

  /**
   * Contar eventos de inactividad (excluyendo tab_hidden/tab_visible)
   */
  function getInactivityCount() {
    return _events.filter(function (e) {
      return e.type === 'inactivity' || e.type === 'inactivity_hidden';
    }).length;
  }

  /**
   * Verificar si el monitoreo está activo
   */
  function isMonitoring() {
    return _isMonitoring;
  }

  return {
    start: start,
    stop: stop,
    setThreshold: setThreshold,
    getEvents: getEvents,
    getInactivityCount: getInactivityCount,
    isMonitoring: isMonitoring
  };
})();
