import assert from 'node:assert/strict';
import test from 'node:test';
import { queue, drained } from './patient-fixtures.js';

const {
  createAdminSchema,
} = await import('../src/validators/user.validator.js');

const {
  createAdminAccount,
} = await import('../src/services/user-management.service.js');

const {
  changeManagedAccess,
  correctManagedPerson,
  listManagedRecords,
} = await import('../src/services/access-management.service.js');

import type { AuthenticatedUser } from '../src/types/auth.types.js';

const VALID_SALITA_ID = '11111111-1111-4111-8111-111111111111';
const VALID_USER_ID = '22222222-2222-4222-8222-222222222222';
const VALID_ROLE_ID = '33333333-3333-4333-8333-333333333333';
const VALID_PERSON_ID = '44444444-4444-4444-8444-444444444444';

test('1. createAdminSchema: Valida y exige salita para RECEPCION y ADMIN_SALITA, e impide salita para SUPER_ADMIN', () => {
  // RECEPCION con salita válida -> Éxito
  const recepcionOk = createAdminSchema.safeParse({
    nombre_usuario: 'recepcion_norte',
    email: 'recepcion.norte@goya.gov.ar',
    password: 'Password123!',
    rol: 'RECEPCION',
    id_salita: VALID_SALITA_ID,
  });
  assert.equal(recepcionOk.success, true);
  if (recepcionOk.success) {
    assert.equal(recepcionOk.data.rol, 'RECEPCION');
    assert.equal(recepcionOk.data.id_salita, VALID_SALITA_ID);
  }

  // RECEPCION sin salita -> Error de validación exigiendo salita
  const recepcionSinSalita = createAdminSchema.safeParse({
    nombre_usuario: 'recepcion_sin_sala',
    email: 'sin_sala@goya.gov.ar',
    password: 'Password123!',
    rol: 'RECEPCION',
  });
  assert.equal(recepcionSinSalita.success, false);
  if (!recepcionSinSalita.success) {
    const errors = recepcionSinSalita.error.flatten().fieldErrors;
    assert.ok(errors.id_salita?.includes('Seleccioná una salita.'));
  }

  // ADMIN_SALITA con salita válida -> Éxito
  const adminOk = createAdminSchema.safeParse({
    nombre_usuario: 'admin_sur',
    email: 'admin.sur@goya.gov.ar',
    password: 'Password123!',
    rol: 'ADMIN_SALITA',
    id_salita: VALID_SALITA_ID,
  });
  assert.equal(adminOk.success, true);

  // ADMIN_SALITA sin salita -> Error exigiendo salita
  const adminSinSalita = createAdminSchema.safeParse({
    nombre_usuario: 'admin_sin_sala',
    email: 'admin.sin_sala@goya.gov.ar',
    password: 'Password123!',
    rol: 'ADMIN_SALITA',
  });
  assert.equal(adminSinSalita.success, false);
  if (!adminSinSalita.success) {
    const errors = adminSinSalita.error.flatten().fieldErrors;
    assert.ok(errors.id_salita?.includes('Seleccioná una salita.'));
  }

  // SUPER_ADMIN sin salita -> Éxito
  const superOk = createAdminSchema.safeParse({
    nombre_usuario: 'superadmin_central',
    email: 'superadmin@goya.gov.ar',
    password: 'Password123!',
    rol: 'SUPER_ADMIN',
  });
  assert.equal(superOk.success, true);

  // SUPER_ADMIN con salita -> Error
  const superConSalita = createAdminSchema.safeParse({
    nombre_usuario: 'superadmin_erroneo',
    email: 'superadmin.error@goya.gov.ar',
    password: 'Password123!',
    rol: 'SUPER_ADMIN',
    id_salita: VALID_SALITA_ID,
  });
  assert.equal(superConSalita.success, false);
  if (!superConSalita.success) {
    const errors = superConSalita.error.flatten().fieldErrors;
    assert.ok(errors.id_salita?.includes('El superadministrador no requiere salita.'));
  }

  // Rol inválido -> Rechazado
  const rolInvalido = createAdminSchema.safeParse({
    nombre_usuario: 'usuario_invalido',
    email: 'invalido@goya.gov.ar',
    password: 'Password123!',
    rol: 'MEDICO',
    id_salita: VALID_SALITA_ID,
  });
  assert.equal(rolInvalido.success, false);
});

