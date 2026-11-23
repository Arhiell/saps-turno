
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Sección principal de presentación de CORA.
export default function PublicHero() {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <section className="public-hero">
      <div className="container row mx-auto align-items-center g-4">
        {/* Presentación y accesos principales. */}
        <div className="col-lg-7">
          <p className="public-eyebrow">
            SALUD PÚBLICA · GOYA
          </p>

          <h1>
            CORA
          </h1>

          <p className="public-lead">
            Conexión y Organización de la Red de Atención.
          </p>

          <p>
            Una atención más humana, conectada y organizada.
            Conocé las salas municipales, consultá las novedades
            y organizá tu próxima atención en un mismo lugar.
          </p>

          <div className="d-flex flex-wrap gap-3 mt-4" aria-busy={isLoading}>
            {!isLoading && (isAuthenticated ? (
              <Link className="btn btn-success btn-lg" to="/panel">Mi panel</Link>
            ) : (
              <>
                <Link className="btn btn-success btn-lg" to="/login">
                  <i className="bi bi-calendar-plus me-2" aria-hidden="true" />
                  Solicitar / Iniciar sesión
                </Link>
                <Link className="btn btn-outline-success btn-lg" to="/registro">
                  Crear cuenta
                </Link>
              </>
            ))}
          </div>
        </div>

        {/* Representación visual de atención y turnos. */}
        <div className="col-lg-5">
          <div
            className="public-health-visual"
            role="img"
            aria-label="Una salita y un calendario representan el acceso a la atención primaria"
          >
            <i
              className="bi bi-hospital"
              aria-hidden="true"
            />

            <div>
              <i
                className="bi bi-calendar-check"
                aria-hidden="true"
              />

              <span>
                Tu salud, más cerca
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
