import type { AffectedTurno, AgendaChange, AgendaProposal } from '../../services/agenda-impacto.service';
import AgendaQuickRow from './AgendaQuickRow';

interface Props {
  turnos: AffectedTurno[];
  cambio: AgendaChange;
  propuestas: AgendaProposal[];
  busy: boolean;
  revision: number;
  onChoose: (proposal: AgendaProposal) => void;
}
export default function AgendaAffectedList({ turnos, cambio, propuestas, busy, revision, onChoose }: Props) {
  return <div className="row g-3">{turnos.map(turno =>
    <div className="col-12 col-lg-6" key={turno.id_turno}>
      <AgendaQuickRow turno={turno} cambio={cambio} busy={busy} revision={revision}
        propuesta={propuestas.find(p => p.id_turno === turno.id_turno)} onChoose={onChoose} />
    </div>,
  )}</div>;
}