test('2. createAdminAccount: Registra correctamente un usuario con rol RECEPCION y lo asigna a la salita', async () => {
  queue(
    { table: 'usuarios', result: [] },
    { table: 'usuarios', result: [] },
    { table: 'roles', result: [{ id_rol: VALID_ROLE_ID, codigo: 'RECEPCION', nombre: 'Recepción' }] },
    { table: 'salitas', result: [{ id_salita: VALID_SALITA_ID, nombre: 'SAPS Norte', activo: true }] },
    {
      table: 'usuarios',
      method: 'POST',
      result: {
        id_usuario: VALID_USER_ID,
        id_rol: VALID_ROLE_ID,
        nombre_usuario: 'recepcion_prueba',
        email: 'recepcion_prueba@goya.gov.ar',
        activo: true,
        email_verificado: false,
      },
    },
    {
      table: 'usuario_salita',
      method: 'POST',
      result: [{
        id_usuario: VALID_USER_ID,
        id_salita: VALID_SALITA_ID,
        activo: true,
      }],
      check: (_url, body) => {
        const data = Array.isArray(body) ? body[0] : body;
        assert.equal(data?.id_usuario, VALID_USER_ID);
        assert.equal(data?.id_salita, VALID_SALITA_ID);
      },
    }
  );

  const created = await createAdminAccount({
    nombre_usuario: 'recepcion_prueba',
    email: 'recepcion_prueba@goya.gov.ar',
    password: 'Password123!',
    rol: 'RECEPCION',
    id_salita: VALID_SALITA_ID,
  });

  assert.equal(created.id_usuario, VALID_USER_ID);
  assert.equal(created.rol, 'RECEPCION');
  assert.deepEqual(created.salita, {
    id_salita: VALID_SALITA_ID,
    nombre: 'SAPS Norte',
  });
  drained();
});

test('3. createAdminAccount: Falla con 404 si la salita indicada para RECEPCION no existe o está inactiva', async () => {
  queue(
    { table: 'usuarios', result: [] },
    { table: 'usuarios', result: [] },
    { table: 'roles', result: [{ id_rol: VALID_ROLE_ID, codigo: 'RECEPCION', nombre: 'Recepción' }] },
    { table: 'salitas', result: [] }
  );

  await assert.rejects(
    async () => {
      await createAdminAccount({
        nombre_usuario: 'recepcion_sin_salita',
        email: 'sin_salita@goya.gov.ar',
        password: 'Password123!',
        rol: 'RECEPCION',
        id_salita: VALID_SALITA_ID,
      });
    },
    {
      name: 'AppError',
      statusCode: 404,
      message: 'La salita indicada no existe o está inactiva',
    }
  );
  drained();
});

test('4. listManagedRecords: Consulta cuentas incluyendo RECEPCION y permite filtrar por rol RECEPCION', async () => {
  const superUser: AuthenticatedUser = {
    id_usuario: VALID_USER_ID,
    email: 'super@goya.gov.ar',
    nombre_usuario: 'superadmin',
    rol: 'SUPER_ADMIN',
  };

  queue({
    table: 'usuarios',
    result: [
      {
        id_usuario: '55555555-5555-4555-8555-555555555555',
        id_persona: null,
        nombre_usuario: 'recepcion1',
        email: 'recepcion1@goya.gov.ar',
        activo: true,
        email_verificado: true,
        rol: { codigo: 'RECEPCION', nombre: 'Recepción' },
        persona: null,
        asignaciones: [
          {
            id_salita: VALID_SALITA_ID,
            salita: { id_salita: VALID_SALITA_ID, nombre: 'SAPS Norte' },
          },
        ],
      },
    ],
    check: (url) => {
      const select = url.searchParams.get('select') ?? '';
      assert.ok(select.includes('rol:roles!inner(codigo,nombre)'));
      const roles = url.searchParams.getAll('rol.codigo');
      assert.ok(roles.includes('eq.RECEPCION'));
    },
  });

  const result = await listManagedRecords(superUser, {
    page: 1,
    search: '',
    role: 'RECEPCION',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].rol.codigo, 'RECEPCION');
  drained();
});

