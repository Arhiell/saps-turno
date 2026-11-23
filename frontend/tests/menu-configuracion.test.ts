import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMenuForRole,
  isMenuItemActive,
} from '../src/components/layout/sidebar-menu.ts';

test('getMenuForRole otorga la misma estructura funcional a ADMIN_SALITA y RECEPCION', () => {
  // SUPER_ADMIN
  const superAdminMenu = getMenuForRole('SUPER_ADMIN');
  const configSuper = superAdminMenu.find((i) => i.path === '/configuracion');
  assert.ok(configSuper, 'SUPER_ADMIN debe tener grupo Configuración');
  assert.equal(configSuper?.label, 'Configuración');
  assert.ok(configSuper?.children, 'Debe tener sub-elementos');
  
  // No debe existir el enlace redundante 'Configuración general' hacia /configuracion en los hijos
  assert.equal(
    configSuper?.children?.some((c) => c.path === '/configuracion'),
    false,
    'No debe existir un sub-elemento redundante /configuracion'
  );

  const adminSuper = superAdminMenu.find((i) => i.path === '/admin-sistema');
  assert.ok(adminSuper, 'SUPER_ADMIN debe tener grupo Administración');
  assert.equal(adminSuper?.label, 'Administración');
  assert.deepEqual(
    adminSuper?.children?.map((c) => c.path),
    ['/administracion', '/contenido', '/notificaciones']
  );

  // ADMIN_SALITA y RECEPCION comparten la misma estructura funcional
  const adminSalitaMenu = getMenuForRole('ADMIN_SALITA');
  const recepcionMenu = getMenuForRole('RECEPCION');

  const configSalita = adminSalitaMenu.find((i) => i.path === '/configuracion');
  const configRecepcion = recepcionMenu.find((i) => i.path === '/configuracion');
  assert.ok(configSalita, 'ADMIN_SALITA debe tener grupo Configuración');
  assert.ok(configRecepcion, 'RECEPCION debe tener grupo Configuración');

  const expectedConfigSubPaths = [
    '/configuracion/horarios',
    '/configuracion/especialidades',
    '/configuracion/cierres',
    '/configuracion/bloqueos',
    '/configuracion/parametros',
  ];

  assert.deepEqual(
    configSalita?.children?.map((c) => c.path),
    expectedConfigSubPaths,
    'ADMIN_SALITA debe tener los 5 apartados operativos de salita'
  );

  assert.deepEqual(
    configRecepcion?.children?.map((c) => c.path),
    expectedConfigSubPaths,
    'RECEPCION debe compartir los mismos 5 apartados operativos de salita'
  );

  // Ninguno de los dos roles de salita debe tener zonas, barrios ni cobertura
  for (const paths of [configSalita?.children?.map((c) => c.path), configRecepcion?.children?.map((c) => c.path)]) {
    assert.equal(paths?.includes('/configuracion/zonas'), false);
    assert.equal(paths?.includes('/configuracion/barrios'), false);
    assert.equal(paths?.includes('/configuracion/cobertura'), false);
  }

  // Grupo Administración para ambos roles
  const adminSalitaAdmin = adminSalitaMenu.find((i) => i.path === '/admin-sistema');
  const adminRecepcionAdmin = recepcionMenu.find((i) => i.path === '/admin-sistema');
  assert.ok(adminSalitaAdmin, 'ADMIN_SALITA debe tener grupo Administración');
  assert.ok(adminRecepcionAdmin, 'RECEPCION debe tener grupo Administración');

  const expectedAdminSubPaths = ['/administracion', '/contenido', '/notificaciones'];
  assert.deepEqual(adminSalitaAdmin?.children?.map((c) => c.path), expectedAdminSubPaths);
  assert.deepEqual(adminRecepcionAdmin?.children?.map((c) => c.path), expectedAdminSubPaths);

  // Profesionales y Reportes accesibles para ambos roles en el menú principal
  assert.ok(adminSalitaMenu.some((i) => i.path === '/profesionales'));
  assert.ok(recepcionMenu.some((i) => i.path === '/profesionales'));
  assert.ok(adminSalitaMenu.some((i) => i.path === '/reportes'));
  assert.ok(recepcionMenu.some((i) => i.path === '/reportes'));
});

test('isMenuItemActive activa correctamente sub-elementos de configuración y administración sin colisión', () => {
  const recepcionMenu = getMenuForRole('RECEPCION');

  // Horarios
  assert.equal(isMenuItemActive('/configuracion/horarios', '/configuracion/horarios', recepcionMenu), true);
  assert.equal(isMenuItemActive('/configuracion/horarios', '/configuracion', recepcionMenu), false);

  // Especialidades
  assert.equal(isMenuItemActive('/configuracion/especialidades', '/configuracion/especialidades', recepcionMenu), true);

  // Cierres
  assert.equal(isMenuItemActive('/configuracion/cierres', '/configuracion/cierres', recepcionMenu), true);

  // Cuentas de acceso
  assert.equal(isMenuItemActive('/administracion', '/administracion', recepcionMenu), true);
  assert.equal(isMenuItemActive('/administracion', '/admin-sistema', recepcionMenu), false);

  // Notificaciones y subrutas
  assert.equal(isMenuItemActive('/notificaciones', '/notificaciones', recepcionMenu), true);
  assert.equal(isMenuItemActive('/notificaciones/programadas', '/notificaciones', recepcionMenu), true);
  assert.equal(isMenuItemActive('/notificaciones/nueva', '/notificaciones', recepcionMenu), true);
});
