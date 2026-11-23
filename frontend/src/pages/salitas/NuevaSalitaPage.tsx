import { useNavigate } from 'react-router-dom';

import SalitaForm from '../../components/salitas/SalitaForm';

import { createSalita } from '../../services/salitas.service';

import type {
  CreateSalitaRequest,
} from '../../types/salita.types';

import '../../styles/salitas.css';

const NuevaSalitaPage = () => {
  const navigate = useNavigate();

  const handleSubmit = async (
    data: CreateSalitaRequest,
  ) => {
    await createSalita(data);

    navigate('/salitas');
  };

  return (
    <div className="salitas-page">

      <div className="salitas-header">
        <div className="salitas-header-top">

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

            <h1>
              Nueva salita
            </h1>

            <p>
              Registrá una nueva salita
              municipal en el sistema.
            </p>
          </div>

        </div>
      </div>

      <SalitaForm
        submitLabel="Crear salita"
        onSubmit={handleSubmit}
        onCancel={() =>
          navigate('/salitas')
        }
      />

    </div>
  );
};

export default NuevaSalitaPage;
