import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAdminSalitas } from '../../services/salitas.service';
import { getCierres, desactivarCierre } from '../../services/cierre-calendario.service';
import { tiposCierre, datosCierre, type Cierre, type CierreInput } from '../../types/cierre-calendario.types';
import type { Salita } from '../../types/salita.types';
import type { AgendaChange } from '../../services/agenda-impacto.service';
import CierreForm from '../../components/turnos/CierreForm';
import AgendaImpactPanel from '../../components/turnos/AgendaImpactPanel';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { agendaDate, agendaToday } from '../../utils/agenda-display';
import { authError } from '../../utils/auth-errors';
import CalendarioSyncPanel from '../../components/turnos/CalendarioSyncPanel';

export default function CierresPage() {
  const { user } = useAuth();
  const superAdmin = user?.rol === 'SUPER_ADMIN';
  const [rows, setRows] = useState<Cierre[]>([]);
  const [salitas, setSalitas] = useState<Salita[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<{ id?: string; initial?: CierreInput } | null>(null);
  const [draft, setDraft] = useState<Extract<AgendaChange, { tipo: 'cierre' }> | null>(null);
  const [persistido, setPersistido] = useState(false);
  const [removing, setRemoving] = useState<Cierre | null>(null);
  const [history, setHistory] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void Promise.all([getCierres(), getAdminSalitas()])
      .then(([cierres, clinics]) => { if (active) { setRows(cierres); setSalitas(clinics.data); } })
      .catch(cause => { if (active) setError(authError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [superAdmin, revision]);
  const close = () => { setDraft(null); setForm(null); setPersistido(false); };
  const saved = () => { close(); setSuccess('Calendario guardado. La disponibilidad ya considera este cambio.'); setRevision(v => v + 1); };
  const canEdit = (c: Cierre) => !c.fuente_externa && (superAdmin || c.alcance === 'SALITA' && salitas.some(s => s.id_salita === c.id_salita));
  const scopeLabel = (c: CierreInput) => c.alcance === 'GLOBAL' ? 'Global: todas las salitas' : salitas.find(s => s.id_salita === c.id_salita)?.nombre ?? 'Salita asignada';
  const groupedManual = new Set(rows.flatMap(c => c.coincidencias_manuales ?? []));
  const visibleRows = rows.filter(c => !groupedManual.has(c.id_cierre) && (history || c.activo && c.fecha_fin >= agendaToday()));
  return (
    <section>
      <div className="dashboard-header">
        <h1>Feriados y cierres</h1>
        <p>
          Registrá fechas en que todas las salitas o una salita dejan de atender. Para la ausencia de un profesional usá{' '}
          <Link to="/configuracion/bloqueos">Ausencias y reprogramación</Link>.
        </p>
      </div>
      {!superAdmin && (
        <p className="small text-muted mb-3">
          Podés administrar tus salitas. Los cierres globales son de consulta; en feriados importados podés reprogramar únicamente los turnos de tus salitas.
        </p>
      )}
      {error && (
        <p className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
          <span>{error}</span>
          <button className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" onClick={() => setRevision(v => v + 1)}>
            <i className="bi bi-arrow-clockwise" />
            <span>Reintentar</span>
          </button>
        </p>
      )}
      {success && <p className="alert alert-success" role="status">{success}</p>}
      {loading && <p role="status">Cargando calendario…</p>}
      <CalendarioSyncPanel superAdmin={superAdmin} disabled={!!form || !!draft || busy} onBusyChange={setBusy} onUpdated={() => setRevision(v => v + 1)} />
      {!form && !draft && (
        <button
          className="btn btn-saps mb-3 d-inline-flex align-items-center gap-2"
          disabled={loading || busy || !!error}
          onClick={() => { setForm({}); setSuccess(''); }}
        >
          <i className="bi bi-plus-lg" />
          <span>Nuevo feriado o cierre</span>
        </button>
      )}
      {form && !draft && <CierreForm key={form.id ?? 'nuevo'} initial={form.initial} superAdmin={superAdmin} salitas={salitas}
        onCancel={close} onReview={datos => {
          setForm({ ...form, initial: datos });
          setDraft({ tipo: 'cierre', ...(form.id ? { id: form.id } : {}), datos });
        }} />}
      {draft && <AgendaImpactPanel cambio={draft} persistido={persistido} context={scopeLabel(draft.datos)} onSaved={saved} onClose={() => {
        setDraft(null);
        if (persistido) { close(); setRevision(v => v + 1); }
      }} />}
      <div className="dashboard-panel p-3">
        <h2 className="h5 mb-3">{history ? 'Todos los registros' : 'Cierres vigentes y próximos'}</h2>
        <div className="form-check mb-3">
          <input id="check-history" className="form-check-input" type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />
          <label className="form-check-label small" htmlFor="check-history">Mostrar también pasados e inactivos</label>
        </div>
        <div className="row g-3">
          {visibleRows.map(c => <article className="col-12 col-xl-6" key={c.id_cierre}>
            <div className="border rounded p-3 h-100 text-break">
              <div className="d-flex flex-wrap gap-2 mb-2"><span className={`badge ${c.activo ? 'text-bg-danger' : 'text-bg-secondary'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span><span>{tiposCierre[c.tipo]}</span></div>
              <h3 className="h6">{c.titulo}</h3>
              <p className="mb-1">{agendaDate(c.fecha_inicio)}{c.fecha_fin !== c.fecha_inicio && ` hasta ${agendaDate(c.fecha_fin)}`}</p>
              <p className="mb-1">{c.dia_completo ? 'Todo el día' : `${c.hora_inicio?.slice(0, 5)} a ${c.hora_fin?.slice(0, 5)} cada día`}</p>
              <p className="fw-semibold mb-1">{scopeLabel(c)}</p>
              <p className="small mb-1">Origen: {c.fuente_externa ? 'ArgentinaDatos (solo lectura)' : `Manual · ${c.origen}`}</p>
              {c.fuente_externa && <>
                <p className="small">Tipo de la fuente: {[...new Set(c.datos_externos?.map(d => d.tipo) ?? [])].join(', ')}. El feriado ya impide nuevas reservas.</p>
                <p className={c.turnos_pendientes ? 'text-danger fw-semibold' : 'small'}>{c.turnos_pendientes} turnos pendientes en tu alcance</p>
                <button className="btn btn-outline-success btn-sm mb-2 d-inline-flex align-items-center gap-1" disabled={!!form || !!draft || loading || busy} onClick={() => {
                  setPersistido(true); setDraft({ tipo: 'cierre', id: c.id_cierre, datos: datosCierre(c) }); setSuccess('');
                }}>
                  <i className="bi bi-calendar-event" />
                  <span>Ver turnos afectados / reprogramar</span>
                </button>
                {(c.coincidencias_manuales ?? []).map(id => {
                  const manual = rows.find(r => r.id_cierre === id);
                  return manual && <div className="border rounded p-2 my-2" key={id}>
                    <p className="small mb-1">Coincide con una carga manual conservada: <strong>{manual.titulo}</strong>. La fecha se bloquea una sola vez.</p>
                    <p className="small mb-1">Origen manual: {manual.origen}</p>
                    {manual.observaciones && <p className="small mb-1">Observaciones internas: {manual.observaciones}</p>}
                    {canEdit(manual) && <button className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" disabled={!!form || !!draft || loading || busy}
                      onClick={() => setForm({ id: manual.id_cierre, initial: manual })}>
                      <i className="bi bi-pencil" />
                      <span>Editar carga manual</span>
                    </button>}
                  </div>;
                })}
              </>}
              {c.observaciones && <p className="small">Observaciones internas: {c.observaciones}</p>}
              {canEdit(c) ? <div className="d-flex flex-wrap gap-2 mt-2">
                <button className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1" disabled={!!form || !!draft || loading || busy} onClick={() => { setSuccess(''); setForm({ id: c.id_cierre, initial: c }); }}>
                  <i className="bi bi-pencil-square" />
                  <span>Editar</span>
                </button>
                {c.activo && <button className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" disabled={!!form || !!draft || loading || busy} onClick={() => setRemoving(c)}>
                  <i className="bi bi-x-circle" />
                  <span>Desactivar</span>
                </button>}
              </div> : <span className="small text-muted">Solo consulta</span>}
            </div>
          </article>)}
        </div>
        {!loading && !visibleRows.length && (
          <div className="text-center py-4 text-muted">
            <i className="bi bi-calendar2-check fs-2 d-block mb-2 text-secondary" />
            <p className="mb-0">No hay cierres registrados para este filtro.</p>
          </div>
        )}
      </div>
      <ConfirmationModal open={!!removing} title="Desactivar cierre" message={removing ? `${removing.titulo} · ${scopeLabel(removing)}` : ''}
        confirmText="Desactivar cierre" loading={busy} detail={error ? <p role="alert" className="text-danger">{error}</p> : undefined}
        notice="La atención volverá a depender de horarios, bloqueos y cupos. Los turnos reprogramados no vuelven a su fecha original."
        onClose={() => { if (!busy) setRemoving(null); }} onConfirm={() => {
          if (!removing || busy) return;
          setBusy(true); setError('');
          void desactivarCierre(removing.id_cierre).then(() => { setRemoving(null); saved(); })
            .catch(cause => setError(authError(cause))).finally(() => setBusy(false));
        }} />
    </section>
  );
}
