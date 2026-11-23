import { useState } from 'react';
import ValidatedInput from '../ui/ValidatedInput';
import { agendaDate } from '../../utils/agenda-display';
import type useAbsenceForm from './useAbsenceForm';
import type { Bloqueo } from '../../types/configuracion.types';

export default function AbsenceList({ state: s, onEdit }: { state: ReturnType<typeof useAbsenceForm>; onEdit: (row: Bloqueo) => void }) {
  const [filter, setFilter] = useState('');
  const rows = s.rows.filter(r => !filter || r.fecha === filter);
  return (
    <section className="dashboard-panel">
      <div className="p-3 border-bottom">
        <h2 className="h5 mb-3">Ausencias y cierres registrados</h2>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-sm-auto flex-grow-1" style={{ maxWidth: '300px' }}>
            <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="filter-absence-date">
              Filtrar por fecha
            </label>
            <ValidatedInput
              id="filter-absence-date"
              type="date"
              className="form-control"
              style={{ minHeight: '42px', height: '42px' }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          {filter && (
            <div className="col-12 col-sm-auto">
              <button
                type="button"
                className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                style={{ minHeight: '42px', height: '42px' }}
                onClick={() => setFilter('')}
              >
                <i className="bi bi-x-circle" />
                <span>Ver todas las fechas</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {s.loading ? (
        <p className="p-3 mb-0" role="status">Cargando ausencias…</p>
      ) : (
        <div className="table-responsive">
          <table className="table saps-responsive-table align-middle mb-0">
            <thead>
              <tr>
                {['Fecha y franja', 'Alcance', 'Motivo', 'Estado', 'Acciones'].map((t) => (
                  <th scope="col" key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = s.professionals.find((prof) => prof.id_profesional === r.id_profesional);
                return (
                  <tr key={r.id_bloqueo}>
                    <td data-label="Fecha y franja">
                      <span className="fw-semibold">{agendaDate(r.fecha)}</span>
                      <br />
                      <span className="text-muted small">
                        {r.dia_completo ? 'Día completo' : `${r.hora_inicio?.slice(0, 5)} – ${r.hora_fin?.slice(0, 5)}`}
                      </span>
                    </td>
                    <td data-label="Alcance">
                      <div className="fw-semibold small">
                        {s.clinics.find((c) => c.id_salita === r.id_salita)?.nombre ?? 'Salita no disponible'}
                      </div>
                      <div className="text-muted small">
                        {r.id_profesional ? (p ? `${p.persona.apellidos}, ${p.persona.nombres}` : 'Profesional no disponible') : 'Todos los profesionales'}
                      </div>
                      <div className="text-secondary small">
                        {r.id_especialidad ? (s.specialties.find((e) => e.id_especialidad === r.id_especialidad)?.nombre ?? 'Especialidad no disponible') : 'Todas las especialidades'}
                      </div>
                    </td>
                    <td data-label="Motivo" className="text-break small">{r.motivo}</td>
                    <td data-label="Estado">
                      <span className={`badge ${r.activo ? 'text-bg-success' : 'text-bg-secondary'}`}>
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td data-label="Acciones">
                      <button
                        className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1"
                        disabled={Boolean(s.impact)}
                        onClick={() => onEdit(r)}
                      >
                        <i className="bi bi-pencil-square" />
                        <span>Editar / desactivar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <div className="text-center py-4 text-muted">
              <i className="bi bi-calendar2-check fs-2 d-block mb-2 text-secondary" />
              <p className="mb-0">No hay ausencias registradas para este filtro.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
