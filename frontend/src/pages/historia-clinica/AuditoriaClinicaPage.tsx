import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  consultarAuditoriaClinica,
  extractClinicalApiError,
  getHistoriaClinicaContext,
} from '../../services/historia-clinica.service';
import type {
  AuditoriaClinicaRecord,
  CatalogSalitaItem,
} from '../../types/historia-clinica.types';
import {
  findSalitaNombre,
  formatArgentinaDate,
  formatArgentinaDateTime,
} from '../../utils/historia-clinica-format';
import {
  RECOVERABLE_ERROR_TIMEOUT_MS,
  useAutoDismiss,
} from '../../utils/useAutoDismiss';

const PAGE_LIMIT = 15;

const operationBadgeClass = (op: AuditoriaClinicaRecord['tipo_operacion']): string => {
  switch (op) {
    case 'CONSULTA':
      return 'badge text-bg-info';
    case 'CREACION':
      return 'badge text-bg-success';
    case 'MODIFICACION':
      return 'badge text-bg-warning';
    case 'CORRECCION':
      return 'badge text-bg-primary';
    case 'EXPORTACION':
      return 'badge text-bg-danger';
    default:
      return 'badge text-bg-secondary';
  }
};

export default function AuditoriaClinicaPage() {
  const [salitas, setSalitas] = useState<CatalogSalitaItem[]>([]);
  const [salitaFilter, setSalitaFilter] = useState('');
  const [pacienteFilter, setPacienteFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [offset, setOffset] = useState(0);

  const [rows, setRows] = useState<AuditoriaClinicaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useAutoDismiss(
    error,
    () => setError(null),
    RECOVERABLE_ERROR_TIMEOUT_MS,
    Boolean(error) && rows.length > 0
  );

  const fetchAuditoria = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await consultarAuditoriaClinica({
          id_salita: salitaFilter || undefined,
          id_paciente: pacienteFilter.trim() || undefined,
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          limit: PAGE_LIMIT,
          offset: nextOffset,
        });
        setRows(data);
      } catch (err) {
        setError(extractClinicalApiError(err).message);
      } finally {
        setLoading(false);
      }
    },
    [salitaFilter, pacienteFilter, fechaDesde, fechaHasta]
  );

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const ctx = await getHistoriaClinicaContext();
        if (active) setSalitas(ctx.catalogo_salitas);
      } catch {
        // Si no tiene contexto, consultarAuditoriaClinica reportará el error específico.
      }
      if (active) {
        await fetchAuditoria(0);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [fetchAuditoria]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setOffset(0);
    void fetchAuditoria(0);
  };

  return (
    <div className="hc-page">
      <div className="hc-hero hc-hero--audit d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h1 className="h3 mb-1">
            <i className="bi bi-shield-check text-primary me-2" />
            Auditoría Clínica Inmutable
          </h1>
          <p className="text-muted mb-0">
            Registro de trazabilidad de accesos, creaciones, rectificaciones y exportaciones clínicas. No expone contenido asistencial sensible.
          </p>
        </div>
        <span className="badge text-bg-primary px-3 py-2">
          Permiso requerido: VER_AUDITORIA_CLINICA
        </span>
      </div>

      {error && (
        <div className="alert alert-danger mb-0" role="alert">
          <i className="bi bi-shield-exclamation me-2" />
          {error}
        </div>
      )}

      <div className="hc-card p-3">
        <form className="row g-3 align-items-end" onSubmit={handleSubmit}>
          <div className="col-12 col-md-3">
            <label className="form-label fw-semibold" htmlFor="audit-salita">
              Salita
            </label>
            <select
              id="audit-salita"
              className="form-select"
              value={salitaFilter}
              onChange={(e) => setSalitaFilter(e.target.value)}
            >
              <option value="">Todas las salitas</option>
              {salitas.map((s) => (
                <option key={s.id_salita} value={s.id_salita}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label fw-semibold" htmlFor="audit-paciente">
              ID Paciente (UUID opcional)
            </label>
            <input
              id="audit-paciente"
              type="text"
              className="form-control"
              placeholder="Filtrar por UUID de paciente"
              value={pacienteFilter}
              onChange={(e) => setPacienteFilter(e.target.value)}
            />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-semibold" htmlFor="audit-desde">
              Desde
            </label>
            <input
              id="audit-desde"
              type="date"
              className="form-control"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="col-6 col-md-2">
            <label className="form-label fw-semibold" htmlFor="audit-hasta">
              Hasta
            </label>
            <input
              id="audit-hasta"
              type="date"
              className="form-control"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-2 d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-grow-1" disabled={loading}>
              Filtrar
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setSalitaFilter('');
                setPacienteFilter('');
                setFechaDesde('');
                setFechaHasta('');
                setOffset(0);
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="hc-card p-5 text-center text-muted">
          <div className="spinner-border text-primary mb-2" role="status" />
          <div>Consultando registros de auditoría clínica...</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="hc-empty-state">
          <i className="bi bi-journal-check fs-1 text-muted d-block mb-2" />
          <h5>Sin eventos de auditoría</h5>
          <p className="mb-0">
            No se registraron eventos de auditoría clínica para los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="d-grid gap-3">
          {/* Vista móvil */}
          <div className="hc-mobile-list d-md-none">
            {rows.map((row) => (
              <article key={row.id_auditoria_clinica} className="hc-mobile-item small">
                <div className="hc-mobile-item-head">
                  <div>
                    <div className="hc-mobile-item-title">{row.recurso}</div>
                    <div className="text-muted">{formatArgentinaDateTime(row.fecha_hora)}</div>
                  </div>
                  <span className={operationBadgeClass(row.tipo_operacion)}>
                    {row.tipo_operacion}
                  </span>
                </div>
                <div>
                  <strong>Salita:</strong> {findSalitaNombre(salitas, row.id_salita)}
                </div>
                <div>
                  <strong>Motivo:</strong> {row.motivo_acceso}
                </div>
                <div className="text-muted">
                  Alcance: {row.alcance_acceso || '—'} · IP: <code>{row.ip_origen || '—'}</code>
                </div>
              </article>
            ))}
          </div>

          {/* Vista escritorio */}
          <div className="hc-card overflow-hidden d-none d-md-block">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Operación</th>
                    <th>Recurso</th>
                    <th>Salita</th>
                    <th>Usuario / Profesional</th>
                    <th>Motivo de acceso</th>
                    <th>Alcance / Fecha acto</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id_auditoria_clinica}>
                      <td className="text-nowrap">{formatArgentinaDateTime(row.fecha_hora)}</td>
                      <td>
                        <span className={operationBadgeClass(row.tipo_operacion)}>
                          {row.tipo_operacion}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold">{row.recurso}</div>
                        {row.id_recurso && (
                          <div className="text-muted">ID: {row.id_recurso.slice(0, 8)}…</div>
                        )}
                      </td>
                      <td>{findSalitaNombre(salitas, row.id_salita)}</td>
                      <td>
                        <div>Usr: <code>{row.id_usuario.slice(0, 8)}…</code></div>
                        {row.id_profesional && (
                          <div className="text-muted">
                            Prof: <code>{row.id_profesional.slice(0, 8)}…</code>
                          </div>
                        )}
                      </td>
                      <td>{row.motivo_acceso}</td>
                      <td>
                        <div>{row.alcance_acceso || '—'}</div>
                        {row.fecha_acto_clinico && (
                          <div className="text-muted">
                            Acto: {formatArgentinaDate(row.fecha_acto_clinico)}
                          </div>
                        )}
                      </td>
                      <td>
                        <code>{row.ip_origen || '—'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hc-card p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="text-muted small">
              Página <strong>{Math.floor(offset / PAGE_LIMIT) + 1}</strong> · Mostrando {rows.length} registros (desde #{offset + 1})
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                disabled={offset === 0 || loading}
                onClick={() => {
                  const next = Math.max(0, offset - PAGE_LIMIT);
                  setOffset(next);
                  void fetchAuditoria(next);
                }}
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                disabled={rows.length < PAGE_LIMIT || loading}
                onClick={() => {
                  const next = offset + PAGE_LIMIT;
                  setOffset(next);
                  void fetchAuditoria(next);
                }}
              >
                <span>Siguiente</span>
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
