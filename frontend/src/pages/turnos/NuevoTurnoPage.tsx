import { getParametros } from '../../services/configuracion.service';
import type { Parametro } from '../../types/configuracion.types';
import ValidatedInput from '../../components/ui/ValidatedInput';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { ActionInlineFeedback, FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { focusFieldById, focusFirstInvalidControl } from '../../utils/form-feedback';

import {
  getPatients,
} from '../../services/patients.service';

import {
  getProfessionals,
  getProfessionalClinics,
  getProfessionalSpecialties,
} from '../../services/profesionales.service';

import {
  createTurno,
  getDisponibilidad,
} from '../../services/turnos.service';

import type {
  Patient,
  PatientPagination,
} from '../../types/patient.types';

import type {
  Professional,
  ProfessionalClinic,
  ProfessionalSpecialty,
} from '../../types/profesional.types';

import type {
  DisponibilidadResponse,
  DisponibilidadSlot,
} from '../../types/turno.types';

const getToday = () => {
  const date =
    new Date();

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),
    String(
      date.getDate(),
    ).padStart(2, '0'),
  ].join('-');
};

// Obtiene la fecha actual usando explícitamente la zona horaria de Argentina.
const getArgentinaToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const isSlotInFuture = (
  date: string,
  slot: DisponibilidadSlot,
  now: number,
) => {
  // Para fechas futuras, los horarios no están vencidos.
  if (date > getArgentinaToday()) return true;
  if (date < getArgentinaToday()) return false;

  // Acepta HH:mm y HH:mm:ss y compara usando la hora argentina (UTC-03:00).
  const hora = slot.hora_inicio;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) return false;

  const horaCompleta = hora.length === 5 ? `${hora}:00` : hora;
  const slotStart = new Date(`${date}T${horaCompleta}-03:00`).getTime();
  return Number.isFinite(slotStart) && slotStart > now;
};

