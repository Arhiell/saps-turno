import { useRef } from 'react';
import { Link } from 'react-router-dom';
import AgendaImpactPanel from '../../components/turnos/AgendaImpactPanel';
import AbsenceForm from '../../components/turnos/AbsenceForm';
import AbsenceList from '../../components/turnos/AbsenceList';
import useAbsenceForm from '../../components/turnos/useAbsenceForm';

export default function BloqueosPage() {
  const s = useAbsenceForm();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <div>
      <div className="dashboard-header">
        <h1>Ausencias y reprogramación</h1>
        <p>Registrá una ausencia puntual y reorganizá los turnos afectados desde esta pantalla.</p>
      </div>
      <p className="text-muted small mb-3">
        Si el profesional falta un jueves, seleccioná la fecha de ese jueves. Sus horarios del miércoles y de las otras semanas se mantienen.
        {s.user?.rol !== 'RECEPCION' && (
          <> Para cambiar los días de atención de todas las semanas, usá{' '}
            <Link to={`/configuracion/horarios${s.form.id_profesional ? `?profesional=${s.form.id_profesional}` : ''}`}>
              Horarios habituales
            </Link>.
          </>
        )}
      </p>
      {s.error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-3" role="alert">
          <span>{s.error}</span>
          <button
            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1 ms-2"
            disabled={Boolean(s.impact)}
            onClick={s.reload}
          >
            <i className="bi bi-arrow-clockwise" />
            <span>Recargar</span>
          </button>
        </div>
      )}
      {s.success && <div className="alert alert-success mb-3" role="status">{s.success}</div>}
      {s.impact && <AgendaImpactPanel cambio={s.impact} context={s.context} onClose={s.close} onSaved={s.saved} />}
      <AbsenceForm state={s} formRef={formRef} />
      <AbsenceList state={s} onEdit={row => { s.edit(row); formRef.current?.scrollIntoView({ block: 'start' }); }} />
    </div>
  );
}
