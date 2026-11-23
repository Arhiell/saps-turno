import { 
  AppError 
} from "./app-error.js";
import { 
  hasDatabaseCode 
} from "./profile-error.js";

export const rethrowTutorError = (error: unknown): never => {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String(error.message) : "";
  if (hasDatabaseCode(error, "P0001") && (
    message.includes("La persona del tutor debe estar activa y tener telefono") ||
    message.includes("Una persona con perfil de tutor activo debe conservar un telefono") ||
    message.includes("Una persona con perfil de paciente activo debe conservar")
  )) throw new AppError(message, 400);
  throw error;
};
