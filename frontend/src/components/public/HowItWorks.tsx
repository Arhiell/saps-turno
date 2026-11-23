import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Pasos principales para que el paciente pueda solicitar atención.
const steps = [
  [
    'bi-person-plus',
    'Registrate',
    'Creá tu cuenta de paciente con tus datos.',
  ],
  [
    'bi-person-vcard',
    'Completá tu perfil',
    'Mantené tus datos personales y de contacto actualizados.',
  ],
  [
    'bi-geo-alt',
    'Conocé tu salita',
    'Consultá tu cobertura según tu domicilio.',
  ],
  [
    'bi-person-badge',
    'Elegí la atención',
    'Buscá especialidad y profesional disponibles.',
  ],
  [
    'bi-calendar-check',
    'Solicitá tu turno',
    'Elegí un día y horario y revisá la confirmación.',
  ],
  [
    'bi-bell',
    'Consultá tus notificaciones',
    'Revisá los avisos y cambios desde tu cuenta.',
  ],
];

// Explica el funcionamiento general del sistema al paciente.
export default function HowItWorks() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <>
      <section
        id="como-funciona"
        className="container public-section"
      >
        <p className="public-eyebrow">
          PASO A PASO
        </p>

        <h2>
          ¿Cómo funciona?
        </h2>

        <ol className="row g-3 list-unstyled mt-2">
          {steps.map(
            (
              [
                icon,
                title,
                text,
              ],
              index
            ) => (
              <li
                className="col-sm-6 col-lg-4"
                key={title}
              >
                <div className="card h-100 p-4">
                  <span className="public-step">
                    <i
                      className={`bi ${icon}`}
                      aria-hidden="true"
                    />{' '}
                    {index + 1}
                  </span>

                  <h3 className="h5 mt-3">
                    {title}
                  </h3>

                  <p className="mb-0">
                    {text}
                  </p>
                </div>
              </li>
            )
          )}
        </ol>
      </section>

      {/* Accesos de ayuda para registro e ingreso al sistema. */}
      <section
        id="ayuda"
        className="container public-section"
      >
        <h2>
          Estamos para orientarte
        </h2>

        <div className="row g-3 mt-2">
          <div className="col-md-6">
            <div className="card p-4 h-100">
              <h3 className="h5">
                {isAuthenticated ? 'Continuá desde tu panel' : '¿Todavía no tenés cuenta?'}
              </h3>

              <p>
                {isAuthenticated
                  ? 'Accedé a las funciones de tu cuenta desde tu panel.'
                  : 'El registro público es exclusivo para pacientes. Una vez que ingreses, completá tu perfil para solicitar atención.'}
              </p>

              {!isLoading && <Link to={isAuthenticated ? '/panel' : '/registro'}>
                {isAuthenticated ? 'Mi panel' : 'Crear mi cuenta'}{' '}
                <i
                  className="bi bi-arrow-right"
                  aria-hidden="true"
                />
              </Link>}
            </div>
          </div>

          <div className="col-md-6">
            <div className="card p-4 h-100">
              <h3 className="h5">
                ¿Necesitás ayuda para ingresar?
              </h3>

              <p>
                Podés recuperar tu contraseña o comunicarte con tu
                salita a través de los datos de contacto publicados.
              </p>

              <Link to="/recuperar-contrasena">
                Recuperar contraseña
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
