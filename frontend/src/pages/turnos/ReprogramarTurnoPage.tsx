import ValidatedInput from '../../components/ui/ValidatedInput';
import { authError } from '../../utils/auth-errors';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import ConfirmationModal from '../../components/ui/ConfirmationModal';

import {
  getProfessionals,
  getProfessionalClinics,
  getProfessionalSpecialties,
} from '../../services/profesionales.service';

import {
  getDisponibilidad,
  getTurnoById,
} from '../../services/turnos.service';

import {
  reprogramarTurno,
} from '../../services/reprogramacion.service';

import type {
  Professional,
  ProfessionalClinic,
  ProfessionalSpecialty,
} from '../../types/profesional.types';

import type {
  DisponibilidadResponse,
  DisponibilidadSlot,
  Turno,
} from '../../types/turno.types';

const getToday = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const formatDateTime = (
  value: string,
) => {
  return new Date(value).toLocaleString(
    'es-AR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  );
};

const ReprogramarTurnoPage = () => {
  const { id } = useParams<{
    id: string;
  }>();

  const navigate = useNavigate();

  const [turno, setTurno] =
    useState<Turno | null>(null);

  const [professionals, setProfessionals] =
    useState<Professional[]>([]);

  const [professionalSpecialties, setProfessionalSpecialties] =
    useState<ProfessionalSpecialty[]>([]);

  const [professionalClinics, setProfessionalClinics] =
    useState<ProfessionalClinic[]>([]);

  const [selectedProfessional, setSelectedProfessional] =
    useState('');

  const [selectedSpecialty, setSelectedSpecialty] =
    useState('');

  const [selectedSalita, setSelectedSalita] =
    useState('');

  const [fecha, setFecha] =
    useState('');

  const [selectedSlot, setSelectedSlot] =
    useState<DisponibilidadSlot | null>(null);

  const [availability, setAvailability] =
    useState<DisponibilidadResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingRelations, setLoadingRelations] =
    useState(false);

  const [loadingAvailability, setLoadingAvailability] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [confirmOpen, setConfirmOpen] =
    useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!id) {
      setError(
        'No se recibió el identificador del turno.',
      );

      setLoading(false);

      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [
          turnoResponse,
          professionalsResponse,
        ] = await Promise.all([
          getTurnoById(id),
          getProfessionals(),
        ]);

        const currentTurno =
          turnoResponse.data.turno;

        setTurno(currentTurno);

        setProfessionals(
          professionalsResponse.data.filter(
            (item) => item.activo,
          ),
        );

        setSelectedProfessional(
          currentTurno.id_profesional,
        );

        setSelectedSpecialty(
          currentTurno.id_especialidad,
        );

        setSelectedSalita(
          currentTurno.id_salita,
        );

        setFecha(
          currentTurno.fecha_hora_inicio.substring(
            0,
            10,
          ),
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

    void loadData();
  }, [id]);

  useEffect(() => {
    if (!selectedProfessional) {
      setProfessionalSpecialties([]);
      setProfessionalClinics([]);
      return;
    }

    const loadRelations = async () => {
      try {
        setLoadingRelations(true);
        setError('');

        const [
          specialtiesResponse,
          clinicsResponse,
        ] = await Promise.all([
          getProfessionalSpecialties(
            selectedProfessional,
          ),
          getProfessionalClinics(
            selectedProfessional,
          ),
        ]);

        setProfessionalSpecialties(
          specialtiesResponse.data.filter(
            (item) =>
              item.activo &&
              item.especialidad.activo,
          ),
        );

        setProfessionalClinics(
          clinicsResponse.data.filter(
            (item) =>
              item.activo &&
              item.salita.activo,
          ),
        );
      } catch (error) {
        console.error(error);

        setError(
          'No se pudieron cargar las especialidades y salitas del profesional.',
        );
      } finally {
        setLoadingRelations(false);
      }
    };

    void loadRelations();
  }, [selectedProfessional]);

  useEffect(() => {
    setSelectedSlot(null);
    setAvailability(null);

    if (
      !fecha ||
      !selectedProfessional ||
      !selectedSpecialty ||
      !selectedSalita
    ) {
      return;
    }

    const loadAvailability = async () => {
      try {
        setLoadingAvailability(true);
        setError('');

        const response =
          await getDisponibilidad(
            fecha,
            selectedProfessional,
            selectedSpecialty,
            selectedSalita,
            undefined,
            id,
          );

        setAvailability(response);
      } catch (error) {
        console.error(error);

        setError(
          'No se pudo consultar la disponibilidad.',
        );
      } finally {
        setLoadingAvailability(false);
      }
    };

    void loadAvailability();
  }, [
    id,
    fecha,
    selectedProfessional,
    selectedSpecialty,
    selectedSalita,
  ]);

  const availableSlots = useMemo(
    () =>
      availability?.slots.filter(
        (slot) =>
          slot.estado === 'DISPONIBLE',
      ) ?? [],
    [availability],
  );

  const handleProfessionalChange = (
    value: string,
  ) => {
    setSelectedProfessional(value);

    setSelectedSpecialty('');
    setSelectedSalita('');
    setSelectedSlot(null);
    setAvailability(null);
  };

  const handleSpecialtyChange = (
    value: string,
  ) => {
    setSelectedSpecialty(value);

    setSelectedSlot(null);
    setAvailability(null);
  };

  const handleSalitaChange = (
    value: string,
  ) => {
    setSelectedSalita(value);

    setSelectedSlot(null);
    setAvailability(null);
  };

  const handleDateChange = (
    value: string,
  ) => {
    setFecha(value);

    setSelectedSlot(null);
    setAvailability(null);
  };

  const handleSubmit = async (
    event?: React.FormEvent<HTMLFormElement>,
  ) => {
    event?.preventDefault();

    if (!id || !turno) {
      return;
    }

    if (
      !selectedProfessional ||
      !selectedSpecialty ||
      !selectedSalita ||
      !fecha ||
      !selectedSlot || motivo.trim().length < 3
    ) {
      setError(
        'Seleccione profesional, especialidad, salita, fecha, horario e indique un motivo.',
      );

      return;
    }

    try {
      setSaving(true);
      setError('');

      const fechaHoraInicio =
        `${fecha}T${selectedSlot.hora_inicio}:00-03:00`;

      await reprogramarTurno(id, {
        motivo_reprogramacion: motivo.trim(),
        version: turno.version,
        id_profesional:
          selectedProfessional,

        id_especialidad:
          selectedSpecialty,

        id_salita:
          selectedSalita,

        fecha_hora_inicio:
          fechaHoraInicio,
      });

      navigate(`/turnos/${id}`, {
        replace: true,
        state: {
          message:
            'Turno reprogramado correctamente.',
        },
      });
    } catch (error) {
      console.error(error);

      setError(
        authError(error),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div
          className="spinner-border text-success"
          role="status"
        >
          <span className="visually-hidden">
            Cargando...
          </span>
        </div>
      </div>
    );
  }

  if (!turno) {
    return (
      <div className="turnos-page">
        <div className="alert alert-danger">
          {error ||
            'No se encontró el turno.'}
        </div>

        <button
          type="button"
          className="btn btn-saps"
          onClick={() =>
            navigate('/turnos')
          }
        >
          Volver a turnos
        </button>
      </div>
    );
  }

  return (
    <div className="turnos-page">
      <ConfirmationModal
        open={confirmOpen}
        title="Confirmar reprogramación"
        message="¿Querés cambiar la fecha y el horario de este turno?"
        detail={
          <>
            <div className="fw-semibold">Turno {turno.codigo_turno}</div>
            <div className="text-muted small mt-1">
              Nuevo horario: {fecha} · {selectedSlot?.hora_inicio} - {selectedSlot?.hora_fin}
            </div>
          </>
        }
        confirmText="Reprogramar turno"
        variant="warning"
        icon="bi-calendar2-week"
        loading={saving}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void handleSubmit();
        }}
      />

      <div className="mb-4">
        <button
          type="button"
          className="btn btn-link text-decoration-none p-0 mb-3"
          onClick={() =>
            navigate(`/turnos/${id}`)
          }
        >
          <i className="bi bi-arrow-left me-2" />
          Volver al turno
        </button>

        <h2 className="fw-bold mb-1">
          Reprogramar turno
        </h2>

        <p className="text-muted mb-0">
          Seleccione la nueva fecha y
          horario del turno.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2" />
          {error}
        </div>
      )}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3">
          <h5 className="mb-0 fw-bold">
            <i className="bi bi-info-circle me-2 text-success" />
            Turno actual
          </h5>
        </div>

        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <small className="text-muted d-block">
                Código
              </small>

              <strong>
                {turno.codigo_turno}
              </strong>
            </div>

            <div className="col-md-3">
              <small className="text-muted d-block">
                Paciente
              </small>

              <strong>
                {turno.paciente.persona.apellidos}
                ,{' '}
                {turno.paciente.persona.nombres}
              </strong>
            </div>

            <div className="col-md-3">
              <small className="text-muted d-block">
                Fecha actual
              </small>

              <strong>
                {formatDateTime(
                  turno.fecha_hora_inicio,
                )}
              </strong>
            </div>

            <div className="col-md-3">
              <small className="text-muted d-block">
                Estado
              </small>

              <span className="turno-badge">
                {turno.estado.nombre}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={(event) => {
        event.preventDefault();
        setConfirmOpen(true);
      }}>
        <div className="row g-4">
          <div className="col-xl-7">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-calendar-event me-2 text-success" />
                  Nueva agenda
                </h5>
              </div>

              <div className="card-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">
                      Profesional *
                    </label>

                    <select
                      className="form-select"
                      value={
                        selectedProfessional
                      }
                      onChange={(event) =>
                        handleProfessionalChange(
                          event.target.value,
                        )
                      }
                      required
                    >
                      <option value="">
                        Seleccionar profesional
                      </option>

                      {professionals.map(
                        (professional) => (
                          <option
                            key={
                              professional.id_profesional
                            }
                            value={
                              professional.id_profesional
                            }
                          >
                            {
                              professional
                                .persona
                                .apellidos
                            }
                            ,{' '}
                            {
                              professional
                                .persona
                                .nombres
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Especialidad *
                    </label>

                    <select
                      className="form-select"
                      value={
                        selectedSpecialty
                      }
                      onChange={(event) =>
                        handleSpecialtyChange(
                          event.target.value,
                        )
                      }
                      disabled={
                        !selectedProfessional ||
                        loadingRelations
                      }
                      required
                    >
                      <option value="">
                        {loadingRelations
                          ? 'Cargando...'
                          : 'Seleccionar especialidad'}
                      </option>

                      {professionalSpecialties.map(
                        (item) => (
                          <option
                            key={
                              item.id_especialidad
                            }
                            value={
                              item.id_especialidad
                            }
                          >
                            {
                              item
                                .especialidad
                                .nombre
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Salita *
                    </label>

                    <select
                      className="form-select"
                      value={
                        selectedSalita
                      }
                      onChange={(event) =>
                        handleSalitaChange(
                          event.target.value,
                        )
                      }
                      disabled={
                        !selectedProfessional ||
                        loadingRelations
                      }
                      required
                    >
                      <option value="">
                        {loadingRelations
                          ? 'Cargando...'
                          : 'Seleccionar salita'}
                      </option>

                      {professionalClinics.map(
                        (item) => (
                          <option
                            key={
                              item.id_salita
                            }
                            value={
                              item.id_salita
                            }
                          >
                            {
                              item
                                .salita
                                .nombre
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label">
                      Nueva fecha *
                    </label>

                    <ValidatedInput
                      type="date"
                      className="form-control"
                      value={fecha}
                      min={getToday()}
                      onChange={(event) =>
                        handleDateChange(
                          event.target.value,
                        )
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-clock me-2 text-success" />
                  Horarios disponibles
                </h5>
              </div>

              <div className="card-body">
                {!fecha ||
                !selectedProfessional ||
                !selectedSpecialty ||
                !selectedSalita ? (
                  <div className="turno-availability-empty">
                    <i className="bi bi-calendar2-week" />

                    <p className="mb-0">
                      Complete los datos para
                      consultar los horarios.
                    </p>
                  </div>
                ) : loadingAvailability ? (
                  <div className="text-center py-5">
                    <div
                      className="spinner-border text-success"
                      role="status"
                    >
                      <span className="visually-hidden">
                        Consultando...
                      </span>
                    </div>

                    <p className="text-muted mt-3 mb-0">
                      Consultando disponibilidad...
                    </p>
                  </div>
                ) : availableSlots.length ===
                  0 ? (
                  <div className="turno-availability-empty">
                    <i className="bi bi-calendar-x" />

                    <h6>
                      Sin horarios disponibles
                    </h6>

                    <p className="text-muted mb-0">
                      No hay horarios disponibles
                      para esta selección.
                    </p>
                  </div>
                ) : (
                  <div className="turno-slots">
                    {availableSlots.map(
                      (slot) => {
                        const selected =
                          selectedSlot?.hora_inicio ===
                            slot.hora_inicio &&
                          selectedSlot?.hora_fin ===
                            slot.hora_fin;

                        return (
                          <button
                            key={`${slot.hora_inicio}-${slot.hora_fin}`}
                            type="button"
                            className={`turno-slot ${
                              selected
                                ? 'turno-slot-selected'
                                : ''
                            }`}
                            onClick={() =>
                              setSelectedSlot(
                                slot,
                              )
                            }
                          >
                            <i className="bi bi-clock me-2" />

                            <strong>
                              {
                                slot.hora_inicio
                              }
                            </strong>

                            <span>
                              {' '}
                              a{' '}
                              {
                                slot.hora_fin
                              }
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                )}

                {selectedSlot && (
                  <div className="turno-selected-slot mt-3">
                    <i className="bi bi-check-circle-fill me-2" />

                    Nuevo horario:{' '}
                    <strong>
                      {
                        selectedSlot.hora_inicio
                      }{' '}
                      -{' '}
                      {
                        selectedSlot.hora_fin
                      }
                    </strong>
                  </div>
                )}
              </div>

              <div className="card-footer bg-white border-0">
                <label className="form-label w-100">Motivo interno de la reprogramación
                  <textarea className="form-control" required minLength={3} maxLength={500} rows={2}
                    disabled={saving} value={motivo} onChange={event => setMotivo(event.target.value)} />
                  <span className="form-text">Se registra en el historial administrativo y no se envía al paciente.</span>
                </label>
                <button
                  type="submit"
                  className="btn btn-saps w-100"
                  disabled={
                    saving ||
                    !selectedSlot || motivo.trim().length < 3
                  }
                >
                  {saving ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      />

                      Reprogramando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-calendar-check me-2" />
                      Confirmar reprogramación
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ReprogramarTurnoPage;