test('5. changeManagedAccess: SUPER_ADMIN puede activar y desactivar una cuenta RECEPCION', async () => {
  const superUser: AuthenticatedUser = {
    id_usuario: '99999999-9999-4999-8999-999999999999',
    email: 'super@goya.gov.ar',
    nombre_usuario: 'superadmin',
    rol: 'SUPER_ADMIN',
  };

  const recepcionUserId = '88888888-8888-4888-8888-888888888888';

  // Desactivar cuenta RECEPCION
  queue(
    {
      table: 'usuarios',
      result: {
        id_usuario: recepcionUserId,
        id_persona: VALID_PERSON_ID,
        id_rol: VALID_ROLE_ID,
        rol: { codigo: 'RECEPCION' },
      },
    },
    {
      table: 'sesiones_refresh',
      method: 'PATCH',
      result: [],
    },
    {
      table: 'usuarios',
      method: 'PATCH',
      result: [],
      check: (_url, body) => {
        const data = Array.isArray(body) ? body[0] : body;
        assert.equal(data?.activo, false);
      },
    }
  );

  await changeManagedAccess(superUser, recepcionUserId, false);
  drained();

  // No-SUPER_ADMIN recibe 403 al intentar cambiar estado
  const adminSalitaUser: AuthenticatedUser = {
    id_usuario: '77777777-7777-4777-8777-777777777777',
    email: 'admin.salita@goya.gov.ar',
    nombre_usuario: 'admin_salita',
    rol: 'ADMIN_SALITA',
  };

  await assert.rejects(
    async () => {
      await changeManagedAccess(adminSalitaUser, recepcionUserId, false);
    },
    {
      name: 'AppError',
      statusCode: 403,
      message: 'Solo el superadministrador puede gestionar estas cuentas.',
    }
  );
});

test('6. correctManagedPerson: SUPER_ADMIN puede modificar datos de persona vinculada a RECEPCION', async () => {
  const superUser: AuthenticatedUser = {
    id_usuario: '99999999-9999-4999-8999-999999999999',
    email: 'super@goya.gov.ar',
    nombre_usuario: 'superadmin',
    rol: 'SUPER_ADMIN',
  };

  const existingPerson = {
    id_persona: VALID_PERSON_ID,
    dni: '35111222',
    nombres: 'María',
    apellidos: 'Gómez',
    fecha_nacimiento: '1990-03-15',
    sexo: 'FEMENINO',
    telefono: null,
    email: null,
    direccion: 'Belgrano 123',
    localidad: 'Goya',
    provincia: 'Corrientes',
    codigo_postal: null,
    activo: true,
  };

  queue(
    {
      table: 'usuarios',
      result: [{
        id_usuario: VALID_USER_ID,
        rol: { codigo: 'RECEPCION' },
      }],
      check: (url) => {
        assert.equal(url.searchParams.get('id_persona'), `eq.${VALID_PERSON_ID}`);
      },
    },
    {
      table: 'personas',
      result: [existingPerson],
    },
    {
      table: 'personas',
      result: [],
    },
    {
      table: 'personas',
      method: 'PATCH',
      result: {
        ...existingPerson,
        nombres: 'María Laura',
      },
    }
  );

  const updated = await correctManagedPerson(superUser, VALID_PERSON_ID, {
    dni: '35111222',
    nombres: 'María Laura',
    apellidos: 'Gómez',
    fecha_nacimiento: '1990-03-15',
    sexo: 'FEMENINO',
  });

  assert.equal(updated.nombres, 'María Laura');
  drained();

  // No-SUPER_ADMIN recibe 403
  const recepcionUser: AuthenticatedUser = {
    id_usuario: VALID_USER_ID,
    email: 'recep@goya.gov.ar',
    nombre_usuario: 'recep1',
    rol: 'RECEPCION',
  };

  await assert.rejects(
    async () => {
      await correctManagedPerson(recepcionUser, VALID_PERSON_ID, {
        dni: '35111222',
        nombres: 'María Laura',
        apellidos: 'Gómez',
        fecha_nacimiento: '1990-03-15',
        sexo: 'FEMENINO',
      });
    },
    {
      name: 'AppError',
      statusCode: 403,
      message: 'Solo el superadministrador puede modificar administradores.',
    }
  );
});
