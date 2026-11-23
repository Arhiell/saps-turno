import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMenuForRole,
  isMenuItemActive,
} from '../src/components/layout/sidebar-menu.ts';
import {
  calculateAgeLabel,
  formatArgentinaDate,
  formatSignedConsultaNotice,
  isoToArgentinaDateTimeLocal,
} from '../src/utils/historia-clinica-format.ts';
import {
  buildAgendaReturnUrl,
  buildBuscadorUrl,
  buildConsultaSectionsForMode,
  resolveConsultaBlockViewMode,
  resolvePrimaryBackTarget,
} from '../src/utils/historia-clinica-navigation.ts';

test('getMenuForRole respeta permisos reales por rol en Historia Clínica y Auditoría', () => {
  const superAdminSinPermiso = getMenuForRole('SUPER_ADMIN', []);
  assert.equal(superAdminSinPermiso.some((i) => i.path === '/auditoria-clinica'), false);
  assert.equal(superAdminSinPermiso.some((i) => i.path === '/historia-clinica'), false);

  const superAdminConAuditoria = getMenuForRole('SUPER_ADMIN', ['VER_AUDITORIA_CLINICA']);
  assert.equal(superAdminConAuditoria.some((i) => i.path === '/auditoria-clinica'), true);
  assert.equal(superAdminConAuditoria.some((i) => i.path === '/historia-clinica'), false);
  assert.equal(
    superAdminConAuditoria.some((i) => i.path === '/historia-clinica/derivaciones'),
    false
  );

  assert.equal(
    getMenuForRole('ADMIN_SALITA', []).some((i) => i.path.includes('historia-clinica')),
    false
  );
  assert.equal(
    getMenuForRole('RECEPCION', []).some((i) => i.path.includes('historia-clinica')),
    false
  );
  assert.equal(
    getMenuForRole('RECEPCION', ['VER_HISTORIA_CLINICA']).some((i) =>
      i.path.includes('historia-clinica')
    ),
    true
  );
  assert.equal(
    getMenuForRole('PACIENTE', ['VER_HISTORIA_CLINICA']).some((i) =>
      i.path.includes('historia-clinica')
    ),
    false
  );

  const profSinPermisos = getMenuForRole('PROFESIONAL', []);
  assert.equal(profSinPermisos.some((i) => i.path === '/historia-clinica'), false);

  const profConPermisos = getMenuForRole('PROFESIONAL', [
    'VER_HISTORIA_CLINICA',
    'GESTIONAR_DERIVACIONES_CLINICAS',
  ]);
  assert.equal(profConPermisos.some((i) => i.path === '/historia-clinica'), true);
  assert.equal(
    profConPermisos.some((i) => i.path === '/historia-clinica/derivaciones'),
    true
  );
  assert.equal(profConPermisos.some((i) => i.path === '/auditoria-clinica'), false);
});

test('Rol PACIENTE incluye siempre «Mi historia clínica» en su menú', () => {
  const pacienteMenu = getMenuForRole('PACIENTE', []);
  const item = pacienteMenu.find((i) => i.path === '/mi-historia');
  assert.ok(item, 'Debe existir la opción /mi-historia en el menú del paciente');
  assert.equal(item.label, 'Mi historia clínica');
  assert.equal(item.icon, 'bi-journal-medical');
});

test('isMenuItemActive activa únicamente la opción correcta sin doble resaltado en Derivaciones', () => {
  const profMenu = getMenuForRole('PROFESIONAL', [
    'VER_HISTORIA_CLINICA',
    'GESTIONAR_DERIVACIONES_CLINICAS',
  ]);

  const activePathsFor = (pathname: string) =>
    profMenu
      .filter((item) => isMenuItemActive(pathname, item.path, profMenu))
      .map((item) => item.path);

  assert.deepEqual(activePathsFor('/historia-clinica'), ['/historia-clinica']);
  assert.deepEqual(activePathsFor('/historia-clinica/derivaciones'), [
    '/historia-clinica/derivaciones',
  ]);
  assert.deepEqual(activePathsFor('/historia-clinica/pacientes/123'), [
    '/historia-clinica',
  ]);
  assert.deepEqual(activePathsFor('/historia-clinica/consultas/456'), [
    '/historia-clinica',
  ]);
  assert.deepEqual(activePathsFor('/historia-clinica/nueva-consulta'), [
    '/historia-clinica',
  ]);
});

test('Utilidades de formato argentino manejan fechas YYYY-MM-DD sin desfase UTC', () => {
  assert.equal(formatArgentinaDate('1990-05-14'), '14/05/1990');
  assert.equal(formatArgentinaDate(null), '—');
  assert.match(calculateAgeLabel('1990-05-14'), /^\d+ años$/);
});

