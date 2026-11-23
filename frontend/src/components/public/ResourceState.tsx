// Propiedades utilizadas para representar el estado de un recurso.
interface Props {
  loading: boolean;
  error: string;
  empty?: boolean;
  emptyText?: string;
  retry: () => void;
}

// Muestra el estado correspondiente durante la carga de recursos públicos.
export default function ResourceState({
  loading,
  error,
  empty,
  emptyText = 'No hay datos disponibles.',
  retry,
}: Props) {
  // Estado de carga.
  if (loading) {
    return (
      <p
        role="status"
        className="py-3"
      >
        <span
          className="spinner-border spinner-border-sm me-2"
          aria-hidden="true"
        />
        Cargando información...
      </p>
    );
  }

  // Estado de error con posibilidad de reintentar.
  if (error) {
    return (
      <div
        role="alert"
        className="alert alert-warning"
      >
        <p>
          {error}
        </p>

        <button
          className="btn btn-outline-secondary"
          onClick={retry}
        >
          Volver a intentar
        </button>
      </div>
    );
  }

  // Estado sin resultados disponibles.
  if (empty) {
    return (
      <p className="py-3">
        {emptyText}
      </p>
    );
  }

  return null;
}