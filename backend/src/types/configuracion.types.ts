import type { ConfiguracionValor } from "../validators/configuracion.validator.js";

export interface ConfiguracionRow {
  id_configuracion: string;
  id_salita: string | null;
  clave: string;
  valor: ConfiguracionValor;
  descripcion: string | null;
  es_publica: boolean;
  actualizado_por: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}
export interface ConfiguracionAccess {
  publicOnly: boolean;
  salitas: string[] | null;
}
