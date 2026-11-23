# Procedimiento de Pruebas de Integración en Staging – Historia Clínica

Este documento describe el procedimiento reproducible para validar las **14 funciones RPC** del módulo de Historia Clínica contra una base **Supabase de pruebas / staging** (con `20261110_historia_clinica.sql` aplicada).

> **Advertencia**: No ejecutar nunca sobre producción ni utilizar datos reales de pacientes.

---

## 1. Configuración de variables de entorno de staging

Crear o ajustar `backend/.env` apuntando exclusivamente al proyecto Supabase de pruebas:

```env
NODE_ENV=test
PORT=3001
SUPABASE_URL=https://<proyecto-staging>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable_key_staging>
SUPABASE_SECRET_KEY=<secret_key_staging>
JWT_ACCESS_SECRET=<secreto_jwt_staging_min_32_chars>
JWT_ACCESS_EXPIRES_MINUTES=15
FRONTEND_URL=http://localhost:5173
```

Verificar que `SUPABASE_SECRET_KEY` se utilice únicamente en el backend.

---

## 2. Usuarios y datos sintéticos de prueba

Crear en el entorno de staging registros sintéticos (DNI/correos ficticios, p. ej. `99000001`..`99000010` y `@staging.saps.local`):

1. **Estructura base**:
   - `Salita A` (`id_salita_origen`) y `Salita B` (`id_salita_destino`), ambas activas.
   - `Especialidad 1` (`Clínica Médica`) y `Especialidad 2` (`Cardiología`), activas.
2. **Usuarios por rol** (todos `activo = true`, `email_verificado = true`, con `personas` asociada):
   - `PROFESIONAL_A` (rol `PROFESIONAL`): asignado en `profesional_salita` a `Salita A` (vigente hoy) y en `profesional_especialidad` a `Especialidad 1`.
   - `PROFESIONAL_B` (rol `PROFESIONAL`): asignado en `profesional_salita` a `Salita B` (vigente hoy) y en `profesional_especialidad` a `Especialidad 2`.
   - `PROFESIONAL_VENCIDO` (rol `PROFESIONAL`): con `profesional_salita` vencida (`fecha_hasta < CURRENT_DATE`).
   - `ADMIN_SALITA_B` (rol `ADMIN_SALITA`): asignado en `usuario_salita` vigente únicamente a `Salita B`.
   - `RECEPCION_A` (rol `RECEPCION`): asignado a `Salita A`.
   - `SUPER_ADMIN_TEST` (rol `SUPER_ADMIN`): perfil completo.
   - `PACIENTE_TEST` (rol `PACIENTE`): paciente sintético asignado a `Salita A` (`pacientes.id_salita_asignada = Salita A`).
   - **Usuario auditor dedicado (opcional)** en staging con rol de prueba que posea `VER_AUDITORIA_CLINICA` en `rol_permisos` para validar la RPC 14 (`consultar_auditoria_clinica`).

---

## 3. Verificación previa de privilegios en PostgreSQL (RPC 0 / DDL)

Ejecutar en el SQL Editor del proyecto **staging**:

```sql
-- 3.1 Confirmar que service_role NO tiene privilegios directos sobre tablas clínicas
SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE grantee IN ('service_role', 'authenticated', 'anon', 'PUBLIC')
   AND table_schema = 'public'
   AND table_name IN (
     'historias_clinicas', 'antecedentes_clinicos', 'alergias_paciente',
     'consultas_medicas', 'diagnosticos_clinicos', 'evoluciones_clinicas',
     'tratamientos_clinicos', 'estudios_clinicos',
     'derivaciones_autorizaciones_clinicas', 'derivaciones_autorizaciones_historial',
     'auditoria_clinica', 'auditoria_accesos_auditoria'
   );
-- Resultado esperado: 0 filas.

-- 3.2 Confirmar que las 14 RPC tienen EXECUTE para service_role y NO para PUBLIC/anon/authenticated
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
     'verificar_acceso_clinico',
     'consultar_historia_clinica',
     'consultar_consulta_medica',
     'registrar_consulta_clinica',
     'firmar_consulta_medica',
     'anular_consulta_borrador',
     'registrar_evolucion_clinica',
     'rectificar_evolucion_clinica',
     'actualizar_estado_estudio_clinico',
     'informar_estudio_clinico',
     'solicitar_derivacion_clinica',
     'resolver_derivacion_clinica',
     'listar_derivaciones_clinicas',
     'consultar_auditoria_clinica'
   )
 ORDER BY p.proname;
-- Resultado esperado: exactamente 14 funciones.
```

---

## 4. Matriz de ejecución sobre las 14 RPC (vía API Express)

Levantar la API contra staging (`npm run dev` o `npm start`) y obtener JWTs reales mediante `POST /api/auth/login`.

1. **`verificar_acceso_clinico` + `consultar_historia_clinica` (RPC 1 y 2)**:
   - `GET /api/historia-clinica/pacientes/:idPaciente?id_salita=:salitaA` con `PROFESIONAL_A` → `200`.
   - Mismo endpoint con `es_exportacion=true` sin `motivo_acceso` → `200` (audita `EXPORTACION` con motivo `Exportación de historia clínica`).
   - Mismo endpoint con `PROFESIONAL_B` (otra salita sin derivación) → `403`.
   - Mismo endpoint con `PROFESIONAL_VENCIDO` → `403`.
   - Mismo endpoint con `ADMIN_SALITA_B`, `RECEPCION_A`, `SUPER_ADMIN_TEST`, `PACIENTE_TEST` → `403`.
