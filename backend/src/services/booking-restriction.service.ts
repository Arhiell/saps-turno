import { findTurnoSanction } from '../repositories/turno-agenda.repository.js';

import { AppError } from '../utils/app-error.js';

// Verifica que el paciente no tenga sanciones vigentes para solicitar turnos.
export const assertPatientCanBook = async (
  patient: string
) => {
  // Consulta si existe una sanción activa.
  const sanction = await findTurnoSanction(patient);

  // Impide reservar turnos mientras la sanción esté vigente.
  if (sanction) {
    throw new AppError(
      'Tenés una sanción vigente. No podés solicitar turnos de ninguna especialidad hasta que finalice.',
      409,
      'PATIENT_SANCTIONED',
      {
        motivo: sanction.motivo,
        fecha_inicio: sanction.fecha_inicio,
        fecha_fin: sanction.fecha_fin,
      }
    );
  }
};