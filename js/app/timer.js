/**
 * timer.js — Temporizador de enfoque tipo Pomodoro
 * Barra de progreso circular (SVG), alertas de color, persistencia en localStorage.
 * Depende de: StorageService, InactivityDetector (soft, solo en _logSession).
 */
var FocusTimer = (() => {
  'use strict';

  // Presets: minutos de enfoque / minutos de descanso
  var PRESETS = {
    '15/5':  { focus: 15, break: 5 },
    '25/5':  { focus: 25, break: 5 },
    '50/10': { focus: 50, break: 10 },
    '90/20': { focus: 90, break: 20 }
  };

  // Estados posibles del temporizador
  var STATES = {
    IDLE:    'idle',
    RUNNING: 'running',
    PAUSED:  'paused'
  };

  // --- Estado interno ---
  var _state = STATES.IDLE;
  var _sessionType = 'focus';       // 'focus' | 'break'
  var _focusDuration = 25 * 60;     // segundos
  var _breakDuration = 5 * 60;
  var _totalSeconds = 25 * 60;      // total de la sesión actual
  var _remainingSeconds = 25 * 60;
  var _intervalId = null;
  var _currentPreset = '25/5';
  var _sessionsCompleted = 0;
  var _currentSessionId = null;
  var _soundEnabled = true;
  var _pauseCount = 0;

  // Callbacks
  var _onTick = null;
  var _onStateChange = null;
  var _onComplete = null;

  // =====================================================================
  // Sonido de finalización con Web Audio API (tono suave, no estridente)
  // =====================================================================
  function _playCompletionSound() {
    if (!_soundEnabled) return;
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();

      // Nota 1: C5 (523 Hz)
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 523.25;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.2);

      // Nota 2: E5 (659 Hz) con ligero delay
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 659.25;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.4);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 1.4);

      // Cerrar contexto de audio después
      setTimeout(function () { ctx.close(); }, 2000);
    } catch (e) {
      // Web Audio no disponible; continuar sin sonido
    }
  }

  // =====================================================================
  // Color de progreso según tiempo restante
  // =====================================================================
  function _getProgressColor() {
    if (_sessionType === 'break') {
      return '#4fc3f7'; // Azul claro para descanso
    }
    if (_remainingSeconds <= 60) {
      return '#ef5350'; // Rojo — últimos 60 s
    }
    var percent = _remainingSeconds / _totalSeconds;
    if (percent <= 0.25) {
      return '#ffb74d'; // Ámbar — último 25%
    }
    return '#66bb6a'; // Verde — normal
  }

  /**
   * ¿Debe pulsar? Solo en los últimos 60 s de una sesión de enfoque activa
   */
  function _shouldPulse() {
    return _state === STATES.RUNNING &&
           _sessionType === 'focus' &&
           _remainingSeconds <= 60 &&
           _remainingSeconds > 0;
  }

  // =====================================================================
  // Tick principal (se ejecuta cada segundo)
  // =====================================================================
  function _tick() {
    if (_remainingSeconds <= 0) {
      _complete();
      return;
    }
    _remainingSeconds--;
    _saveState();
    if (_onTick) _onTick(_buildTickData());
  }

  /**
   * Construir objeto de datos para el callback de tick
   */
  function _buildTickData() {
    return {
      remaining:  _remainingSeconds,
      total:      _totalSeconds,
      progress:   1 - (_remainingSeconds / _totalSeconds),
      color:      _getProgressColor(),
      pulse:      _shouldPulse(),
      state:      _state,
      sessionType: _sessionType,
      formatted:  formatTime(_remainingSeconds),
      isBreak:    _sessionType === 'break'
    };
  }

  // =====================================================================
  // Completar sesión o descanso
  // =====================================================================
  function _complete() {
    clearInterval(_intervalId);
    _intervalId = null;

    var completedType = _sessionType;

    if (_sessionType === 'focus') {
      // Sesión de enfoque completada
      _sessionsCompleted++;
      _logSession(true);
      _playCompletionSound();

      // Preparar para descanso
      _sessionType = 'break';
      _totalSeconds = _breakDuration;
      _remainingSeconds = _breakDuration;
    } else {
      // Descanso completado
      _playCompletionSound();

      // Preparar para nueva sesión de enfoque
      _sessionType = 'focus';
      _totalSeconds = _focusDuration;
      _remainingSeconds = _focusDuration;
    }

    _state = STATES.IDLE;
    _saveState();

    if (_onComplete) {
      _onComplete({
        type: completedType,
        sessionsCompleted: _sessionsCompleted
      });
    }
    if (_onStateChange) _onStateChange(_state);
  }

  // =====================================================================
  // Registro de sesiones en almacenamiento
  // =====================================================================
  function _logSession(completed) {
    var activeUser = StorageService.get('active_user') || 'default';
    var sessions = StorageService.getForUser(activeUser, 'sessions') || [];

    // Contar inactividades si el módulo está disponible
    var inactivityCount = 0;
    if (typeof InactivityDetector !== 'undefined') {
      inactivityCount = InactivityDetector.getInactivityCount();
    }

    sessions.push({
      id: _currentSessionId,
      date: new Date().toISOString(),
      duration: _totalSeconds,
      effectiveTime: _totalSeconds - _remainingSeconds,
      type: 'focus',
      completed: completed,
      preset: _currentPreset,
      pauseCount: _pauseCount,
      inactivityEvents: inactivityCount
    });

    StorageService.setForUser(activeUser, 'sessions', sessions);
  }

  // =====================================================================
  // Persistencia de estado en localStorage
  // =====================================================================
  function _saveState() {
    StorageService.set('timer_state', {
      state: _state,
      sessionType: _sessionType,
      remainingSeconds: _remainingSeconds,
      totalSeconds: _totalSeconds,
      focusDuration: _focusDuration,
      breakDuration: _breakDuration,
      currentPreset: _currentPreset,
      sessionsCompleted: _sessionsCompleted,
      currentSessionId: _currentSessionId,
      pauseCount: _pauseCount,
      savedAt: Date.now()
    });
  }

  /**
   * Restaurar estado desde localStorage (para recargas de página).
   * Devuelve true si se restauró exitosamente.
   */
  function restoreState() {
    var saved = StorageService.get('timer_state');
    if (!saved) return false;

    // Descartar estados de más de 30 minutos (sesión probablemente abandonada)
    if (Date.now() - saved.savedAt > 30 * 60 * 1000) {
      StorageService.remove('timer_state');
      return false;
    }

    _state = saved.state || STATES.IDLE;
    _sessionType = saved.sessionType || 'focus';
    _remainingSeconds = saved.remainingSeconds;
    _totalSeconds = saved.totalSeconds;
    _focusDuration = saved.focusDuration;
    _breakDuration = saved.breakDuration;
    _currentPreset = saved.currentPreset;
    _sessionsCompleted = saved.sessionsCompleted || 0;
    _currentSessionId = saved.currentSessionId;
    _pauseCount = saved.pauseCount || 0;

    // Si estaba corriendo, ajustar por el tiempo transcurrido fuera de la página
    if (_state === STATES.RUNNING) {
      var elapsed = Math.floor((Date.now() - saved.savedAt) / 1000);
      _remainingSeconds = Math.max(0, _remainingSeconds - elapsed);

      if (_remainingSeconds <= 0) {
        _complete();
        return true;
      }

      // Reanudar intervalo
      _intervalId = setInterval(_tick, 1000);
    }

    // Emitir estado actual a la UI
    if (_onStateChange) _onStateChange(_state);
    if (_onTick) _onTick(_buildTickData());

    return true;
  }

  // =====================================================================
  // Utilidad de formato
  // =====================================================================
  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // =====================================================================
  // API pública
  // =====================================================================

  /** Seleccionar un preset predefinido (solo cuando está idle) */
  function setPreset(presetKey) {
    if (_state !== STATES.IDLE) return;
    if (!PRESETS[presetKey]) return;

    _currentPreset = presetKey;
    var preset = PRESETS[presetKey];
    _focusDuration = preset.focus * 60;
    _breakDuration = preset.break * 60;
    _sessionType = 'focus';
    _totalSeconds = _focusDuration;
    _remainingSeconds = _focusDuration;
    _saveState();
  }

  /** Configurar tiempo personalizado (solo cuando está idle) */
  function setCustomTime(focusMin, breakMin) {
    if (_state !== STATES.IDLE) return;

    _currentPreset = 'custom';
    _focusDuration = Math.max(1, Math.min(180, focusMin)) * 60;
    _breakDuration = Math.max(1, Math.min(60, breakMin)) * 60;
    _sessionType = 'focus';
    _totalSeconds = _focusDuration;
    _remainingSeconds = _focusDuration;
    _saveState();
  }

  /** Iniciar o reanudar el temporizador */
  function start() {
    if (_state === STATES.RUNNING) return;

    // Nueva sesión desde idle
    if (_state === STATES.IDLE && _sessionType === 'focus') {
      _currentSessionId = 'session_' + Date.now();
      _pauseCount = 0;
    }

    _state = STATES.RUNNING;
    _intervalId = setInterval(_tick, 1000);
    _saveState();
    if (_onStateChange) _onStateChange(_state);
  }

  /** Pausar el temporizador */
  function pause() {
    if (_state !== STATES.RUNNING) return;

    _state = STATES.PAUSED;
    if (_sessionType === 'focus') _pauseCount++;
    clearInterval(_intervalId);
    _intervalId = null;
    _saveState();
    if (_onStateChange) _onStateChange(_state);
  }

  /** Reanudar (alias legible; internamente llama a start) */
  function resume() {
    if (_state !== STATES.PAUSED) return;
    start();
  }

  /** Reiniciar completamente al estado de enfoque inicial */
  function reset() {
    clearInterval(_intervalId);
    _intervalId = null;

    // Si había una sesión en progreso, registrarla como incompleta
    if ((_state === STATES.RUNNING || _state === STATES.PAUSED) && _sessionType === 'focus') {
      _logSession(false);
    }

    _state = STATES.IDLE;
    _sessionType = 'focus';
    _totalSeconds = _focusDuration;
    _remainingSeconds = _focusDuration;
    _pauseCount = 0;
    _currentSessionId = null;

    _saveState();
    if (_onStateChange) _onStateChange(_state);
    if (_onTick) _onTick(_buildTickData());
  }

  /** Saltar directamente al descanso (cuenta como sesión completada) */
  function skipToBreak() {
    if (_sessionType !== 'focus') return;
    if (_state !== STATES.RUNNING && _state !== STATES.PAUSED) return;

    clearInterval(_intervalId);
    _intervalId = null;

    _sessionsCompleted++;
    _logSession(true);

    _state = STATES.IDLE;
    _sessionType = 'break';
    _totalSeconds = _breakDuration;
    _remainingSeconds = _breakDuration;

    _saveState();
    if (_onStateChange) _onStateChange(_state);
    if (_onTick) _onTick(_buildTickData());
  }

  /** Activar/desactivar sonido de finalización */
  function setSoundEnabled(enabled) {
    _soundEnabled = !!enabled;
  }

  /** Registrar callbacks: 'tick', 'stateChange', 'complete' */
  function on(event, callback) {
    switch (event) {
      case 'tick':        _onTick = callback; break;
      case 'stateChange': _onStateChange = callback; break;
      case 'complete':    _onComplete = callback; break;
    }
  }

  /** Obtener snapshot del estado actual */
  function getState() {
    return {
      state:             _state,
      sessionType:       _sessionType,
      remaining:         _remainingSeconds,
      total:             _totalSeconds,
      progress:          1 - (_remainingSeconds / _totalSeconds),
      color:             _getProgressColor(),
      pulse:             _shouldPulse(),
      formatted:         formatTime(_remainingSeconds),
      preset:            _currentPreset,
      sessionsCompleted: _sessionsCompleted,
      isBreak:           _sessionType === 'break'
    };
  }

  return {
    PRESETS:         PRESETS,
    STATES:          STATES,
    setPreset:       setPreset,
    setCustomTime:   setCustomTime,
    start:           start,
    pause:           pause,
    resume:          resume,
    reset:           reset,
    skipToBreak:     skipToBreak,
    restoreState:    restoreState,
    setSoundEnabled: setSoundEnabled,
    on:              on,
    getState:        getState,
    formatTime:      formatTime
  };
})();
