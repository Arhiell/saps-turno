import {
  supabase,
} from '../config/supabase.js';

// Representa la proyección pública de una salita.
export interface PublicSalitaRow {
  id_salita: string;
  nombre: string;
  direccion: string;
  telefono: string | null;

  horario_apertura:
    string | null;

  horario_cierre:
    string | null;

  barrio: {
    zona: {
      nombre: string;
    } | null;
  } | null;
}

// Obtiene una proyección segura de las salitas activas
// para su exposición pública.
export const publicSalitas =
  async () => {
    // Utiliza el barrio de ubicación de la salita,
    // no la relación múltiple de cobertura salita_barrios.
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'salitas'
        )
        .select(
          `
            id_salita,
            nombre,
            direccion,
            telefono,
            horario_apertura,
            horario_cierre,
            barrio:barrios!salitas_id_barrio_fkey(
              zona:zonas(
                nombre
              )
            )
          `
        )
        .eq(
          'activo',
          true
        )
        .order(
          'nombre'
        )
        .returns<
          PublicSalitaRow[]
        >();

    if (error) {
      throw error;
    }

    // Reemplaza la estructura barrio/zona por el nombre directo de la zona.
    return (
      data ?? []
    ).map(
      ({
        barrio,
        ...salita
      }) => ({
        ...salita,
        zona:
          barrio?.zona
            ?.nombre ??
          null,
      })
    );
  };