/**
 * Información básica de la petición.
 *
 * Puede reutilizarse para auditoría,
 * sesiones, recuperación y verificación.
 */
export interface RequestMetadata {
  ip: string | null;
  userAgent?: string | null;
}