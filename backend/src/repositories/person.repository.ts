import { supabase } from '../config/supabase.js';

import type {
  CreatePersonInput,
} from '../validators/person.validator.js';

import { personSelect } from './person-read.repository.js';

// Crea una persona y devuelve sus datos.
export const createPerson = async (
  input: CreatePersonInput
) => {
  const { data, error } = await supabase
    .from('personas')
    .insert(input)
    .select(personSelect)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

// Crea la persona y la vincula al administrador en una transacción.
export const createPersonForAdmin = async (
  idUsuario: string,
  input: Omit<CreatePersonInput, 'email'>,
  ip: string | null
) => {
  const { data, error } = await supabase.rpc(
    'completar_perfil_administrativo',
    {
      p_usuario: idUsuario,
      p_persona: input,
      p_ip: ip,
    }
  );

  if (error) {
    throw error;
  }

  // Si la función SQL en Supabase aún no incluye RECEPCION y devuelve NO_AUTORIZADO,
  // aplicamos fallback controlado verificando permisos administrativos y completando de forma segura.
  if (data === 'NO_AUTORIZADO') {
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id_usuario, email, activo, email_verificado, id_persona, roles!inner(codigo, activo)')
      .eq('id_usuario', idUsuario)
      .single();

    if (!userError && user && user.activo && user.email_verificado && !user.id_persona) {
      const roleCode = (user.roles as unknown as { codigo: string; activo: boolean })?.codigo;
      const roleActive = (user.roles as unknown as { codigo: string; activo: boolean })?.activo;

      if (roleActive && (roleCode === 'RECEPCION' || roleCode === 'ADMIN_SALITA' || roleCode === 'SUPER_ADMIN')) {
        // Verificar si existe persona con ese DNI
        const { data: existingPersonByDni } = await supabase
          .from('personas')
          .select('id_persona')
          .eq('dni', input.dni)
          .maybeSingle();

        if (existingPersonByDni) {
          const { data: userWithDni } = await supabase
            .from('usuarios')
            .select('id_usuario')
            .eq('id_persona', existingPersonByDni.id_persona)
            .maybeSingle();

          return userWithDni ? 'DNI_CUENTA' : 'DNI_EXISTENTE';
        }

        // Verificar si existe persona con ese email
        const { data: existingPersonByEmail } = await supabase
          .from('personas')
          .select('id_persona')
          .ilike('email', user.email)
          .maybeSingle();

        if (existingPersonByEmail) {
          return 'EMAIL_EXISTENTE';
        }

        // Crear la persona
        const { data: newPerson, error: insertError } = await supabase
          .from('personas')
          .insert({
            dni: input.dni,
            nombres: input.nombres.trim(),
            apellidos: input.apellidos.trim(),
            fecha_nacimiento: input.fecha_nacimiento || null,
            sexo: input.sexo || null,
            telefono: input.telefono?.trim() || null,
            email: user.email.toLowerCase(),
            direccion: input.direccion?.trim() || null,
            localidad: input.localidad || 'Goya',
            provincia: input.provincia || 'Corrientes',
            codigo_postal: input.codigo_postal?.trim() || null,
          })
          .select('id_persona')
          .single();

        if (insertError) {
          return 'DUPLICADO';
        }

        // Vincular al usuario
        const { error: updateError } = await supabase
          .from('usuarios')
          .update({ id_persona: newPerson.id_persona })
          .eq('id_usuario', idUsuario);

        if (updateError) {
          return 'DUPLICADO';
        }

        return 'OK';
      }
    }
  }

  return data as string;
};
