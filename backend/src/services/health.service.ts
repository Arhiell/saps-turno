import {
  getSystemRoles
} from "../repositories/system.repository.js";

export const checkDatabaseConnection = async () => {
  const roles = await getSystemRoles();

  return {
    connected: true,
    database: "Supabase PostgreSQL",
    rolesFound: roles.length,
    roles
  };
};