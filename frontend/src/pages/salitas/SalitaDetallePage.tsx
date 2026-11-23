import { useEffect, useState } from 'react';

import {
  useNavigate,
  useParams,
  Link,
} from 'react-router-dom';

import ConfirmationModal from '../../components/ui/ConfirmationModal';

import {
  deleteSalita,
  getSalitaById,
} from '../../services/salitas.service';

import { getBarrios } from '../../services/barrios.service';

import type {
  Salita,
} from '../../types/salita.types';

import type {
  Barrio,
} from '../../types/barrio.types';

import '../../styles/salitas.css';

const SalitaDetallePage = () => {
  const { id } = useParams<{
    id: string;
  }>();

  const navigate = useNavigate();

  const [salita, setSalita] =
    useState<Salita | null>(null);

  const [barrio, setBarrio] =
    useState<Barrio | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [deleting, setDeleting] =
    useState(false);
  const [confirmOpen, setConfirmOpen] =
    useState(false);

  useEffect(() => {
    if (!id) {
      setError(
        'No se recibió el identificador de la salita.',
      );

      setLoading(false);

      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [
          salitaResponse,
          barriosResponse,
        ] = await Promise.all([
          getSalitaById(id),
          getBarrios(),
        ]);

        setSalita(
          salitaResponse.data,
        );

        const foundBarrio =
          barriosResponse.data.barrios.find(
            (item) =>
              item.id_barrio ===
              salitaResponse.data
                .id_barrio,
          );

        setBarrio(
          foundBarrio ?? null,
        );
      } catch (error) {
        console.error(error);

        setError(
          'No se pudo cargar la información de la salita.',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!id || !salita) {
      return;
    }

    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!id || !salita) {
      return;
    }

    try {
      setDeleting(true);

      await deleteSalita(id);

      setConfirmOpen(false);
      navigate('/salitas');
    } catch (error) {
      console.error(error);

      setError(
        'No se pudo desactivar la salita.',
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="salitas-loading">
        <div
          className="spinner-border text-success"
          role="status"
        >
          <span className="visually-hidden">
            Cargando...
          </span>
        </div>

        <p className="text-muted mt-3 mb-0">
          Cargando información...
        </p>
      </div>
    );
  }

  if (error || !salita) {
    return (
      <div className="salitas-page">
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error ||
            'No se encontró la salita.'}
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() =>
            navigate('/salitas')
          }
        >
          <i className="bi bi-arrow-left me-2" />
          Volver a salitas
        </button>
      </div>
    );
  }

  return (
    <div className="salitas-page">
      <ConfirmationModal
        open={confirmOpen}
        title="Desactivar salita"
        subtitle="Esta acción requiere confirmación."
        message="¿Querés desactivar la salita?"
        detail={
          <>
            <div className="fw-semibold">{salita.nombre}</div>

            <div className="text-muted small mt-1">
              Código: {salita.codigo}
            </div>
          </>
        }
        confirmText="Desactivar salita"
        cancelText="Cancelar"
        variant="danger"
        icon="bi-hospital"
        loading={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void confirmDelete()}
      />

      {/* ENCABEZADO */}
      <div className="salitas-detail-top">

        <div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary salitas-back-button"
            onClick={() =>
              navigate('/salitas')
            }
          >
            <i className="bi bi-arrow-left me-1" />
            Volver a salitas

          </button>

          <div className="salitas-detail-title">

            <div className="salitas-detail-icon">
              <i className="bi bi-hospital" />
            </div>

            <div>
              <h1>
                {salita.nombre}
              </h1>

              <div className="salitas-detail-code">
                Código: {salita.codigo}
              </div>
            </div>

          </div>
        </div>

        <div className="salitas-detail-actions">
          <Link className="btn btn-saps text-nowrap d-inline-flex align-items-center" to={`/configuracion/cobertura?salita=${salita.id_salita}`}>
            <i className="bi bi-geo-alt me-2" />
            <span>Barrios de cobertura</span>
          </Link>

          <button
            type="button"
            className="btn btn-outline-success text-nowrap d-inline-flex align-items-center"
            onClick={() =>
              navigate(
                `/salitas/${salita.id_salita}/editar`,
              )
            }
          >
            <i className="bi bi-pencil me-2" />
            <span>Editar</span>
          </button>

          {salita.activo && (
            <button
              type="button"
              className="btn btn-outline-danger text-nowrap d-inline-flex align-items-center"
              onClick={handleDelete}
              disabled={deleting}
            >
              <i className="bi bi-shield-slash me-2" />
              <span>{deleting ? 'Desactivando...' : 'Desactivar'}</span>
            </button>
          )}

        </div>

      </div>

      {error && (
        <div
          className="alert alert-danger mb-4"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="row g-4">

        {/* INFORMACIÓN GENERAL */}
        <div className="col-lg-8">
          <section className="salitas-section h-100">

            <div className="salitas-section-header">
              <h2>
                Información general
              </h2>

              <p>
                Datos registrados de la
                salita.
              </p>
            </div>

            <div className="salitas-info-grid">

              <div className="salitas-info-item">
                <span className="salitas-info-label">
                  Código
                </span>

                <span className="salitas-info-value">
                  {salita.codigo}
                </span>
              </div>

              <div className="salitas-info-item">
                <span className="salitas-info-label">
                  Estado
                </span>

                <span
                  className={`salitas-status ${
                    salita.activo
                      ? 'active'
                      : 'inactive'
                  }`}
                >
                  <i
                    className={`bi ${
                      salita.activo
                        ? 'bi-check-circle'
                        : 'bi-dash-circle'
                    }`}
                  />

                  {salita.activo
                    ? 'Activa'
                    : 'Inactiva'}
                </span>
              </div>

              <div className="salitas-info-item">
                <span className="salitas-info-label">
                  Dirección
                </span>

                <span className="salitas-info-value">
                  {salita.direccion}
                </span>
              </div>

              <div className="salitas-info-item">
                <span className="salitas-info-label">
                  Barrio
                </span>

                <span className="salitas-info-value">
                  {barrio?.nombre ||
                    'No disponible'}
                </span>
              </div>

              <div className="salitas-info-item">
                <span className="salitas-info-label">
                  Teléfono
                </span>

                <span
                  className={`salitas-info-value ${
                    !salita.telefono
                      ? 'salitas-empty-value'
                      : ''
                  }`}
                >
                  {salita.telefono ||
                    'No informado'}
                </span>
              </div>

              <div className="salitas-info-item">
                <span className="salitas-info-label">
                  Email
                </span>

                <span
                  className={`salitas-info-value ${
                    !salita.email
                      ? 'salitas-empty-value'
                      : ''
                  }`}
                >
                  {salita.email ||
                    'No informado'}
                </span>
              </div>

            </div>

          </section>
        </div>

        {/* HORARIO */}
        <div className="col-lg-4">
          <section className="salitas-section h-100">

            <div className="salitas-section-header">
              <h2>
                Horario de atención
              </h2>

              <p>
                Horario general de
                funcionamiento.
              </p>
            </div>

            <div className="salitas-schedule">

              <div className="salitas-schedule-item">
                <span className="salitas-schedule-label">
                  Apertura
                </span>

                <strong className="salitas-schedule-value">
                  {salita.horario_apertura ||
                    '--:--'}
                </strong>
              </div>

              <div className="salitas-schedule-item">
                <span className="salitas-schedule-label">
                  Cierre
                </span>

                <strong className="salitas-schedule-value">
                  {salita.horario_cierre ||
                    '--:--'}
                </strong>
              </div>

            </div>

          </section>
        </div>

        {/* UBICACIÓN */}
        <div className="col-12">
          <section className="salitas-section">

            <div className="salitas-section-header">
              <h2>
                Ubicación
              </h2>

              <p>
                Coordenadas geográficas
                registradas para la salita.
              </p>
            </div>

            <div className="salitas-location">

              <div className="salitas-location-item">
                <span className="salitas-location-label">
                  Latitud
                </span>

                <span
                  className={`salitas-location-value ${
                    salita.latitud ===
                      null
                      ? 'salitas-empty-value'
                      : ''
                  }`}
                >
                  {salita.latitud ??
                    'No informada'}
                </span>
              </div>

              <div className="salitas-location-item">
                <span className="salitas-location-label">
                  Longitud
                </span>

                <span
                  className={`salitas-location-value ${
                    salita.longitud ===
                      null
                      ? 'salitas-empty-value'
                      : ''
                  }`}
                >
                  {salita.longitud ??
                    'No informada'}
                </span>
              </div>

            </div>

          </section>
        </div>

      </div>
    </div>
  );
};

export default SalitaDetallePage;
