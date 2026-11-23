import { getEstadoClass, formatShortRef } from '../../utils/turno-status';
import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import ConnectionStatusBadge from '../../components/ui/ConnectionStatusBadge';
import { useAutoDismiss } from '../../utils/useAutoDismiss';

import {
  getTurnoById,
  changeTurnoStatus,
} from '../../services/turnos.service';

import type {
  Turno,
} from '../../types/turno.types';

const formatTurnoDateTime = (startVal: string, endVal?: string) => {
  const start = new Date(startVal);
  const horaInicio = start.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  let horaFin = '';
  if (endVal) {
    const end = new Date(endVal);
    horaFin = end.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const fechaCompleta = start.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const fechaCapitalizada =
    fechaCompleta.charAt(0).toUpperCase() + fechaCompleta.slice(1);

  const fechaCorta = start.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return {
    horaInicio,
    horaFin,
    fechaCompleta: fechaCapitalizada,
    fechaCorta,
  };
};

const TurnoDetallePage = () => {
  const navigate =
    useNavigate();

  const { id } =
    useParams();

  const [turno, setTurno] =
    useState<Turno | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [changingStatus, setChangingStatus] =
    useState(false);

  const [cancelOpen, setCancelOpen] =
    useState(false);

  const [cancelReason, setCancelReason] =
    useState('');

  const [statusTarget, setStatusTarget] =
    useState<string | null>(null);

  const [copiedCode, setCopiedCode] =
    useState(false);

  const { ultimoEvento, resyncTick } = useAgendaSocket();

  useAutoDismiss(message, setMessage, 15_000, Boolean(message));
  useAutoDismiss(error, setError, 15_000, Boolean(error));

  const loadTurno =
    async (isBackground = false) => {
      if (!id) {
        setError(
          'No se especificó el turno.',
        );
        setLoading(false);
        return;
      }

      try {
        if (!isBackground && !turno) {
          setLoading(true);
        }
        setError('');

        const response =
          await getTurnoById(
            id,
          );

        setTurno(
          response.data.turno,
        );
      } catch (error) {
        console.error(error);

        setError(
          'No se pudo cargar el turno.',
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadTurno();
  }, [id]);

  // Actualización reactiva ante eventos de WebSocket correspondientes a este turno
  useEffect(() => {
    if (!ultimoEvento || !id) return;

    if (ultimoEvento.id_turno === id) {
      if (ultimoEvento.estado) {
        setTurno((prev) =>
          prev
            ? {
                ...prev,
                estado: {
                  ...prev.estado,
                  codigo: ultimoEvento.estado!,
                  nombre: ultimoEvento.estado!,
                },
              }
            : null
        );
      }
      void loadTurno(true);
    }
  }, [ultimoEvento, id]);

  // Resincronización ante reconexión del socket
  useEffect(() => {
    if (resyncTick > 0 && id) {
      void loadTurno(true);
    }
  }, [resyncTick, id]);

  const handleCancel = () => {
    if (!id || !turno) return;
    setCancelReason('');
    setError('');
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!id || !turno) return;

    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setError('Debe indicar un motivo de cancelación de al menos 3 caracteres.');
      return;
    }

      try {
        setChangingStatus(
          true,
        );

        setError('');

        await changeTurnoStatus(
          id,
          {
            estado:
              'CANCELADO',
            motivo_cancelacion:
              reason,
          },
        );

        setCancelOpen(false);
        setMessage(
          'Turno cancelado correctamente.',
        );

        await loadTurno();
      } catch (error) {
        console.error(error);

        setError(
          'No se pudo cancelar el turno.',
        );
      } finally {
        setChangingStatus(
          false,
        );
      }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusTarget(newStatus);
  };

  const confirmStatusChange = async () => {
    if (!id || !statusTarget) return;

      try {
        setChangingStatus(
          true,
        );

        setError('');

        await changeTurnoStatus(
          id,
          {
            estado:
              statusTarget,
          },
        );

        setStatusTarget(null);
        setMessage(
          'Estado actualizado correctamente.',
        );

        await loadTurno();
      } catch (error) {
        console.error(error);

        setError(
          'No se pudo actualizar el estado del turno.',
        );
      } finally {
        setChangingStatus(
          false,
        );
      }
  };

  const handleReprogramar = () => {
    if (!id || !turno) {
      return;
    }

    navigate(`/turnos/${id}/reprogramar`);
  };

  const handleCopyCode = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = textToCopy;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!turno) {
    return (
      <div>
        <div className="alert alert-danger">
          {error || 'Turno no encontrado.'}
        </div>

        <button
          type="button"
          className="btn btn-saps"
          onClick={() => navigate('/turnos')}
        >
          Volver a turnos
        </button>
      </div>
    );
  }

  const isFinal = turno.estado.es_estado_final;

  const dt = formatTurnoDateTime(
    turno.fecha_hora_inicio,
    turno.fecha_hora_fin,
  );
  const shortRef = formatShortRef(turno.codigo_turno || turno.id_turno);
  const pacienteNombre = `${turno.paciente.persona.apellidos}, ${turno.paciente.persona.nombres}`;

  const getStatusModalInfo = () => {
    if (statusTarget === 'CONFIRMADO') {
      return {
        title: 'Confirmar turno',
        message: '¿Querés confirmar este turno?',
        confirmText: 'Confirmar turno',
        variant: 'primary' as const,
        icon: 'bi-check-circle',
      };
    }
    if (statusTarget === 'EN_ESPERA') {
      return {
        title: 'Pasar turno a espera',
        message: '¿El paciente ya se encuentra en la salita para su atención médica?',
        confirmText: 'Pasar a espera',
        variant: 'primary' as const,
        icon: 'bi-hourglass-split',
      };
    }
    if (statusTarget === 'NO_ASISTIO') {
      return {
        title: 'Registrar inasistencia',
        message: '¿Querés registrar que el paciente no asistió a su turno?',
        confirmText: 'Marcar inasistencia',
        variant: 'danger' as const,
        icon: 'bi-person-x',
      };
    }
    return {
      title: 'Actualizar estado',
      message: '¿Querés cambiar el estado de este turno?',
      confirmText: 'Aceptar',
      variant: 'primary' as const,
      icon: 'bi-check-circle',
    };
  };

  const statusModalInfo = getStatusModalInfo();

  return (
    <div className="turnos-page">
      {(message || error) && (
        <FloatingFeedbackToast
          message={message || error}
          variant={error ? 'error' : 'success'}
          onDismiss={() => {
            setMessage('');
            setError('');
          }}
        />
      )}

      <ConfirmationModal
        open={cancelOpen}
        title="Cancelar turno"
        message="¿Querés cancelar este turno? El horario quedará disponible para otra persona."
        detail={
          <>
            <div className="fw-semibold text-dark">{pacienteNombre}</div>
            <div className="text-muted small mt-1">
              {dt.fechaCorta} — {dt.horaInicio} · <span className="font-monospace">Ref. #{shortRef}</span>
            </div>
            <label className="form-label w-100 mt-3">
              Motivo de cancelación <span className="text-danger">*</span>
              <textarea
                className="form-control mt-1"
                required
                minLength={3}
                maxLength={2000}
                placeholder="Indique el motivo por el cual se cancela el turno..."
                value={cancelReason}
                disabled={changingStatus}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </label>
            {error && <div className="alert alert-danger mb-0 mt-2" role="alert">{error}</div>}
          </>
        }
        confirmText="Cancelar turno"
        variant="danger"
        icon="bi-x-circle"
        loading={changingStatus}
        onClose={() => {
          setCancelOpen(false);
          setError('');
        }}
        onConfirm={() => void confirmCancel()}
      />

      <ConfirmationModal
        open={statusTarget !== null}
        title={statusModalInfo.title}
        message={statusModalInfo.message}
        detail={
          <>
            <div className="fw-semibold text-dark">{pacienteNombre}</div>
            <div className="text-muted small mt-1">
              {dt.fechaCorta} — {dt.horaInicio} · <span className="font-monospace">Ref. #{shortRef}</span>
            </div>
          </>
        }
        confirmText={statusModalInfo.confirmText}
        variant={statusModalInfo.variant}
        icon={statusModalInfo.icon}
        loading={changingStatus}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void confirmStatusChange()}
      />

      {/* Cabecera optimizada: título enfocado en paciente y referencia secundaria con copiado */}
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary mb-2.5 d-inline-flex align-items-center"
          onClick={() => navigate('/turnos')}
        >
          <i className="bi bi-arrow-left me-1.5" />
          Volver a turnos
        </button>

        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
          <div>
            <h2 className="fw-bold mb-1 text-dark">
              {pacienteNombre} — {dt.horaInicio}
            </h2>

            <div className="d-flex align-items-center gap-2.5 flex-wrap text-muted small">
              <span className="d-inline-flex align-items-center gap-1.5">
                <i className="bi bi-calendar-event text-success" />
                <span>{dt.fechaCompleta}</span>
              </span>

              <span className="text-secondary opacity-50">•</span>

              <span className="d-inline-flex align-items-center gap-1">
                <span className="text-secondary">Código de turno:</span>
                <strong className="text-dark font-monospace">#{shortRef}</strong>
                <button
                  type="button"
                  className="btn btn-link text-secondary p-0 ms-1 border-0"
                  style={{ fontSize: '0.85rem', lineHeight: 1 }}
                  onClick={() => void handleCopyCode(`#${shortRef}`)}
                  title={`Copiar código #${shortRef}\nUUID completo: ${turno.codigo_turno || turno.id_turno}`}
                  aria-label="Copiar código de turno"
                >
                  <i className={copiedCode ? "bi bi-check2 text-success" : "bi bi-copy"} />
                </button>
                {copiedCode && (
                  <span className="badge bg-success-subtle text-success small ms-1 py-0.5 px-1.5" style={{ fontSize: '0.7rem' }}>
                    ¡Copiado!
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <ConnectionStatusBadge />
            <span className={getEstadoClass(turno.estado.codigo)}>
              {turno.estado.nombre}
            </span>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-8">
          {/* Tarjeta de Información del turno: grid compacto con espaciado vertical reducido */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white py-2 px-3 border-bottom">
              <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                <i className="bi bi-calendar-event text-success" />
                Información del turno
              </h6>
            </div>

            <div className="card-body p-0">
              <div className="turno-detail-grid-compact">
                <div>
                  <span>Fecha y hora</span>
                  <strong>{dt.fechaCorta} — {dt.horaInicio}</strong>
                </div>

                <div>
                  <span>Finalización estimada</span>
                  <strong>{dt.horaFin ? `${dt.fechaCorta} — ${dt.horaFin}` : 'No especificada'}</strong>
                </div>

                <div>
                  <span>Paciente</span>
                  <strong>{pacienteNombre}</strong>
                  <small>DNI {turno.paciente.persona.dni}</small>
                </div>

                <div>
                  <span>Profesional</span>
                  <strong>
                    {turno.profesional.persona.apellidos}, {turno.profesional.persona.nombres}
                  </strong>
                  <small>Matrícula {turno.profesional.matricula}</small>
                </div>

                <div>
                  <span>Especialidad</span>
                  <strong>{turno.especialidad.nombre}</strong>
                </div>

                <div>
                  <span>Salita</span>
                  <strong>{turno.salita.nombre}</strong>
                  {turno.salita.direccion && (
                    <small>{turno.salita.direccion}</small>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta de Consulta médica: compacta, agrupando motivo y observaciones sin espacio vacío desperdiciado */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-2 px-3 border-bottom">
              <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                <i className="bi bi-chat-left-text text-success" />
                Consulta médica y observaciones
              </h6>
            </div>

            <div className="card-body p-3">
              <div className="row g-3">
                <div className={turno.observaciones ? 'col-md-6' : 'col-12'}>
                  <span className="text-secondary small fw-bold text-uppercase d-block" style={{ fontSize: '0.73rem', letterSpacing: '0.4px' }}>
                    Motivo de consulta médica
                  </span>
                  <p className="mb-0 text-dark fw-medium mt-0.5">
                    {turno.motivo_consulta || 'Sin motivo de consulta informado.'}
                  </p>
                </div>

                {turno.observaciones && (
                  <div className="col-md-6 border-start-md ps-md-3">
                    <span className="text-secondary small fw-bold text-uppercase d-block" style={{ fontSize: '0.73rem', letterSpacing: '0.4px' }}>
                      Observaciones del turno
                    </span>
                    <p className="mb-0 text-dark fw-medium mt-0.5">
                      {turno.observaciones}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white py-2 px-3 border-bottom">
              <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                <i className="bi bi-lightning text-success" />
                Acciones
              </h6>
            </div>

            <div className="card-body p-3 d-flex flex-column gap-2">
              {!isFinal && (
                <>
                  {turno.estado.codigo === 'SOLICITADO' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center"
                      disabled={changingStatus}
                      onClick={() => void handleStatusChange('CONFIRMADO')}
                    >
                      <i className="bi bi-check-circle me-1.5" />
                      Confirmar turno
                    </button>
                  )}

                  {turno.estado.codigo !== 'EN_ESPERA' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center justify-content-center"
                      disabled={changingStatus}
                      onClick={() => void handleStatusChange('EN_ESPERA')}
                    >
                      <i className="bi bi-hourglass-split me-1.5 text-warning" />
                      Pasar a espera
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center"
                    disabled={changingStatus}
                    onClick={() => void handleStatusChange('NO_ASISTIO')}
                  >
                    <i className="bi bi-person-x me-1.5" />
                    Registrar inasistencia
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center"
                    disabled={changingStatus}
                    onClick={handleReprogramar}
                  >
                    <i className="bi bi-calendar2-week me-1.5" />
                    Reprogramar turno
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center"
                    disabled={changingStatus}
                    onClick={() => void handleCancel()}
                  >
                    <i className="bi bi-x-circle me-1.5" />
                    Cancelar turno
                  </button>
                </>
              )}

              {isFinal && (
                <div className="turno-final-message py-2.5 px-3">
                  <i className="bi bi-lock me-2 text-secondary" />
                  Este turno tiene un estado final y no admite modificaciones.
                </div>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-2 px-3 border-bottom">
              <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                <i className="bi bi-info-circle text-success" />
                Estado del turno
              </h6>
            </div>

            <div className="card-body p-3">
              <div className="turno-state-card">
                <span className={getEstadoClass(turno.estado.codigo)}>
                  {turno.estado.nombre}
                </span>

                <p className="text-muted mb-0 mt-2.5 small">
                  {turno.estado.es_estado_final
                    ? 'El estado actual es final (no admite más transiciones).'
                    : 'El turno se encuentra activo y puede ser modificado según el flujo de atención.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TurnoDetallePage;