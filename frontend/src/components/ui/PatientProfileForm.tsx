import ZonaBarrioSelect from './ZonaBarrioSelect';
import ValidatedInput from './ValidatedInput';
import {
  useState,
  type FormEvent,
} from 'react';

import ConfirmationModal from './ConfirmationModal';

import type {
  OwnPatientUpdate,
  Patient,
} from '../../types/patient.types';

import {
  updateOwnPatient,
} from '../../services/patients.service';

import {
  useAuth,
} from '../../context/AuthContext';

import usePatientCoverage, {
  coveredClinics,
} from '../../context/usePatientCoverage';

import {
  authError,
} from '../../utils/auth-errors';

// CAMPOS EDITABLES DEL PACIENTE

// Define el nombre del campo, su etiqueta
// y la cantidad máxima de caracteres.
const fields = [
  [
    'nombres',
    'Nombres',
    100,
  ],
  [
    'apellidos',
    'Apellidos',
    100,
  ],
  [
    'telefono',
    'Teléfono',
    30,
  ],
  [
    'direccion',
    'Dirección',
    250,
  ],
  [
    'obra_social',
    'Obra social',
    150,
  ],
  [
    'numero_afiliado',
    'Número de afiliado',
    80,
  ],
  [
    'contacto_emergencia_nombre',
    'Contacto de emergencia',
    200,
  ],
  [
    'contacto_emergencia_telefono',
    'Teléfono de emergencia',
    30,
  ],
] as const;

export default function PatientProfileForm({
  patient,
  coverage,
  onClose,
  onSaved,
}: {
  patient: Patient;
  coverage: ReturnType<typeof usePatientCoverage>;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Permite actualizar los datos del usuario
  // almacenados en el contexto de autenticación.
  const {
    reloadProfile,
  } = useAuth();

  // ESTADO DEL FORMULARIO

  // Inicializa el formulario con los datos
  // actuales del paciente.
  const [
    draft,
    setDraft,
  ] = useState<OwnPatientUpdate>(() => ({
    ...Object.fromEntries(
      fields.map(
        ([key]) => [
          key,
          patient[key] ?? '',
        ]
      )
    ),
    id_barrio: patient.id_barrio,
  }));

  // Estado de procesamiento.
  const [
    busy,
    setBusy,
  ] = useState(false);

  // Mensaje de error.
  const [
    error,
    setError,
  ] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // COBERTURA DEL BARRIO

  // Obtiene las salitas que cubren
  // el barrio actualmente seleccionado.
  const eligible = coveredClinics(
    draft.id_barrio ?? '',
    coverage.clinics,
    coverage.relations
  );

  // Indica si la salita actual dejaría
  // de cubrir al paciente.
  const reassigned = !eligible.some(
    (c) =>
      c.id_salita ===
      patient.id_salita_asignada
  );

  // Detecta si el paciente cambió su barrio.
  const changedBarrio =
    draft.id_barrio !==
    patient.id_barrio;

  // GUARDAR CAMBIOS

  const submit = async (
    event?: FormEvent
  ) => {
    event?.preventDefault();

    // Evita solicitudes duplicadas.
    if (busy) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      // Envía únicamente cambios permitidos
      // y deja la asignación de salita al servidor.
      const changes = Object.fromEntries(
        Object.entries(draft).filter(
          ([key, value]) =>
            value !==
            (
              patient[
                key as keyof Patient
              ] ?? ''
            )
        )
      ) as OwnPatientUpdate;

      // Si no hubo modificaciones, cierra el formulario.
      if (
        !Object.keys(changes).length
      ) {
        onClose();
        return;
      }

      // Actualiza los datos del paciente.
      await updateOwnPatient(
        changes
      );

      // Recarga el perfil actualizado.
      await reloadProfile();

      // Informa al componente padre que se guardó.
      onSaved();
    } catch (cause) {
      setError(
        authError(cause)
      );
    } finally {
      setBusy(false);
    }
  };

  // INTERFAZ
  return (
    <>
      <ConfirmationModal
        open={confirmOpen}
        title="Guardar perfil"
        message="¿Querés guardar los cambios de tu perfil?"
        detail={
          <div className="fw-semibold">
            {draft.nombres} {draft.apellidos}
          </div>
        }
        confirmText="Guardar cambios"
        variant="primary"
        icon="bi-person-check"
        loading={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void submit();
        }}
      />

      <form
        className="patient-section mb-4"
        onSubmit={(event) => {
          event.preventDefault();
          setConfirmOpen(true);
        }}
      >
      <h2 className="h5">
        Editar perfil
      </h2>

      <p className="text-muted">
        DNI, fecha de nacimiento y sexo requieren
        revisión en tu salita. El correo tiene su
        propia verificación.
      </p>

      {/* Mensaje de error. */}
      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <fieldset disabled={busy}>
        <div className="row g-3">
          {/* Campos personales editables. */}
          {fields.map(
            ([
              key,
              label,
              max,
            ]) => (
              <div
                className="col-12 col-md-6"
                key={key}
              >
                <label className="form-label w-100">
                  {label}

                  <ValidatedInput field={key}
                    className="form-control mt-1"
                    value={
                      draft[key] ?? ''
                    }
                    maxLength={max}
                    type={
                      key.includes(
                        'telefono'
                      )
                        ? 'tel'
                        : 'text'
                    }
                    required={[
                      'nombres',
                      'apellidos',
                      'direccion',
                    ].includes(key)}
                    minLength={
                      key === 'direccion'
                        ? 3
                        : [
                              'nombres',
                              'apellidos',
                            ].includes(key)
                          ? 2
                          : undefined
                    }
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [key]:
                          event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            )
          )}

          {/* Selección del barrio. */}
          <div className="col-12">
            <ZonaBarrioSelect
              barrios={coverage.barrios.filter((barrio) => barrio.activo || barrio.id_barrio === patient.id_barrio)}
              value={draft.id_barrio ?? ''}
              disabled={coverage.loading || !!coverage.error}
              onChange={(id_barrio) => setDraft((current) => ({ ...current, id_barrio }))}
            />
          </div>
        </div>

        {/* Informa cómo afecta el cambio de barrio
            a la cobertura y salita asignada. */}
        {changedBarrio && (
          <div
            className="alert alert-warning mt-3"
            role="status"
          >
            {reassigned
              ? eligible.length === 1
                ? `Al guardar, tu salita pasará a ser ${eligible[0].nombre}. Tus turnos existentes se conservan.`
                : 'Este barrio requiere revisión administrativa. Contactá a tu salita para cambiarlo.'
              : 'Tu salita actual cubre el nuevo barrio. Tus turnos existentes se conservan.'}
          </div>
        )}

        {/* Recuerda actualizar el barrio
            cuando también cambió la dirección. */}
        {draft.direccion !==
          patient.direccion && (
          <p className="small mt-3">
            Si te mudaste a otro barrio,
            actualizalo también para revisar tu
            cobertura.
          </p>
        )}

        {/* Acciones del formulario. */}
        <div className="d-flex flex-wrap gap-2 mt-3">
          <button
            className="btn btn-saps"
            disabled={
              changedBarrio &&
              (
                coverage.loading ||
                !!coverage.error ||
                (
                  reassigned &&
                  eligible.length !== 1
                )
              )
            }
          >
            {busy
              ? 'Guardando…'
              : 'Guardar cambios'}
          </button>

          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </fieldset>
      </form>
    </>
  );
}