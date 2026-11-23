
import { useState } from 'react';

import type {
  Patient,
} from '../../types/patient.types';

import usePatientCoverage, {
  coveredClinics,
} from '../../context/usePatientCoverage';

export default function PatientCoverageCard({
  patient,
  coverage,
}: {
  patient: Pick<Patient, 'id_barrio' | 'id_salita_asignada'>;
  coverage: ReturnType<typeof usePatientCoverage>;
}) {
  const [expanded, setExpanded] = useState(false);

  const {
    barrios,
    clinics,
    zones,
    relations,
    loading,
    error,
    retry,
  } = coverage;

  // Busca el barrio actual del paciente.
  const barrio = barrios.find(
    (b) => b.id_barrio === patient.id_barrio
  );

  // Busca la salita asignada.
  const clinic = clinics.find(
    (c) => c.id_salita === patient.id_salita_asignada
  );

  // Obtiene las salitas que cubren el barrio.
  const covered = coveredClinics(
    patient.id_barrio,
    clinics,
    relations
  );

  const zoneName = zones.find(
    (z) => z.id_zona === barrio?.id_zona
  )?.nombre;

  const hasCoverage = covered.some(
    (c) => c.id_salita === patient.id_salita_asignada
  );

  return (
    <section className="patient-section h-100 patient-coverage-card">
      <div className="patient-coverage-header">
        <div>
          <span className="patient-selector-kicker">Cobertura</span>
          <h2 className="h5 mb-0">Mi cobertura</h2>
        </div>
        {!loading && !error && (
          <span className={`coverage-status-pill ${hasCoverage ? 'is-valid' : 'is-warning'}`}>
            {hasCoverage ? 'Cobertura vigente' : 'Revisión necesaria'}
          </span>
        )}
      </div>

      {/* Resumen de cobertura para celulares. */}
      <button
        type="button"
        className="patient-coverage-summary"
        aria-expanded={expanded}
        onClick={() => setExpanded((previous) => !previous)}
      >
        <span className="patient-coverage-summary-icon">
          <i
            className="bi bi-hospital"
            aria-hidden="true"
          />
        </span>

        <span className="patient-coverage-summary-text">
          <strong>Mi cobertura</strong>

          <span>
            {loading
              ? 'Cargando información…'
              : clinic?.nombre ?? 'Salita no disponible'}
          </span>

          {!loading && (
            <small>
              {barrio?.nombre ?? 'Barrio sin informar'}
              {zoneName ? ` · ${zoneName}` : ''}
            </small>
          )}
        </span>

        <i
          className={`bi ${
            expanded ? 'bi-chevron-up' : 'bi-chevron-down'
          } patient-coverage-chevron`}
          aria-hidden="true"
        />
      </button>

      {/* Información completa de cobertura. */}
      <div
        className={`patient-coverage-content ${
          expanded ? 'is-expanded' : ''
        }`}
      >
        <div className="patient-coverage-grid mb-3">
          <div className="patient-coverage-mini">
            <span>Barrio</span>
            <strong>{barrio?.nombre ?? 'Sin información'}</strong>
          </div>
          <div className="patient-coverage-mini">
            <span>Zona</span>
            <strong>{zoneName ?? 'Sin información'}</strong>
          </div>
          <div className="patient-coverage-mini">
            <span>Salita</span>
            <strong>{clinic?.nombre ?? 'Sin información'}</strong>
          </div>
        </div>

        {loading ? (
          <div className="p-3 text-center text-muted" role="status">
            <div className="spinner-border spinner-border-sm text-success me-2" aria-hidden="true" />
            <span className="align-middle">Cargando cobertura…</span>
          </div>
        ) : error ? (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {error}{' '}

            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={retry}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <dl className="mb-0 patient-coverage-list">
              <div>
                <dt>Dirección de la salita</dt>
                <dd>{clinic?.direccion || 'Sin informar'}</dd>
              </div>

              <div>
                <dt>Teléfono</dt>
                <dd>
                  {clinic?.telefono ? (
                    <a
                      href={`tel:${clinic.telefono.replace(
                        /[^+\d]/g,
                        ''
                      )}`}
                      className="text-nowrap"
                    >
                      {clinic.telefono}
                    </a>
                  ) : (
                    'Sin informar'
                  )}
                </dd>
              </div>

              <div>
                <dt>Horario institucional</dt>
                <dd>
                  {clinic?.horario_apertura &&
                  clinic.horario_cierre
                    ? `${clinic.horario_apertura.slice(
                        0,
                        5
                      )} a ${clinic.horario_cierre.slice(
                        0,
                        5
                      )}`
                    : 'Consultá los horarios en tu salita'}
                </dd>
              </div>
            </dl>

            {!hasCoverage && (
              <div className="alert alert-warning mb-0">
                Tu asignación no tiene cobertura vigente. Contactá a administración para revisarla.
              </div>
            )}

            {covered.length > 1 && (
              <p className="small text-muted mb-0 mt-3">
                Salitas que cubren tu barrio:{' '}
                {covered
                  .map((c) => c.nombre)
                  .join(', ')}
                . Para reservar se utiliza tu salita asignada.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
