import AccountSummary from '../../components/ui/AccountSummary';
import ProfessionalAccessAccount from '../../components/profesionales/ProfessionalAccessAccount';
import { useEffect, useState, useRef } from 'react';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { FloatingFeedbackToast } from '../../components/ui/FormFeedback';
import { useAgendaSocket } from '../../context/AgendaSocketContext';
import {
  RECOVERABLE_ERROR_TIMEOUT_MS,
  SUCCESS_MESSAGE_TIMEOUT_MS,
  useAutoDismiss,
} from '../../utils/useAutoDismiss';

import AsignacionVigencia from '../../components/profesionales/AsignacionVigencia';

import {
  useLocation,
  useNavigate,
  useParams,
  Link,
} from 'react-router-dom';

import {
  addProfessionalClinic,
  addProfessionalSpecialty,
  deleteProfessionalClinic,
  deleteProfessionalSpecialty,
  getProfessionalById,
  getProfessionalClinics,
  getProfessionalSpecialties,
} from '../../services/profesionales.service';

import { getSpecialties } from '../../services/especialidades.service';
import { getAdminSalitas } from '../../services/salitas.service';

import type {
  Professional,
  ProfessionalClinic,
  ProfessionalSpecialty,
  Specialty,
} from '../../types/profesional.types';

import type {
  Salita,
} from '../../types/salita.types';

interface ProfesionalDetalleLocationState {
  professional?: Professional;
  message?: string;
  messageTitle?: string;
}

const ProfesionalDetallePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const navigationState =
    (location.state as ProfesionalDetalleLocationState | null) ??
    null;

  const [professional, setProfessional] =
    useState<Professional | null>(
      navigationState?.professional ?? null,
    );

  const [specialties, setSpecialties] =
    useState<ProfessionalSpecialty[]>([]);

  const [clinics, setClinics] =
    useState<ProfessionalClinic[]>([]);

  const [availableSpecialties, setAvailableSpecialties] =
    useState<Specialty[]>([]);

  const [availableClinics, setAvailableClinics] =
    useState<Salita[]>([]);

  const [selectedSpecialty, setSelectedSpecialty] =
    useState('');

  const [selectedClinic, setSelectedClinic] =
    useState('');

  const [loading, setLoading] =
    useState(!navigationState?.professional);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState(
      navigationState?.message ?? '',
    );

  const [messageTitle, setMessageTitle] =
    useState(
      navigationState?.messageTitle ??
        'Actualización completada',
    );

  const [removalTarget, setRemovalTarget] =
    useState<{
      tipo: 'salita' | 'especialidad';
      nombre: string;
      id: string;
    } | null>(null);

  const [removing, setRemoving] =
    useState(false);

  const { ultimoEventoProfesional, resyncTick } = useAgendaSocket();
  const requestIdRef = useRef(0);

  const loadData = async (
    showLoading = true,
    professionalOverride?: Professional | null,
  ) => {
    if (!id) {
      return;
    }

    const currentRequestId = ++requestIdRef.current;

    try {
      if (showLoading) {
        setLoading(true);
      }

      setError('');

      const professionalRequest =
        professionalOverride
          ? Promise.resolve({
              data: professionalOverride,
            })
          : getProfessionalById(id);

      const [
        professionalResult,
        specialtiesResult,
        clinicsResult,
        allSpecialtiesResult,
        allClinicsResult,
      ] = await Promise.allSettled([
        professionalRequest,
        getProfessionalSpecialties(id),
        getProfessionalClinics(id),
        getSpecialties(),
        getAdminSalitas(),
      ]);

      if (currentRequestId !== requestIdRef.current) return;

      if (professionalResult.status === 'fulfilled') {
        setProfessional(professionalResult.value.data);
      } else {
        setError('No se pudo cargar la información del profesional.');
      }

      if (specialtiesResult.status === 'fulfilled') {
        setSpecialties(specialtiesResult.value.data);
      }

      if (clinicsResult.status === 'fulfilled') {
        setClinics(clinicsResult.value.data);
      }

      if (allSpecialtiesResult.status === 'fulfilled') {
        setAvailableSpecialties(
          allSpecialtiesResult.value.data.filter(
            (specialty) => specialty.activo && specialty.requiere_profesional
          )
        );
      }

      if (allClinicsResult.status === 'fulfilled') {
        setAvailableClinics(
          allClinicsResult.value.data.filter((clinic) => clinic.activo)
        );
      }
    } catch (cause) {
      if (currentRequestId === requestIdRef.current) {
        console.error(cause);
        setError('No se pudo cargar la información del profesional.');
      }
    } finally {
      if (showLoading && currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (ultimoEventoProfesional || resyncTick > 0) {
      void loadData(false);
    }
  }, [ultimoEventoProfesional, resyncTick]);

  useEffect(() => {
    const state =
      (location.state as ProfesionalDetalleLocationState | null) ??
      null;

    if (state?.professional) {
      setProfessional(
        state.professional,
      );

      setMessage(
        state.message ?? '',
      );

      setMessageTitle(
        state.messageTitle ??
          'Actualización completada',
      );
    }

    void loadData(
      !state?.professional,
      state?.professional ?? null,
    );
  }, [
    id,
    location.state,
  ]);

  useAutoDismiss(message, () => setMessage(''), SUCCESS_MESSAGE_TIMEOUT_MS, Boolean(message));
  useAutoDismiss(error, () => setError(''), RECOVERABLE_ERROR_TIMEOUT_MS, Boolean(error));

  const handleAddSpecialty = async () => {
    if (!id || !selectedSpecialty) {
      return;
    }

    try {
      setError('');

      await addProfessionalSpecialty(
        id,
        {
          id_especialidad:
            selectedSpecialty,
        },
      );

      setSelectedSpecialty('');

      setMessageTitle(
        'Asignación completada',
      );

      setMessage(
        'Especialidad asignada correctamente.',
      );

      await loadData(false);
    } catch (cause) {
      console.error(cause);

      setError(
        'No se pudo asignar la especialidad.',
      );
    }
  };

  const handleRemoveSpecialty = (
    specialty: ProfessionalSpecialty,
  ) => {
    if (!id) {
      return;
    }

    setRemovalTarget({
      tipo: 'especialidad',
      nombre:
        specialty.especialidad.nombre,
      id: specialty.id_especialidad,
    });
  };

  const handleAddClinic = async () => {
    if (!id || !selectedClinic) {
      return;
    }

    try {
      setError('');

      await addProfessionalClinic(
        id,
        {
          id_salita: selectedClinic,
        },
      );

      setSelectedClinic('');

      setMessageTitle(
        'Asignación completada',
      );

      setMessage(
        'Salita asignada correctamente.',
      );

      await loadData(false);
    } catch (cause) {
      console.error(cause);

      setError(
        'No se pudo asignar la salita.',
      );
    }
  };

  const handleRemoveClinic = (
    clinic: ProfessionalClinic,
  ) => {
    if (!id) {
      return;
    }

    setRemovalTarget({
      tipo: 'salita',
      nombre: clinic.salita.nombre,
      id: clinic.id_salita,
    });
  };

  const confirmRemoval = async () => {
    if (
      !id ||
      !removalTarget ||
      removing
    ) {
      return;
    }

    try {
      setRemoving(true);
      setError('');

      if (
        removalTarget.tipo === 'salita'
      ) {
        await deleteProfessionalClinic(
          id,
          removalTarget.id,
        );

        setMessageTitle(
          'Asignación eliminada',
        );

        setMessage(
          'La asignación de la salita se quitó correctamente.',
        );
      } else {
        await deleteProfessionalSpecialty(
          id,
          removalTarget.id,
        );

        setMessageTitle(
          'Asignación eliminada',
        );

        setMessage(
          'La especialidad se quitó correctamente.',
        );
      }

      setRemovalTarget(null);

      await loadData(false);
    } catch (cause) {
      console.error(cause);

      setError(
        removalTarget.tipo === 'salita'
          ? 'No se pudo quitar la asignación de la salita.'
          : 'No se pudo quitar la especialidad.',
      );
    } finally {
      setRemoving(false);
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

  if (!professional) {
    return (
      <div>
        <div className="alert alert-danger">
          {error ||
            'Profesional no encontrado.'}
        </div>

        <button
          type="button"
          className="btn btn-saps"
          onClick={() =>
            navigate('/profesionales')
          }
        >
          Volver
        </button>
      </div>
    );
  }

  const person =
    professional.persona;

  const assignedSpecialtyIds =
    new Set(
      specialties.map(
        (item) =>
          item.id_especialidad,
      ),
    );

  const assignedClinicIds =
    new Set(
      clinics.map(
        (item) =>
          item.id_salita,
      ),
    );

  const specialtiesToSelect =
    availableSpecialties.filter(
      (item) =>
        !assignedSpecialtyIds.has(
          item.id_especialidad,
        ),
    );

  const clinicsToSelect =
    availableClinics.filter(
      (item) =>
        !assignedClinicIds.has(
          item.id_salita,
        ),
    );

  return (
    <div className="professional-detail">

      <Link
        className="btn btn-saps mb-3"
        to={`/configuracion/horarios?profesional=${id}`}
      >
        <i className="bi bi-calendar-week me-2" />
        Horarios y disponibilidad
      </Link>

      <div className="d-flex justify-content-between align-items-start mb-4 gap-3">

        <div>
          <button
            type="button"
            className="btn btn-outline-secondary mb-3"
            onClick={() =>
              navigate('/profesionales')
            }
          >
            <i className="bi bi-arrow-left me-2" />
            Volver a profesionales
          </button>

          <h2 className="fw-bold mb-1">
            {person.apellidos},{' '}
            {person.nombres}
          </h2>

          <p className="text-muted mb-0">
            Matrícula:{' '}
            {professional.matricula}
          </p>
          <AccountSummary account={person.cuenta} />
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() =>
            navigate(
              `/profesionales/${professional.id_profesional}/editar`,
              {
                state: {
                  professional,

                  returnTo:
                    `/profesionales/${professional.id_profesional}`,

                  returnLabel:
                    'Volver al profesional',
                },
              },
            )
          }
        >
          <i className="bi bi-pencil me-2" />
          Editar
        </button>

      </div>

      <ProfessionalAccessAccount
        key={professional.id_profesional}
        professional={professional}
        onCreated={(account) => setProfessional((current) => current ? {
          ...current,
          persona: { ...current.persona, cuenta: account },
        } : current)}
      />

      {message && (
        <FloatingFeedbackToast
          variant="success"
          title={messageTitle}
          message={message}
          onDismiss={() => setMessage('')}
        />
      )}

      {error && (
        <FloatingFeedbackToast
          variant="error"
          title="Error"
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      <ConfirmationModal
        open={Boolean(removalTarget)}
        title={removalTarget?.tipo === 'salita' ? 'Quitar asignación de salita' : 'Quitar especialidad'}
        subtitle="Esta acción requiere confirmación."
        message={`¿Confirmás que querés quitar la ${
          removalTarget?.tipo === 'salita' ? 'asignación a la salita' : 'especialidad'
        } de este profesional?`}
        confirmText={removalTarget?.tipo === 'salita' ? 'Quitar salita' : 'Quitar especialidad'}
        cancelText="Cancelar"
        variant="danger"
        icon="bi-trash3"
        loading={removing}
        detail={
          removalTarget ? (
            <div className="bg-light border rounded p-3 mt-2">
              <div className="fw-semibold">{removalTarget.nombre}</div>
              <div className="text-muted small mt-1">
                {removalTarget.tipo === 'salita'
                  ? 'La salita seguirá existiendo en el sistema. Solo se quitará su asignación a este profesional.'
                  : 'La especialidad seguirá existiendo en el sistema. Solo se quitará su asignación a este profesional.'}
              </div>
            </div>
          ) : undefined
        }
        onClose={() => setRemovalTarget(null)}
        onConfirm={() => void confirmRemoval()}
      />

      <div className="row g-4">

        {/* INFORMACIÓN PERSONAL */}

        <div className="col-xl-5">

          <div className="card border-0 shadow-sm h-100">

            <div className="card-header bg-white py-3">
              <h5 className="mb-0 fw-bold">
                <i className="bi bi-person-vcard me-2 text-success" />
                Información personal
              </h5>
            </div>

            <div className="card-body">

              <div className="professional-detail-avatar">
                <i className="bi bi-person-badge" />
              </div>

              <div className="professional-info-list">

                <div>
                  <span>DNI</span>

                  <strong>
                    {person.dni}
                  </strong>
                </div>

                <div>
                  <span>Matrícula</span>

                  <strong>
                    {professional.matricula}
                  </strong>
                </div>

                <div>
                  <span>
                    Fecha de nacimiento
                  </span>

                  <strong>
                    {person.fecha_nacimiento ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>Sexo</span>

                  <strong>
                    {person.sexo ||
                      'No informa'}
                  </strong>
                </div>

                <div>
                  <span>Teléfono</span>

                  <strong>
                    {person.telefono ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>Email</span>

                  <strong>
                    {person.email ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>Dirección</span>

                  <strong>
                    {person.direccion ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>Localidad</span>

                  <strong>
                    {person.localidad ||
                      '—'}
                  </strong>
                </div>

                <div>
                  <span>Estado</span>

                  <strong>
                    {professional.activo ? (
                      <span className="badge bg-success-subtle text-success">
                        Activo
                      </span>
                    ) : (
                      <span className="badge bg-secondary-subtle text-secondary">
                        Inactivo
                      </span>
                    )}
                  </strong>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ASIGNACIONES */}

        <div className="col-xl-7">

          {/* ESPECIALIDADES */}

          <div className="card border-0 shadow-sm mb-4">

            <div className="card-header bg-white py-3">

              <div className="d-flex justify-content-between align-items-center">

                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-award me-2 text-success" />
                  Especialidades
                </h5>

                <span className="badge bg-success-subtle text-success">
                  {specialties.length}
                </span>

              </div>

            </div>

            <div className="card-body">

              <div className="row g-2 mb-4">

                <div className="col">

                  <select
                    className="form-select"
                    value={selectedSpecialty}
                    onChange={(event) =>
                      setSelectedSpecialty(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Seleccionar especialidad
                    </option>

                    {specialtiesToSelect.map(
                      (specialty) => (
                        <option
                          key={
                            specialty.id_especialidad
                          }
                          value={
                            specialty.id_especialidad
                          }
                        >
                          {specialty.nombre}
                        </option>
                      ),
                    )}
                  </select>

                </div>

                <div className="col-auto">

                  <button
                    type="button"
                    className="btn btn-saps"
                    disabled={
                      !selectedSpecialty
                    }
                    onClick={() =>
                      void handleAddSpecialty()
                    }
                  >
                    <i className="bi bi-plus-lg me-1" />
                    Asignar
                  </button>

                </div>

              </div>

              {specialties.length === 0 ? (
                <div className="professional-mini-empty">
                  No hay especialidades
                  asignadas.
                </div>
              ) : (
                <div className="professional-assignment-list">

                  {specialties.map(
                    (specialty) => (
                      <div
                        className="professional-assignment"
                        key={
                          specialty.id_especialidad
                        }
                      >

                        <div>

                          <strong>
                            {
                              specialty
                                .especialidad
                                .nombre
                            }
                          </strong>

                          <small>
                            Desde{' '}
                            {
                              specialty.fecha_desde
                            }
                          </small>

                          <small>
                            Hasta{' '}
                            {specialty.fecha_hasta ??
                              'Sin fecha de finalización'}
                          </small>

                          <AsignacionVigencia
                            profesional={
                              professional.id_profesional
                            }
                            relacion={
                              specialty.id_especialidad
                            }
                            tipo="especialidad"
                            desde={
                              specialty.fecha_desde
                            }
                            hasta={
                              specialty.fecha_hasta
                            }
                            activo={
                              specialty.activo
                            }
                            onSaved={() =>
                              loadData(false)
                            }
                            onSuccess={(
                              successMessage,
                            ) => {
                              setMessageTitle(
                                'Vigencia actualizada',
                              );

                              setMessage(
                                successMessage,
                              );
                            }}
                          />

                        </div>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Quitar especialidad"
                          onClick={() =>
                            void handleRemoveSpecialty(
                              specialty,
                            )
                          }
                        >
                          <i className="bi bi-trash" />
                        </button>

                      </div>
                    ),
                  )}

                </div>
              )}

            </div>
          </div>

          {/* SALITAS */}

          <div className="card border-0 shadow-sm">

            <div className="card-header bg-white py-3">

              <div className="d-flex justify-content-between align-items-center">

                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-hospital me-2 text-success" />
                  Salitas
                </h5>

                <span className="badge bg-success-subtle text-success">
                  {clinics.length}
                </span>

              </div>

            </div>

            <div className="card-body">

              <div className="row g-2 mb-4">

                <div className="col">

                  <select
                    className="form-select"
                    value={selectedClinic}
                    onChange={(event) =>
                      setSelectedClinic(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Seleccionar salita
                    </option>

                    {clinicsToSelect.map(
                      (clinic) => (
                        <option
                          key={
                            clinic.id_salita
                          }
                          value={
                            clinic.id_salita
                          }
                        >
                          {clinic.nombre}
                        </option>
                      ),
                    )}
                  </select>

                </div>

                <div className="col-auto">

                  <button
                    type="button"
                    className="btn btn-saps"
                    disabled={
                      !selectedClinic
                    }
                    onClick={() =>
                      void handleAddClinic()
                    }
                  >
                    <i className="bi bi-plus-lg me-1" />
                    Asignar
                  </button>

                </div>

              </div>

              {clinics.length === 0 ? (
                <div className="professional-mini-empty">
                  No hay salitas asignadas.
                </div>
              ) : (
                <div className="professional-assignment-list">

                  {clinics.map(
                    (clinic) => (
                      <div
                        className="professional-assignment"
                        key={
                          clinic.id_salita
                        }
                      >

                        <div>

                          <strong>
                            {clinic.salita.nombre}
                          </strong>

                          <small>
                            {clinic.salita.direccion}
                          </small>

                          <small>
                            Desde{' '}
                            {clinic.fecha_desde}
                          </small>

                          <small>
                            Hasta{' '}
                            {clinic.fecha_hasta ??
                              'Sin fecha de finalización'}
                          </small>

                          <AsignacionVigencia
                            profesional={
                              professional.id_profesional
                            }
                            relacion={
                              clinic.id_salita
                            }
                            tipo="salita"
                            desde={
                              clinic.fecha_desde
                            }
                            hasta={
                              clinic.fecha_hasta
                            }
                            activo={
                              clinic.activo
                            }
                            onSaved={() =>
                              loadData(false)
                            }
                            onSuccess={(
                              successMessage,
                            ) => {
                              setMessageTitle(
                                'Vigencia actualizada',
                              );

                              setMessage(
                                successMessage,
                              );
                            }}
                          />

                        </div>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Quitar salita"
                          onClick={() =>
                            void handleRemoveClinic(
                              clinic,
                            )
                          }
                        >
                          <i className="bi bi-trash" />
                        </button>

                      </div>
                    ),
                  )}

                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfesionalDetallePage;
