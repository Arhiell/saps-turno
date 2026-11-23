import { useEffect, useState } from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import SalitaForm from '../../components/salitas/SalitaForm';

import {
  getSalitaById,
  updateSalita,
} from '../../services/salitas.service';

import type {
  CreateSalitaRequest,
  Salita,
} from '../../types/salita.types';

const EditarSalitaPage = () => {
  const { id } = useParams<{
    id: string;
  }>();

  const navigate = useNavigate();

  const [salita, setSalita] =
    useState<Salita | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    if (!id) {
      setError(
        'No se recibió el identificador de la salita.',
      );

      setLoading(false);

      return;
    }

    const loadSalita = async () => {
      try {
        setLoading(true);
        setError('');

        const response =
          await getSalitaById(id);

        setSalita(response.data);
      } catch (error) {
        console.error(error);

        setError(
          'No se pudo cargar la salita.',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadSalita();
  }, [id]);

  const handleSubmit = async (
    data: CreateSalitaRequest,
  ) => {
    if (!id) {
      return;
    }

    setSaving(true);

    try {
      await updateSalita(id, data);

      navigate('/salitas');
    } finally {
      setSaving(false);
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

        <p className="text-muted mt-3">
          Cargando información de la
          salita...
        </p>
      </div>
    );
  }

  if (error || !salita) {
    return (
      <div>
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
    <div>
      <div className="dashboard-header mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() =>
                navigate('/salitas')
              }
            >
              <i className="bi bi-arrow-left me-1" />
              Volver a Salitas
            </button>
          </div>

          <h1>Editar salita</h1>

          <p>
            Modificá los datos de{' '}
            <strong>
              {salita.nombre}
            </strong>
            .
          </p>
        </div>
      </div>

      <SalitaForm
        initialData={salita}
        submitLabel="Guardar cambios"
        loading={saving}
        showActive
        onSubmit={handleSubmit}
        onCancel={() =>
          navigate('/salitas')
        }
      />
    </div>
  );
};

export default EditarSalitaPage;