2. **`registrar_consulta_clinica` (RPC 4)**:
   - `POST /api/historia-clinica/consultas` con `PROFESIONAL_A`, `firmar=false`, incluyendo `diagnosticos`, `tratamientos`, `estudios`, `antecedentes`, `alergias` → `201` (`estado: BORRADOR`).
   - Enviar campo extra `id_usuario` o `id_profesional` → `400`.
   - Enviar un estudio con descripción vacía dentro de una consulta válida → `400` y verificar que no se insertó la consulta (atomicidad).
3. **`consultar_consulta_medica` (RPC 3)**:
   - `GET /api/historia-clinica/consultas/:idConsulta?id_salita=:salitaA` con `PROFESIONAL_A` → `200`.
   - Mismo `BORRADOR` consultado por otro profesional de `Salita A` → `403` (protección de borradores ajenos).
4. **`anular_consulta_borrador` y `firmar_consulta_medica` (RPC 5 y 6)**:
   - Crear un segundo borrador y ejecutar `POST /api/historia-clinica/consultas/:idBorrador2/anular` con `motivo_anulacion` → `200` (`ANULADA`).
   - Sobre el primer borrador, ejecutar `POST /api/historia-clinica/consultas/:idConsulta/firmar` → `200` (`FIRMADA`).
   - Intentar anular la consulta ya `FIRMADA` → `400`.
5. **`registrar_evolucion_clinica` y `rectificar_evolucion_clinica` (RPC 7 y 8)**:
   - `POST /api/historia-clinica/consultas/:idConsulta/evoluciones` con `PROFESIONAL_A` → `201` (`FIRMADA`).
   - `POST /api/historia-clinica/evoluciones/:idEvolucion/rectificar` con `PROFESIONAL_A` → `200` (`version: 2`, evolución anterior pasa a `RECTIFICADA`).
   - Intentar rectificar con otro profesional → `403`.
6. **`actualizar_estado_estudio_clinico` e `informar_estudio_clinico` (RPC 9 y 10)**:
   - `PATCH /api/historia-clinica/estudios/:idEstudio/estado` (`EN_PROCESO`) → `200`.
   - `POST /api/historia-clinica/estudios/:idEstudio/informar` (`resultado`) → `200` (`COMPLETADO`).
   - Intentar volver a cambiar estado de estudio `COMPLETADO` → `400`.
7. **`solicitar_derivacion_clinica`, `listar_derivaciones_clinicas` y `resolver_derivacion_clinica` (RPC 11, 12 y 13)**:
   - `POST /api/historia-clinica/derivaciones` con `PROFESIONAL_A` desde `Salita A` hacia `Salita B`, `alcance: ESPECIALIDAD`, `id_especialidad_destino: Especialidad 2` → `201` (`PENDIENTE`).
   - `GET /api/historia-clinica/derivaciones?id_salita=:salitaB` con `PROFESIONAL_B` → `200`.
   - `PATCH /api/historia-clinica/derivaciones/:idDerivacion/resolver` desde `Salita B` (`AUTORIZADA`) → `200`.
   - Confirmar que `PROFESIONAL_B` ahora accede con `?id_salita=:salitaB&id_especialidad=:esp2` (`200`, `contenido_restringido_por_alcance: true`, `antecedentes: []`, `alergias: []`), pero sigue recibiendo `403` sin `id_especialidad` (longitudinal no autorizado).
   - Revocar la derivación (`REVOCADA` con motivo) y confirmar que `PROFESIONAL_B` vuelve a recibir `403`.
8. **`consultar_auditoria_clinica` (RPC 14)**:
   - `GET /api/historia-clinica/auditoria?id_salita=:salitaA` con `PROFESIONAL_A` (sin `VER_AUDITORIA_CLINICA`) → `403`.
   - `GET /api/historia-clinica/auditoria?fecha_desde=<hoy>&fecha_hasta=<hoy YYYY-MM-DD>` con usuario auditor autorizado → `200`.

---

## 5. Verificación de auditoría

Desde el SQL Editor de staging, comprobar los registros generados:

```sql
SELECT id_auditoria_clinica, tipo_operacion, recurso, alcance_acceso, motivo_acceso, fecha_hora
  FROM public.auditoria_clinica
 WHERE id_paciente = '<id_paciente_test>'
 ORDER BY fecha_hora DESC;

SELECT id_acceso_auditoria, rol_usuario, id_salita, filtros, fecha_hora
  FROM public.auditoria_accesos_auditoria
 ORDER BY fecha_hora DESC
 LIMIT 10;
```

Verificar que existan eventos `CONSULTA`, `EXPORTACION`, `CREACION`, `MODIFICACION` y `CORRECCION`, y que cualquier intento de `UPDATE` o `DELETE` sobre `auditoria_clinica` sea rechazado por `tr_auditoria_clinica_inmutable`.

---

## 6. Limpieza de datos de prueba

Las tablas clínicas y de auditoría clínica poseen triggers `BEFORE DELETE` (`impedir_eliminacion_clinica` e `inmutabilidad_auditoria_clinica`) que impiden borrar filas en operación normal. Por ello:

- **En staging dedicado / rama efímera de Supabase**: reiniciar la base de pruebas (o ejecutar un script de limpieza exclusivo de staging que deshabilite temporalmente los triggers solo en el entorno de pruebas dentro de una transacción, elimine los registros vinculados a `<id_paciente_test>` y vuelva a habilitar los triggers).
- **Nunca** deshabilitar triggers ni ejecutar limpiezas destructivas en producción.
