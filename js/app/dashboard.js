/**
 * dashboard.js — Panel de seguimiento de rendimiento
 * Métricas diarias, semanales y mensuales. Gráficos con Chart.js.
 * Exportación a CSV y JSON.
 * Depende de: StorageService.
 */
var Dashboard = (() => {
  'use strict';

  // Rangos de filtro
  var RANGES = {
    '7d':  7,
    '30d': 30,
    '90d': 90,
    'all': Infinity
  };

  var _charts = {};
  var _currentRange = '30d';

  // =====================================================================
  // Obtener sesiones del usuario activo
  // =====================================================================
  function _getSessions() {
    var activeUser = StorageService.get('active_user') || 'default';
    return StorageService.getForUser(activeUser, 'sessions') || [];
  }

  /**
   * Filtrar sesiones por rango de días
   */
  function _filterByRange(sessions, rangeDays) {
    if (rangeDays === Infinity) return sessions;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    cutoff.setHours(0, 0, 0, 0);
    var cutoffISO = cutoff.toISOString();
    return sessions.filter(function (s) {
      return s.date >= cutoffISO;
    });
  }

  // =====================================================================
  // Cálculo de métricas
  // =====================================================================
  function _computeMetrics(sessions) {
    var completed = sessions.filter(function (s) { return s.completed; });
    var started = sessions.length;
    var completedCount = completed.length;

    // Tiempo total en enfoque (segundos)
    var totalFocusTime = completed.reduce(function (sum, s) {
      return sum + (s.effectiveTime || s.duration || 0);
    }, 0);

    // Interrupciones: suma de pausas + inactividades
    var totalInterruptions = sessions.reduce(function (sum, s) {
      return sum + (s.pauseCount || 0) + (s.inactivityEvents || 0);
    }, 0);

    // Promedio de duración efectiva por sesión completada
    var avgEffective = completedCount > 0
      ? Math.round(totalFocusTime / completedCount)
      : 0;

    // Racha de días consecutivos con al menos 1 sesión completada
    var streak = _computeStreak(completed);

    // Datos por día para gráficos
    var daily = _groupByDay(sessions);

    return {
      started:           started,
      completed:         completedCount,
      completionRate:    started > 0 ? Math.round((completedCount / started) * 100) : 0,
      totalFocusTime:    totalFocusTime,
      totalInterruptions: totalInterruptions,
      avgEffective:      avgEffective,
      streak:            streak,
      daily:             daily
    };
  }

  /**
   * Calcular racha de días consecutivos con al menos 1 sesión completada
   * Cuenta hacia atrás desde hoy.
   */
  function _computeStreak(completedSessions) {
    if (completedSessions.length === 0) return 0;

    // Conjunto de días únicos con sesiones completadas
    var daysSet = {};
    completedSessions.forEach(function (s) {
      var day = s.date ? s.date.slice(0, 10) : '';
      if (day) daysSet[day] = true;
    });

    var streak = 0;
    var d = new Date();
    d.setHours(0, 0, 0, 0);

    // Si hoy no hay sesión, empezar desde ayer
    var todayStr = d.toISOString().slice(0, 10);
    if (!daysSet[todayStr]) {
      d.setDate(d.getDate() - 1);
    }

    for (var i = 0; i < 365; i++) {
      var dayStr = d.toISOString().slice(0, 10);
      if (daysSet[dayStr]) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Agrupar sesiones por día
   * Devuelve { labels: [], completed: [], started: [], focusMin: [], interruptions: [] }
   */
  function _groupByDay(sessions) {
    var map = {};

    sessions.forEach(function (s) {
      var day = s.date ? s.date.slice(0, 10) : 'desconocido';
      if (!map[day]) {
        map[day] = { completed: 0, started: 0, focusMin: 0, interruptions: 0 };
      }
      map[day].started++;
      if (s.completed) {
        map[day].completed++;
        map[day].focusMin += Math.round((s.effectiveTime || s.duration || 0) / 60);
      }
      map[day].interruptions += (s.pauseCount || 0) + (s.inactivityEvents || 0);
    });

    // Ordenar por fecha
    var sortedDays = Object.keys(map).sort();

    return {
      labels:       sortedDays.map(function (d) { return _formatDayLabel(d); }),
      rawDates:     sortedDays,
      completed:    sortedDays.map(function (d) { return map[d].completed; }),
      started:      sortedDays.map(function (d) { return map[d].started; }),
      focusMin:     sortedDays.map(function (d) { return map[d].focusMin; }),
      interruptions: sortedDays.map(function (d) { return map[d].interruptions; })
    };
  }

  /**
   * Formatear etiqueta de día: "15 abr"
   */
  function _formatDayLabel(isoDay) {
    var parts = isoDay.split('-');
    var months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    var day = parseInt(parts[2], 10);
    var month = months[parseInt(parts[1], 10) - 1] || parts[1];
    return day + ' ' + month;
  }

  // =====================================================================
  // Formato de tiempo legible
  // =====================================================================
  function formatDuration(seconds) {
    if (seconds < 60) return seconds + 's';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'min';
    return m + ' min';
  }

  // =====================================================================
  // Renderizar métricas en tarjetas
  // =====================================================================
  function _renderMetricCards(metrics) {
    _setTextContent('ff-metric-completed', metrics.completed + ' / ' + metrics.started);
    _setTextContent('ff-metric-rate', metrics.completionRate + '%');
    _setTextContent('ff-metric-focus-time', formatDuration(metrics.totalFocusTime));
    _setTextContent('ff-metric-interruptions', metrics.totalInterruptions);
    _setTextContent('ff-metric-streak', metrics.streak + (metrics.streak === 1 ? ' día' : ' días'));
    _setTextContent('ff-metric-avg', formatDuration(metrics.avgEffective));
  }

  function _setTextContent(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // =====================================================================
  // Gráficos con Chart.js
  // =====================================================================
  function _renderCharts(metrics) {
    var daily = metrics.daily;

    // Colores consistentes con el sistema visual
    var colors = {
      primary:     'rgba(8, 145, 248, 1)',
      primaryFade: 'rgba(8, 145, 248, 0.15)',
      green:       'rgba(102, 187, 106, 1)',
      greenFade:   'rgba(102, 187, 106, 0.15)',
      amber:       'rgba(255, 183, 77, 1)',
      amberFade:   'rgba(255, 183, 77, 0.15)',
      red:         'rgba(239, 83, 80, 1)',
      redFade:     'rgba(239, 83, 80, 0.15)'
    };

    // --- Gráfico 1: Sesiones completadas vs iniciadas ---
    _destroyChart('sessions');
    var ctx1 = document.getElementById('ff-chart-sessions');
    if (ctx1) {
      _charts['sessions'] = new Chart(ctx1.getContext('2d'), {
        type: 'bar',
        data: {
          labels: daily.labels,
          datasets: [
            {
              label: 'Completadas',
              data: daily.completed,
              backgroundColor: colors.greenFade,
              borderColor: colors.green,
              borderWidth: 2,
              borderRadius: 4
            },
            {
              label: 'Iniciadas',
              data: daily.started,
              backgroundColor: colors.primaryFade,
              borderColor: colors.primary,
              borderWidth: 2,
              borderRadius: 4
            }
          ]
        },
        options: _chartOptions('Sesiones por día')
      });
    }

    // --- Gráfico 2: Tiempo de enfoque (minutos) ---
    _destroyChart('focus');
    var ctx2 = document.getElementById('ff-chart-focus');
    if (ctx2) {
      _charts['focus'] = new Chart(ctx2.getContext('2d'), {
        type: 'line',
        data: {
          labels: daily.labels,
          datasets: [{
            label: 'Minutos de enfoque',
            data: daily.focusMin,
            borderColor: colors.primary,
            backgroundColor: colors.primaryFade,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: colors.primary,
            pointRadius: 4
          }]
        },
        options: _chartOptions('Tiempo de enfoque por día (min)')
      });
    }

    // --- Gráfico 3: Interrupciones ---
    _destroyChart('interruptions');
    var ctx3 = document.getElementById('ff-chart-interruptions');
    if (ctx3) {
      _charts['interruptions'] = new Chart(ctx3.getContext('2d'), {
        type: 'bar',
        data: {
          labels: daily.labels,
          datasets: [{
            label: 'Interrupciones',
            data: daily.interruptions,
            backgroundColor: colors.amberFade,
            borderColor: colors.amber,
            borderWidth: 2,
            borderRadius: 4
          }]
        },
        options: _chartOptions('Interrupciones por día')
      });
    }
  }

  /**
   * Opciones comunes de gráfico
   */
  function _chartOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: "'Lato', sans-serif", size: 13 },
            padding: 16,
            usePointStyle: true
          }
        },
        title: {
          display: true,
          text: title,
          font: { family: "'Baloo Chettan', cursive", size: 16 },
          padding: { bottom: 16 }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 12 },
            stepSize: 1,
            precision: 0
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false }
        }
      }
    };
  }

  /**
   * Destruir gráfico si existe para evitar fugas de memoria
   */
  function _destroyChart(key) {
    if (_charts[key]) {
      _charts[key].destroy();
      _charts[key] = null;
    }
  }

  // =====================================================================
  // Estado vacío
  // =====================================================================
  function _renderEmptyState() {
    var container = document.getElementById('ff-dashboard-content');
    if (!container) return;

    container.innerHTML =
      '<div style="text-align:center; padding: 80px 20px;">' +
        '<div style="font-size:64px; margin-bottom:20px;">\uD83C\uDFAF</div>' +
        '<h3 style="font-family:var(--ff-font-heading); font-size:24px; color:var(--ff-text);">Aún no hay datos</h3>' +
        '<p style="color:var(--ff-text-light); font-size:16px; margin-top:10px;">Completa tu primera sesión de enfoque para ver tus estadísticas aquí.</p>' +
        '<a href="focus.html" class="ff-btn ff-btn-primary" style="margin-top:24px;">Ir al temporizador</a>' +
      '</div>';
  }

  // =====================================================================
  // Exportación de datos
  // =====================================================================

  /**
   * Exportar sesiones a JSON y descargar
   */
  function exportJSON() {
    var sessions = _getSessions();
    var blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    _downloadBlob(blob, 'focusflow-sesiones.json');
  }

  /**
   * Exportar sesiones a CSV y descargar
   */
  function exportCSV() {
    var sessions = _getSessions();
    if (sessions.length === 0) return;

    var headers = ['Fecha','Duración (s)','Tiempo efectivo (s)','Completada','Preset','Pausas','Inactividades'];
    var rows = sessions.map(function (s) {
      return [
        s.date || '',
        s.duration || 0,
        s.effectiveTime || 0,
        s.completed ? 'Sí' : 'No',
        s.preset || '',
        s.pauseCount || 0,
        s.inactivityEvents || 0
      ].join(',');
    });

    var csv = headers.join(',') + '\n' + rows.join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); // BOM para Excel
    _downloadBlob(blob, 'focusflow-sesiones.csv');
  }

  /**
   * Descargar blob como archivo
   */
  function _downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // =====================================================================
  // Renderizar todo el dashboard
  // =====================================================================
  function render(range) {
    _currentRange = range || _currentRange;
    var allSessions = _getSessions();

    if (allSessions.length === 0) {
      _renderEmptyState();
      return;
    }

    var days = RANGES[_currentRange] || 30;
    var filtered = _filterByRange(allSessions, days);
    var metrics = _computeMetrics(filtered);

    _renderMetricCards(metrics);
    _renderCharts(metrics);
  }

  /**
   * Obtener rango actual
   */
  function getCurrentRange() {
    return _currentRange;
  }

  return {
    render:          render,
    exportJSON:      exportJSON,
    exportCSV:       exportCSV,
    formatDuration:  formatDuration,
    getCurrentRange: getCurrentRange
  };
})();
