import { useEffect, useState, useRef, useMemo } from 'react';
import { getMisHorarios } from '../../services/profesionales.service';
import type { MisHorariosData } from '../../services/profesionales.service';
import { authError } from '../../utils/auth-errors';
import { useAutoDismiss } from '../../utils/useAutoDismiss';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import '../../styles/mis-horarios.css';

export default function MisHorariosPage() {
  const getTodayString = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date());

  const [fecha, setFecha] = useState<string>(getTodayString);
  const [data, setData] = useState<MisHorariosData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [revision, setRevision] = useState<number>(0);

  // Filtros interactivos por salita y especialidad
  const [filtroSalita, setFiltroSalita] = useState<string>('');
  const [filtroEspecialidad, setFiltroEspecialidad] = useState<string>('');

  const { ultimoEvento, ultimoEventoProfesional, resyncTick } = useAgendaSocket();
  const lastEventIdRef = useRef<string | null>(ultimoEvento?.id ?? null);
  const requestIdRef = useRef(0);

  useAutoDismiss(error, setError);

  // Actualización en tiempo real ante eventos de agenda, turnos o cambios de profesional
  useEffect(() => {
    if (ultimoEvento && ultimoEvento.id !== lastEventIdRef.current) {
      lastEventIdRef.current = ultimoEvento.id;
      setRevision((r) => r + 1);
    }
  }, [ultimoEvento]);

  useEffect(() => {
    if (ultimoEventoProfesional) {
      setRevision((r) => r + 1);
    }
  }, [ultimoEventoProfesional]);

  useEffect(() => {
    if (resyncTick > 0) {
      setRevision((r) => r + 1);
    }
  }, [resyncTick]);

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    if (!data) {
      setLoading(true);
    }
    setError('');

    void getMisHorarios(fecha)
      .then((res) => {
        if (currentRequestId === requestIdRef.current && res.success) {
          setData(res.data);
        }
      })
      .catch((err) => {
        if (currentRequestId === requestIdRef.current) {
          setError(authError(err));
        }
      })
      .finally(() => {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      });
  }, [fecha, revision]);

  const handlePrevDay = () => {
    const d = new Date(`${fecha}T12:00:00-03:00`);
    d.setDate(d.getDate() - 1);
    setFecha(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(`${fecha}T12:00:00-03:00`);
    d.setDate(d.getDate() + 1);
    setFecha(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setFecha(getTodayString());
  };

  const formatHumanDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
      return new Intl.DateTimeFormat('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Franjas de la fecha consultada filtradas por salita y especialidad seleccionadas
  const franjasFiltradas = useMemo(() => {
    if (!data?.disponibilidad_fecha?.franjas) return [];
    return data.disponibilidad_fecha.franjas.filter((f) => {
      const matchSalita = !filtroSalita || f.salita === filtroSalita;
      const matchEsp = !filtroEspecialidad || f.especialidad === filtroEspecialidad;
      return matchSalita && matchEsp;
    });
  }, [data?.disponibilidad_fecha?.franjas, filtroSalita, filtroEspecialidad]);

  // Salitas y especialidades únicas presentes en la fecha actual
  const salitasDeHoy = useMemo(() => {
    if (!data?.disponibilidad_fecha?.franjas) return [];
    return Array.from(new Set(data.disponibilidad_fecha.franjas.map((f) => f.salita)));
  }, [data?.disponibilidad_fecha?.franjas]);

  const especialidadesDeHoy = useMemo(() => {
    if (!data?.disponibilidad_fecha?.franjas) return [];
    return Array.from(new Set(data.disponibilidad_fecha.franjas.map((f) => f.especialidad)));
  }, [data?.disponibilidad_fecha?.franjas]);

  return (
    <div className="horarios-page-wrapper pb-5">
      {/* 1. Header principal */}
      <section className="horarios-header-section">
        <div className="horarios-header-title">
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
              Módulo Profesional
            </span>
            {data?.profesional.matricula && (
              <span className="badge bg-light text-secondary border px-2 py-1 font-monospace">
                Matrícula: {data.profesional.matricula}
              </span>
            )}
          </div>
          <h1>Mis horarios y disponibilidad</h1>
          <p className="horarios-header-subtitle">
            Cronograma laboral, franjas horarias y disponibilidad en tiempo real por salita y especialidad.
          </p>
        </div>
      </section>

      {/* Aviso informativo de reglas del servicio */}
      <div className="notice-banner">
        <i className="bi bi-info-circle-fill text-success fs-5" aria-hidden="true" />
        <span>
          Para solicitar modificaciones en tus días u horarios habituales, sumar salitas o registrar licencias, comunicate con la administración de tu salita.
        </span>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2" role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill fs-5" aria-hidden="true" />
            <div>{error}</div>
          </div>
          <button
            type="button"
            className="btn-close flex-shrink-0"
            aria-label="Cerrar aviso"
            onClick={() => setError('')}
          />
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-5 bg-white rounded-3 border">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando horarios...</span>
          </div>
          <p className="text-muted mt-2 mb-0">Cargando cronograma y disponibilidad laboral...</p>
        </div>
      )}

      {data && (
        <>
          {/* ================================================================
              2. SECCIÓN: INFORMACIÓN GENERAL (KPI CARDS)
              ================================================================ */}
          <section>
            <h2 className="kpi-section-title">
              <i className="bi bi-grid-fill text-success" aria-hidden="true" />
              Información general del servicio
            </h2>

            <div className="kpi-grid">
              {/* Horario de atención */}
              <div className="kpi-card">
                <div className="kpi-icon-wrapper kpi-icon-green">
                  <i className="bi bi-clock-history" aria-hidden="true" />
                </div>
                <div className="kpi-content">
                  <div className="d-flex align-items-center justify-content-between gap-1">
                    <span className="kpi-label">Horario de atención</span>
                    {data.informacion_general.es_horario_uniforme === false && (
                      <span className="badge bg-light text-secondary border px-1 py-0" style={{ fontSize: '0.68rem' }}>
                        Diferenciado
                      </span>
                    )}
                  </div>
                  <div className="kpi-value-highlight">
                    {data.informacion_general.horario_atencion}
                  </div>
                  <span className="kpi-subtext">
                    <i className="bi bi-stopwatch me-1" aria-hidden="true" />
                    {data.informacion_general.es_duracion_uniforme === false && data.informacion_general.duracion_descripcion
                      ? `Turnos de ${data.informacion_general.duracion_descripcion} (según especialidad)`
                      : `Turnos de ${data.informacion_general.duracion_turno_minutos} minutos`}
                  </span>
                </div>
              </div>

              {/* Días laborales */}
              <div className="kpi-card">
                <div className="kpi-icon-wrapper kpi-icon-blue">
                  <i className="bi bi-calendar-check" aria-hidden="true" />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Días laborales</span>
                  <div className="kpi-tags-wrapper">
                    {data.informacion_general.dias_laborales.length > 0 ? (
                      data.informacion_general.dias_laborales.map((dia) => (
                        <span key={dia} className="kpi-tag-chip accent-green">
                          <i className="bi bi-check2" aria-hidden="true" />
                          {dia}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted small">Sin días asignados</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Salitas de atención */}
              <div className="kpi-card">
                <div className="kpi-icon-wrapper kpi-icon-amber">
                  <i className="bi bi-hospital" aria-hidden="true" />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Salitas de atención</span>
                  <div className="kpi-tags-wrapper">
                    {data.informacion_general.salitas.length > 0 ? (
                      data.informacion_general.salitas.map((salita) => (
                        <span key={salita} className="kpi-tag-chip">
                          <i className="bi bi-geo-alt-fill text-danger me-1" aria-hidden="true" />
                          {salita}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted small">Sin salitas asignadas</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Especialidades */}
              <div className="kpi-card">
                <div className="kpi-icon-wrapper kpi-icon-purple">
                  <i className="bi bi-heart-pulse" aria-hidden="true" />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Especialidades</span>
                  <div className="kpi-tags-wrapper">
                    {data.informacion_general.especialidades.length > 0 ? (
                      data.informacion_general.especialidades.map((esp) => (
                        <span key={esp} className="kpi-tag-chip accent-blue">
                          <i className="bi bi-patch-check me-1" aria-hidden="true" />
                          {esp}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted small">Sin especialidades</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              3. SECCIÓN: CRONOGRAMA SEMANAL
              ================================================================ */}
          <section className="cronograma-section">
            <div className="section-header-row">
              <h2>
                <i className="bi bi-calendar3-week text-primary" aria-hidden="true" />
                Cronograma semanal de atención
              </h2>
              <span className="text-muted small">
                Horarios y franjas habituales programadas por día de la semana
              </span>
            </div>

            <div className="week-grid-container">
              {data.cronograma_semanal.map((dia) => (
                <div
                  key={dia.dia_semana}
                  className={`day-column-card ${dia.trabaja ? 'is-active' : 'is-inactive'}`}
                >
                  <div className="day-card-header">
                    <span className="day-card-title">{dia.nombre_dia}</span>
                    <span
                      className={`day-status-pill ${
                        dia.trabaja ? 'active' : 'inactive'
                      }`}
                    >
                      {dia.trabaja ? 'Atención' : 'Libre'}
                    </span>
                  </div>

                  {dia.trabaja ? (
                    <div className="day-shifts-list">
                      {dia.franjas.map((franja) => (
                        <div key={franja.id_horario} className="shift-badge-box">
                          <div className="shift-hours-label">
                            <i className="bi bi-clock text-success" aria-hidden="true" />
                            {franja.hora_inicio} - {franja.hora_fin} hs
                          </div>
                          <div className="shift-meta-label">
                            {franja.salita}
                          </div>
                          <div className="shift-meta-badge">
                            {franja.especialidad} ({franja.duracion_turno_minutos} min)
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="day-empty-label">
                      <i className="bi bi-moon-stars d-block mb-1 fs-5 text-muted" aria-hidden="true" />
                      No laborable
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ================================================================
              4. SECCIÓN: DISPONIBILIDAD DIARIA Y SLOTS
              ================================================================ */}
          <section className="disponibilidad-section">
            <div className="section-header-row">
              <h2>
                <i className="bi bi-calendar2-range text-success" aria-hidden="true" />
                Disponibilidad por fecha
              </h2>

              <div className="legend-bar">
                <span className="legend-item">
                  <span className="legend-indicator green" />
                  Disponible
                </span>
                <span className="legend-item">
                  <span className="legend-indicator blue" />
                  Ocupado
                </span>
                <span className="legend-item">
                  <span className="legend-indicator red" />
                  Bloqueado
                </span>
                <span className="legend-item">
                  <span className="legend-indicator gray" />
                  Finalizado
                </span>
              </div>
            </div>

            {/* Barra de navegación de fecha */}
            <div className="date-navigation-toolbar">
              <div className="date-controls-group">
                <button
                  type="button"
                  className="nav-day-btn"
                  onClick={handlePrevDay}
                  title="Día anterior"
                >
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                </button>

                <input
                  type="date"
                  className="date-picker-styled"
                  value={fecha}
                  onChange={(e) => {
                    if (e.target.value) setFecha(e.target.value);
                  }}
                />

                <button
                  type="button"
                  className="nav-day-btn"
                  onClick={handleNextDay}
                  title="Día siguiente"
                >
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="btn-today-pill"
                  onClick={handleToday}
                >
                  <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                  Hoy
                </button>
              </div>

              <div className="active-date-display">
                <span className="active-date-day text-capitalize">
                  {formatHumanDate(data.disponibilidad_fecha.fecha)}
                </span>
                <span className="active-date-human">
                  {data.disponibilidad_fecha.trabaja
                    ? 'Día programado para atención médica'
                    : 'Día sin franjas laborales activas'}
                </span>
              </div>
            </div>

            {/* Filtros segmentados si atiende en varias salitas o especialidades en la fecha */}
            {(salitasDeHoy.length > 1 || especialidadesDeHoy.length > 1) && (
              <div className="d-flex flex-wrap gap-2 p-2 bg-light rounded-3 border mb-3">
                {salitasDeHoy.length > 1 && (
                  <div className="d-flex align-items-center gap-1">
                    <label htmlFor="horarios-filtro-salita" className="small text-muted fw-semibold mb-0">
                      <i className="bi bi-hospital me-1 text-success" />
                      Filtrar por salita:
                    </label>
                    <select
                      id="horarios-filtro-salita"
                      className="form-select form-select-sm"
                      style={{ width: 'auto', minWidth: '160px' }}
                      value={filtroSalita}
                      onChange={(e) => setFiltroSalita(e.target.value)}
                    >
                      <option value="">Todas las salitas ({salitasDeHoy.length})</option>
                      {salitasDeHoy.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {especialidadesDeHoy.length > 1 && (
                  <div className="d-flex align-items-center gap-1">
                    <label htmlFor="horarios-filtro-esp" className="small text-muted fw-semibold mb-0">
                      <i className="bi bi-heart-pulse me-1 text-primary" />
                      Especialidad:
                    </label>
                    <select
                      id="horarios-filtro-esp"
                      className="form-select form-select-sm"
                      style={{ width: 'auto', minWidth: '160px' }}
                      value={filtroEspecialidad}
                      onChange={(e) => setFiltroEspecialidad(e.target.value)}
                    >
                      <option value="">Todas las especialidades ({especialidadesDeHoy.length})</option>
                      {especialidadesDeHoy.map((esp) => (
                        <option key={esp} value={esp}>
                          {esp}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(filtroSalita || filtroEspecialidad) && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-secondary p-0 ms-auto text-decoration-none"
                    onClick={() => {
                      setFiltroSalita('');
                      setFiltroEspecialidad('');
                    }}
                  >
                    <i className="bi bi-x-circle me-1" />
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}

            {/* Métricas y resumen de turnos del día */}
            {data.disponibilidad_fecha.trabaja && (
              <div className="metrics-pills-row">
                <div className="metrics-pills-list">
                  <span className="stat-pill total">
                    <i className="bi bi-collection me-1" aria-hidden="true" />
                    Total franjas: <strong>{data.disponibilidad_fecha.resumen_slots.total}</strong>
                  </span>
                  <span className="stat-pill disponibles">
                    <span className="legend-indicator green" />
                    Disponibles: <strong>{data.disponibilidad_fecha.resumen_slots.disponibles}</strong>
                  </span>
                  <span className="stat-pill ocupados">
                    <span className="legend-indicator blue" />
                    Ocupados: <strong>{data.disponibilidad_fecha.resumen_slots.ocupados}</strong>
                  </span>
                  {data.disponibilidad_fecha.resumen_slots.bloqueados > 0 && (
                    <span className="stat-pill bloqueados">
                      <span className="legend-indicator red" />
                      Bloqueados: <strong>{data.disponibilidad_fecha.resumen_slots.bloqueados}</strong>
                    </span>
                  )}
                  {(data.disponibilidad_fecha.resumen_slots.finalizados ?? 0) > 0 && (
                    <span className="stat-pill finalizados">
                      <span className="legend-indicator gray" />
                      Finalizados: <strong>{data.disponibilidad_fecha.resumen_slots.finalizados}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Casos especiales o Grilla de Slots */}
            {!data.disponibilidad_fecha.trabaja ? (
              <div className="day-off-card">
                <i className="bi bi-calendar-x day-off-icon" aria-hidden="true" />
                <h3>No tenés atención programada</h3>
                <p>
                  No contás con franjas laborales asignadas para este día de la semana. Podés explorar los días siguientes utilizando el selector de fechas.
                </p>
              </div>
            ) : data.disponibilidad_fecha.bloqueo_dia_completo.bloqueado ? (
              <div className="day-blocked-alert">
                <i className="bi bi-exclamation-octagon-fill fs-2" aria-hidden="true" />
                <div>
                  <h4>Día bloqueado por la institución o profesional</h4>
                  <p>
                    Motivo: <strong>{data.disponibilidad_fecha.bloqueo_dia_completo.motivo || 'Cierre / Licencia'}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {franjasFiltradas.length === 0 ? (
                  <div className="text-center py-4 text-muted bg-white border rounded-3 p-3">
                    <i className="bi bi-funnel fs-3 d-block mb-2 text-secondary" />
                    <p className="fw-semibold mb-1">No hay franjas con los filtros seleccionados</p>
                    <p className="small mb-0">Probá limpiando el filtro de salita o especialidad.</p>
                  </div>
                ) : (
                  franjasFiltradas.map((franja) => (
                    <div key={franja.id_horario} className="franja-block">
                      <div className="franja-block-header">
                        <div className="franja-block-title">
                          <i className="bi bi-clock text-primary" aria-hidden="true" />
                          Franja horaria: {franja.hora_inicio} a {franja.hora_fin} hs
                        </div>

                        <div className="franja-badges">
                          <span className="franja-clinic-pill">
                            <i className="bi bi-hospital me-1" aria-hidden="true" />
                            {franja.salita}
                          </span>
                          <span className="franja-specialty-pill">
                            <i className="bi bi-heart-pulse me-1" aria-hidden="true" />
                            {franja.especialidad}
                          </span>
                        </div>
                      </div>

                      <div className="slots-grid-modern">
                        {franja.slots.map((slot, idx) => (
                          <div
                            key={`${slot.hora_inicio}-${idx}`}
                            className={`slot-card-interactive state-${slot.estado.toLowerCase()}`}
                            title={
                              slot.estado === 'OCUPADO'
                                ? `Turno Ocupado: ${slot.paciente || 'Paciente'} (${slot.estado_turno || ''})`
                                : slot.estado === 'BLOQUEADO'
                                  ? `Bloqueado: ${slot.motivo || 'No disponible'}`
                                  : slot.estado === 'FINALIZADO' || slot.estado === 'NO_DISPONIBLE'
                                    ? `Horario finalizado (${slot.motivo || 'No disponible para reserva'})`
                                    : 'Horario disponible para asignación'
                            }
                          >
                            <span className="slot-time-text">
                              {slot.hora_inicio} - {slot.hora_fin}
                            </span>

                            <span className="slot-badge-status">
                              {slot.estado === 'DISPONIBLE' && (
                                <>
                                  <i className="bi bi-check-circle-fill text-success" aria-hidden="true" />
                                  Libre
                                </>
                              )}
                              {slot.estado === 'OCUPADO' && (
                                <>
                                  <i className="bi bi-person-fill text-primary" aria-hidden="true" />
                                  Ocupado
                                </>
                              )}
                              {slot.estado === 'BLOQUEADO' && (
                                <>
                                  <i className="bi bi-dash-circle-fill text-danger" aria-hidden="true" />
                                  Bloqueado
                                </>
                              )}
                              {(slot.estado === 'FINALIZADO' || slot.estado === 'NO_DISPONIBLE') && (
                                <>
                                  <i className="bi bi-clock-history text-muted" aria-hidden="true" />
                                  Finalizado
                                </>
                              )}
                            </span>

                            {slot.estado === 'OCUPADO' && slot.paciente && (
                              <span className="slot-patient-label" title={slot.paciente}>
                                {slot.paciente}
                              </span>
                            )}

                            {slot.estado === 'BLOQUEADO' && slot.motivo && (
                              <span className="slot-reason-label" title={slot.motivo}>
                                {slot.motivo}
                              </span>
                            )}

                            {(slot.estado === 'FINALIZADO' || slot.estado === 'NO_DISPONIBLE') && slot.motivo && (
                              <span className="slot-reason-label text-muted" title={slot.motivo}>
                                {slot.motivo}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
