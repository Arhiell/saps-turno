import type { AffectedTurno, AgendaProposal } from '../../services/agenda-impacto.service';
import { agendaDateTime } from '../../utils/agenda-display';

export default function AgendaReview({ turnos, propuestas }: { turnos: AffectedTurno[]; propuestas: AgendaProposal[] }) {
  return <ul className="list-unstyled mb-0 text-break">{turnos.map(t => {
    const destino = propuestas.find(p => p.id_turno === t.id_turno)?.destino;
    return <li key={t.id_turno} className="border-bottom py-2">
      <strong>{t.paciente.persona.apellidos}, {t.paciente.persona.nombres}</strong>
      <div>{agendaDateTime(t.fecha_hora_inicio)} → {destino ? agendaDateTime(destino.fecha_hora_inicio) : 'Pendiente; no se modifica'}</div>
    </li>;
  })}</ul>;
}
