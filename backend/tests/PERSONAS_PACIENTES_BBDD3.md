# Pruebas Personas + Pacientes ? BBDD3

Fecha: 19/09/2026. Entorno development; API local en puerto 3000 y Supabase real.

## Resultado

Los 25 requests registrados devolvieron el estado esperado. Pasaron adem?s las 12 pruebas unitarias existentes. No fue necesario corregir c?digo de la API ni modificar el SQL.

Archivos existentes modificados: ninguno. Archivos eliminados: ninguno. Archivos creados: `tests/patient-live.mjs`, `tests/patient-live-results.json` y este informe. `dist` se regener? mediante build (ignorado por Git).

## Esquema revisado

Fuente disponible: `src/BBDD/SAPS_Turno_BBDD3_FINAL.sql`. Se ley? sin ejecutarla: contiene DROP TABLE y reinicia la base.

- `personas` centraliza identidad; DNI UNIQUE y CHECK de formato, fecha, sexo y email. Pacientes, tutores y profesionales tienen id_persona NOT NULL UNIQUE, FK con ON DELETE RESTRICT. Usuarios tiene FK opcional UNIQUE con ON DELETE SET NULL.
- Zonas ? barrios ? salitas; cobertura muchos a muchos en salita_barrios, PK compuesta, fechas y sede ?nica activa. El trigger de pacientes comprueba cobertura activa y vigente.
- Triggers exigen persona activa y datos m?nimos para cada perfil, y protegen datos requeridos por pacientes/tutores activos. Triggers de modificaci?n y auditor?a mantienen trazabilidad.
- paciente_tutores relaciona ambos perfiles con PK compuesta y un tutor principal vigente. No se desarroll? ni se insertaron datos en este m?dulo.
- profesional_especialidad y profesional_salita tienen claves compuestas; horarios_atencion las referencia y evita solapamientos mediante exclusi?n GiST. Turnos referencia paciente, profesional, especialidad, salita, horario y estado; tiene exclusiones por paciente/profesional y unicidad de turno abierto por especialidad. Sus triggers validan agenda y sincronizan estado.
- Se revisaron ?ndices de b?squeda, restricciones y permisos: RLS habilitado, sin acceso p?blico directo y service_role para backend.

Confirmaci?n remota: tablas accesibles; OpenAPI de PostgREST confirma FK pacientes.id_persona ? personas.id_persona y ausencia de dni/nombres/apellidos/telefono/email en pacientes. Los 5 roles existen. No se dispone de conexi?n SQL directa al cat?logo para certificar uno por uno todos los ?ndices/triggers desplegados; la cobertura y auditor?a s? tuvieron evidencia funcional real.

## HTTP recibido

| Prueba | M?todo / ruta | Esperado | Recibido |
|---|---|---:|---:|
| Health | GET /api/health | 200 | 200 |
| Health DB | GET /api/health/database | 200 | 200 |
| Health usuarios | GET /api/users/health | 200 | 200 |
| Login SUPER_ADMIN | POST /api/auth/login | 200 | 200 |
| Login PACIENTE | POST /api/auth/login | 200 | 200 |
| POST sin JWT | POST /api/patients | 401 | 401 |
| POST invalido | POST /api/patients | 400 | 400 |
| POST paciente | POST /api/patients | 201 | 201 |
| DNI duplicado | POST /api/patients | 409 | 409 |
| Listado | GET /api/patients | 200 | 200 |
| Lectura plana | GET /api/patients/1eac804d-e735-492a-b1ea-2b16bb1bbf37 | 200 | 200 |
| Lectura plana | GET /api/patients/dni/40999888 | 200 | 200 |
| PATCH mixto | PATCH /api/patients/1eac804d-e735-492a-b1ea-2b16bb1bbf37 | 200 | 200 |
| Desactivar | PATCH /api/patients/1eac804d-e735-492a-b1ea-2b16bb1bbf37/status | 200 | 200 |
| Listado sin inactivo | GET /api/patients | 200 | 200 |
| Leer inactivo | GET /api/patients/1eac804d-e735-492a-b1ea-2b16bb1bbf37 | 200 | 200 |
| Reactivar | PATCH /api/patients/1eac804d-e735-492a-b1ea-2b16bb1bbf37/status | 200 | 200 |
| UUID invalido | GET /api/patients/no-uuid | 400 | 400 |
| UUID inexistente | GET /api/patients/9f8ff942-5ce3-457f-ba6f-4cf46bd4f0e4 | 404 | 404 |
| PATCH vacio | PATCH /api/patients/1eac804d-e735-492a-b1ea-2b16bb1bbf37 | 400 | 400 |
| Sin cobertura | PATCH /api/patients/1eac804d-e735-492a-b1ea-2b16bb1bbf37 | 400 | 400 |
| PACIENTE no puede listar | GET /api/patients | 403 | 403 |
| Login prueba reutilizacion | POST /api/auth/login | 200 | 200 |
| POST sin cobertura | POST /api/patients | 400 | 400 |
| POST reutiliza persona existente | POST /api/patients | 201 | 201 |

