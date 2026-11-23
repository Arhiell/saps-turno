import type { Turno } from '../../types/turno.types';
import { getEstadoClass } from '../../utils/turno-status';
import { formatFechaHora } from '../../utils/agenda-display';
import { Link } from 'react-router-dom';
import CancelAppointment from './CancelAppointment';

export default function TurnoCard({
  turno,
  patient = false,
  onChanged,
  detail = false,
  onViewDetail,
}: {
  turno: Turno;
  patient?: boolean;
  onChanged?: () => void;
  detail?: boolean;
  onViewDetail?: (turno: Turno) => void;
}) {
  // Define qué persona mostrar según si la tarjeta pertenece al paciente.
  const person = patient
    ? turno.profesional?.persona
    : turno.paciente?.persona;

  return (
    <article className="turno-preview card border-0 shadow-sm p-3 p-sm-4 bg-white">
      {/* Fecha, hora y estado del turno */}
      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center pb-2 border-bottom">
        <time dateTime={turno.fecha_hora_inicio} className="fw-bold text-success text-nowrap">
          <i className="bi bi-clock me-1" aria-hidden="true" />
          {formatFechaHora(turno.fecha_hora_inicio)} hs
        </time>

        <span className={getEstadoClass(turno.estado.codigo)}>
          {turno.estado.nombre}
        </span>
      </div>

      {/* Profesional para el paciente o paciente para administración/profesional */}
      <div className="mt-3">
        <h3 className="h6 fw-bold text-dark mb-1">
          {patient ? 'Profesional: ' : ''}
          {person ? `${person.apellidos}, ${person.nombres}` : 'Sin informar'}
        </h3>

        {/* DNI visible para administración o si el turno es de dependiente */}
        {!patient && (
          <p className="small text-muted mb-2 text-nowrap">
            DNI {turno.paciente?.persona?.dni || 'Sin informar'}
          </p>
        )}

        {/* Especialidad y salita del turno */}
        <p className="text-secondary small mb-1">
          <strong>{turno.especialidad?.nombre || 'Especialidad sin informar'}</strong>
          {' · '}
          {turno.salita?.nombre || 'Salita sin informar'}
        </p>

        {/* Dirección de la salita para el paciente */}
        {patient && turno.salita?.direccion && (
          <p className="text-muted small mb-2">
            <i className="bi bi-geo-alt me-1" aria-hidden="true" />
            {turno.salita.direccion}
          </p>
        )}
      </div>

      {/* Información y acciones para el paciente */}
      {patient && (
        <div className="pt-2 border-top mt-2">
          {/* Si el turno es para una persona a cargo */}
          {turno.paciente?.persona && (
            <p className="small text-secondary mb-1">
              <strong>Paciente:</strong> {turno.paciente.persona.apellidos}, {turno.paciente.persona.nombres}
              {turno.paciente.persona.dni ? (
                <span className="text-nowrap ms-1">(DNI {turno.paciente.persona.dni})</span>
              ) : ''}
            </p>
          )}

          <p className="small text-secondary mb-1">
            <strong>Motivo:</strong> {turno.motivo_consulta || 'Consulta general'}
          </p>

          {turno.solicitante?.persona && (
            <p className="small text-muted mb-2">
              Solicitado por: {turno.solicitante.persona.apellidos}, {turno.solicitante.persona.nombres}
            </p>
          )}

          <div className="d-flex flex-wrap gap-2 mt-3 pt-2">
            {!detail && (
              <Link
                className="btn btn-outline-success d-inline-flex align-items-center justify-content-center gap-1 text-nowrap"
                style={{ minHeight: '40px', whiteSpace: 'nowrap' }}
                to={`/mis-turnos/${turno.id_turno}`}
              >
                <i className="bi bi-eye" aria-hidden="true" />
                <span>Ver detalle</span>
              </Link>
            )}

            <CancelAppointment
              turno={turno}
              onCancelled={onChanged}
            />
          </div>
        </div>
      )}

      {/* Acciones para profesional o recepción */}
      {!patient && onViewDetail && (
        <div className="d-flex flex-wrap gap-2 mt-3 pt-2 border-top">
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            onClick={() => onViewDetail(turno)}
          >
            <i className="bi bi-person-lines-fill me-1" aria-hidden="true" />
            Ver ficha del paciente
          </button>
        </div>
      )}
    </article>
  );
}
