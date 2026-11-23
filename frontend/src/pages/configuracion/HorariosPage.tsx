import AgendaImpactPanel from '../../components/turnos/AgendaImpactPanel';
import { isAgendaConflict, type AgendaChange } from '../../services/agenda-impacto.service';
import ValidatedInput from '../../components/ui/ValidatedInput';
import WeeklyScheduleFields from '../../components/profesionales/WeeklyScheduleFields';
import {
  newWeeklySlot,
  scheduleDays as days,
  type WeeklySlot,
} from '../../utils/weekly-schedule';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useSearchParams,
} from 'react-router-dom';

import {
  getHorarios,
  guardarHorario,
} from '../../services/configuracion.service';

import {
  getProfessionals,
  getProfessionalClinics,
  getProfessionalSpecialties,
} from '../../services/profesionales.service';

import { getAdminSalitas } from '../../services/salitas.service';
import { getSpecialties } from '../../services/especialidades.service';
import { getDisponibilidad } from '../../services/turnos.service';

import type {
  Horario,
  HorarioInput,
} from '../../types/configuracion.types';

import type {
  Professional,
  ProfessionalClinic,
  ProfessionalSpecialty,
  Specialty,
} from '../../types/profesional.types';

import type { Salita } from '../../types/salita.types';

import type {
  DisponibilidadResponse,
} from '../../types/turno.types';

import { authError } from '../../utils/auth-errors';

// Devuelve la fecha actual de Argentina.
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());

// Genera el estado inicial del formulario.
const initial = (id = ''): HorarioInput => ({
  id_profesional: id,
  id_salita: '',
  id_especialidad: '',
  dia_semana: 1,
  hora_inicio: '08:00',
  hora_fin: '12:00',
  duracion_turno_minutos: 20,
  cupo_maximo_diario: null,
  vigencia_desde: today(),
  vigencia_hasta: null,
  activo: true,
});

