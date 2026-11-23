import { useEffect, useState } from 'react';

import { useAuth } from '../../context/AuthContext';
import { roleLabels } from '../../components/layout/sidebar-menu';
import { PROFESSIONAL_MESSAGE_TIMEOUT_MS, useAutoDismiss } from '../../utils/useAutoDismiss';

import PersonalProfileForm from '../../components/ui/PersonalProfileForm';
import ProfileInfoCard from '../../components/ui/ProfileInfoCard';
import AccountSecuritySection from '../../components/ui/AccountSecuritySection';
import PrivacySection from '../../components/ui/PrivacySection';

// Muestra el perfil personal y la información de cuenta de administradores y profesionales.
export default function AdminProfilePage() {
  const { user, person, roleInfo, reloadProfile } = useAuth();

  // Controla la edición y actualización del perfil.
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Almacena los mensajes de error y confirmación.
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isProfessional = user?.rol === 'PROFESIONAL';
  useAutoDismiss(message, setMessage, PROFESSIONAL_MESSAGE_TIMEOUT_MS, isProfessional);
  useAutoDismiss(error, setError, PROFESSIONAL_MESSAGE_TIMEOUT_MS, isProfessional);

  // Carga automáticamente los datos actualizados del perfil al ingresar.
  useEffect(() => {
    let active = true;
    void reloadProfile().catch(() => {
      if (active) {
        setError('No pudimos cargar tu perfil. Volvé a intentar.');
      }
    });
    return () => {
      active = false;
    };
  }, [reloadProfile]);

  // Obtiene la información profesional asociada al usuario.
  const professional = roleInfo?.professional;

  // Muestra una lista de valores mediante etiquetas.
  const badges = (values: string[]) =>
    values.length ? (
      <div className="d-flex flex-wrap gap-2">
        {values.map((value, index) => (
          <span
            key={`${index}-${value}`}
            className="badge bg-success-subtle text-success text-wrap text-break mw-100"
          >
            {value}
          </span>
        ))}
      </div>
    ) : (
      'Sin informar'
    );

  return (
    <div>
      {/* Encabezado con los datos principales del usuario. */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="text-break">
          <h1 className="h3 mb-1">
            Mi perfil
          </h1>

          <p className="text-muted mb-2">
            Tus datos personales y tu cuenta de acceso.
          </p>

          {person && (
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="badge bg-light text-dark border px-2 py-1 fs-6 fw-semibold d-inline-flex align-items-center">
                <i
                  className="bi bi-person-circle text-success me-1"
                  aria-hidden="true"
                />
                {person.nombres} {person.apellidos}
              </span>

              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                {roleLabels[user?.rol ?? '']}
              </span>
            </div>
          )}
        </div>

        {/* Acciones para editar el perfil. */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {busy && (
            <span className="spinner-border spinner-border-sm text-success" role="status" aria-label="Sincronizando perfil…" />
          )}

          <button
            className="btn btn-saps d-inline-flex align-items-center gap-2"
            disabled={busy || editing || !person}
            onClick={() => {
              setEditing(true);
              setMessage('');
              setError('');
            }}
          >
            <i className="bi bi-pencil-square" aria-hidden="true" />
            <span>Editar perfil</span>
          </button>
        </div>
      </div>

      {/* Muestra los mensajes de error o confirmación. */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert alert-success" role="status">
          {message}
        </div>
      )}

      {/* Informa cuando no existen datos personales vinculados. */}
      {!person && (
        <div className="alert alert-warning">
          No hay datos personales vinculados.
          Contactá a administración para revisar tu perfil.
        </div>
      )}

      {/* Muestra el formulario de edición del perfil. */}
      {editing && person && (
        <PersonalProfileForm
          person={person}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            setMessage('Tu perfil se actualizó correctamente.');
            try {
              setBusy(true);
              await reloadProfile();
            } catch {
              // Silencioso si falla la recarga secundaria tras el guardado
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {/* Muestra las tarjetas con información del perfil. */}
      <div className="row g-4" aria-busy={busy}>
        {/* Datos personales del usuario. */}
        {person && (
          <div className="col-12 col-lg-6">
            <ProfileInfoCard
              title="Datos personales"
              fields={{
                Nombres: person.nombres,
                Apellidos: person.apellidos,
                DNI: person.dni,
                'Fecha de nacimiento': person.fecha_nacimiento
                  ?.split('-')
                  .reverse()
                  .join('/'),
                Sexo: person.sexo?.replaceAll('_', ' '),
                Teléfono: person.telefono,
                'Correo personal': person.email,
                Dirección: person.direccion,
                Localidad: person.localidad,
                Provincia: person.provincia,
                'Código postal': person.codigo_postal,
              }}
            />
          </div>
        )}

        {/* Datos de la cuenta de acceso. */}
        <div className="col-12 col-lg-6">
          <ProfileInfoCard
            title="Datos de la cuenta"
            fields={{
              Usuario: user?.nombre_usuario,
              'Correo de acceso': user?.email,
              Rol: roleLabels[user?.rol ?? ''],
              Estado: user?.activo === undefined
                ? 'Sin informar'
                : user.activo
                  ? 'Activa'
                  : 'Inactiva',
              'Verificación de correo': user?.email_verificado
                ? 'Verificado'
                : 'Pendiente',
            }}
          />
        </div>

        {/* Información profesional o administrativa según el rol. */}
        <div className="col-12">
          <ProfileInfoCard
            title={
              user?.rol === 'PROFESIONAL'
                ? 'Información profesional'
                : 'Información administrativa'
            }
            fields={
              user?.rol === 'SUPER_ADMIN'
                ? {
                    Alcance: 'Administración general',
                  }
                : {
                    ...(user?.rol === 'PROFESIONAL'
                      ? {
                          Matrícula: professional?.license,
                          'Estado profesional': professional
                            ? professional.active
                              ? 'Activo'
                              : 'Inactivo'
                            : 'Sin informar',
                          Especialidades: badges(
                            professional?.specialties ?? []
                          ),
                        }
                      : {}),
                    'Salitas asignadas': badges(
                      (roleInfo?.clinics ?? []).map(
                        clinic =>
                          `${clinic.name}${
                            clinic.primary ? ' (principal)' : ''
                          }${
                            clinic.active ? '' : ' (inactiva)'
                          }`
                      )
                    ),
                  }
            }
          />
        </div>
      </div>

      {/* Opciones para administrar la seguridad de la cuenta. */}
      <AccountSecuritySection />
      <PrivacySection />
    </div>
  );
}
