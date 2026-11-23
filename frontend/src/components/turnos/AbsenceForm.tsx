import type { RefObject } from 'react';
import ValidatedInput from '../ui/ValidatedInput';
import AbsenceSchedule from './AbsenceSchedule';
import type useAbsenceForm from './useAbsenceForm';

export default function AbsenceForm({ state: s, formRef }: {
  state: ReturnType<typeof useAbsenceForm>; formRef: RefObject<HTMLFormElement | null>;
}) {
  return <form ref={formRef} onSubmit={e => { e.preventDefault(); s.review(); }} className="dashboard-panel p-3 mb-4 configuration-form">
    <h2 className="h5">{s.editing ? 'Editar ausencia o cierre' : '1. Indicá quién no atenderá y dónde'}</h2>
    <fieldset disabled={s.loading || !s.ready || Boolean(s.impact)}>
      <div className="row g-3">
        <label className="col-md-4 form-label">Salita
          <select required className="form-select" value={s.form.id_salita} onChange={e => s.change({ id_salita: e.target.value })}>
            <option value="">Seleccionar salita</option>
            {s.clinics.map(c => <option key={c.id_salita} value={c.id_salita}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="col-md-4 form-label">Profesional
          <select className="form-select" value={s.form.id_profesional ?? ''} onChange={e => s.change({ id_profesional: e.target.value || null })}>
            <option value="">Todos los profesionales</option>
            {s.professionals.map(p => <option key={p.id_profesional} value={p.id_profesional}>{p.persona.apellidos}, {p.persona.nombres}</option>)}
          </select>
        </label>
        <label className="col-md-4 form-label">Especialidad
          <select className="form-select" value={s.form.id_especialidad ?? ''} onChange={e => s.change({ id_especialidad: e.target.value || null })}>
            <option value="">Todas las especialidades</option>
            {s.specialties.map(e => <option key={e.id_especialidad} value={e.id_especialidad}>{e.nombre}</option>)}
          </select>
        </label>
        <div className="col-12"><AbsenceSchedule form={s.form} onDate={fecha => s.change({ fecha })} /></div>
        <label className="col-md-4 form-label">Fecha exacta de ausencia
          <ValidatedInput field="fecha" type="date" required className="form-control" value={s.form.fecha} onChange={e => s.change({ fecha: e.target.value })} />
        </label>
        <div className="col-md-8 d-flex flex-wrap gap-4 align-items-center">
          <label className="form-check">
            <input type="checkbox" className="form-check-input" checked={s.form.dia_completo}
              onChange={e => s.change({ dia_completo: e.target.checked, hora_inicio: null, hora_fin: null })} />
            No atenderá en todo el día
          </label>
          <label className="form-check">
            <input type="checkbox" className="form-check-input" checked={s.form.activo} onChange={e => s.change({ activo: e.target.checked })} />
            Aplicar esta ausencia / cierre
          </label>
        </div>
        <p className="col-12 small text-muted mb-0">Para una ausencia parcial, desmarcá “No atenderá en todo el día” e indicá desde qué hora y hasta qué hora faltará.</p>
        {!s.form.dia_completo && <>
          <label className="col-md-6 form-label">No atenderá desde
            <ValidatedInput field="hora_inicio" type="time" required className="form-control" value={s.form.hora_inicio ?? ''} onChange={e => s.change({ hora_inicio: e.target.value })} />
          </label>
          <label className="col-md-6 form-label">Volverá a atender a las
            <ValidatedInput field="hora_fin" type="time" required className="form-control" value={s.form.hora_fin ?? ''} onChange={e => s.change({ hora_fin: e.target.value })} />
          </label>
        </>}
        <label className="col-12 form-label">3. Motivo interno de la ausencia o cierre
          <textarea required maxLength={500} rows={2} className="form-control" value={s.form.motivo} onChange={e => s.change({ motivo: e.target.value })} />
          <span className="form-text">Se usa para la gestión administrativa. La notificación al paciente utiliza un mensaje general.</span>
        </label>
        <div className="col-12 d-flex flex-wrap gap-2">
          <button className="btn btn-saps" disabled={!s.relationsReady}>4. Revisar turnos afectados</button>
          {s.editing && <button type="button" className="btn btn-outline-secondary" onClick={s.reset}>Cancelar edición</button>}
        </div>
      </div>
    </fieldset>
  </form>;
}