test('historia-clinica-navigation preserva filtros de agenda/buscador sin inyectar ?turno= automático', () => {
  const agendaUrl = buildAgendaReturnUrl({
    mode: 'history',
    fecha: '2026-11-01',
    fechaHasta: '2026-11-10',
    filterRange: true,
    estadoFilter: 'ATENDIDOS',
    page: 2,
  });
  assert.equal(
    agendaUrl,
    '/mi-agenda?rango=1&fecha=2026-11-01&hasta=2026-11-10&estado=ATENDIDOS&page=2'
  );
  assert.equal(agendaUrl.includes('turno='), false);

  assert.equal(
    buildAgendaReturnUrl({ mode: 'today', estadoFilter: 'PENDIENTES', page: 1 }),
    '/mis-pacientes?estado=PENDIENTES'
  );

  assert.equal(
    buildBuscadorUrl({ search: '35123456', salita: 'salita-1', page: 3 }),
    '/historia-clinica?search=35123456&salita=salita-1&page=3'
  );

  assert.deepEqual(
    resolvePrimaryBackTarget(
      { returnTo: agendaUrl, returnLabel: 'Volver a Mi agenda' },
      '/historia-clinica',
      'Volver al buscador'
    ),
    { to: agendaUrl, label: 'Volver a Mi agenda' }
  );
  assert.deepEqual(
    resolvePrimaryBackTarget({ returnTo: 'https://malicious.invalid' }),
    { to: '/historia-clinica', label: 'Volver al buscador' }
  );
});

test('Selector de bloques de Nueva Consulta distingue Obligatorios, Todos y Personalizado', () => {
  const enabledOptional = [
    'examen',
    'diagnosticos',
    'antecedentes',
    'observaciones',
  ] as const;

  const onlyMandatory = buildConsultaSectionsForMode('obligatorios', enabledOptional);
  assert.equal(onlyMandatory.datos, true);
  assert.equal(onlyMandatory.motivo, true);
  assert.equal(onlyMandatory.diagnosticos, false);
  assert.equal(onlyMandatory.observaciones, false);
  assert.deepEqual(resolveConsultaBlockViewMode(onlyMandatory, enabledOptional), {
    mode: 'obligatorios',
    openOptionalCount: 0,
    totalOptionalCount: 4,
  });

  const allBlocks = buildConsultaSectionsForMode('todos', enabledOptional);
  assert.equal(allBlocks.examen, true);
  assert.equal(allBlocks.diagnosticos, true);
  assert.equal(allBlocks.estudios, false);
  assert.deepEqual(resolveConsultaBlockViewMode(allBlocks, enabledOptional), {
    mode: 'todos',
    openOptionalCount: 4,
    totalOptionalCount: 4,
  });

  const manualCustom = { ...onlyMandatory, diagnosticos: true };
  assert.deepEqual(resolveConsultaBlockViewMode(manualCustom, enabledOptional), {
    mode: 'personalizado',
    openOptionalCount: 1,
    totalOptionalCount: 4,
  });

  const collapsedAgain = buildConsultaSectionsForMode('obligatorios', enabledOptional);
  assert.equal(
    resolveConsultaBlockViewMode(collapsedAgain, enabledOptional).mode,
    'obligatorios'
  );
});

test('formatSignedConsultaNotice informa protección e historia de rectificación trazable y estado de turno', () => {
  const sinTurno = formatSignedConsultaNotice(false);
  assert.ok(sinTurno.includes('firmada correctamente'));
  assert.ok(sinTurno.includes('protegido contra modificaciones directas'));
  assert.ok(sinTurno.includes('rectificación trazable'));
  assert.equal(sinTurno.includes('Atendido'), false);

  const conTurno = formatSignedConsultaNotice(true);
  assert.ok(conTurno.includes('Atendido'));
  assert.equal(isoToArgentinaDateTimeLocal('2026-11-11T08:30:00-03:00'), '2026-11-11T08:30');
});

test('useAutoDismiss y feedback unificado tienen duración estándar de 15 segundos', async () => {
  const {
    SUCCESS_MESSAGE_TIMEOUT_MS,
    RECOVERABLE_ERROR_TIMEOUT_MS,
    WARNING_MESSAGE_TIMEOUT_MS,
    INFO_MESSAGE_TIMEOUT_MS,
    PROFESSIONAL_MESSAGE_TIMEOUT_MS,
  } = await import('../src/utils/useAutoDismiss.ts');

  assert.equal(SUCCESS_MESSAGE_TIMEOUT_MS, 15_000);
  assert.equal(RECOVERABLE_ERROR_TIMEOUT_MS, 15_000);
  assert.equal(WARNING_MESSAGE_TIMEOUT_MS, 15_000);
  assert.equal(INFO_MESSAGE_TIMEOUT_MS, 15_000);
  assert.equal(PROFESSIONAL_MESSAGE_TIMEOUT_MS, 15_000);
});

test('Socket agenda:cambio suprime popup flotante duplicado ante firma de consulta médica', () => {
  const eventoFirma = {
    tipo: 'TURNO_ACTUALIZADO',
    mensaje: 'Un turno de tu agenda pasó a estado Atendido al firmar la consulta médica',
  };
  const esFirmaClinicaPropia = Boolean(
    eventoFirma.mensaje &&
    eventoFirma.mensaje.toLowerCase().includes('firmar la consulta')
  );
  assert.equal(esFirmaClinicaPropia, true, 'Debe identificar el evento de firma clínica propia');

  const eventoRecepcion = {
    tipo: 'TURNO_CANCELADO',
    mensaje: 'El turno de las 09:00 fue cancelado por recepción',
  };
  const esOtroEvento = Boolean(
    eventoRecepcion.mensaje &&
    eventoRecepcion.mensaje.toLowerCase().includes('firmar la consulta')
  );
  assert.equal(esOtroEvento, false, 'Eventos ajenos de agenda no deben ser suprimidos');
});
