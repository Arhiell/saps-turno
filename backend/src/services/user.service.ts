import {
  countRoles,
  countUsers
} from "../repositories/user.repository.js";

/**
 * Comprueba que las tablas principales
 * del módulo usuarios sean accesibles.
 */
export const checkUserModule = async () => {
  // Las dos consultas pueden ejecutarse al mismo tiempo.
  const [usersCount, rolesCount] = await Promise.all([
    countUsers(),
    countRoles()
  ]);

  return {
    database: "Supabase PostgreSQL",
    usersTable: true,
    rolesTable: true,
    usersCount,
    rolesCount
  };
};