## Comprobaciones f?sicas

- Esquema remoto: FK pacientes-personas y sin columnas personales antiguas
- DNI 40999888: exactamente una persona y un paciente
- PATCH: telefono en personas y obra_social en pacientes
- Estado afecta solo pacientes; inactivo consultable por ID y excluido de listado
- Cobertura rechazada sin cambios en persona ni paciente
- Cuentas de prueba desactivadas, sin password y sesiones revocadas
- Persona existente reutilizada sin sobrescribir datos; POST sin cobertura 400 no crea paciente
- Ambos pacientes quedaron activos. No se expusieron ni persistieron contrase?as originales, JWT o refresh tokens en archivos de pruebas.
- La prueba de reutilizaci?n us? DNI 40999889, con persona previamente creada, y confirm? que nombres recibidos distintos no sobrescriben la identidad existente.

## Registros creados

La base inicialmente no ten?a usuarios, personas, pacientes ni estructura municipal. Se crearon una zona TEST_ZONA, Barrio Test API, Barrio Test API Sin Cobertura, SAPS Test API y una cobertura v?lida. El segundo barrio permite probar cobertura inv?lida con UUID reales.

| Tabla | UUID / clave |
|---|---|
| zonas | 908e3d23-0670-4716-bbee-fd14d78657e9 |
| barrios | 7c6c129e-aba1-4438-8fec-ecdb4e722133 |
| salitas | 1572fdd1-44d7-47bf-8481-47e2c8865e23 |
| salita_barrios | salita=1572fdd1-44d7-47bf-8481-47e2c8865e23; barrio=7c6c129e-aba1-4438-8fec-ecdb4e722133 |
| barrios | e54900d1-f309-4202-ae99-f4c045582f81 |
| usuarios (SUPER_ADMIN) | 47d0ad94-a364-4ddf-9642-3553337733eb |
| usuarios (PACIENTE) | 2a70568a-8dc4-47aa-9109-9bd56f39673e |
| personas | c6bbab6d-db28-49f2-af3a-e1c9be7294a1 |
| pacientes | 1eac804d-e735-492a-b1ea-2b16bb1bbf37 |
| personas DNI 40999889 | 6de2bc0a-bd67-4516-b6a8-3b78566f72bf |
| pacientes DNI 40999889 | 1311109a-feaa-4695-a126-5193032c3b4e |

DNI 40999888: persona c6bbab6d-db28-49f2-af3a-e1c9be7294a1; paciente 1eac804d-e735-492a-b1ea-2b16bb1bbf37. Tel?fono final 3777222222 y obra social IOSCOR.

Cuentas test_api_super_admin y test_api_paciente: desactivadas y password_hash NULL al finalizar. Se generaron tres sesiones de login, todas revocadas: 311487dd-1863-423a-9641-afdace13783e, 8c22cf2e-1971-4f87-b75b-9d3f8b285792, 0294cad7-d709-4997-84d5-12b7534e6a97. Los triggers generaron 18 registros de auditor?a. No se borr? trazabilidad.

## Ejecuci?n

Se ejecutaron npm.cmd run typecheck, npm.cmd run build y npm.cmd run dev. npm.cmd evita el bloqueo de npm.ps1 de PowerShell sin modificar la pol?tica del sistema. Las 12 pruebas unitarias se ejecutaron con `node --import tsx --test tests/patient.test.ts`; el primer intento dentro del sandbox fall? por spawn EPERM y el reintento autorizado pas?.

Prueba principal reproducible, con API iniciada y configuraci?n de desarrollo:

```powershell
node tests/patient-live.mjs --development
```

El script conserva fixtures, reutiliza los existentes, deja cuentas desactivadas y registra ?nicamente estados/UUID. En una repetici?n, el alta ya existente devuelve 409. Sobrescribe patient-live-results.json; este informe conserva la evidencia de la ejecuci?n inicial. La comprobaci?n adicional de persona preexistente se ejecut? por separado y est? incluida en el JSON.

## Limitaciones pendientes

- Crear persona + paciente y actualizar ambos usa solicitudes independientes; no hay transacci?n. Un fallo posterior puede dejar una persona sin perfil o una actualizaci?n parcial. No se cambi? el SQL ni se a?adi? una RPC fuera de esta etapa.
- ADMIN_SALITA/RECEPCION se autorizan por rol, pero las rutas de pacientes no filtran por usuario_salita. Se probaron operaciones con SUPER_ADMIN y denegaci?n PACIENTE; el aislamiento entre salitas queda pendiente.
- Una persona preexistente sin datos obligatorios de paciente, o inactiva, puede producir un error del trigger no traducido a 400. Ese escenario adicional no form? parte de la matriz HTTP ejecutada.

No se ejecut? git add, git commit ni git push. No se desarrollaron Tutores, Turnos, Sanciones, Profesionales ni frontend.
