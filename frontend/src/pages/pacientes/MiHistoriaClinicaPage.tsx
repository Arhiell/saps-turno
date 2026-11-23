import { useEffect, useState } from 'react';
import useManagedPatients from '../../context/useManagedPatients';
import ManagedPatientSelector from '../../components/ui/ManagedPatientSelector';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import PaginationControls from '../../components/ui/PaginationControls';
import { getOwnHistoriaClinica } from '../../services/patients.service';
import { useAuth } from '../../context/AuthContext';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import { formatManagedKinship } from '../../utils/kinship';
import type {
  PatientClinicalDerivacion,
  PatientClinicalSignedConsulta,
  PatientHistoriaClinicaData,
} from '../../types/historia-clinica.types';
import {
  calculateAgeLabel,
  formatArgentinaDate,
} from '../../utils/historia-clinica-format';
import { useAutoDismiss } from '../../utils/useAutoDismiss';

export default function MiHistoriaClinicaPage() {
  const selection = useManagedPatients();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PatientHistoriaClinicaData | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'consultas' | 'derivaciones' | 'antecedentes'>('consultas');
  const [consultasPage, setConsultasPage] = useState(1);

  useAutoDismiss(error, setError, 15_000, Boolean(error));

  const loadData = async (patientId?: string) => {
    try {
      setLoading(true);
      setError('');
      const res = await getOwnHistoriaClinica(patientId);
      setData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          'No se pudo cargar la información de tu historia clínica. Por favor, intentá nuevamente.'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selection.loading) return;
    const targetId = selection.selected?.id_paciente;
    setConsultasPage(1);
    void loadData(targetId);
  }, [selection.id, selection.loading]);

  // Actualización automática en segundo plano por WebSockets
  const { ultimoEventoClinico, resyncTick } = useAgendaSocket();

  useEffect(() => {
    if (!ultimoEventoClinico) return;
    const targetId = selection.selected?.id_paciente;
    if (!ultimoEventoClinico.id_paciente || ultimoEventoClinico.id_paciente === targetId) {
      void loadData(targetId);
    }
  }, [ultimoEventoClinico, selection.selected?.id_paciente]);

  useEffect(() => {
    if (resyncTick > 0) {
      void loadData(selection.selected?.id_paciente);
    }
  }, [resyncTick, selection.selected?.id_paciente]);

  const handlePrint = () => {
    window.print();
  };

  const { patient: titularPatient } = useAuth();

  const managedDependent = selection.items.find(
    (m) => m.id_paciente === selection.selected?.id_paciente
  );
  const isViewingDependent = Boolean(selection.selected && managedDependent);
  const kinText = managedDependent ? formatManagedKinship(managedDependent, titularPatient) : '';

  return (
    <div className="container-fluid px-0">
      {error && (
        <FloatingFeedbackToast
          variant="error"
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Selector de personas a cargo si es tutor de menores */}
      <ManagedPatientSelector selection={selection} />

      {/* Encabezado de la página */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 no-print">
        <div>
          <h1 className="h3 fw-bold mb-1">
            <i className="bi bi-journal-medical text-success me-2" aria-hidden="true" />
            Mi historia clínica
          </h1>
          <p className="text-muted mb-0">
            {isViewingDependent
              ? `Expediente clínico de ${selection.selected?.nombres} ${selection.selected?.apellidos}${kinText ? ` (${kinText})` : ''}.`
              : 'Consultá tu información médica, atenciones firmadas, diagnósticos y estudios.'}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {data && data.consultas.length > 0 && (
            <button
              type="button"
              className="btn btn-outline-secondary d-flex align-items-center gap-2"
              onClick={handlePrint}
            >
              <i className="bi bi-printer" aria-hidden="true" />
              <span>Imprimir resumen</span>
            </button>
          )}
        </div>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="card border-0 shadow-sm p-5 text-center my-4" role="status">
          <div className="spinner-border text-success mx-auto mb-3" />
          <h2 className="h5 fw-semibold mb-1">Cargando información clínica…</h2>
          <p className="text-muted small mb-0">
            Estamos obteniendo los registros disponibles de manera segura.
          </p>
        </div>
      )}

      {/* Contenido cargado */}
      {!loading && data && (
        <>
          {/* Ficha Resumen del Paciente */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
              <div className="row align-items-center g-3">
                <div className="col-auto">
                  <div
                    className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center"
                    style={{ width: '60px', height: '60px', fontSize: '1.75rem' }}
                  >
                    <i className="bi bi-person-heart" aria-hidden="true" />
                  </div>
                </div>

                <div className="col">
                  <h2 className="h4 fw-bold mb-1">
                    {data.paciente.apellidos}, {data.paciente.nombres}
                  </h2>
                  <div className="d-flex flex-wrap gap-3 text-muted small">
                    <span className="text-nowrap">
                      <strong className="text-dark">DNI:</strong> {data.paciente.dni}
                    </span>
                    {data.paciente.fecha_nacimiento && (
                      <span>
                        <strong className="text-dark">Edad:</strong>{' '}
                        {calculateAgeLabel(data.paciente.fecha_nacimiento)} (
                        {formatArgentinaDate(data.paciente.fecha_nacimiento)})
                      </span>
                    )}
                    {data.paciente.salita_nombre && (
                      <span>
                        <strong className="text-dark">Salita asignada:</strong>{' '}
                        {data.paciente.salita_nombre}
                      </span>
                    )}
                    {data.paciente.obra_social && (
                      <span>
                        <strong className="text-dark">Obra social:</strong>{' '}
                        {data.paciente.obra_social}
                        {data.paciente.numero_afiliado ? ` (Af.: ${data.paciente.numero_afiliado})` : ''}
                      </span>
                    )}
                    {data.historia_clinica?.grupo_sanguineo && (
                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                        Grupo: {data.historia_clinica.grupo_sanguineo}
                        {data.historia_clinica.factor_rh === 'POSITIVO'
                          ? '+'
                          : data.historia_clinica.factor_rh === 'NEGATIVO'
                            ? '-'
                            : ''}
                      </span>
                    )}
                  </div>
                </div>

                {data.historia_clinica?.numero_historia_clinica && (
                  <div className="col-12 col-md-auto text-md-end">
                    <span className="badge bg-light text-dark border p-2">
                      <span className="text-muted d-block small">N° Expediente</span>
                      <strong className="fs-6">{data.historia_clinica.numero_historia_clinica}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navegación por pestañas */}
          <ul className="nav nav-tabs mb-4 no-print" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link ${activeTab === 'consultas' ? 'active fw-bold text-success' : 'text-secondary'}`}
                onClick={() => setActiveTab('consultas')}
              >
                <i className="bi bi-file-medical me-2" aria-hidden="true" />
                Consultas médicas ({data.consultas.length})
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link ${activeTab === 'derivaciones' ? 'active fw-bold text-success' : 'text-secondary'}`}
                onClick={() => setActiveTab('derivaciones')}
              >
                <i className="bi bi-arrow-left-right me-2" aria-hidden="true" />
                Derivaciones ({data.derivaciones.length})
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link ${activeTab === 'antecedentes' ? 'active fw-bold text-success' : 'text-secondary'}`}
                onClick={() => setActiveTab('antecedentes')}
              >
                <i className="bi bi-shield-plus me-2" aria-hidden="true" />
                Antecedentes y Alergias (
                {data.antecedentes.length + data.alergias.length})
              </button>
            </li>
          </ul>

          {/* TAB 1: CONSULTAS MÉDICAS */}
          {activeTab === 'consultas' && (
            <div>
              {data.consultas.length === 0 ? (
                /* ESTADO SIN REGISTROS SEGÚN ESPECIFICACIÓN */
                <div className="card border-0 shadow-sm p-5 text-center my-3">
                  <div
                    className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}
                  >
                    <i className="bi bi-journal-check" aria-hidden="true" />
                  </div>
                  <h3 className="h4 fw-bold mb-2">Historial clínico disponible</h3>
                  <p className="text-muted fs-6 mb-4 mx-auto" style={{ maxWidth: '600px' }}>
                    {isViewingDependent
                      ? 'El paciente todavía no tiene consultas registradas. Cuando tenga su primera atención médica, vas a poder consultar aquí su información clínica disponible.'
                      : 'Todavía no tenés consultas registradas. Cuando tengas tu primera atención médica, vas a poder consultar aquí tu información clínica disponible.'}
                  </p>
                  <div className="d-flex justify-content-center gap-3">
                    <a href="/solicitar-turno" className="btn btn-saps">
                      <i className="bi bi-calendar-plus me-2" aria-hidden="true" />
                      Solicitar un turno
                    </a>
                  </div>
                </div>
              ) : (
                /* LISTADO CRONOLÓGICO DE ATENCIONES FIRMADAS (PAGINACIÓN 15 REGISTROS) */
                <>
                  <div className="d-flex flex-column gap-4">
                    {data.consultas
                      .slice((consultasPage - 1) * 15, consultasPage * 15)
                      .map((consulta) => (
                        <ConsultaMedicaItem key={consulta.id_consulta} consulta={consulta} />
                      ))}
                  </div>
                  <PaginationControls
                    page={consultasPage}
                    totalPages={Math.ceil(data.consultas.length / 15)}
                    totalItems={data.consultas.length}
                    itemsPerPage={15}
                    onPageChange={setConsultasPage}
                    loading={loading}
                    itemLabel="consultas médicas"
                    className="mt-4"
                  />
                </>
              )}
            </div>
          )}

          {/* TAB 2: DERIVACIONES */}
          {activeTab === 'derivaciones' && (
            <div>
              {data.derivaciones.length === 0 ? (
                <div className="card border-0 shadow-sm p-5 text-center my-3">
                  <div
                    className="rounded-circle bg-light text-muted d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '64px', height: '64px', fontSize: '2rem' }}
                  >
                    <i className="bi bi-arrow-left-right" aria-hidden="true" />
                  </div>
                  <h3 className="h5 fw-bold mb-1">Sin derivaciones registradas</h3>
                  <p className="text-muted small mb-0">
                    No se han emitido órdenes de derivación inter-salita o inter-especialidad para este paciente.
                  </p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {data.derivaciones.map((d: PatientClinicalDerivacion) => (
                    <div key={d.id_autorizacion_clinica} className="card border-0 shadow-sm">
                      <div className="card-body p-4">
                        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                          <div>
                            <span className="badge bg-secondary-subtle text-secondary me-2">
                              Alcance: {d.alcance}
                            </span>
                            <span
                              className={`badge ${
                                d.estado === 'AUTORIZADA'
                                  ? 'bg-success text-white'
                                  : d.estado === 'SOLICITADA'
                                    ? 'bg-warning text-dark'
                                    : d.estado === 'UTILIZADA'
                                      ? 'bg-primary text-white'
                                      : 'bg-secondary text-white'
                              }`}
                            >
                              {d.estado}
                            </span>
                            <h3 className="h6 fw-bold mt-2 mb-1">
                              Destino: {d.salita_destino ?? 'Salita no especificada'}
                              {d.especialidad_destino ? ` · Especialidad: ${d.especialidad_destino}` : ''}
                            </h3>
                          </div>
                          <div className="text-muted small">
                            Solicitada el: {formatArgentinaDate(d.fecha_solicitud)}
                          </div>
                        </div>

                        <div className="bg-light p-3 rounded mb-2">
                          <strong className="d-block text-dark small fw-semibold">Motivo:</strong>
                          <p className="mb-0 small">{d.motivo_derivacion}</p>
                        </div>

                        {d.resumen_clinico && (
                          <div className="small text-muted mb-2">
                            <strong>Resumen clínico:</strong> {d.resumen_clinico}
                          </div>
                        )}

                        {(d.fecha_desde || d.fecha_hasta) && (
                          <div className="small text-muted">
                            <i className="bi bi-calendar-event me-1" aria-hidden="true" />
                            Vigencia: {formatArgentinaDate(d.fecha_desde)} al{' '}
                            {formatArgentinaDate(d.fecha_hasta)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ANTECEDENTES Y ALERGIAS */}
          {activeTab === 'antecedentes' && (
            <div className="row g-4">
              {/* Alergias */}
              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white py-3 border-0">
                    <h3 className="h6 fw-bold mb-0 text-danger d-flex align-items-center gap-2">
                      <i className="bi bi-exclamation-octagon-fill" aria-hidden="true" />
                      Alergias registradas ({data.alergias.length})
                    </h3>
                  </div>
                  <div className="card-body p-4 pt-0">
                    {data.alergias.length === 0 ? (
                      <p className="text-muted small mb-0">No se registran alergias para este paciente.</p>
                    ) : (
                      <ul className="list-group list-group-flush">
                        {data.alergias.map((a) => (
                          <li key={a.id_alergia} className="list-group-item px-0 py-2">
                            <div className="d-flex justify-content-between align-items-center">
                              <strong className="text-dark">{a.sustancia_alergeno}</strong>
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                {a.severidad ?? 'No informada'}
                              </span>
                            </div>
                            {a.tipo_reaccion && (
                              <div className="text-muted small">Reacción: {a.tipo_reaccion}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Antecedentes */}
              <div className="col-12 col-lg-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white py-3 border-0">
                    <h3 className="h6 fw-bold mb-0 text-primary d-flex align-items-center gap-2">
                      <i className="bi bi-clipboard-pulse" aria-hidden="true" />
                      Antecedentes clínicos ({data.antecedentes.length})
                    </h3>
                  </div>
                  <div className="card-body p-4 pt-0">
                    {data.antecedentes.length === 0 ? (
                      <p className="text-muted small mb-0">No se registran antecedentes previos.</p>
                    ) : (
                      <ul className="list-group list-group-flush">
                        {data.antecedentes.map((ant) => (
                          <li key={ant.id_antecedente} className="list-group-item px-0 py-2">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="badge bg-primary-subtle text-primary">{ant.tipo}</span>
                              {ant.fecha_antecedente && (
                                <span className="text-muted small">
                                  {formatArgentinaDate(ant.fecha_antecedente)}
                                </span>
                              )}
                            </div>
                            <p className="mb-0 text-dark small">{ant.descripcion}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConsultaMedicaItem({ consulta }: { consulta: PatientClinicalSignedConsulta }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="card border-0 shadow-sm">
      {/* Encabezado del acto médico */}
      <div className="card-header bg-white p-4 border-bottom">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
                Consulta médica firmada
              </span>
              <span className="badge bg-light text-dark border">
                {consulta.especialidad}
              </span>
            </div>

            <h3 className="h5 fw-bold text-dark mb-1">
              Atención médica: {consulta.motivo_consulta}
            </h3>

            <div className="text-muted small">
              <i className="bi bi-hospital me-1" aria-hidden="true" />
              <strong>{consulta.salita}</strong>
              {consulta.salita_direccion ? ` (${consulta.salita_direccion})` : ''}
              <span className="mx-2">·</span>
              <i className="bi bi-person-badge me-1" aria-hidden="true" />
              Profesional: <strong>{consulta.profesional}</strong>
              {consulta.matricula_profesional ? ` (Mat. ${consulta.matricula_profesional})` : ''}
            </div>
          </div>

          <div className="text-md-end">
            <time className="fw-semibold text-dark d-block">
              {new Date(consulta.fecha_atencion).toLocaleDateString('es-AR', {
                timeZone: 'America/Argentina/Buenos_Aires',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            <span className="text-muted small">
              Hora:{' '}
              {new Date(consulta.fecha_atencion).toLocaleTimeString('es-AR', {
                timeZone: 'America/Argentina/Buenos_Aires',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              hs
            </span>
          </div>
        </div>
      </div>

      <div className="card-body p-4">
        {/* Diagnósticos */}
        {consulta.diagnosticos.length > 0 && (
          <div className="mb-4">
            <h4 className="h6 fw-bold text-secondary text-uppercase small mb-2">
              <i className="bi bi-tags me-1" aria-hidden="true" />
              Diagnósticos registrados
            </h4>
            <div className="d-flex flex-wrap gap-2">
              {consulta.diagnosticos.map((diag: { id_diagnostico: string; codigo_cie10?: string | null; descripcion: string; tipo: string; es_principal: boolean; cronico?: boolean }) => (
                <div
                  key={diag.id_diagnostico}
                  className={`p-2 px-3 rounded border ${
                    diag.es_principal
                      ? 'bg-success-subtle border-success text-success-emphasis fw-semibold'
                      : 'bg-light border-secondary-subtle text-dark'
                  }`}
                >
                  <span>{diag.descripcion}</span>
                  {diag.codigo_cie10 && (
                    <span className="badge bg-secondary ms-2 small">{diag.codigo_cie10}</span>
                  )}
                  {diag.es_principal && (
                    <span className="badge bg-success ms-2 small">Principal</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tratamientos e indicaciones médicas */}
        {consulta.tratamientos.length > 0 && (
          <div className="mb-4">
            <h4 className="h6 fw-bold text-secondary text-uppercase small mb-2">
              <i className="bi bi-capsule me-1 text-primary" aria-hidden="true" />
              Tratamientos e Indicaciones
            </h4>
            <div className="table-responsive">
              <table className="table table-sm table-bordered align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th>Medicamento / Indicación</th>
                    <th>Dosis</th>
                    <th>Frecuencia</th>
                    <th>Duración</th>
                    <th>Instrucciones</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {consulta.tratamientos.map((trat: { id_tratamiento: string; medicamento: string; dosis?: string | null; frecuencia?: string | null; duracion_dias?: number | null; instrucciones?: string | null; fecha_inicio?: string | null; fecha_fin?: string | null }) => (
                    <tr key={trat.id_tratamiento}>
                      <td className="fw-semibold">{trat.medicamento}</td>
                      <td>{trat.dosis || '—'}</td>
                      <td>{trat.frecuencia || '—'}</td>
                      <td>{trat.duracion_dias ? `${trat.duracion_dias} días` : '—'}</td>
                      <td>{trat.instrucciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Estudios complementarios */}
        {consulta.estudios.length > 0 && (
          <div className="mb-4">
            <h4 className="h6 fw-bold text-secondary text-uppercase small mb-2">
              <i className="bi bi-clipboard2-pulse me-1 text-info" aria-hidden="true" />
              Estudios complementarios solicitados
            </h4>
            <div className="d-flex flex-column gap-2">
              {consulta.estudios.map((est: { id_estudio: string; tipo_estudio: string; descripcion_pedido: string; estado: string; resultado_informe?: string | null; fecha_solicitud: string; fecha_resultado?: string | null }) => (
                <div key={est.id_estudio} className="p-3 bg-light rounded border">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <strong className="text-dark">{est.tipo_estudio}</strong>
                    <span
                      className={`badge ${
                        est.estado === 'COMPLETADO'
                          ? 'bg-success'
                          : est.estado === 'EN_PROCESO'
                            ? 'bg-warning text-dark'
                            : est.estado === 'CANCELADO'
                              ? 'bg-danger'
                              : 'bg-secondary'
                      }`}
                    >
                      {est.estado}
                    </span>
                  </div>
                  <p className="text-muted small mb-1">{est.descripcion_pedido}</p>
                  {est.resultado_informe && (
                    <div className="mt-2 p-2 bg-white rounded border border-success-subtle">
                      <strong className="text-success small d-block">
                        <i className="bi bi-file-earmark-check me-1" aria-hidden="true" />
                        Resultado / Informe:
                      </strong>
                      <span className="small">{est.resultado_informe}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón para ver más detalles clínicos (evolución, examen físico, cuadro clínico) */}
        <div className="pt-2 border-top d-flex justify-content-between align-items-center">
          <button
            type="button"
            className="btn btn-sm btn-link text-success p-0 text-decoration-none fw-semibold"
            onClick={() => setExpanded(!expanded)}
          >
            <i className={`bi bi-chevron-${expanded ? 'up' : 'down'} me-1`} aria-hidden="true" />
            {expanded ? 'Ocultar evolución y detalle clínico' : 'Ver evolución y notas clínicas'}
          </button>
          <span className="text-muted small">
            Firma verificada: {formatArgentinaDate(consulta.fecha_firma)}
          </span>
        </div>

        {expanded && (
          <div className="mt-3 p-3 bg-light rounded border">
            {consulta.anamnesis_cuadro_clinico && (
              <div className="mb-3">
                <strong className="d-block small text-dark fw-bold">Cuadro clínico / Anamnesis:</strong>
                <p className="small mb-0 text-secondary">{consulta.anamnesis_cuadro_clinico}</p>
              </div>
            )}

            {consulta.examen_fisico && (
              <div className="mb-3">
                <strong className="d-block small text-dark fw-bold">Examen físico:</strong>
                <p className="small mb-0 text-secondary">{consulta.examen_fisico}</p>
              </div>
            )}

            {consulta.plan_terapeutico && (
              <div className="mb-3">
                <strong className="d-block small text-dark fw-bold">Plan terapéutico:</strong>
                <p className="small mb-0 text-secondary">{consulta.plan_terapeutico}</p>
              </div>
            )}

            {/* Evoluciones firmadas */}
            {consulta.evoluciones.length > 0 && (
              <div className="mt-3 pt-3 border-top">
                <strong className="d-block small text-dark fw-bold mb-2">Evoluciones firmadas:</strong>
                <div className="d-flex flex-column gap-2">
                  {consulta.evoluciones.map((ev: { id_evolucion: string; fecha_evolucion: string; nota_evolucion: string; version: number; profesional?: string }) => (
                    <div key={ev.id_evolucion} className="p-2 bg-white rounded border">
                      <div className="d-flex justify-content-between align-items-center small text-muted mb-1">
                        <span>
                          {ev.profesional ? `Por: ${ev.profesional}` : 'Evolución médica'} (v{ev.version})
                        </span>
                        <span>{formatArgentinaDate(ev.fecha_evolucion)}</span>
                      </div>
                      <p className="small mb-0 text-dark">{ev.nota_evolucion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
