import type { ChatbotRole } from './chatbot.config.js';
import { normalizeChatbotText } from '../utils/chatbot-privacy.js';

const admins: ChatbotRole[] = ['SUPER_ADMIN', 'ADMIN_SALITA'];
const all: ChatbotRole[] = [...admins, 'PROFESIONAL', 'PACIENTE'];
export interface ChatbotArticle {
  id: string;
  roles: ChatbotRole[];
  keywords: string[];
  question: string;
  content: string;
  sources: string[];
}

// Solo documentación: nunca se interpolan registros, nombres, IDs ni texto libre del usuario.
export const chatbotKnowledge: ChatbotArticle[] = [
  {
    id: 'personas-a-cargo', roles: [...admins, 'PACIENTE'],
    keywords: ['tutor', 'tutores', 'hijo', 'hijos', 'padres', 'abuelo', 'abuelos', 'menor', 'responsable', 'cargo'],
    question: '¿Cómo gestiono turnos para una persona a cargo?',
    content: 'En Personas a cargo (/personas-a-cargo), el paciente ve sus vínculos autorizados y puede solicitar o consultar turnos de cada persona. También puede elegir el paciente en Solicitar turno y Mis turnos. Administración registra el vínculo desde Pacientes, detalle, Tutores y responsables: verifica la autorización, ingresa el DNI del responsable registrado y el parentesco. Puede retirar el permiso desde esa ficha. Cada persona tiene su propio límite de un turno pendiente por especialidad y su propia cobertura. El paciente atendido puede ser menor o adulto y no necesita cuenta; el responsable necesita su cuenta de paciente activa. El asistente solo explica el procedimiento y no registra ni autoriza vínculos.',
    sources: ['frontend/src/pages/pacientes/PersonasACargoPage.tsx', 'frontend/src/components/ui/PatientTutorsPanel.tsx', 'backend/src/services/patient-managed.service.ts'],
  },
  {
    id: 'pacientes', roles: admins, keywords: ['paciente', 'pacientes', 'tutor', 'tutores'],
    question: '¿Cómo registro y busco pacientes en CORA?',
    content: 'En Pacientes (/pacientes), usá Buscar para buscar por DNI, apellido o nombre completo dentro del sistema. No escribas esos datos en el asistente. Para crear, ingresá a /pacientes/nuevo, completá los campos obligatorios, usá Registrar paciente y confirmá en el diálogo Registrar paciente. Desde el listado podés abrir el detalle. La gestión se limita al alcance autorizado de tu cuenta. Desde Tutores y responsables en el detalle del paciente se registra el responsable por DNI, previa verificacion del vinculo y del permiso para gestionar turnos.',
    sources: ['frontend/src/pages/pacientes/PacientesPage.tsx', 'frontend/src/pages/pacientes/NuevoPacientePage.tsx', 'frontend/src/pages/pacientes/PacienteDetallePage.tsx'],
  },
  {
    id: 'turnos-admin', roles: admins, keywords: ['turno', 'turnos', 'cancelar', 'reprogramar', 'reserva', 'reservar'],
    question: '¿Cómo gestiono turnos desde administración?',
    content: 'En Turnos (/turnos) consultá el listado y sus filtros. Para registrar, abrí /turnos/nuevo, seleccioná Paciente, Especialidad, Profesional, Salita, fecha y horario disponible; usá Confirmar turno y después Crear turno en el diálogo. Las opciones dependen de asignaciones y disponibilidad. En el detalle del turno están las acciones autorizadas, como confirmar, cancelar con motivo o reprogramar; esta última abre /turnos/:id/reprogramar. No es posible reservar sin disponibilidad válida. Para consultar los turnos de hoy usá los filtros de fecha del listado.',
    sources: ['frontend/src/pages/turnos/NuevoTurnoPage.tsx', 'frontend/src/pages/turnos/TurnosPage.tsx', 'frontend/src/pages/turnos/TurnoDetallePage.tsx', 'frontend/src/pages/turnos/ReprogramarTurnoPage.tsx'],
  },
  {
    id: 'turnos-paciente', roles: ['PACIENTE'], keywords: ['turno', 'turnos', 'cancelar', 'reserva', 'reservar', 'solicitar', 'profesional', 'profesionales', 'salita', 'salitas', 'cobertura'],
    question: '¿Cómo solicito, consulto o cancelo mis turnos y reviso mi cobertura?',
    content: 'En Solicitar turno (/solicitar-turno) revisá tu cobertura. Si es válida, elegí Especialidad, Profesional, Días disponibles y un horario. Completá la solicitud y usá Confirmar solicitud. Los profesionales ofrecidos corresponden a tu salita asignada. Revisá tus reservas en Mis turnos (/mis-turnos), abrí el detalle y, cuando el estado lo permita, usá Cancelar turno, completá el motivo y Confirmar cancelación. El paciente no tiene reprogramación administrativa. Si la cobertura no es válida, revisá Mi perfil (/mi-perfil) o consultá a tu salita. No hay un listado administrativo de pacientes, profesionales ni salitas para este rol. La disponibilidad semanal y las restricciones de reservas se muestran en el formulario; el asistente no consulta cupos reales.',
    sources: ['frontend/src/pages/turnos/SolicitarTurnoPage.tsx', 'frontend/src/components/ui/PatientBookingForm.tsx', 'frontend/src/components/ui/PatientBookingSlots.tsx', 'frontend/src/pages/turnos/PatientAppointmentsPage.tsx', 'frontend/src/components/ui/CancelAppointment.tsx'],
  },
  {
    id: 'agenda', roles: ['PROFESIONAL'], keywords: ['agenda', 'turno', 'turnos', 'paciente', 'pacientes', 'hoy', 'atendido', 'inasistencia', 'asistio'],
    question: '¿Cómo consulto mi agenda y registro el resultado de atención?',
    content: 'Mi agenda (/mi-agenda) y Pacientes del día (/mis-pacientes) muestran la misma pantalla Mi agenda y pacientes del día. Elegí la fecha para consultar tus turnos; inicialmente se usa el día de Argentina. Las acciones habilitadas permiten marcar Atendido o No asistió según el turno. Podés descargar la agenda diaria desde esta pantalla. Estas opciones actúan sobre tu agenda autorizada; no tenés el panel de administración general ni el registro administrativo de pacientes. El asistente solo explica el procedimiento y no lee la agenda.',
    sources: ['frontend/src/pages/turnos/MisTurnosPage.tsx', 'frontend/src/routes/AppRoutes.tsx'],
  },
  {
    id: 'profesionales', roles: admins, keywords: ['profesional', 'profesionales', 'matricula', 'especialidad', 'especialidades'],
    question: '¿Dónde consulto y administro profesionales?',
    content: 'Ingresá a Profesionales (/profesionales). El listado permite buscar y abrir el detalle. El registro nuevo está en /profesionales/nuevo y la edición en /profesionales/:id/editar. El formulario incluye datos personales y matrícula; las especialidades, salitas y vigencias de asignaciones determinan qué atenciones se habilitan. Respetá el alcance de las salitas autorizadas para tu cuenta. Los horarios se gestionan en Configuración, Horarios y disponibilidad.',
    sources: ['frontend/src/pages/profesionales/ProfesionalesPage.tsx', 'frontend/src/components/profesionales/ProfesionalForm.tsx', 'frontend/src/pages/profesionales/ProfesionalDetallePage.tsx'],
  },
  {
    id: 'salitas', roles: ['SUPER_ADMIN'], keywords: ['salita', 'salitas', 'barrio', 'barrios', 'zona', 'zonas', 'cobertura'],
    question: '¿Cómo consulto las salitas y su cobertura?',
    content: 'Salitas (/salitas) permite buscar por código, nombre o dirección y abrir el detalle. Para crear usá /salitas/nueva; para editar, la acción correspondiente del listado o detalle. En Configuración están Zonas (/configuracion/zonas), Barrios (/configuracion/barrios) y Cobertura de salitas (/configuracion/cobertura). Estas pantallas administrativas son exclusivas de SUPER_ADMIN.',
    sources: ['frontend/src/pages/salitas/SalitasPage.tsx', 'frontend/src/components/layout/sidebar-menu.ts', 'frontend/src/routes/AppRoutes.tsx'],
  },
  {
    id: 'notificaciones', roles: all, keywords: ['notificacion', 'notificaciones', 'aviso', 'avisos', 'campana'],
    question: '¿Cómo consulto mis notificaciones?',
    content: 'Abrí Mis notificaciones (/mis-notificaciones), disponible en el menú y mediante la campana del encabezado. Podés revisar los avisos recibidos y marcarlos como leídos mediante las opciones disponibles. Esta sección muestra tus propias notificaciones. El asistente no lee su contenido.',
    sources: ['frontend/src/pages/notificaciones/MisNotificacionesPage.tsx', 'frontend/src/components/layout/NotificationBell.tsx'],
  },
  {
    id: 'comunicaciones', roles: admins, keywords: ['enviar notificacion', 'crear notificacion', 'programar notificacion', 'administrar notificaciones', 'contenido', 'noticia', 'noticias'],
    question: '¿Dónde administro comunicaciones y contenido público?',
    content: 'Administrar notificaciones (/notificaciones) ofrece el historial; /notificaciones/nueva permite preparar una comunicación y /notificaciones/programadas muestra las programadas. El formulario define audiencia y programación autorizadas. Contenido público (/contenido) administra publicaciones; /contenido/nueva crea una publicación y /contenido/:id/editar la edita. El asistente no envía comunicaciones ni publica contenido.',
    sources: ['frontend/src/pages/notificaciones/NuevaNotificacionPage.tsx', 'frontend/src/pages/contenido/NewsAdminPage.tsx', 'frontend/src/routes/AppRoutes.tsx'],
  },
  {
    id: 'perfil', roles: all, keywords: ['perfil', 'cuenta', 'contrasena', 'correo', 'usuario', 'seguridad'],
    question: '¿Dónde actualizo mi perfil y las opciones de mi cuenta?',
    content: 'Ingresá a Mi perfil (/mi-perfil). El paciente ve su perfil y cobertura; los demás roles con panel ven su perfil personal. Usá las opciones de datos personales y de cuenta que aparecen allí para actualizar la información o gestionar correo, contraseña y nombre de usuario. Si el sistema exige completar el perfil, primero seguí /completar-perfil. Nunca compartas tus datos, claves ni códigos en este chat.',
    sources: ['frontend/src/pages/pacientes/MiPerfilPage.tsx', 'frontend/src/pages/auth/AdminProfilePage.tsx', 'frontend/src/components/ui/AccountSecuritySection.tsx'],
  },
  {
    id: 'reportes', roles: admins, keywords: ['reporte', 'reportes', 'estadistica', 'estadisticas', 'exportar', 'pdf', 'excel'],
    question: '¿Dónde consulto y exporto reportes?',
    content: 'Abrí Reportes (/reportes). Seleccioná el período y los filtros disponibles para consultar resúmenes, información por especialidad y profesional o agenda diaria. Las opciones de exportación dependen del reporte y pueden ofrecer PDF, Excel o Word. ADMIN_SALITA consulta únicamente su alcance autorizado. El asistente no accede a reportes ni devuelve estadísticas reales.',
    sources: ['frontend/src/pages/reportes/ReportesPage.tsx', 'backend/src/routes/reporte.routes.ts'],
  },
  {
    id: 'configuracion', roles: admins, keywords: ['configuracion', 'horario', 'horarios', 'disponibilidad', 'bloqueo', 'bloqueos', 'parametro', 'parametros'],
    question: '¿Dónde configuro horarios, disponibilidad, bloqueos y parámetros?',
    content: 'En Configuración (/configuracion), Horarios y disponibilidad (/configuracion/horarios) permite configurar días, franjas, duración y vigencia. Bloqueos de agenda (/configuracion/bloqueos) permite cierres de día completo o por franja. Parámetros (/configuracion/parametros) muestra los ajustes permitidos según el rol. Las asignaciones profesionales condicionan las opciones. El asistente no cambia estas configuraciones.',
    sources: ['frontend/src/pages/configuracion/HorariosPage.tsx', 'frontend/src/pages/configuracion/BloqueosPage.tsx', 'frontend/src/pages/configuracion/ParametrosPage.tsx'],
  },
  {
    id: 'inasistencia', roles: ['SUPER_ADMIN', 'ADMIN_SALITA', 'PACIENTE'], keywords: ['inasistencia', 'asistio', 'sancion', 'sanciones', 'suspension'],
    question: '¿Qué significa una inasistencia y su restricción de reservas?',
    content: 'NO_ASISTIO indica que no se registró asistencia al turno. La interfaz puede informar una sanción que impide nuevas reservas, con motivo y vencimiento; no equivale a bloquear la cuenta y no cancela por sí misma reservas existentes. La migración del repositorio define siete días para la sanción automática, pero tener ese archivo no confirma que se haya aplicado en la base. Consultá a la administración ante dudas sobre una restricción particular. El asistente no consulta ni modifica sanciones.',
    sources: ['README.md', 'frontend/src/components/ui/PatientBookingForm.tsx', 'backend/src/services/booking-restriction.service.ts'],
  },
  {
    id: 'ayuda', roles: all, keywords: ['cora', 'ayuda', 'hola', 'funciona', 'funciones', 'navegar', 'inicio'],
    question: '¿Qué es CORA y cómo uso su navegación?',
    content: 'CORA organiza la atención en salitas municipales. Inicio está en /panel. La navegación muestra las secciones autorizadas para tu rol, con menú lateral en escritorio y barra inferior con Más en móvil. Este asistente explica funciones; no consulta datos ni realiza acciones. Cada consulta es independiente. Si una opción no aparece, consultá a la administración.',
    sources: ['README.md', 'frontend/src/components/layout/sidebar-menu.ts', 'frontend/src/components/layout/MobileBottomNav.tsx'],
  },
];

export const selectChatbotArticle = (message: string, role: ChatbotRole) => {
  const normalized = normalizeChatbotText(message);
  const scored = chatbotKnowledge.map(article => ({ article,
    score: Math.max(0, ...article.keywords.filter(word =>
      new RegExp(`\\b${word}\\b`).test(normalized)).map(word => word.length)),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  // Se elige la intención antes de comprobar permisos: no se sustituye una función prohibida por otra.
  const bestScore = scored[0]?.score;
  return scored.find(item => item.score === bestScore && item.article.roles.includes(role))?.article;
};
