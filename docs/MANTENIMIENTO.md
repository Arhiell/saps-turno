# 🛠️ Mantenimiento y evolución

[Índice](README.md) · [Inventario](INVENTARIO_CODIGO.md) · [Operación](INSTALACION_Y_OPERACION.md)

## Recorrido de un cambio

Identificar primero el caso de uso y el actor. Seguir ruta → middleware → controller → validator → service → repository → SQL; después revisar servicio del frontend, tipos, componente y navegación. Los nombres de archivo orientan, pero los imports determinan dependencias reales.

Un cambio de regla debe indicar qué ocurre con datos históricos, permisos y solicitudes concurrentes. Si necesita atomicidad, varias llamadas a Supabase no sustituyen una RPC transaccional. Si modifica fechas, revisar zona argentina, límites inclusivos y rangos de ocupación.

## Documentación que acompaña cada cambio

| Cambio | Actualizar |
| --- | --- |
| Endpoint, campo o permiso | API, inventario de rutas y documento del módulo |
| Tabla, trigger o RPC | Migración, modelo y diccionario SQL |
| Variable o servicio externo | Instalación e integraciones |
| Navegación o flujo de usuario | Frontend y manual funcional |
| Regla de reserva | Turnos, vigencia, concurrencia y reprogramación según alcance |
| Archivo nuevo o movido | Inventario de código y enlaces correspondientes |

El README es la presentación y puerta de entrada. Las explicaciones extensas pertenecen al documento temático para evitar versiones contradictorias de una misma regla.

## Comprobaciones disponibles

Los siguientes comandos existen en los paquetes; elegir los pertinentes al cambio. Su inclusión no significa que se hayan ejecutado en esta revisión documental.

```powershell
npm test --prefix backend
npm run typecheck --prefix backend
npm run build --prefix backend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Las pruebas del backend están en [backend/tests](../backend/tests). No todas equivalen a pruebas de integración con una base real. Revisar el alcance y los dobles utilizados antes de interpretar un resultado. El frontend no declara un script `test` en su paquete actual.

Para cambios de agenda, cubrir reserva frente a reserva, reserva frente a bloqueo/cierre, vigencias límite, cambio de versión y fallo parcial de lotes. Las comprobaciones de concurrencia deben usar transacciones independientes sobre una base de prueba con las migraciones correspondientes.

## Diagnóstico por síntoma

| Síntoma | Evidencia que revisar |
| --- | --- |
| No inicia API | Validación del entorno y versión de Node |
| Endpoint devuelve 404 | Montaje `/api`, ruta local y método HTTP |
| 401 o renovación fallida | Token, sesión refresh y estado del usuario |
| 403 | Rol, perfil, correo, alcance y permisos sobre el recurso |
| No hay oferta | Barrio/cobertura, oferta de especialidad, asociación, horario, cierre y ocupación |
| 409 al reservar | Superposición, versión o cambio concurrente; refrescar datos |
| RPC inexistente | Secuencia SQL aplicada y entorno realmente utilizado |
| Avisos detenidos | Proceso Node, reclamaciones de worker, SMTP y estados persistidos |
| Calendario desactualizado | Última sincronización, lease, errores de proveedor y próxima ejecución |
| Página profunda falla al recargar | Fallback SPA del alojamiento |

## Respaldo y observabilidad

Definir responsables de respaldo, retención y recuperación; ensayar restauración en un entorno separado. El repositorio por sí solo no garantiza esos procedimientos. Registrar errores con contexto suficiente y sin credenciales, tokens ni datos personales innecesarios.

Al investigar una escritura, separar estado SQL del resultado de comunicaciones posteriores. Un correo fallido no revierte una reserva confirmada. Conservar identificadores y tiempos para enlazar historial, auditoría y registros operativos.

## Estado de esta revisión

La ampliación de documentación se basa en lectura estática de código, SQL y documentos existentes. No ejecutó pruebas, compilaciones, lint, migraciones, servicios ni acciones Git. Los informes históricos de verificación conservan su fecha y no certifican el estado actual de un despliegue.
