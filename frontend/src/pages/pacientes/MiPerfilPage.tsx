import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  useAuth,
} from '../../context/AuthContext';

import usePatientCoverage from '../../context/usePatientCoverage';
import { useAgendaSocket } from '../../context/AgendaSocketContext';

import PatientCoverageCard from '../../components/ui/PatientCoverageCard';
import PatientProfileForm from '../../components/ui/PatientProfileForm';
import AccountSecuritySection from '../../components/ui/AccountSecuritySection';
import PrivacySection from '../../components/ui/PrivacySection';



// PERFIL DEL PACIENTE

function PatientProfile() {
  // Obtiene los datos del paciente y usuario
  // desde el contexto de autenticación.
  const {
    patient,
    reloadProfile,
    user,
  } = useAuth();

  // Obtiene la información de cobertura.
  const coverage = usePatientCoverage();

  // Controla la edición del perfil.
  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState('');

  // Sincronización automática por WebSockets
  const { ultimoEventoPaciente, resyncTick } = useAgendaSocket();
  const { retry: retryCoverage } = coverage;
  const lastPatientEventIdRef = useRef<string | null>(
    ultimoEventoPaciente?.id ?? null
  );
  const lastResyncTickRef = useRef<number>(resyncTick);

  useEffect(() => {
    if (!ultimoEventoPaciente) return;
    if (lastPatientEventIdRef.current === ultimoEventoPaciente.id) return;
    lastPatientEventIdRef.current = ultimoEventoPaciente.id;

    void reloadProfile();
    retryCoverage();
  }, [ultimoEventoPaciente, reloadProfile, retryCoverage]);

  useEffect(() => {
    if (resyncTick > 0 && resyncTick !== lastResyncTickRef.current) {
      lastResyncTickRef.current = resyncTick;
      void reloadProfile();
      retryCoverage();
    }
  }, [resyncTick, reloadProfile, retryCoverage]);

  // PERFIL INCOMPLETO

  // Si el usuario todavía no tiene datos
  // de paciente, permite completar el perfil.
  if (!patient) {
    return (
      <div className="patient-section">
        <h1 className="h3">
          Mi perfil
        </h1>

        <p>
          Todavía no completaste tus datos.
        </p>

        <Link
          className="btn btn-saps"
          to="/completar-perfil"
        >
          Completar perfil
        </Link>
        <PrivacySection />
      </div>
    );
  }

  // SECCIONES DEL PERFIL

  const sections = [
    {
      title: 'Información personal',
      icon: 'bi-person-badge',
      fields: {
        Nombres: patient.nombres,
        Apellidos: patient.apellidos,
        DNI: patient.dni,
        'Fecha de nacimiento': patient.fecha_nacimiento?.split('-').reverse().join('/'),
        Sexo: patient.sexo?.replaceAll('_', ' '),
      },
    },
    {
      title: 'Datos de contacto',
      icon: 'bi-telephone',
      fields: {
        Teléfono: patient.telefono,
        'Correo electrónico': user?.email,
        Dirección: patient.direccion,
      },
    },
    {
      title: 'Cobertura médica y emergencia',
      icon: 'bi-heart-pulse',
      fields: {
        'Obra social': patient.obra_social,
        'Número de afiliado': patient.numero_afiliado,
        'Contacto de emergencia': patient.contacto_emergencia_nombre,
        'Teléfono de emergencia': patient.contacto_emergencia_telefono,
      },
    },
  ];

  const missingProfileFields = [
    !patient.nombres && 'nombres',
    !patient.apellidos && 'apellidos',
    !patient.dni && 'DNI',
    !patient.telefono && 'teléfono',
    !patient.direccion && 'dirección',
    !patient.id_barrio && 'barrio',
    !patient.id_salita_asignada && 'salita asignada',
  ].filter(Boolean) as string[];

  // INTERFAZ DEL PACIENTE

  return (
    <div>
      {/* Encabezado y acciones principales. */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">
            Mi perfil
          </h1>

          <p className="text-muted mb-0">
            Tus datos personales, contacto y lugar de atención asignado.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          {/* Activa la edición del perfil */}
          <button
            type="button"
            className="btn btn-saps d-inline-flex align-items-center gap-1"
            disabled={editing}
            onClick={() => {
              setEditing(true);
              setMessage('');
            }}
          >
            <i className="bi bi-pencil-square" aria-hidden="true" />
            <span>Editar información</span>
          </button>
        </div>
      </div>

      {/* Mensaje de éxito. */}
      {message && (
        <div
          className="alert alert-success"
          role="status"
        >
          {message}
        </div>
      )}

      {missingProfileFields.length > 0 && !editing && (
        <div className="alert alert-warning" role="status">
          Tu perfil está incompleto. Faltan datos importantes: {missingProfileFields.join(', ')}. Completá esta información para mejorar tu atención.
        </div>
      )}

      {/* Formulario de edición del perfil. */}
      {editing && (
        <PatientProfileForm
          patient={patient}
          coverage={coverage}
          onClose={() =>
            setEditing(false)
          }
          onSaved={() => {
            setEditing(false);

            setMessage(
              'Tu perfil fue actualizado.'
            );

            coverage.retry();
          }}
        />
      )}

      {/* INFORMACIÓN PERSONAL Y COBERTURA */}

      <div className="row g-4">
        {/* Datos personales. */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm p-4 bg-white rounded-3 h-100">
            <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
              <i className={`bi ${sections[0].icon} text-success`} aria-hidden="true" />
              <span>{sections[0].title}</span>
            </h2>

            <dl className="row g-3 mb-0">
              {Object.entries(sections[0].fields).map(([label, value]) => {
                const isNumeric = ['DNI', 'Fecha de nacimiento'].includes(label);
                return (
                  <div className="col-12 col-sm-6" key={label}>
                    <dt className="text-muted small fw-semibold">{label}</dt>
                    <dd className={`fw-medium text-dark mb-0 ${isNumeric ? 'text-nowrap' : 'text-break'}`}>
                      {value || <span className="text-muted fst-italic">Sin informar</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>

        {/* Cobertura y salita asignada. */}
        <div className="col-12 col-lg-6">
          <PatientCoverageCard
            patient={patient}
            coverage={coverage}
          />
        </div>

        {/* Obra social, contacto y emergencia */}
        {sections.slice(1).map((section) => (
          <div className="col-12 col-lg-6" key={section.title}>
            <div className="card border-0 shadow-sm p-4 bg-white rounded-3 h-100">
              <h2 className="h5 fw-bold mb-3 d-flex align-items-center gap-2 text-dark">
                <i className={`bi ${section.icon} text-success`} aria-hidden="true" />
                <span>{section.title}</span>
              </h2>

              <dl className="row g-3 mb-0">
                {Object.entries(section.fields).map(([label, value]) => {
                  const isNumeric = ['Teléfono', 'Teléfono de emergencia', 'Número de afiliado'].includes(label);
                  return (
                    <div className="col-12 col-sm-6" key={label}>
                      <dt className="text-muted small fw-semibold">{label}</dt>
                      <dd className={`fw-medium text-dark mb-0 ${isNumeric ? 'text-nowrap' : 'text-break'}`}>
                        {value || <span className="text-muted fst-italic">Sin informar</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
        ))}
      </div>

      <AccountSecuritySection />
      <PrivacySection />
    </div>
  );
}

// PÁGINA MI PERFIL

export default function MiPerfilPage() {
  const {
    user,
  } = useAuth();

  // Los pacientes utilizan el perfil completo.
  if (
    user?.rol === 'PACIENTE'
  ) {
    return (
      <PatientProfile />
    );
  }

  // Para otros roles se muestra
  // información básica de la cuenta.
  return (
    <section className="card shadow-sm">
      <div className="card-body">
        <h1 className="h3">
          Mi perfil
        </h1>

        <dl>
          <dt>
            Usuario
          </dt>

          <dd>
            {user?.nombre_usuario}
          </dd>

          <dt>
            Correo
          </dt>

          <dd>
            {user?.email}
          </dd>
        </dl>

        <p className="text-muted">
          Para actualizar tus datos,
          contactá a tu salita.
        </p>
      </div>
    </section>
  );
}
