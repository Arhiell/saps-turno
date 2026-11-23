import { AppError } from "./app-error.js";

export const hasDatabaseCode = (error: unknown, code: string): boolean =>
  typeof error === "object" && error !== null &&
  "code" in error && error.code === code;

// PostgREST devuelve objetos de error que no siempre son instancias de Error.
export const rethrowPatientError = (error: unknown): never => {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String(error.message) : "";
  if (message.includes("La salita asignada no cubre el barrio del paciente")) {
    throw new AppError("La salita seleccionada no cubre el barrio del paciente", 400);
  }
  if (hasDatabaseCode(error, "23503")) {
    throw new AppError("La persona, el barrio o la salita indicados no existen", 400);
  }
  throw error;
};