import { 
  supabase 
} from "../config/supabase.js";

import type { 
  ConfiguracionRow, 
  ConfiguracionAccess 
} from "../types/configuracion.types.js";

import type { 
  ConfiguracionQuery, 
  CreateConfiguracionInput,
  UpdateConfiguracionInput 
} from "../validators/configuracion.validator.js";

const select = "id_configuracion,id_salita,clave,valor,descripcion,es_publica,actualizado_por,fecha_creacion,fecha_actualizacion";

export const findConfiguraciones = async (
  filters: ConfiguracionQuery, 
  access: ConfiguracionAccess, 
  clave?: string
) => {
  const result: ConfiguracionRow[] = [];
 
  // Lee todas las páginas con los permisos aplicados en SQL.
  for (let from = 0; ; from += 100) {
    let query = supabase.from("configuracion").select(select);

    if (filters.scope === "global") query = query.is("id_salita", null);

    if (filters.id_salita) query = query.eq("id_salita", filters.id_salita);

    if (clave) query = query.eq("clave", clave);

    if (access.publicOnly) query = query.eq("es_publica", true);
    
    if (access.salitas !== null) {
      query = access.salitas.length
        ? query.or(`and(id_salita.is.null,es_publica.eq.true),id_salita.in.(${access.salitas.join(",")})`)
        : query.is("id_salita", null).eq("es_publica", true);
    }

    const { data, error } = await query.order("clave").order("id_configuracion")
      .range(from, from + 99).returns<ConfiguracionRow[]>();
    
      if (error) throw error;
    
      result.push(...(data ?? []));
    
      if (!data || data.length < 100) return result;
  }
};

export const findConfiguracionById = async (id: string) => {
  
  const { data, error } = await supabase.from("configuracion").select(select)
    .eq("id_configuracion", id).returns<ConfiguracionRow[]>().maybeSingle();
  
    if (error) throw error;
  
    return data;
};

export const findConfiguracionByClave = async (
  clave: string, 
  idSalita: string | null = null
) => {
  let query = supabase.from("configuracion").select(select).eq("clave", clave);
 
  query = idSalita ? query.eq("id_salita", idSalita) : query.is("id_salita", null);
 
  const { data, error } = await query.returns<ConfiguracionRow[]>().maybeSingle();
 
  if (error) throw error;
 
  return data;
};

export const createConfiguracion = async (input: CreateConfiguracionInput, userId: string) => {
  const { data, error } = await supabase.from("configuracion").insert({
    ...input, id_salita: input.id_salita ?? null, actualizado_por: userId,
  }).select(select).returns<ConfiguracionRow[]>().single();
  
  if (error) throw error;
  
  return data;
};

export const updateConfiguracion = async (
  current: ConfiguracionRow, 
  input: UpdateConfiguracionInput, 
  userId: string
) => {
  
  // El trigger existente mantiene fecha_actualizacion.
  let query = supabase.from("configuracion").update({ ...input, actualizado_por: userId })
    .eq("id_configuracion", current.id_configuracion).eq("clave", current.clave);
 
    query = current.id_salita ? query.eq("id_salita", current.id_salita) : query.is("id_salita", null);
  
    const { data, error } = await query.select(select).returns<ConfiguracionRow[]>().maybeSingle();
  
    if (error) throw error;
  
    return data;
};
