import { useState } from 'react';
import { authError } from '../../utils/auth-errors';
import { useNavigate } from 'react-router-dom';

import ProfesionalForm, {
  type ProfessionalFormData,
} from '../../components/profesionales/ProfesionalForm';

import {
  createProfessional,
} from '../../services/profesionales.service';

const NuevoProfesionalPage = () => {
  const navigate = useNavigate();

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const handleSubmit = async (
    data: ProfessionalFormData,
  ) => {
    try {
      setSaving(true);
      setError('');

      const response = await createProfessional({
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

      navigate(`/profesionales/${response.data.id_profesional}#salitas`, {
        replace: true,
      });
    } catch (error) {
      console.error(error);

      setError(authError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          className="btn btn-outline-secondary mb-3"
          onClick={() =>
            navigate('/profesionales')
          }
        >
          <i className="bi bi-arrow-left me-2" />
          Volver a profesionales
        </button>

        <h2 className="fw-bold mb-1">
          Nuevo profesional
        </h2>

        <p className="text-muted mb-0">
          Registrá al profesional y luego asigná una o varias SAPS y sus especialidades.
        </p>
      </div>

      <ProfesionalForm
        loading={saving}
        error={error}
        onDismissError={() => setError('')}
        onSubmit={handleSubmit}
        onCancel={() =>
          navigate('/profesionales')
        }
      />
    </div>
  );
};

export default NuevoProfesionalPage;