const NuevoTurnoPage = () => {
  const navigate =
    useNavigate();

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [professionals, setProfessionals] =
    useState<Professional[]>([]);

  const [relations, setRelations] = useState<Record<string, {
    specialties: ProfessionalSpecialty[]; clinics: ProfessionalClinic[];
  }>>({});
  const [clinicSettings, setClinicSettings] = useState<Parametro[]>([]);

  const [selectedPatientDetails, setSelectedPatientDetails] = useState<Patient | null>(null);
  const selectedPatient = selectedPatientDetails?.id_paciente ?? '';
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPage, setPatientPage] = useState(1);
  const [patientPagination, setPatientPagination] = useState<PatientPagination | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState('');
  const [patientRetry, setPatientRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setPatients([]);
    setPatientPagination(null);
    setPatientError('');
    setLoadingPatients(false);

    if (!patientSearch.trim() || selectedPatient) return;

    setLoadingPatients(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await getPatients(patientPage, 20, patientSearch.trim(), 'activo');
        if (!active) return;
        setPatients(response.data.patients);
        setPatientPagination(response.data.pagination);
      } catch {
        if (active) setPatientError('No pudimos buscar pacientes.');
      } finally {
        if (active) setLoadingPatients(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [patientSearch, patientPage, patientRetry, selectedPatient]);

  const [selectedProfessional, setSelectedProfessional] =
    useState('');

  const [selectedSpecialty, setSelectedSpecialty] =
    useState('');

  const [selectedSalita, setSelectedSalita] =
    useState('');

  const [fecha, setFecha] =
    useState(getToday());

  const [selectedSlot, setSelectedSlot] =
    useState<DisponibilidadSlot | null>(
      null,
    );

  const [motivoConsulta, setMotivoConsulta] =
    useState('');

  const [observaciones, setObservaciones] =
    useState('');

  const [availability, setAvailability] =
    useState<DisponibilidadResponse | null>(
      null,
    );

  // La pantalla puede mostrarse mientras se cargan las relaciones.
  const [loadingInitial, setLoadingInitial] =
    useState(true);

  const [loadingRelations, setLoadingRelations] =
    useState(true);

  const [loadingAvailability, setLoadingAvailability] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  // Actualiza la lista si la página queda abierta y un horario vence.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoadingInitial(true);
      setLoadingRelations(true);
      setError('');

      try {
        // Cargar primero los datos base para que la pantalla no espere
        // a que terminen todas las consultas de relaciones.
        const [professionalResponse, settings] = await Promise.all([
          getProfessionals(),
          getParametros(),
        ]);

        if (!active) return;

        const available = professionalResponse.data.filter((item) => item.activo);
        setProfessionals(available);
        setClinicSettings(settings.filter((item) => item.clave === 'salita.especialidades'));
        setLoadingInitial(false);

        // Cargar las relaciones en paralelo, sin bloquear el render inicial.
        const entries = await Promise.all(available.map(async (professional) => {
          const [specialties, clinics] = await Promise.all([
            getProfessionalSpecialties(professional.id_profesional),
            getProfessionalClinics(professional.id_profesional),
          ]);

          return [
            professional.id_profesional,
            { specialties: specialties.data, clinics: clinics.data },
          ] as const;
        }));

        if (!active) return;
        setRelations(Object.fromEntries(entries));
      } catch (loadError) {
        console.error('Error cargando datos para crear turno:', loadError);
        if (active) {
          setError('No se pudieron cargar todos los datos necesarios para crear el turno.');
        }
      } finally {
        if (active) {
          setLoadingInitial(false);
          setLoadingRelations(false);
        }
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  const current = (item: { activo: boolean; fecha_desde: string; fecha_hasta: string | null }) =>
    item.activo && item.fecha_desde <= fecha && (!item.fecha_hasta || item.fecha_hasta >= fecha);
  const offers = (clinic: string, specialty: string) => {
    const setting = clinicSettings.find((item) => item.id_salita === clinic);
    return !setting || (Array.isArray(setting.valor) && setting.valor.includes(specialty));
  };
  const eligibleSpecialties = (id: string) => {
    const relation = relations[id];
    return relation?.specialties.filter((item) => current(item) && item.especialidad.activo &&
      relation.clinics.some((clinic) => current(clinic) && clinic.salita.activo && offers(clinic.id_salita, item.id_especialidad))) ?? [];
  };
  const professionalSpecialties = [...new Map(professionals.flatMap((professional) =>
    eligibleSpecialties(professional.id_profesional)).map((item) => [item.id_especialidad, item])).values()];
  const eligibleProfessionals = professionals.filter((professional) =>
    eligibleSpecialties(professional.id_profesional).some((item) => item.id_especialidad === selectedSpecialty));
  const professionalClinics = relations[selectedProfessional]?.clinics.filter((clinic) =>
    current(clinic) && clinic.salita.activo && offers(clinic.id_salita, selectedSpecialty)) ?? [];

  // Al cambiar la fecha, conservar las selecciones que sigan siendo válidas.
  // Solo limpiar la selección que ya no esté habilitada para ese día y sus dependencias.
  useEffect(() => {
    if (
      selectedSpecialty &&
      !professionalSpecialties.some(
        (item) => item.id_especialidad === selectedSpecialty,
      )
    ) {
      setSelectedSpecialty('');
      setSelectedProfessional('');
      setSelectedSalita('');
      return;
    }

    if (
      selectedProfessional &&
      !eligibleProfessionals.some(
        (item) => item.id_profesional === selectedProfessional,
      )
    ) {
      setSelectedProfessional('');
      setSelectedSalita('');
      return;
    }

    if (
      selectedSalita &&
      !professionalClinics.some(
        (item) => item.id_salita === selectedSalita,
      )
    ) {
      setSelectedSalita('');
    } else if (!selectedSalita && professionalClinics.length === 1) {
      setSelectedSalita(professionalClinics[0].id_salita);
    }
  }, [
    fecha,
    selectedSpecialty,
    selectedProfessional,
    selectedSalita,
    professionalSpecialties,
    eligibleProfessionals,
    professionalClinics,
  ]);

  useEffect(() => {
    let active = true;
    setLoadingAvailability(false);
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

    const loadAvailability =
      async () => {
        try {
          setLoadingAvailability(
            true,
          );
          setError('');

          const response =
            await getDisponibilidad(
              fecha,
              selectedProfessional,
              selectedSpecialty,
              selectedSalita,
            );

          if (active) setAvailability(response);
        } catch (error) {
          console.error(error);

          if (active) setError('No se pudo consultar la disponibilidad.');
        } finally {
          if (active) setLoadingAvailability(false);
        }
      };

    void loadAvailability();
    return () => { active = false; };
  }, [
    fecha,
    selectedProfessional,
    selectedSpecialty,
    selectedSalita,
  ]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setMessage('');
        },
        3500,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [message]);

  const availableSlots =
    useMemo(
      () =>
        availability?.slots.filter(
          (slot) =>
            slot.estado === 'DISPONIBLE' &&
            isSlotInFuture(fecha, slot, now),
        ) ?? [],
      [availability, fecha, now],
    );

  useEffect(() => {
    if (selectedSlot && !isSlotInFuture(fecha, selectedSlot, now)) {
      setSelectedSlot(null);
      setError('El horario seleccionado ya pasó. Elegí uno futuro.');
    }
  }, [fecha, now, selectedSlot]);

  const handleSubmit =
    async (
      event?: React.FormEvent<HTMLFormElement>,
    ) => {
      event?.preventDefault();

      if (
        !selectedPatient ||
        !selectedProfessional ||
        !selectedSpecialty ||
        !selectedSalita ||
        !fecha ||
        !selectedSlot
      ) {
        setError(
          'Complete todos los datos obligatorios y seleccione un horario disponible.',
        );
        return;
      }

      // Segunda comprobación en el cliente: evita confirmar un horario
      // que venció mientras el formulario o el modal estaban abiertos.
      if (!isSlotInFuture(fecha, selectedSlot, Date.now())) {
        setSelectedSlot(null);
        setConfirmOpen(false);
        setError('Ese horario ya pasó y no está disponible. Seleccione un horario futuro.');
        return;
      }

      try {
        setSaving(true);
        setError('');

        const fechaHoraInicio =
          `${fecha}T${selectedSlot.hora_inicio}:00-03:00`;

        await createTurno({
          id_paciente:
            selectedPatient,
          id_profesional:
            selectedProfessional,
          id_especialidad:
            selectedSpecialty,
          id_salita:
            selectedSalita,
          fecha_hora_inicio:
            fechaHoraInicio,
          motivo_consulta:
            motivoConsulta.trim() ||
            null,
          observaciones:
            observaciones.trim() ||
            null,
        });

        setMessage(
          'Turno creado correctamente.',
        );

        setTimeout(() => {
          navigate(
            '/turnos',
            {
              replace: true,
            },
          );
        }, 500);
      } catch (error) {
        console.error(error);

        setError(
          'No se pudo crear el turno. El horario puede haber sido ocupado o no cumplir las reglas de agenda.',
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="turnos-page">
      <ConfirmationModal
        open={confirmOpen}
        title="Confirmar turno"
        message="¿Querés registrar este turno?"
        detail={
          <>
            <div className="fw-semibold">
              {selectedPatientDetails?.apellidos}, {selectedPatientDetails?.nombres}
            </div>
            <div className="text-muted small mt-1">
              {fecha} · {selectedSlot?.hora_inicio} - {selectedSlot?.hora_fin}
            </div>
            <div className="text-muted small">
              {professionals.find((professional) => professional.id_profesional === selectedProfessional)?.persona.apellidos}, {professionals.find((professional) => professional.id_profesional === selectedProfessional)?.persona.nombres}
              {' · '}{professionalSpecialties.find((item) => item.id_especialidad === selectedSpecialty)?.especialidad.nombre}
              {' · '}{professionalClinics.find((item) => item.id_salita === selectedSalita)?.salita.nombre}
            </div>
          </>
        }
        confirmText="Crear turno"
        variant="primary"
        icon="bi-calendar-check"
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
          className="btn btn-outline-secondary mb-3"
          onClick={() =>
            navigate('/turnos')
          }
        >
          <i className="bi bi-arrow-left me-2" />
          Volver a turnos
        </button>

        <h2 className="fw-bold mb-1">
          Nuevo turno
        </h2>

        <p className="text-muted mb-0">
          Seleccione paciente, especialidad,
          profesional, salita y horario.
        </p>
      </div>

      {message && (
        <FloatingFeedbackToast
          variant="success"
          message={message}
          onDismiss={() => setMessage('')}
        />
      )}

      {loadingInitial && (
        <div className="alert alert-light border d-flex align-items-center gap-2" role="status">
          <span className="spinner-border spinner-border-sm text-success" aria-hidden="true" />
          Cargando datos del formulario...
        </div>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          if (!selectedPatient) {
            setError('Seleccioná un paciente de los resultados de búsqueda.');
            focusFieldById('turno-paciente-search', 30);
            return;
          }
          if (!event.currentTarget.checkValidity()) {
            const invalidEl = focusFirstInvalidControl(event.currentTarget);
            const fallbackMsg =
              (invalidEl instanceof HTMLInputElement ||
                invalidEl instanceof HTMLSelectElement ||
                invalidEl instanceof HTMLTextAreaElement) &&
              invalidEl.validationMessage
                ? invalidEl.validationMessage
                : 'Completá los campos obligatorios resaltados.';
            setError(fallbackMsg);
            return;
          }
          setConfirmOpen(true);
        }}
      >
        <div className="row g-4">
          <div className="col-xl-7">
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-calendar-check me-2 text-success" />
                  Datos del turno
                </h5>
              </div>

              <div className="card-body">
                <div className="row g-3">
                  <div className="col-12">
                    {selectedPatientDetails ? (
                      <div className="border rounded p-3">
                        <div className="small text-muted">Paciente seleccionado</div>
                        <div className="fw-semibold text-break">
                          {selectedPatientDetails.apellidos}, {selectedPatientDetails.nombres}
                        </div>
                        <div>DNI {selectedPatientDetails.dni}</div>
                        <button type="button" className="btn btn-outline-secondary btn-sm mt-2"
                          onClick={() => setSelectedPatientDetails(null)}>
                          Cambiar paciente
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="form-label" htmlFor="turno-paciente-search">Paciente *</label>
                        <input id="turno-paciente-search" type="search" className="form-control"
                          placeholder="DNI, nombre o apellido..." autoComplete="off" maxLength={150}
                          value={patientSearch} aria-describedby="turno-paciente-status"
                          onChange={(event) => {
                            setPatientSearch(event.target.value);
                            setPatientPage(1);
                            setPatients([]);
                            setPatientPagination(null);
                            setPatientError('');
                            setLoadingPatients(Boolean(event.target.value.trim()));
                          }} />
                        <div id="turno-paciente-status" className="small text-muted mt-2" role="status">
                          {!patientSearch.trim()
                            ? 'Buscá un paciente por DNI, nombre o apellido.'
                            : loadingPatients
                              ? 'Buscando pacientes...'
                              : !patientError && patients.length === 0
                                ? 'No encontramos pacientes con esos datos.'
                                : patientPagination
                                  ? `${patientPagination.total} pacientes encontrados`
                                  : ''}
                        </div>
                        {patientError && (
                          <div className="alert alert-danger mt-2" role="alert">
                            {patientError}
                            <button type="button" className="btn btn-outline-danger btn-sm ms-2"
                              onClick={() => setPatientRetry((value) => value + 1)}>Reintentar</button>
                          </div>
                        )}
                        {!loadingPatients && !patientError && patients.length > 0 && (
                          <div className="list-group mt-2" aria-label="Resultados de pacientes">
                            {patients.map((patient) => (
                              <button key={patient.id_paciente} type="button"
                                className="list-group-item list-group-item-action text-break"
                                onClick={() => setSelectedPatientDetails(patient)}>
                                <span className="d-block fw-semibold">{patient.apellidos}, {patient.nombres}</span>
                                <span className="d-block small text-muted">DNI {patient.dni}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {!loadingPatients && patientPagination && patientPagination.totalPages > 1 && (
                          <nav className="d-flex flex-wrap align-items-center gap-2 mt-2" aria-label="Páginas de pacientes">
                            <button type="button" className="btn btn-outline-secondary btn-sm"
                              disabled={patientPage <= 1} onClick={() => {
                                setLoadingPatients(true);
                                setPatientPage((page) => page - 1);
                              }}>Anterior</button>
                            <span className="small">Página {patientPagination.page} de {patientPagination.totalPages}</span>
                            <button type="button" className="btn btn-outline-secondary btn-sm"
                              disabled={patientPage >= patientPagination.totalPages} onClick={() => {
                                setLoadingPatients(true);
                                setPatientPage((page) => page + 1);
                              }}>Siguiente</button>
                          </nav>
                        )}
                      </>
                    )}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label" htmlFor="turno-especialidad">Especialidad *</label>
                    <select id="turno-especialidad" className="form-select" value={selectedSpecialty}
                      disabled={loadingInitial || loadingRelations} required onChange={(event) => {
                        setSelectedSpecialty(event.target.value); setSelectedProfessional(''); setSelectedSalita('');
                        setSelectedSlot(null); setAvailability(null);
                      }}>
                      <option value="">Seleccionar especialidad</option>
                      {professionalSpecialties.map((item) => (
                        <option key={item.id_especialidad} value={item.id_especialidad}>{item.especialidad.nombre}</option>
                      ))}
                    </select>
                    {!loadingInitial && !professionalSpecialties.length && <p className="small text-muted">No hay especialidades con profesionales y salas habilitados para esta fecha.</p>}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="turno-profesional">Profesional *</label>
                    <select id="turno-profesional" className="form-select" value={selectedProfessional}
                      disabled={loadingInitial || loadingRelations || !selectedSpecialty} required onChange={(event) => {
                        setSelectedProfessional(event.target.value); setSelectedSalita('');
                        setSelectedSlot(null); setAvailability(null);
                      }}>
                      <option value="">{selectedSpecialty ? 'Seleccionar profesional' : 'Primero seleccionar especialidad'}</option>
                      {eligibleProfessionals.map((professional) => (
                        <option key={professional.id_profesional} value={professional.id_profesional}>
                          {professional.persona.apellidos}, {professional.persona.nombres}
                        </option>
                      ))}
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
                        setSelectedSalita(
                          event.target
                            .value,
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

                  <div className="col-md-6">
                    <label className="form-label">
                      Fecha *
                    </label>

                    <ValidatedInput
                      type="date"
                      className="form-control"
                      value={fecha}
                      min={getArgentinaToday()}
                      onChange={(event) =>
                        setFecha(
                          event.target
                            .value,
                        )
                      }
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">
                      Motivo de consulta
                    </label>

                    <textarea
                      className="form-control"
                      rows={3}
                      maxLength={2000}
                      value={
                        motivoConsulta
                      }
                      onChange={(event) =>
                        setMotivoConsulta(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Indique el motivo de la consulta..."
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">
                      Observaciones
                    </label>

                    <textarea
                      className="form-control"
                      rows={3}
                      maxLength={4000}
                      value={
                        observaciones
                      }
                      onChange={(event) =>
                        setObservaciones(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Observaciones adicionales..."
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
                {!selectedProfessional ||
                !selectedSpecialty ||
                !selectedSalita ||
                !fecha ? (
                  <div className="turno-availability-empty">
                    <i className="bi bi-calendar2-week" />

                    <p className="mb-0">
                      Complete especialidad,
                      profesional, salita y
                      fecha para consultar
                      disponibilidad.
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
                      Consultando
                      disponibilidad...
                    </p>
                  </div>
                ) : (availability?.slots.length ?? 0) === 0 ? (
                  <div className="turno-availability-empty">
                    <i className="bi bi-calendar-x" />

                    <h6>
                      Sin horarios disponibles
                    </h6>

                    <p className="text-muted mb-0">
                      {fecha === getArgentinaToday() &&
                      availability?.slots.some(
                        (slot) => slot.estado === 'BLOQUEADO' && slot.motivo === 'Horario pasado',
                      ) ? (
                        <>
                          No quedan horarios disponibles para hoy. Los horarios que ya comenzaron
                          no se pueden reservar. Elegí otra fecha para consultar próximos horarios.
                        </>
                      ) : (
                        <>
                          No hay horarios disponibles para los datos seleccionados. Probá con otra
                          fecha o verificá la disponibilidad del profesional.
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="turno-availability-summary mb-3">
                      <div>
                        <strong>
                          {availableSlots.length}
                        </strong>

                        <span>
                          disponibles
                        </span>
                      </div>

                      <div>
                        <strong>
                          {
                            availability
                              ?.resumen
                              .ocupados
                          }
                        </strong>

                        <span>
                          ocupados
                        </span>
                      </div>

                      <div>
                        <strong>
                          {
                            availability
                              ?.resumen
                              .bloqueados
                          }
                        </strong>

                        <span>
                          bloqueados
                        </span>
                      </div>
                    </div>

                    <div className="turno-slots">
                      {(availability?.slots ?? []).map((slot) => {
                        const isPast = !isSlotInFuture(fecha, slot, now);
                        const isSelectable =
                          slot.estado === 'DISPONIBLE' && !isPast;
                        const selected =
                          isSelectable &&
                          selectedSlot?.hora_inicio === slot.hora_inicio &&
                          selectedSlot?.hora_fin === slot.hora_fin;
                        const statusLabel = isPast
                          ? 'Horario pasado'
                          : slot.estado === 'OCUPADO'
                            ? 'Ocupado'
                            : slot.estado === 'BLOQUEADO'
                              ? slot.motivo === 'Cupo diario completo'
                                ? 'Cupo diario completo'
                                : slot.motivo || 'No disponible'
                              : 'Disponible';
                        const statusIcon = isPast
                          ? 'bi-lock-fill'
                          : slot.estado === 'OCUPADO'
                            ? 'bi-person-fill-lock'
                            : slot.estado === 'BLOQUEADO'
                              ? 'bi-lock-fill'
                              : 'bi-clock';

                        return (
                          <button
                            key={`${slot.hora_inicio}-${slot.hora_fin}`}
                            type="button"
                            disabled={!isSelectable}
                            aria-disabled={!isSelectable}
                            title={!isSelectable ? statusLabel : `Seleccionar ${slot.hora_inicio}`}
                            className={`turno-slot ${
                              selected
                                ? 'turno-slot-selected'
                                : ''
                            } ${!isSelectable ? 'turno-slot-disabled' : ''}`}
                            style={!isSelectable ? {
                              backgroundColor: '#f3f4f6',
                              borderColor: '#d1d5db',
                              color: '#7b8490',
                              cursor: 'not-allowed',
                              opacity: 0.82,
                            } : undefined}
                            onClick={() => {
                              if (isSelectable) setSelectedSlot(slot);
                            }}
                          >
                            <span className="d-flex align-items-center justify-content-center gap-2">
                              <i className={`bi ${statusIcon}`} />
                              <strong>{slot.hora_inicio}</strong>
                              <span>a {slot.hora_fin}</span>
                            </span>
                            <small
                              className="d-block mt-1"
                              style={{
                                color: isSelectable ? '#198754' : '#7b8490',
                                fontWeight: 400,
                              }}
                            >
                              {statusLabel}
                            </small>
                          </button>
                        );
                      })}
                    </div>

                    {selectedSlot && (
                      <div className="turno-selected-slot mt-3">
                        <i className="bi bi-check-circle-fill me-2" />

                        Horario seleccionado:{' '}
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
                  </>
                )}
              </div>

              <div className="card-footer bg-white border-0 d-flex flex-column gap-2">
                {error && (
                  <ActionInlineFeedback
                    variant="error"
                    message={error}
                    onDismiss={() => setError('')}
                  />
                )}
                <button
                  type="submit"
                  className="btn btn-saps w-100"
                  disabled={
                    saving ||
                    !selectedPatient ||
                    !selectedSlot
                  }
                >
                  {saving ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      />

                      Creando turno...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-calendar-check me-2" />
                      Confirmar turno
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

export default NuevoTurnoPage;
