import {
  z,
} from 'zod';

import {
  createPatientSchema,
} from './patient.validator.js';

// ========================================
// ACTUALIZACIÓN DE PACIENTE
// ========================================

// Permite actualizar parcialmente los datos de un paciente.
export const updatePatientSchema = createPatientSchema
  .partial()
  .refine(
    (data) =>
      Object.values(data).some(
        (value) => value !== undefined
      ),
    {
      // Exige al menos un campo para realizar la actualización.
      message:
        'Debe enviar al menos un campo para actualizar',
    }
  );

// ========================================
// ESTADO DEL PACIENTE
// ========================================

// Valida la activación o desactivación de un paciente.
export const patientStatusSchema = z
  .object({
    activo: z.boolean(),
  })
  .strict();

// Tipos derivados de los esquemas de validación.
export type UpdatePatientInput = z.infer<
  typeof updatePatientSchema
>;

export type PatientStatusInput = z.infer<
  typeof patientStatusSchema
>;

// ========================================
// AUTOGESTIÓN DEL PACIENTE
// ========================================

// La autogestión protege identidad y correo;
// la salita se resuelve desde el barrio.
export const ownPatientUpdateSchema =
  createPatientSchema
    .pick({
      nombres: true,
      apellidos: true,
      telefono: true,
      direccion: true,
      id_barrio: true,
      obra_social: true,
      numero_afiliado: true,
      contacto_emergencia_nombre: true,
      contacto_emergencia_telefono: true,
    })
    .partial()
    .strict()
    .refine(
      (data) =>
        Object.values(data).some(
          (value) => value !== undefined
        ),
      {
        // Exige indicar al menos un dato para modificar.
        message:
          'Indicá los datos que querés actualizar',
      }
    );