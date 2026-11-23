import { useEffect, useState } from 'react';

import { authError } from '../../utils/auth-errors';
import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import ProfesionalForm, {
  type ProfessionalFormData,
} from '../../components/profesionales/ProfesionalForm';

import {
  getProfessionalById,
  updateProfessional,
} from '../../services/profesionales.service';

import type {
  Professional,
} from '../../types/profesional.types';

interface EditarProfesionalLocationState {
  professional?: Professional;
  returnTo?: string;
  returnLabel?: string;
}

const EditarProfesionalPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const navigationState =
    (location.state as EditarProfesionalLocationState | null) ??
    null;

  /*
   * Si venimos desde el detalle, volvemos al detalle.
   *
   * Si venimos desde el listado, volvemos al listado.
   *
   * Si entramos directamente a la URL de edición,
   * tomamos el listado como lugar de retorno.
   */
  const defaultDetailPath = id
    ? `/profesionales/${id}`
    : '/profesionales';

  const returnTo =
    navigationState?.returnTo ??
    (navigationState?.professional
      ? defaultDetailPath
      : '/profesionales');

  const returnLabel =
    navigationState?.returnLabel ??
    (navigationState?.professional
      ? 'Volver al profesional'
      : 'Volver a profesionales');

  const [professional, setProfessional] =
    useState<Professional | null>(
      navigationState?.professional ?? null,
    );

  const [loading, setLoading] =
    useState(!navigationState?.professional);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    if (!id) {
      setError(
        'No se especificó el profesional.',
      );

      setLoading(false);

      return;
    }

    if (navigationState?.professional) {
      setProfessional(
        navigationState.professional,
      );

      setLoading(false);

      return;
    }

    const loadProfessional = async () => {
      try {
        setLoading(true);
        setError('');

        const response =
          await getProfessionalById(id);

        setProfessional(response.data);
      } catch (cause) {
        console.error(cause);

        setError(
          'No se pudo cargar el profesional.',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProfessional();
  }, [
    id,
    navigationState?.professional,
  ]);

  const handleSubmit = async (
    data: ProfessionalFormData,
  ) => {
    if (!id || !professional) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      await updateProfessional(id, {
        dni: data.dni,
        nombres: data.nombres,
        apellidos: data.apellidos,
        fecha_nacimiento:
          data.fecha_nacimiento || null,
        sexo: data.sexo,
        telefono:
          data.telefono || null,
        email:
          data.email || null,
        direccion:
          data.direccion || null,
        localidad: data.localidad,
        provincia: data.provincia,
        codigo_postal:
          data.codigo_postal || null,
        matricula: data.matricula,
      });

      const updatedProfessional: Professional = {
        ...professional,

        matricula: data.matricula,

        persona: {
          ...professional.persona,

          dni: data.dni,
          nombres: data.nombres,
          apellidos: data.apellidos,

          fecha_nacimiento:
            data.fecha_nacimiento || null,

          sexo: data.sexo,

          telefono:
            data.telefono || null,

          email:
            data.email || null,

          direccion:
            data.direccion || null,

          localidad: data.localidad,

          provincia: data.provincia,

          codigo_postal:
            data.codigo_postal || null,
        },
      };

      setProfessional(
        updatedProfessional,
      );

      /*
       * Si editamos desde el detalle,
       * volvemos al detalle con los datos actualizados.
       *
       * Si editamos desde el listado,
       * volvemos directamente al listado.
       */
      if (
        returnTo ===
        `/profesionales/${id}`
      ) {
        navigate(
          returnTo,
          {
            replace: true,

            state: {
              professional:
                updatedProfessional,

              message:
                'Los datos del profesional se actualizaron correctamente.',

              messageTitle:
                'Datos actualizados',
            },
          },
        );

        return;
      }

      navigate(
        returnTo,
        {
          replace: true,

          state: {
            professional:
              updatedProfessional,

            message:
              'Los datos del profesional se actualizaron correctamente.',

            messageTitle:
              'Datos actualizados',
          },
        },
      );
    } catch (cause) {
      console.error(cause);

      setError(authError(cause));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    navigate(
      returnTo,
      {
        state: professional
          ? {
              professional,
            }
          : undefined,
      },
    );
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
          className="btn btn-outline-secondary"
          onClick={() =>
            navigate('/profesionales')
          }
        >
          <i className="bi bi-arrow-left me-2" />
          Volver
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          className="btn btn-outline-secondary mb-3"
          onClick={goBack}
        >
          <i className="bi bi-arrow-left me-2" />
          {returnLabel}
        </button>

        <h2 className="fw-bold mb-1">
          Editar profesional
        </h2>

        <p className="text-muted mb-0">
          Modificar los datos del profesional.
        </p>
      </div>

      <ProfesionalForm
        professional={professional}
        loading={saving}
        error={error}
        onDismissError={() => setError('')}
        onSubmit={handleSubmit}
        onCancel={goBack}
      />
    </div>
  );
};

export default EditarProfesionalPage;
