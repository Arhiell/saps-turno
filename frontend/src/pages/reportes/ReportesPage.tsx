import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getReporteEspecialidades,
  getReporteProfesionales,
  getReporteResumen,
  descargarReporte,
  reporteDownloadError,
  getAgendaDiaria,
  descargarAgendaDiaria,
} from '../../services/reportes.service';

import {
  getAdminSalitas,
} from '../../services/salitas.service';

import type {
  ReporteEspecialidad,
  ReporteFiltros,
  ReporteFormato,
  ReporteProfesional,
  ReporteResumen,
  AgendaDiariaResponse,
} from '../../types/reporte.types';

import type {
  Salita,
} from '../../types/salita.types';

import '../../styles/reportes.css';

type ReporteVista =
  | 'resumen'
  | 'especialidades'
  | 'profesionales'
  | 'agenda';

const getToday = () => {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(2, '0');

  const day =
    String(
      date.getDate(),
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getFirstDayOfMonth =
  () => {
    const date =
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      );

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1,
      ).padStart(2, '0');

    return `${year}-${month}-01`;
  };

const formatNumber =
  (value: number) =>
    new Intl.NumberFormat(
      'es-AR',
    ).format(value);

const formatDate =
  (value: string) => {
    if (!value) {
      return '-';
    }

    const parts =
      value.split('-');

    if (parts.length !== 3) {
      return value;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

const ReportesPage = () => {
  const [
    vista,
    setVista,
  ] =
    useState<ReporteVista>(
      'resumen',
    );

  const [
    fechaDesde,
    setFechaDesde,
  ] =
    useState(
      getFirstDayOfMonth(),
    );

  const [
    fechaHasta,
    setFechaHasta,
  ] =
    useState(
      getToday(),
    );

  const [
    fechaAgenda,
    setFechaAgenda,
  ] =
    useState(
      getToday(),
    );

  const [
    idSalita,
    setIdSalita,
  ] =
    useState('');

  const [
    salitas,
    setSalitas,
  ] =
    useState<Salita[]>([]);

  const [
    resumen,
    setResumen,
  ] =
    useState<ReporteResumen | null>(
      null,
    );

  const [
    especialidades,
    setEspecialidades,
  ] =
    useState<ReporteEspecialidad[]>(
      [],
    );

  const [
    profesionales,
    setProfesionales,
  ] =
    useState<ReporteProfesional[]>(
      [],
    );

  const [
    agenda,
    setAgenda,
  ] =
    useState<AgendaDiariaResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    loadingSalitas,
    setLoadingSalitas,
  ] =
    useState(true);

  const [
    exportando,
    setExportando,
  ] =
    useState<ReporteFormato | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const filtros =
    useMemo<ReporteFiltros>(
      () => ({
        fecha_desde:
          fechaDesde,
        fecha_hasta:
          fechaHasta,
        ...(idSalita
          ? {
              id_salita:
                idSalita,
            }
          : {}),
      }),
      [
        fechaDesde,
        fechaHasta,
        idSalita,
      ],
    );

  useEffect(() => {
    const cargarSalitas =
      async () => {
        try {
          setLoadingSalitas(
            true,
          );

          const response =
            await getAdminSalitas();

          setSalitas(
            response.data.filter(
              (salita: Salita) =>
                salita.activo,
            ),
          );
        } catch (err) {
          console.error(err);
          setSalitas([]);
        } finally {
          setLoadingSalitas(
            false,
          );
        }
      };

    void cargarSalitas();
  }, []);

  const validarPeriodo =
    () => {
      if (
        !fechaDesde ||
        !fechaHasta
      ) {
        setError(
          'Debe seleccionar ambas fechas.',
        );

        return false;
      }

      if (
        fechaDesde >
        fechaHasta
      ) {
        setError(
          'La fecha desde no puede ser posterior a la fecha hasta.',
        );

        return false;
      }

      return true;
    };

  const generarReporte =
    async () => {
      if (!validarPeriodo()) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        if (
          vista === 'resumen'
        ) {
          const response =
            await getReporteResumen(
              filtros,
            );

          setResumen(
            response.reporte,
          );
        }

        if (
          vista ===
          'especialidades'
        ) {
          const response =
            await getReporteEspecialidades(
              filtros,
            );

          setEspecialidades(
            response.reporte,
          );
        }

        if (
          vista ===
          'profesionales'
        ) {
          const response =
            await getReporteProfesionales(
              filtros,
            );

          setProfesionales(
            response.reporte,
          );
        }
      } catch (err: any) {
        console.error(err);

        setError(
          err?.response?.data
            ?.message ||
            'No se pudo generar el reporte.',
        );
      } finally {
        setLoading(false);
      }
    };

  const generarAgenda =
    async () => {
      if (!fechaAgenda) {
        setError(
          'Debe seleccionar una fecha.',
        );

        return;
      }

      try {
        setLoading(true);
        setError('');

        const response =
          await getAgendaDiaria({
            fecha:
              fechaAgenda,
            ...(idSalita
              ? {
                  id_salita:
                    idSalita,
                }
              : {}),
          });

        setAgenda(response);
      } catch (err: any) {
        console.error(err);

        setError(
          err?.response?.data
            ?.message ||
            'No se pudo cargar la agenda diaria.',
        );
      } finally {
        setLoading(false);
      }
    };

  const exportarReporte =
    async (
      formato: ReporteFormato,
    ) => {
      if (!validarPeriodo()) {
        return;
      }

      try {
        setExportando(
          formato,
        );

        setError('');

        const tipo:
          | 'resumen'
          | 'especialidades'
          | 'profesionales' =
          vista === 'agenda'
            ? 'resumen'
            : vista;

        await descargarReporte(
          filtros,
          tipo,
          formato,
        );
      } catch (err: any) {
        console.error(err);

        setError(
          await reporteDownloadError(err),
        );
      } finally {
        setExportando(null);
      }
    };

  const exportarAgenda =
    async (
      formato: ReporteFormato,
    ) => {
      if (!fechaAgenda) {
        setError(
          'Debe seleccionar una fecha.',
        );

        return;
      }

      try {
        setExportando(
          formato,
        );

        setError('');

        await descargarAgendaDiaria(
          {
            fecha:
              fechaAgenda,
            ...(idSalita
              ? {
                  id_salita:
                    idSalita,
                }
              : {}),
          },
          formato,
        );
      } catch (err: any) {
        console.error(err);

        setError(
          await reporteDownloadError(err),
        );
      } finally {
        setExportando(null);
      }
    };

  const limpiar =
    () => {
      setFechaDesde(
        getFirstDayOfMonth(),
      );

      setFechaHasta(
        getToday(),
      );

      setFechaAgenda(
        getToday(),
      );

      setIdSalita('');

      setError('');

      setResumen(null);

      setEspecialidades([]);

      setProfesionales([]);

      setAgenda(null);
    };

  return (
    <div className="reportes-page">

      {/* ENCABEZADO */}
      <div className="reportes-page-header">
        <div>
          <h1>
            Reportes
          </h1>

          <p>
            Consultá estadísticas,
            actividad y agenda del
            sistema.
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <section className="reportes-card">
        <div className="reportes-card-header">
          <div>
            <h2>
              <i className="bi bi-funnel me-2" />
              Filtros
            </h2>

            <p>
              Seleccioná el período y
              la salita.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={limpiar}
          >
            <i className="bi bi-x-lg me-2" />
            Limpiar
          </button>
        </div>

        <div className="reportes-filtros-grid">

          {vista ===
          'agenda' ? (
            <div>
              <label
                htmlFor="fechaAgenda"
                className="form-label"
              >
                Fecha
              </label>

              <input
                id="fechaAgenda"
                type="date"
                className="form-control"
                value={
                  fechaAgenda
                }
                onChange={(
                  event,
                ) =>
                  setFechaAgenda(
                    event.target
                      .value,
                  )
                }
              />
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="fechaDesde"
                  className="form-label"
                >
                  Desde
                </label>

                <input
                  id="fechaDesde"
                  type="date"
                  className="form-control"
                  value={
                    fechaDesde
                  }
                  onChange={(
                    event,
                  ) =>
                    setFechaDesde(
                      event.target
                        .value,
                    )
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="fechaHasta"
                  className="form-label"
                >
                  Hasta
                </label>

                <input
                  id="fechaHasta"
                  type="date"
                  className="form-control"
                  value={
                    fechaHasta
                  }
                  onChange={(
                    event,
                  ) =>
                    setFechaHasta(
                      event.target
                        .value,
                    )
                  }
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="salitaReporte"
              className="form-label"
            >
              Salita
            </label>

            <select
              id="salitaReporte"
              className="form-select"
              value={
                idSalita
              }
              onChange={(
                event,
              ) =>
                setIdSalita(
                  event.target
                    .value,
                )
              }
              disabled={
                loadingSalitas
              }
            >
              <option value="">
                Todas las salitas
              </option>

              {salitas.map(
                (salita) => (
                  <option
                    key={
                      salita.id_salita
                    }
                    value={
                      salita.id_salita
                    }
                  >
                    {
                      salita.nombre
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="reportes-filtros-action">
            <button
              type="button"
              className="btn btn-saps w-100"
              onClick={
                vista ===
                'agenda'
                  ? generarAgenda
                  : generarReporte
              }
              disabled={
                loading
              }
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  Generando...
                </>
              ) : (
                <>
                  <i className="bi bi-bar-chart-line me-2" />
                  Generar reporte
                </>
              )}
            </button>
          </div>

        </div>

        {error && (
          <div className="alert alert-danger mx-4 mt-4 mb-0">
            <i className="bi bi-exclamation-triangle me-2" />
            {error}
          </div>
        )}
      </section>

      {/* TIPO */}
      <section className="reportes-card">
        <div className="reportes-card-header">
          <div>
            <h2>
              <i className="bi bi-file-earmark-bar-graph me-2" />
              Tipo de reporte
            </h2>

            <p>
              Elegí qué información
              querés consultar.
            </p>
          </div>
        </div>

        <div className="reportes-tabs">

          <button
            type="button"
            className={
              vista ===
              'resumen'
                ? 'reportes-tab active'
                : 'reportes-tab'
            }
            onClick={() =>
              setVista(
                'resumen',
              )
            }
          >
            <i className="bi bi-speedometer2" />

            <span>
              Resumen general
            </span>

            <small>
              Métricas del período
            </small>
          </button>

          <button
            type="button"
            className={
              vista ===
              'especialidades'
                ? 'reportes-tab active'
                : 'reportes-tab'
            }
            onClick={() =>
              setVista(
                'especialidades',
              )
            }
          >
            <i className="bi bi-heart-pulse" />

            <span>
              Por especialidad
            </span>

            <small>
              Demanda y resultados
            </small>
          </button>

          <button
            type="button"
            className={
              vista ===
              'profesionales'
                ? 'reportes-tab active'
                : 'reportes-tab'
            }
            onClick={() =>
              setVista(
                'profesionales',
              )
            }
          >
            <i className="bi bi-person-badge" />

            <span>
              Por profesional
            </span>

            <small>
              Actividad profesional
            </small>
          </button>

          <button
            type="button"
            className={
              vista ===
              'agenda'
                ? 'reportes-tab active'
                : 'reportes-tab'
            }
            onClick={() =>
              setVista(
                'agenda',
              )
            }
          >
            <i className="bi bi-calendar3" />

            <span>
              Agenda diaria
            </span>

            <small>
              Pacientes por profesional
            </small>
          </button>

        </div>
      </section>

      {/* RESUMEN */}
      {vista ===
        'resumen' && (
        <>
          {resumen ? (
            <>
              <div className="reportes-periodo">
                <strong>
                  Período:
                </strong>

                <span>
                  {formatDate(
                    resumen
                      .periodo
                      .desde,
                  )}{' '}
                  —{' '}
                  {formatDate(
                    resumen
                      .periodo
                      .hasta,
                  )}
                </span>
              </div>

              <div className="reportes-stats-grid">

                <div className="reportes-stat">
                  <div className="reportes-stat-icon">
                    <i className="bi bi-calendar-check" />
                  </div>

                  <div>
                    <span>
                      Total de turnos
                    </span>

                    <strong>
                      {formatNumber(
                        resumen
                          .total_turnos,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="reportes-stat">
                  <div className="reportes-stat-icon">
                    <i className="bi bi-check-circle" />
                  </div>

                  <div>
                    <span>
                      Atenciones realizadas
                    </span>

                    <strong>
                      {formatNumber(
                        resumen
                          .atenciones_realizadas,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="reportes-stat">
                  <div className="reportes-stat-icon">
                    <i className="bi bi-x-circle" />
                  </div>

                  <div>
                    <span>
                      Cancelaciones
                    </span>

                    <strong>
                      {formatNumber(
                        resumen
                          .cancelaciones,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="reportes-stat">
                  <div className="reportes-stat-icon">
                    <i className="bi bi-person-x" />
                  </div>

                  <div>
                    <span>
                      Inasistencias
                    </span>

                    <strong>
                      {formatNumber(
                        resumen
                          .inasistencias,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="reportes-stat">
                  <div className="reportes-stat-icon">
                    <i className="bi bi-people" />
                  </div>

                  <div>
                    <span>
                      Pacientes atendidos
                    </span>

                    <strong>
                      {formatNumber(
                        resumen
                          .pacientes_atendidos,
                      )}
                    </strong>
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="reportes-empty">
              <i className="bi bi-bar-chart" />

              <h3>
                No hay un reporte generado
              </h3>

              <p>
                Seleccioná el período y
                presioná «Generar reporte».
              </p>
            </div>
          )}

          {resumen && (
            <div className="reportes-export-card">
              <div>
                <h2>
                  <i className="bi bi-download me-2" />
                  Exportar reporte
                </h2>

                <p>
                  Descargá el resumen
                  en PDF, Excel o Word.
                </p>
              </div>

              <div className="reportes-export-buttons">
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={
                    exportando !==
                    null
                  }
                  onClick={() =>
                    exportarReporte(
                      'pdf',
                    )
                  }
                >
                  <i className="bi bi-file-earmark-pdf me-2" />
                  PDF
                </button>

                <button
                  type="button"
                  className="btn btn-outline-success"
                  disabled={
                    exportando !==
                    null
                  }
                  onClick={() =>
                    exportarReporte(
                      'xlsx',
                    )
                  }
                >
                  <i className="bi bi-file-earmark-excel me-2" />
                  Excel
                </button>

                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={
                    exportando !==
                    null
                  }
                  onClick={() =>
                    exportarReporte(
                      'docx',
                    )
                  }
                >
                  <i className="bi bi-file-earmark-word me-2" />
                  Word
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ESPECIALIDADES */}
      {vista ===
        'especialidades' && (
        <section className="reportes-card">
          <div className="reportes-card-header">
            <div>
              <h2>
                Demanda por especialidad
              </h2>

              <p>
                Turnos agrupados por
                especialidad.
              </p>
            </div>

            {especialidades.length >
              0 && (
              <div className="reportes-export-buttons">
                <button
                  className="btn btn-outline-danger"
                  onClick={() =>
                    exportarReporte(
                      'pdf',
                    )
                  }
                >
                  PDF
                </button>

                <button
                  className="btn btn-outline-success"
                  onClick={() =>
                    exportarReporte(
                      'xlsx',
                    )
                  }
                >
                  Excel
                </button>

                <button
                  className="btn btn-outline-primary"
                  onClick={() =>
                    exportarReporte(
                      'docx',
                    )
                  }
                >
                  Word
                </button>
              </div>
            )}
          </div>

          {especialidades.length >
          0 ? (
            <div className="table-responsive">
              <table className="table saps-responsive-table reportes-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">
                      Especialidad
                    </th>
                    <th scope="col">
                      Total
                    </th>
                    <th scope="col">
                      Atendidos
                    </th>
                    <th scope="col">
                      Inasistencias
                    </th>
                    <th scope="col">
                      Cancelados
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {especialidades.map(
                    (
                      item,
                    ) => (
                      <tr
                        key={
                          item.id_especialidad
                        }
                      >
                        <td data-label="Especialidad">
                          <strong>
                            {
                              item.nombre
                            }
                          </strong>
                        </td>

                        <td data-label="Total">
                          {
                            item.total_turnos
                          }
                        </td>

                        <td data-label="Atendidos">
                          {
                            item.atendidos
                          }
                        </td>

                        <td data-label="Inasistencias">
                          {
                            item.inasistencias
                          }
                        </td>

                        <td data-label="Cancelados">
                          {
                            item.cancelados
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="reportes-empty compact">
              <i className="bi bi-heart-pulse" />

              <p>
                Generá el reporte para
                consultar las especialidades.
              </p>
            </div>
          )}
        </section>
      )}

      {/* PROFESIONALES */}
      {vista ===
        'profesionales' && (
        <section className="reportes-card">
          <div className="reportes-card-header">
            <div>
              <h2>
                Actividad por profesional
              </h2>

              <p>
                Turnos agrupados por
                profesional.
              </p>
            </div>

            {profesionales.length >
              0 && (
              <div className="reportes-export-buttons">
                <button
                  className="btn btn-outline-danger"
                  onClick={() =>
                    exportarReporte(
                      'pdf',
                    )
                  }
                >
                  PDF
                </button>

                <button
                  className="btn btn-outline-success"
                  onClick={() =>
                    exportarReporte(
                      'xlsx',
                    )
                  }
                >
                  Excel
                </button>

                <button
                  className="btn btn-outline-primary"
                  onClick={() =>
                    exportarReporte(
                      'docx',
                    )
                  }
                >
                  Word
                </button>
              </div>
            )}
          </div>

          {profesionales.length >
          0 ? (
            <div className="table-responsive">
              <table className="table saps-responsive-table reportes-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">
                      Profesional
                    </th>
                    <th scope="col">
                      Total
                    </th>
                    <th scope="col">
                      Atendidos
                    </th>
                    <th scope="col">
                      Inasistencias
                    </th>
                    <th scope="col">
                      Cancelados
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {profesionales.map(
                    (
                      item,
                    ) => (
                      <tr
                        key={
                          item.id_profesional
                        }
                      >
                        <td data-label="Profesional">
                          <strong>
                            {
                              item.profesional
                            }
                          </strong>
                        </td>

                        <td data-label="Total">
                          {
                            item.total_turnos
                          }
                        </td>

                        <td data-label="Atendidos">
                          {
                            item.atendidos
                          }
                        </td>

                        <td data-label="Inasistencias">
                          {
                            item.inasistencias
                          }
                        </td>

                        <td data-label="Cancelados">
                          {
                            item.cancelados
                          }
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="reportes-empty compact">
              <i className="bi bi-person-badge" />

              <p>
                Generá el reporte para
                consultar los profesionales.
              </p>
            </div>
          )}
        </section>
      )}

      {/* AGENDA DIARIA */}
      {vista ===
        'agenda' && (
        <section className="reportes-card">

          <div className="reportes-card-header">
            <div>
              <h2>
                Agenda diaria
              </h2>

              <p>
                Pacientes agrupados por
                profesional, salita y
                especialidad.
              </p>
            </div>

            {agenda && (
              <div className="reportes-export-buttons">
                <button
                  className="btn btn-outline-danger"
                  onClick={() =>
                    exportarAgenda(
                      'pdf',
                    )
                  }
                >
                  PDF
                </button>

                <button
                  className="btn btn-outline-success"
                  onClick={() =>
                    exportarAgenda(
                      'xlsx',
                    )
                  }
                >
                  Excel
                </button>

                <button
                  className="btn btn-outline-primary"
                  onClick={() =>
                    exportarAgenda(
                      'docx',
                    )
                  }
                >
                  Word
                </button>
              </div>
            )}
          </div>

          {agenda ? (
            <>
              <div className="reportes-periodo">
                <strong>
                  {formatDate(
                    agenda.fecha,
                  )}
                </strong>

                <span>
                  {
                    agenda.total_pacientes
                  }{' '}
                  paciente
                  {agenda.total_pacientes !==
                  1
                    ? 's'
                    : ''}
                </span>
              </div>

              {agenda.listas.length >
              0 ? (
                <div className="reportes-agenda-list">
                  {agenda.listas.map(
                    (
                      lista,
                      index,
                    ) => (
                      <div
                        className="reportes-agenda-group"
                        key={`${lista.id_profesional}-${lista.id_salita}-${lista.id_especialidad}-${index}`}
                      >
                        <div className="reportes-agenda-header">
                          <div>
                            <strong>
                              {
                                lista.profesional
                              }
                            </strong>

                            <span>
                              {
                                lista.especialidad
                              }
                            </span>
                          </div>

                          <div>
                            <strong>
                              {
                                lista.salita
                              }
                            </strong>

                            <span>
                              {
                                lista.total_pacientes
                              }{' '}
                              pacientes
                            </span>
                          </div>
                        </div>

                        <div className="table-responsive">
                          <table className="table saps-responsive-table reportes-table mb-0">
                            <thead>
                              <tr>
                                <th scope="col">
                                  Hora
                                </th>
                                <th scope="col">
                                  Paciente
                                </th>
                                <th scope="col">
                                  DNI
                                </th>
                                <th scope="col">
                                  Estado
                                </th>
                                <th scope="col">
                                  Motivo
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {lista.pacientes.map(
                                (
                                  paciente,
                                ) => (
                                  <tr
                                    key={
                                      paciente.id_turno
                                    }
                                  >
                                    <td data-label="Hora">
                                      <strong>
                                        {
                                          paciente.hora
                                        }
                                      </strong>
                                    </td>

                                    <td data-label="Paciente">
                                      {
                                        paciente.apellido_nombre
                                      }
                                    </td>

                                    <td data-label="DNI">
                                      {
                                        paciente.dni
                                      }
                                    </td>

                                    <td data-label="Estado">
                                      {
                                        paciente.estado
                                      }
                                    </td>

                                    <td data-label="Motivo">
                                      {
                                        paciente.motivo_consulta ||
                                        '-'
                                      }
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="reportes-empty compact">
                  <i className="bi bi-calendar-x" />

                  <p>
                    No hay pacientes
                    registrados para
                    esta fecha.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="reportes-empty compact">
              <i className="bi bi-calendar3" />

              <p>
                Seleccioná una fecha y
                generá la agenda.
              </p>
            </div>
          )}
        </section>
      )}

    </div>
  );
};

export default ReportesPage;
