# Agenda diaria de pacientes

La API permite consultar listas nominales a `SUPER_ADMIN` y `ADMIN_SALITA`.
El administrador consulta exclusivamente las asignaciones activas y vigentes de
`usuario_salita`, verificadas en cada solicitud. Omitir `id_salita` no elimina
esta restricción. Enviar una salita no autorizada devuelve 403, también al exportar.

## Endpoints

- `GET /api/reportes/agenda-diaria`: respuesta JSON para mostrar en el sistema.
- `GET /api/reportes/agenda-diaria/exportar`: descarga PDF, Excel o Word.
- `GET /api/reportes/agenda-diaria/imprimir`: HTML escapado con formato A4 para imprimir.

Todos requieren `Authorization: Bearer <token>` y responden con `Cache-Control: no-store`.
El cliente del sistema debe enviar el JWT también al solicitar archivos o el HTML.

Filtros comunes:

| Parámetro | Valores |
| --- | --- |
| `fecha` | `YYYY-MM-DD`, `hoy`, `manana` o `mañana`; por defecto hoy |
| `id_salita` | UUID opcional |
| `id_profesional` | UUID opcional |
| `id_especialidad` | UUID opcional |
| `estado` | Código opcional existente y activo de `estados_turno` |
| `formato` | Obligatorio solo para exportar: `pdf`, `xlsx` o `docx` |

El día se calcula en `America/Argentina/Buenos_Aires`, desde medianoche inclusive
hasta la siguiente medianoche exclusiva. Solo se incluyen estados no finales;
`CANCELADO` y `REPROGRAMADO` quedan excluidos incluso si se solicitan expresamente.
Un filtro por estado final devuelve una lista vacía. No se usan UUID fijos de estados.

## Respuesta y documentos

La respuesta contiene `ok`, `sistema`, `fecha`, `total_pacientes` y `listas`.
Cada lista corresponde a una combinación de profesional, salita y especialidad,
con sus identificadores, nombres, dirección disponible y cantidad de pacientes.
Los pacientes incluyen `id_turno`, `codigo_turno`, `hora`, `apellido_nombre`, `dni`,
`estado` y `motivo_consulta`. Se ordenan por fecha/hora y UUID del turno como desempate.
El total cuenta turnos asignados (un paciente con dos citas figura dos veces).

PDF y Word contienen una sección por lista, en A4, con tabla, total y firma.
Excel contiene una hoja por lista con encabezados de impresión.
El HTML usa una sección imprimible por lista y repite encabezados de tabla.
Sin coincidencias se devuelve 200, `listas: []`, y las exportaciones indican que
no hay pacientes asignados. Se recorren todas las páginas de Supabase.

Para un archivo independiente, enviar `id_profesional`; para todas las listas de
una salita, enviar `id_salita` y omitir `id_profesional`. No se generan tablas nuevas.

## Ejemplos en Git Bash

Definir `API` con la URL del sistema y `TOKEN` con un JWT válido de la sesión.

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/api/reportes/agenda-diaria?fecha=hoy"
curl -H "Authorization: Bearer $TOKEN" "$API/api/reportes/agenda-diaria?fecha=manana"
curl -H "Authorization: Bearer $TOKEN" "$API/api/reportes/agenda-diaria?fecha=2026-09-21&id_salita=$SALITA"
curl -H "Authorization: Bearer $TOKEN" "$API/api/reportes/agenda-diaria?fecha=2026-09-21&id_profesional=$PROFESIONAL"
curl -H "Authorization: Bearer $TOKEN" "$API/api/reportes/agenda-diaria/exportar?fecha=2026-09-21&id_profesional=$PROFESIONAL&formato=pdf" -o agenda.pdf
curl -H "Authorization: Bearer $TOKEN" "$API/api/reportes/agenda-diaria/exportar?fecha=2026-09-21&id_salita=$SALITA&formato=xlsx" -o agenda.xlsx
curl -H "Authorization: Bearer $TOKEN" "$API/api/reportes/agenda-diaria/exportar?fecha=2026-09-21&id_salita=$SALITA&formato=docx" -o agenda.docx
```

## Verificación automatizada

```bash
node --import tsx --test tests/agenda-diaria.test.ts tests/reporte.test.ts
npm run typecheck
npm run build
```

Las pruebas ejecutan curl en Git Bash contra Express local con JWT de prueba y
transporte Supabase simulado. Verifican permisos, filtros SQL, datos, paginación,
errores, HTML escapado y archivos reales generados en memoria. En Windows se usa
`C:/Program Files/Git/bin/bash.exe`; `GIT_BASH` permite indicar otra ubicación.
No modifican la base real ni reemplazan una validación de sus relaciones y permisos.
