
import type { RequestHandler } from 'express';
import {
  agendaChangeSchema,
  agendaProposalSchema,
  agendaConfirmSchema,
  agendaAvailabilitySchema,
} from '../validators/agenda-impacto.validator.js';
import { getAgendaImpact } from '../services/agenda-impacto.service.js';
import { generateAgendaProposal } from '../services/agenda-propuesta.service.js';
import { confirmAgendaProposal } from '../services/agenda-confirmacion.service.js';
import { getAgendaAvailability } from '../services/agenda-disponibilidad.service.js';

export const agendaAvailabilityController: RequestHandler = async (req, res) => {
  const input = agendaAvailabilitySchema.parse(req.body);
  res.json(await getAgendaAvailability(input.cambio, input.id_turno, input.fecha, req.user!));
};

// Obtiene los turnos afectados por un cambio de agenda.
export const agendaImpactController: RequestHandler = async (req, res) => {
  const { afectados } = await getAgendaImpact(
    agendaChangeSchema.parse(req.body),
    req.user!
  );

  // Excluye información clínica y datos sensibles del solicitante.
  res.json({
    afectados: afectados.map(
      ({
        motivo_consulta: _m,
        observaciones: _o,
        motivo_cancelacion: _c,
        cancelado_por: _u,
        solicitante: _s,
        ...turno
      }) => turno
    ),
  });
};

// Genera una propuesta para reorganizar los turnos afectados.
export const agendaProposalController: RequestHandler = async (req, res) => {
  const input = agendaProposalSchema.parse(req.body);

  res.json(
    await generateAgendaProposal(
      input.cambio,
      input.dias,
      req.user!
    )
  );
};

// Confirma la propuesta de reorganización de la agenda.
export const agendaConfirmController: RequestHandler = async (req, res) => {
  res.json(
    await confirmAgendaProposal(
      agendaConfirmSchema.parse(req.body),
      req.user!
    )
  );
};