export default function HorariosPage() {
  const [params] = useSearchParams();

  // Profesional recibido desde la URL.
  const professionalFromUrl = params.get('profesional') ?? '';
  const openedFromProfessional = Boolean(professionalFromUrl);

  // Estado del formulario.
  const [form, setForm] = useState<HorarioInput>(() =>
    initial(professionalFromUrl)
  );

  const [editing, setEditing] = useState<string>();
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>(() => [newWeeklySlot(1)]);
  const [relationsProfessional, setRelationsProfessional] = useState('');

  // Datos principales.
  const [rows, setRows] = useState<Horario[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clinics, setClinics] = useState<Salita[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  // Asignaciones del profesional seleccionado.
  const [relations, setRelations] = useState<{
    clinics: ProfessionalClinic[];
    specialties: ProfessionalSpecialty[];
  }>({
    clinics: [],
    specialties: [],
  });

  // Estados generales de la pantalla.
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [relationLoading, setRelationLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState<AgendaChange | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);

  // Filtro del listado.
  const [filter, setFilter] = useState(
    professionalFromUrl
  );

  // Datos para consultar disponibilidad.
  const [date, setDate] = useState(today);

  const [availability, setAvailability] =
    useState<DisponibilidadResponse | null>(null);

  // Referencia para volver al formulario al editar.
  const formRef = useRef<HTMLFormElement>(null);

  // Profesional seleccionado.
  const selectedProfessional =
    professionals.find(
      (professional) =>
        professional.id_profesional === form.id_profesional
    ) ?? null;

  // Nombre legible del profesional seleccionado.
  const selectedProfessionalName = selectedProfessional
    ? `${selectedProfessional.persona.apellidos}, ${selectedProfessional.persona.nombres}`
    : '';

  // Carga horarios, profesionales, salitas y especialidades.
  useEffect(() => {
    let active = true;

    setLoading(true);
    setReady(false);
    setError('');

    void Promise.all([
      getHorarios(),
      getProfessionals(),
      getAdminSalitas(),
      getSpecialties(),
    ])
      .then(([h, p, c, s]) => {
        if (active) {
          setRows(h);
          setProfessionals(p.data);
          setClinics(c.data);
          setSpecialties(s.data);
          setReady(true);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(authError(cause));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [revision]);

  // Carga las salitas y especialidades asignadas al profesional.
  useEffect(() => {
    let active = true;

    setRelations({
      clinics: [],
      specialties: [],
    });
    setRelationsProfessional('');

    if (!form.id_profesional) {
      setRelationLoading(false);
      return;
    }

    setRelationLoading(true);

    void Promise.all([
      getProfessionalClinics(form.id_profesional),
      getProfessionalSpecialties(form.id_profesional),
    ])
      .then(([c, s]) => {
        if (active) {
          setRelations({
            clinics: c.data,
            specialties: s.data,
          });
          setRelationsProfessional(form.id_profesional);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(authError(cause));
        }
      })
      .finally(() => {
        if (active) {
          setRelationLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [form.id_profesional, revision]);

  // Si la página recibe un profesional desde la URL,
  // mantenemos ese profesional como filtro inicial.
  useEffect(() => {
    if (professionalFromUrl) {
      setFilter(professionalFromUrl);

      setForm((current) => {
        if (current.id_profesional === professionalFromUrl) {
          return current;
        }

        return {
          ...current,
          id_profesional: professionalFromUrl,
          id_salita: '',
          id_especialidad: '',
        };
      });
    }
  }, [professionalFromUrl]);

  // Actualiza parcialmente el formulario.
  // También limpia la consulta de disponibilidad anterior.
  const change = (patch: Partial<HorarioInput>) => {
    setForm((value) => ({
      ...value,
      ...patch,
    }));

    setAvailability(null);
  };

  // Comprueba si una asignación está vigente en una fecha.
  const validAt = (
    relation: {
      activo: boolean;
      fecha_desde: string;
      fecha_hasta: string | null;
    },
    dateValue: string
  ) =>
    relation.activo &&
    relation.fecha_desde <= dateValue &&
    (
      !relation.fecha_hasta ||
      relation.fecha_hasta >= dateValue
    );

  // Salitas vigentes asignadas al profesional.
  const clinicOptions = clinics.filter(
    (clinic) =>
      clinic.activo &&
      relations.clinics.some(
        (relation) =>
          relation.id_salita === clinic.id_salita &&
          validAt(relation, form.vigencia_desde)
      )
  );

  // Especialidades vigentes asignadas al profesional.
  const specialtyOptions = specialties.filter(
    (specialty) =>
      specialty.activo &&
      relations.specialties.some(
        (relation) =>
          relation.id_especialidad ===
            specialty.id_especialidad &&
          validAt(relation, form.vigencia_desde)
      )
  );

  // El catálogo de salitas ya está limitado por el alcance del administrador.
  const onlyClinic = clinicOptions.length === 1 ? clinicOptions[0].id_salita : '';
  const onlySpecialty = specialtyOptions.length === 1 ? specialtyOptions[0].id_especialidad : '';
  const clinicSelectionValid = clinicOptions.some((clinic) => clinic.id_salita === form.id_salita);
  const specialtySelectionValid = specialtyOptions.some((specialty) => specialty.id_especialidad === form.id_especialidad);

  useEffect(() => {
    if (editing || !ready || relationLoading || relationsProfessional !== form.id_profesional) return;
    setForm((current) => {
      const id_salita = clinicSelectionValid ? current.id_salita : onlyClinic;
      const id_especialidad = specialtySelectionValid ? current.id_especialidad : onlySpecialty;
      return id_salita === current.id_salita && id_especialidad === current.id_especialidad
        ? current
        : { ...current, id_salita, id_especialidad };
    });
  }, [editing, ready, relationLoading, relationsProfessional, form.id_profesional,
    onlyClinic, onlySpecialty, clinicSelectionValid, specialtySelectionValid]);

  // Limpia el formulario y finaliza la edición.
  const reset = () => {
    setEditing(undefined);
    setWeeklySlots([newWeeklySlot(1)]);

    setForm(
      initial(
        openedFromProfessional
          ? professionalFromUrl
          : ''
      )
    );

    setAvailability(null);
  };

  // Guarda un nuevo horario o actualiza uno existente.
  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (busy || !ready || relationLoading || relationsProfessional !== form.id_profesional) {
      return;
    }

    setError('');
    setSuccess('');

    const inputs: HorarioInput[] = editing ? [form] : weeklySlots.map((slot) => ({
      ...form,
      dia_semana: slot.dia_semana,
      hora_inicio: slot.hora_inicio,
      hora_fin: slot.hora_fin,
    }));
    if (!inputs.length) {
      setError('Seleccioná al menos un día y una franja de atención.');
      return;
    }
    // Valida todas las franjas antes de comenzar el guardado.
    if (inputs.some((input) => !input.hora_inicio || !input.hora_fin || input.hora_inicio >= input.hora_fin)) {
      setError(
        'El inicio debe ser anterior al fin.'
      );
      return;
    }

    // Valida el período de vigencia.
    if (
      form.vigencia_hasta &&
      form.vigencia_hasta < form.vigencia_desde
    ) {
      setError('Revisá el período de vigencia.');
      return;
    }

    // Valida las asignaciones del profesional.
    if (
      form.activo &&
      (
        !clinicOptions.some(
          (clinic) =>
            clinic.id_salita === form.id_salita
        ) ||
        !specialtyOptions.some(
          (specialty) =>
            specialty.id_especialidad ===
            form.id_especialidad
        )
      )
    ) {
      setError(
        'Asigná la salita y la especialidad al profesional para esa fecha antes de activar el horario.'
      );
      return;
    }

    // Evita franjas superpuestas para el mismo profesional,
    // incluso cuando atiende en diferentes salitas.
    const overlapping = inputs.some((input) => rows.some(
      (schedule) =>
        schedule.id_horario !== editing &&
        schedule.activo &&
        schedule.id_profesional === form.id_profesional &&
        schedule.dia_semana === input.dia_semana &&
        schedule.hora_inicio.slice(0, 5) < input.hora_fin &&
        schedule.hora_fin.slice(0, 5) > input.hora_inicio &&
        schedule.vigencia_desde <=
          (form.vigencia_hasta ?? '9999-12-31') &&
        (schedule.vigencia_hasta ?? '9999-12-31') >=
          form.vigencia_desde
    )) || inputs.some((input, index) => inputs.slice(index + 1).some((other) =>
      input.dia_semana === other.dia_semana &&
      input.hora_inicio < other.hora_fin && input.hora_fin > other.hora_inicio
    ));

    if (form.activo && overlapping) {
      setError(
        'El profesional ya tiene una franja activa que se superpone con este horario.'
      );
      return;
    }

    setBusy(true);
    let saved = 0;

    try {
      for (const input of inputs) {
        await guardarHorario(input, editing);
        saved += 1;
        // Retira las franjas confirmadas para no reenviarlas si falla una posterior.
        if (!editing) {
          const savedKey = weeklySlots[saved - 1].key;
          setWeeklySlots((current) => current.filter((slot) => slot.key !== savedKey));
        }
      }

      reset();

      setSuccess(
        `${saved === 1 ? 'Horario guardado' : `${saved} franjas guardadas`} correctamente. Podés consultar su disponibilidad.`
      );

      // Fuerza la recarga del listado.
      setRevision((value) => value + 1);
    } catch (cause) {
      if (editing && isAgendaConflict(cause)) setImpact({ tipo: 'horario', id: editing, datos: { ...form } });
      setError(saved
        ? `Se guardaron ${saved} franjas. Quedan pendientes las que se muestran en el formulario. ${authError(cause)}`
        : authError(cause));
      if (saved) {
        try {
          setRows(await getHorarios());
        } catch {
          setError((message) => `${message} No se pudo actualizar el listado; recargalo antes de continuar.`);
          setReady(false);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  // Consulta los turnos disponibles para una fecha.
  const preview = async () => {
    if (
      busy ||
      !form.id_profesional ||
      !form.id_salita ||
      !form.id_especialidad ||
      !date
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');
    setAvailability(null);

    try {
      setAvailability(
        await getDisponibilidad(
          date,
          form.id_profesional,
          form.id_especialidad,
          form.id_salita
        )
      );
    } catch (cause) {
      setError(authError(cause));
    } finally {
      setBusy(false);
    }
  };

  // Carga un horario existente en el formulario.
  const edit = (row: Horario) => {
    const {
      id_horario,
      ...input
    } = row;

    setForm({
      id_profesional: input.id_profesional,
      id_especialidad: input.id_especialidad,
      id_salita: input.id_salita,
      dia_semana: input.dia_semana,
      hora_inicio: input.hora_inicio.slice(0, 5),
      hora_fin: input.hora_fin.slice(0, 5),
      duracion_turno_minutos:
        input.duracion_turno_minutos,
      cupo_maximo_diario:
        input.cupo_maximo_diario,
      vigencia_desde: input.vigencia_desde,
      vigencia_hasta: input.vigencia_hasta,
      activo: input.activo,
    });

    setEditing(id_horario);
    setAvailability(null);
    setSuccess('');
    setError('');

    formRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const visibleRows = rows.filter(
    (schedule) =>
      !filter ||
      schedule.id_profesional === filter
  );

  const availabilityHasSlots =
    Boolean(
      availability &&
      availability.slots.length
    );

  return (
    <div>
      {impact && <AgendaImpactPanel cambio={impact} onClose={() => setImpact(null)} onSaved={() => {
        setImpact(null); reset(); setError(''); setSuccess('Cambio de agenda guardado.'); setRevision(v => v + 1);
      }} />}
      {/* Navegación contextual cuando se accede desde la ficha de un profesional */}
      {openedFromProfessional && form.id_profesional && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Link
            className="btn btn-outline-secondary"
            to={`/profesionales/${form.id_profesional}`}
          >
            <i className="bi bi-arrow-left me-2" aria-hidden="true" />
            Volver al profesional
          </Link>
        </div>
      )}

      {/* Encabezado */}
      <div className="dashboard-header">
        <h1>
          Horarios y disponibilidad
        </h1>

        <p>
          Definí las franjas de atención de los
          profesionales de tus salitas y consultá
          los turnos disponibles.
        </p>
      </div>

      {/* Contexto del profesional */}
      {openedFromProfessional && (
        <div
          className="dashboard-panel p-3 mb-4"
          style={{
            borderLeft: '4px solid var(--saps-green, #198754)',
          }}
        >
          <div className="d-flex align-items-start gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center"
              style={{
                width: 44,
                height: 44,
                background: 'rgba(25, 135, 84, 0.1)',
                flexShrink: 0,
              }}
            >
              <i className="bi bi-person-badge fs-5 text-success" />
            </div>

            <div>
              <div className="small text-muted">
                Profesional seleccionado
              </div>

              <div className="fw-semibold fs-5">
                {selectedProfessionalName ||
                  'Cargando profesional...'}
              </div>

              {selectedProfessional?.matricula && (
                <div className="small text-muted mt-1">
                  Matrícula:{' '}
                  {selectedProfessional.matricula}
                </div>
              )}

              <div className="small text-muted mt-2">
                Estás configurando los horarios y la
                disponibilidad de este profesional.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes generales */}
      {error && (
        <div
          className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2"
          role="alert"
        >
          <div>
            <i className="bi bi-exclamation-triangle me-2" />
            {error}
          </div>

          <button
            className="btn btn-outline-danger"
            disabled={busy}
            onClick={() =>
              setRevision((value) => value + 1)
            }
            type="button"
          >
            Recargar
          </button>
        </div>
      )}

      {success && (
        <div
          className="alert alert-success d-flex align-items-center justify-content-between gap-2"
          role="status"
        >
          <div>
            <i className="bi bi-check-circle me-2" />
            {success}
          </div>

          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => setSuccess('')}
          />
        </div>
      )}

      {loading && (
        <div
          className="alert alert-light border"
          role="status"
        >
          <span
            className="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          />
          Cargando horarios y configuración...
        </div>
      )}

      {/* Formulario de horarios */}
      <form
        ref={formRef}
        className="dashboard-panel p-3 mb-4 configuration-form"
        onSubmit={submit}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 className="h5 mb-1">
              {editing
                ? 'Editar horario'
                : 'Nuevo horario'}
            </h2>

            <p className="text-muted small mb-0">
              Definí cuándo y dónde atiende el
              profesional.
            </p>
          </div>

          {editing && (
            <span className="badge text-bg-warning">
              Editando horario
            </span>
          )}
        </div>

        <fieldset
          disabled={
            busy || Boolean(impact) ||
            loading ||
            !ready
          }
        >
          <div className="row g-3">
            <label className="col-lg-4 form-label">
              Profesional

              <select
                className="form-select"
                required
                value={form.id_profesional}
                onChange={(e) =>
                  change({
                    id_profesional:
                      e.target.value,
                    id_salita: '',
                    id_especialidad: '',
                  })
                }
              >
                <option value="">
                  Seleccionar profesional
                </option>

                {professionals
                  .filter(
                    (professional) =>
                      professional.activo ||
                      professional.id_profesional ===
                        form.id_profesional
                  )
                  .map((professional) => (
                    <option
                      key={
                        professional.id_profesional
                      }
                      value={
                        professional.id_profesional
                      }
                    >
                      {professional.persona.apellidos},{' '}
                      {professional.persona.nombres}
                    </option>
                  ))}
              </select>
            </label>

            <label className="col-lg-4 form-label">
              Salita

              <select
                className="form-select"
                required
                disabled={relationLoading || (!editing && clinicOptions.length === 1)}
                value={form.id_salita}
                onChange={(e) =>
                  change({
                    id_salita: e.target.value,
                  })
                }
              >
                <option value="">
                  Seleccionar salita asignada
                </option>

                {clinics
                  .filter(
                    (clinic) =>
                      clinicOptions.includes(clinic) ||
                      clinic.id_salita ===
                        form.id_salita
                  )
                  .map((clinic) => (
                    <option
                      key={clinic.id_salita}
                      value={clinic.id_salita}
                    >
                      {clinic.nombre}

                      {!clinicOptions.includes(
                        clinic
                      )
                        ? ' (sin asignación vigente)'
                        : ''}
                    </option>
                  ))}
              </select>
            </label>

            <label className="col-lg-4 form-label">
              Especialidad

              <select
                className="form-select"
                required
                disabled={relationLoading || (!editing && specialtyOptions.length === 1)}
                value={form.id_especialidad}
                onChange={(e) =>
                  change({
                    id_especialidad:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  Seleccionar especialidad asignada
                </option>

                {specialties
                  .filter(
                    (specialty) =>
                      specialtyOptions.includes(
                        specialty
                      ) ||
                      specialty.id_especialidad ===
                        form.id_especialidad
                  )
                  .map((specialty) => (
                    <option
                      key={
                        specialty.id_especialidad
                      }
                      value={
                        specialty.id_especialidad
                      }
                    >
                      {specialty.nombre}

                      {!specialtyOptions.includes(
                        specialty
                      )
                        ? ' (sin asignación vigente)'
                        : ''}
                    </option>
                  ))}
              </select>
            </label>

            {/* Acceso a las asignaciones */}
            {form.id_profesional && (
              <div className="col-12">
                <div className="alert alert-light border mb-0">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div>
                      <strong>
                        Asignaciones del profesional
                      </strong>

                      <div className="small text-muted">
                        La salita y la especialidad deben
                        estar asignadas al profesional para
                        poder activar este horario.
                      </div>
                      {!relationLoading && relationsProfessional === form.id_profesional && (
                        <div className="small mt-2">
                          {!clinicOptions.length || !specialtyOptions.length
                            ? 'Falta una salita o especialidad con asignación vigente dentro de tu alcance para la fecha indicada.'
                            : 'Las opciones únicas se completan automáticamente. Si hay varias salitas o especialidades asignadas, elegí dónde y en qué especialidad atenderá.'}
                        </div>
                      )}
                    </div>

                    <Link
                      className="btn btn-sm btn-outline-success"
                      to={`/profesionales/${form.id_profesional}`}
                    >
                      Administrar asignaciones
                    </Link>
                  </div>

                  {relationLoading && (
                    <div
                      role="status"
                      className="small text-muted mt-2"
                    >
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        aria-hidden="true"
                      />
                      Cargando asignaciones...
                    </div>
                  )}
                </div>
              </div>
            )}

            {!editing && (
              <WeeklyScheduleFields slots={weeklySlots} onChange={setWeeklySlots} />
            )}
            {editing && <>
            <label className="col-sm-6 col-lg-4 form-label">
              Día

              <select
                className="form-select"
                value={form.dia_semana}
                onChange={(e) =>
                  change({
                    dia_semana: Number(
                      e.target.value
                    ),
                  })
                }
              >
                {days.map((day, index) => (
                  <option
                    key={day}
                    value={index + 1}
                  >
                    {day}
                  </option>
                ))}
              </select>
            </label>

            <label className="col-sm-6 col-lg-4 form-label">
              Inicio

              <ValidatedInput field="hora_inicio"
                className="form-control"
                type="time"
                required
                value={form.hora_inicio}
                onChange={(e) =>
                  change({
                    hora_inicio:
                      e.target.value,
                  })
                }
              />
            </label>

            <label className="col-sm-6 col-lg-4 form-label">
              Fin

              <ValidatedInput field="hora_fin"
                className="form-control"
                type="time"
                required
                value={form.hora_fin}
                onChange={(e) =>
                  change({
                    hora_fin:
                      e.target.value,
                  })
                }
              />
            </label>

            </>}
            <label className="col-sm-6 col-lg-3 form-label">
              Duración del turno (minutos)

              <ValidatedInput field="duracion_turno_minutos"
                className="form-control"
                type="number"
                min={5}
                max={240}
                required
                value={
                  form.duracion_turno_minutos
                }
                onChange={(e) =>
                  change({
                    duracion_turno_minutos:
                      Number(e.target.value),
                  })
                }
              />

              <small className="text-muted">
                Ejemplo: 20 minutos genera turnos
                de 20 min.
              </small>
            </label>

            <label className="col-sm-6 col-lg-3 form-label">
              Cupo diario (opcional)

              <ValidatedInput field="cupo_maximo_diario"
                className="form-control"
                type="number"
                min={1}
                value={
                  form.cupo_maximo_diario ?? ''
                }
                onChange={(e) =>
                  change({
                    cupo_maximo_diario:
                      e.target.value
                        ? Number(e.target.value)
                        : null,
                  })
                }
              />

              <small className="text-muted">
                Dejalo vacío si no querés limitarlo.
              </small>
            </label>

            <label className="col-sm-6 col-lg-3 form-label">
              Vigente desde

              <ValidatedInput field="vigencia_desde"
                className="form-control"
                type="date"
                required
                value={form.vigencia_desde}
                onChange={(e) =>
                  change({
                    vigencia_desde:
                      e.target.value,
                  })
                }
              />
            </label>

            <label className="col-sm-6 col-lg-3 form-label">
              Vigente hasta (opcional)

              <ValidatedInput field="vigencia_hasta"
                className="form-control"
                type="date"
                min={form.vigencia_desde}
                value={
                  form.vigencia_hasta ?? ''
                }
                onChange={(e) =>
                  change({
                    vigencia_hasta:
                      e.target.value || null,
                  })
                }
              />

              <small className="text-muted">
                Sin fecha significa que no tiene
                vencimiento definido.
              </small>
            </label>

            <div className="col-12">
              <label className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    change({
                      activo:
                        e.target.checked,
                    })
                  }
                />

                <span className="form-check-label">
                  Horario activo
                </span>
              </label>
            </div>

            <div className="col-12 d-flex flex-wrap gap-2">
              <button
                className="btn btn-saps"
                type="submit"
                disabled={relationLoading}
              >
                {busy
                  ? 'Procesando...'
                  : editing
                    ? 'Guardar cambios'
                    : `Guardar horarios (${weeklySlots.length})`}
              </button>

              {editing && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={reset}
                  disabled={busy}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </div>
        </fieldset>
      </form>

      {/* Consulta de disponibilidad */}
      <section className="dashboard-panel p-3 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h5 mb-1">
              Disponibilidad
            </h2>

            <p className="text-muted mb-0">
              Consultá los turnos generados para
              una fecha concreta.
            </p>
          </div>

          {availability && (
            <span className="badge text-bg-success">
              Consulta realizada
            </span>
          )}
        </div>

        {!form.id_profesional ||
        !form.id_salita ||
        !form.id_especialidad ? (
          <div className="alert alert-light border mb-0">
            <i className="bi bi-info-circle me-2" />

            Para consultar la disponibilidad,
            seleccioná primero el profesional, la
            salita y la especialidad en el formulario
            de arriba.
          </div>
        ) : (
          <>
            <div className="alert alert-light border">
              <div className="row g-2 small">
                <div className="col-md-4">
                  <strong>Profesional:</strong>{' '}
                  {selectedProfessionalName ||
                    'Seleccionado'}
                </div>

                <div className="col-md-4">
                  <strong>Salita:</strong>{' '}
                  {clinics.find(
                    (clinic) =>
                      clinic.id_salita ===
                      form.id_salita
                  )?.nombre ||
                    'Seleccionada'}
                </div>

                <div className="col-md-4">
                  <strong>Especialidad:</strong>{' '}
                  {specialties.find(
                    (specialty) =>
                      specialty.id_especialidad ===
                      form.id_especialidad
                  )?.nombre ||
                    'Seleccionada'}
                </div>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-3 align-items-end">
              <label className="form-label mb-0">
                Fecha

                <ValidatedInput
                  className="form-control"
                  type="date"
                  value={date}
                  disabled={busy}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setAvailability(null);
                  }}
                />
              </label>

              <button
                className="btn btn-outline-success"
                type="button"
                disabled={
                  busy ||
                  loading ||
                  !ready ||
                  !date
                }
                onClick={() =>
                  void preview()
                }
              >
                {busy
                  ? 'Consultando...'
                  : 'Consultar disponibilidad'}
              </button>
            </div>
          </>
        )}

        {/* Resultado */}
        {availability && (
          <div
            className="mt-4"
            aria-live="polite"
          >
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">
                    Disponibles
                  </div>

                  <div className="fs-3 fw-bold text-success">
                    {availability.resumen.disponibles}
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">
                    Ocupados
                  </div>

                  <div className="fs-3 fw-bold">
                    {availability.resumen.ocupados}
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted">
                    Bloqueados
                  </div>

                  <div className="fs-3 fw-bold text-secondary">
                    {availability.resumen.bloqueados}
                  </div>
                </div>
              </div>
            </div>

            {availabilityHasSlots ? (
              <div className="row g-3">
                {availability.slots.map(
                  (slot) => {
                    const isAvailable =
                      slot.estado ===
                      'DISPONIBLE';

                    const isOccupied =
                      slot.estado ===
                      'OCUPADO';

                    return (
                      <div
                        className="col-6 col-md-4 col-lg-3"
                        key={`${slot.hora_inicio}-${slot.hora_fin}`}
                      >
                        <div
                          className={`border rounded p-3 h-100 ${
                            isAvailable
                              ? 'border-success bg-success-subtle'
                              : isOccupied
                                ? 'bg-light'
                                : 'bg-secondary-subtle'
                          }`}
                        >
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <strong>
                              {slot.hora_inicio}–
                              {slot.hora_fin}
                            </strong>

                            {isAvailable ? (
                              <i
                                className="bi bi-check-circle text-success"
                                aria-hidden="true"
                              />
                            ) : isOccupied ? (
                              <i
                                className="bi bi-person-fill text-secondary"
                                aria-hidden="true"
                              />
                            ) : (
                              <i
                                className="bi bi-lock-fill text-secondary"
                                aria-hidden="true"
                              />
                            )}
                          </div>

                          <div className="small mt-2">
                            {isAvailable
                              ? 'Disponible'
                              : isOccupied
                                ? 'Ocupado'
                                : 'Bloqueado'}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="alert alert-light border mb-0">
                <div className="d-flex gap-3 align-items-start">
                  <i className="bi bi-calendar-x fs-4 text-muted" />

                  <div>
                    <strong>
                      No hay turnos para esta fecha.
                    </strong>

                    <div className="small text-muted mt-1">
                      No se encontraron bloques de
                      atención disponibles para la
                      combinación seleccionada.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Listado de horarios registrados */}
      <section className="dashboard-panel">
        <div className="p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <h2 className="h5 mb-1">
                Horarios guardados
              </h2>

              <p className="text-muted small mb-0">
                Administrá las franjas de atención
                configuradas.
              </p>
            </div>

            {openedFromProfessional && (
              <span className="badge text-bg-light border">
                Mostrando horarios del profesional
              </span>
            )}
          </div>

          <label className="form-label w-100 mt-3">
            Filtrar profesional

            <select
              className="form-select"
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value)
              }
            >
              <option value="">
                Todos
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
                    {professional.persona.apellidos},{' '}
                    {professional.persona.nombres}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <div className="table-responsive">
          <table className="table saps-responsive-table">
            <thead>
              <tr>
                {[
                  'Profesional',
                  'Salita / especialidad',
                  'Franja',
                  'Vigencia',
                  'Estado',
                  'Acciones',
                ].map((label) => (
                  <th
                    scope="col"
                    key={label}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map(
                (schedule) => {
                  const professional =
                    professionals.find(
                      (value) =>
                        value.id_profesional ===
                        schedule.id_profesional
                    );

                  const clinic =
                    clinics.find(
                      (value) =>
                        value.id_salita ===
                        schedule.id_salita
                    );

                  const specialty =
                    specialties.find(
                      (value) =>
                        value.id_especialidad ===
                        schedule.id_especialidad
                    );

                  return (
                    <tr
                      key={
                        schedule.id_horario
                      }
                    >
                      <td data-label="Profesional">
                        {professional
                          ? `${professional.persona.apellidos}, ${professional.persona.nombres}`
                          : 'Profesional no disponible'}
                      </td>

                      <td data-label="Salita / especialidad">
                        {clinic?.nombre ??
                          'Salita no disponible'}

                        <br />

                        {specialty?.nombre ??
                          'Especialidad no disponible'}
                      </td>

                      <td data-label="Franja">
                        {days[
                          schedule.dia_semana - 1
                        ]}{' '}
                        ·{' '}
                        {schedule.hora_inicio.slice(
                          0,
                          5
                        )}
                        –
                        {schedule.hora_fin.slice(
                          0,
                          5
                        )}

                        <br />

                        <small>
                          Turnos de{' '}
                          {
                            schedule.duracion_turno_minutos
                          }{' '}
                          min
                        </small>
                      </td>

                      <td data-label="Vigencia">
                        {schedule.vigencia_desde}
                        {' / '}
                        {schedule.vigencia_hasta ??
                          'Sin fin'}
                      </td>

                      <td data-label="Estado">
                        <span
                          className={`badge ${
                            schedule.activo
                              ? 'text-bg-success'
                              : 'text-bg-secondary'
                          }`}
                        >
                          {schedule.activo
                            ? 'Activo'
                            : 'Inactivo'}
                        </span>
                      </td>

                      <td data-label="Acciones">
                        <button
                          className="btn btn-outline-success"
                          type="button"
                          disabled={
                            busy || loading
                          }
                          onClick={() =>
                            edit(schedule)
                          }
                        >
                          Editar / consultar
                        </button>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>

        {!loading &&
          !visibleRows.length && (
            <div className="p-4 text-center text-muted">
              <i className="bi bi-calendar-week fs-2 d-block mb-2" />

              <strong>
                No hay horarios configurados.
              </strong>

              <div className="small mt-1">
                {filter
                  ? 'El profesional seleccionado todavía no tiene horarios registrados.'
                  : 'Todavía no se registraron horarios de atención.'}
              </div>
            </div>
          )}
      </section>
    </div>
  );
}
