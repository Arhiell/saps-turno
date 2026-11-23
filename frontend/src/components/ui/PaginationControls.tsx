export interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems?: number | null;
  itemsPerPage?: number;
  onPageChange: (newPage: number) => void;
  loading?: boolean;
  itemLabel?: string;
  className?: string;
}

export default function PaginationControls({
  page,
  totalPages,
  totalItems,
  itemsPerPage = 15,
  onPageChange,
  loading = false,
  itemLabel = 'registros',
  className = '',
}: PaginationControlsProps) {
  if (totalPages <= 1 && (totalItems === undefined || totalItems === null || totalItems <= itemsPerPage)) {
    return null;
  }

  const startItem = totalItems !== undefined && totalItems !== null && totalItems > 0
    ? (page - 1) * itemsPerPage + 1
    : null;
  const endItem = totalItems !== undefined && totalItems !== null && totalItems > 0
    ? Math.min(page * itemsPerPage, totalItems)
    : null;

  return (
    <nav
      className={`d-flex flex-wrap align-items-center justify-content-between gap-3 py-3 px-2 rounded bg-light border ${className}`}
      aria-label="Paginación"
    >
      <div className="text-muted small">
        <span>
          Página <strong>{page}</strong> de <strong>{Math.max(1, totalPages)}</strong>
        </span>
        {startItem !== null && endItem !== null && totalItems !== null && (
          <span className="ms-2">
            ({startItem}–{endItem} de <strong>{totalItems}</strong> {itemLabel})
          </span>
        )}
      </div>

      <div className="d-flex align-items-center gap-2 ms-auto">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
          <span>Anterior</span>
        </button>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <span>Siguiente</span>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
