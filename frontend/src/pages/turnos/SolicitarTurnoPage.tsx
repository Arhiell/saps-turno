import {
  Link,
} from 'react-router-dom';

import {
  useAuth,
} from '../../context/AuthContext';

import usePatientCoverage, {
  coveredClinics,
} from '../../context/usePatientCoverage';

import PatientCoverageCard from '../../components/ui/PatientCoverageCard';
import PatientBookingForm from '../../components/ui/PatientBookingForm';
import { useState } from 'react';
import useManagedPatients from '../../context/useManagedPatients';
import ManagedPatientSelector from '../../components/ui/ManagedPatientSelector';

export default function SolicitarTurnoPage() {
  // Obtiene el perfil del paciente autenticado.
  const {
    patient: ownPatient,
  } = useAuth();
  const selection = useManagedPatients();
  const patient = selection.selected;
  const [busy, setBusy] = useState(false);

  // Obtiene barrios, salitas y relaciones
  // necesarias para validar la cobertura.
  const coverage = usePatientCoverage();

  // ========================================
  // PERFIL INCOMPLETO
  // ========================================

  // Si todavía no completó su perfil,
  // debe hacerlo antes de solicitar un turno.
  if (!ownPatient) {
    return (
      <section className="patient-section">
        <h1 className="h3">
          Solicitar turno
        </h1>

        <p>
          Completá tu perfil para conocer tu cobertura.
        </p>

        <Link
          className="btn btn-saps"
          to="/completar-perfil"
        >
          Completar perfil
        </Link>
      </section>
    );
  }

  // ========================================
  // VALIDACIÓN DE COBERTURA
  // ========================================

  // Verifica que la salita asignada al paciente
  // tenga cobertura vigente para su barrio.
  const valid = patient && coveredClinics(
    patient.id_barrio,
    coverage.clinics,
    coverage.relations
  ).some(
    (c) =>
      c.id_salita ===
      patient.id_salita_asignada
  );

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <section>
      <h1 className="h3">
        Solicitar turno
      </h1>

      <ManagedPatientSelector selection={selection} disabled={busy} />

      <p className="text-muted mb-4">
        Elegí una especialidad y un profesional de tu salita,
        y después uno de sus días disponibles.
      </p>

      {!selection.loading && !selection.error && patient && <div className="row g-4">
        {/* Información de cobertura del paciente. */}
        <div className="col-12 col-lg-5">
          <PatientCoverageCard
            patient={patient}
            coverage={coverage}
          />
        </div>

        {/* =====================================
            RESERVA DEL TURNO
            ===================================== */}

        <div className="col-12 col-lg-7">
          {/* Si la cobertura es válida,
              permite solicitar el turno. */}
          {!coverage.loading &&
            !coverage.error &&
            valid && (
              <PatientBookingForm
                key={patient.id_paciente}
                patientId={patient.id_paciente}
                onBusyChange={setBusy}
                clinic={
                  patient.id_salita_asignada
                }
              />
            )}

          {/* Si la salita asignada no tiene
              cobertura vigente, bloquea la reserva. */}
          {!coverage.loading &&
            !coverage.error &&
            !valid && (
              <div className="patient-section">
                <p>
                  Necesitamos revisar la cobertura de la persona seleccionada
                  antes de reservar. Contactá a su salita para actualizar sus datos.
                </p>

                <Link
                  className="btn btn-outline-success"
                  to={patient.id_paciente === ownPatient.id_paciente ? '/mi-perfil' : '/personas-a-cargo'}
                >
                  Volver a los datos del paciente
                </Link>
              </div>
            )}
        </div>
      </div>}
    </section>
  );
}
