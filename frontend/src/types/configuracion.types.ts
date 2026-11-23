// ========================================
// ZONAS
// ========================================

// Representa una zona geográfica utilizada para agrupar barrios.
export interface Zona {
  id_zona: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}


// ========================================
// CATÁLOGOS
// ========================================

// Tipos de catálogos administrables desde configuración.
export type CatalogoTipo =
  | 'zonas'
  | 'barrios'
  | 'especialidades';

// Estructura común utilizada por los catálogos.
export interface CatalogoRegistro {
  id: string;
  nombre: string;
  activo: boolean;

  // Campos opcionales según el tipo de catálogo.
  descripcion?: string | null;
  id_zona?: string;
  codigo_postal?: string | null;
  codigo?: string;
  requiere_profesional?: boolean;
}

// Datos enviados al crear o actualizar un catálogo.
// El ID no se envía dentro del cuerpo.
export type CatalogoInput = Omit<
  CatalogoRegistro,
  'id'
>;


// ========================================
// COBERTURA DE SALITAS
// ========================================

// Relaciona una salita con un barrio y su período de vigencia.
export interface Cobertura {
  id_salita: string;
  id_barrio: string;
  es_barrio_sede: boolean;
  activo: boolean;
  fecha_desde: string;
  fecha_hasta: string | null;
}


// ========================================
// HORARIOS DE ATENCIÓN
// ========================================

// Datos necesarios para crear o actualizar un horario.
export interface HorarioInput {
  id_profesional: string;
  id_especialidad: string;
  id_salita: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  duracion_turno_minutos: number;
  cupo_maximo_diario: number | null;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  activo: boolean;
}

// Horario recibido desde la API con su identificador.
export interface Horario extends HorarioInput {
  id_horario: string;
}


// ========================================
// BLOQUEOS DE AGENDA
// ========================================

// Datos necesarios para crear o actualizar un bloqueo.
export interface BloqueoInput {
  id_salita: string;
  id_profesional: string | null;
  id_especialidad: string | null;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  dia_completo: boolean;
  motivo: string;
  activo: boolean;
}

// Bloqueo recibido desde la API con su identificador.
export interface Bloqueo extends BloqueoInput {
  id_bloqueo: string;
}


// ========================================
// PARÁMETROS DEL SISTEMA
// ========================================

// Representa un parámetro configurable del sistema
// o perteneciente a una salita específica.
export interface Parametro {
  id_configuracion: string;
  id_salita: string | null;
  clave: string;
  valor: unknown;
  descripcion?: string | null;
  es_publica: boolean;
}