# Asistente CORA

Prototipo académico de orientación funcional. **Deshabilitado por defecto y no habilitado para uso sanitario real.** Explica las pantallas existentes; no ejecuta operaciones, consulta pacientes, lee agendas, historiales clínicos ni accede a datos del negocio.

## Configuración manual

Agregar exclusivamente a `backend/.env`, conservando los demás valores:

```dotenv
CHATBOT_ENABLED=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

No usar variables `VITE_*` para la clave. Los `.env` están ignorados por Git. No se modificó ningún `.env` real. El backend puede iniciar sin clave y con el asistente apagado; una consulta que necesite Gemini responde `503 CHATBOT_DISABLED`. Los demás módulos continúan funcionando.

1. Entrar manualmente a [Google AI Studio](https://aistudio.google.com/) con la cuenta que se utilizará para el prototipo.
2. Seleccionar el proyecto y revisar **API keys**, **Usage** y sus límites. Crear una clave para ese proyecto si corresponde; no pegarla en el chat ni en el repositorio.
3. Comprobar que `gemini-3.5-flash-lite` aparezca disponible para ese proyecto y que la cuota gratuita esté habilitada y tenga saldo. Consultar [modelos](https://ai.google.dev/gemini-api/docs/models), [precios](https://ai.google.dev/gemini-api/docs/pricing), [límites](https://ai.google.dev/gemini-api/docs/rate-limits) y [retiros](https://ai.google.dev/gemini-api/docs/deprecations). Ver un modelo en la documentación pública **no confirma el acceso de esta cuenta**. Los límites efectivos dependen del proyecto y pueden cambiar.
4. Si el acceso o la gratuidad no pueden confirmarse en el panel, mantener `CHATBOT_ENABLED=false`. No habilitar facturación automáticamente. Una verificación que genere contenido consume cuota y requiere autorización específica; ni la implementación ni las pruebas realizaron esa verificación real.
5. Solo para una demostración académica con datos ficticios, configurar la clave en el backend y cambiar manualmente `CHATBOT_ENABLED=true`. Reiniciar el backend. Sin autorización de consumo, mantenerlo apagado.
6. Iniciar sesión con uno de los cuatro roles con panel, abrir **Asistente CORA** y probar una pregunta sugerida. Abrir el panel no genera una llamada. Al terminar la demostración, volver a `false` y reiniciar.

SDK instalado: `@google/genai` **2.31.0**, fijado en el backend, compatible con Node 22.16.0 del entorno. No se agregó dependencia de ejecución al frontend.

## Arquitectura y contrato

```text
React / AppLayout → Axios existente → POST /api/chatbot
  → authenticate + requireRole → Zod + filtros → intención funcional autorizada
  → pregunta canónica y documentación estática → Gemini → validación → texto plano
```

Entrada: `{ "message": "¿Cómo solicito un turno?" }`.

Salida: `{ "success": true, "data": { "reply": "..." } }`.

Errores: `{ "success": false, "message": "...", "code": "CHATBOT_..." }` con estado HTTP adecuado. Se conservan los códigos de acceso existentes, como `EMAIL_NOT_VERIFIED` y `PROFILE_INCOMPLETE`. No se aceptan roles, identidades, historiales ni instrucciones del sistema enviados por el cliente. El rol se obtiene mediante la autenticación existente, que consulta usuarios y roles; el chatbot no añade consultas a datos de pacientes.

El parser de 8 KB se aplica solo a `/api/chatbot`, antes del parser global. Los errores del chatbot se manejan localmente, sin imprimir el cuerpo de las solicitudes, respuestas, claves ni errores originales del SDK. No se modificó el manejo global de errores. Las respuestas usan `Cache-Control: no-store`.

## Privacidad y alcance

- El **texto libre nunca se transmite a Gemini**, aunque los filtros no detecten un dato sensible. Se reconoce localmente un tema y se envía únicamente la pregunta predefinida del artículo y su documentación estática autorizada. Esto también impide transmitir instrucciones maliciosas del usuario.
- Los filtros preventivos rechazan patrones de DNI, teléfono, correo, tokens, credenciales y divulgación personal o clínica. No son un anonimizador; pueden omitir variantes y bloquear consultas válidas. La barrera principal de salida es el uso exclusivo de texto estático revisado.
- Una intención desconocida, no autorizada, médica o de ejecución de acciones recibe una respuesta local; no produce una llamada a Gemini. Las preguntas se responden de forma independiente; no se intenta interpretar referencias a conversaciones anteriores.
- No se habilitan herramientas, funciones, búsqueda, ejecución de código ni acceso del modelo a Supabase o PostgreSQL.
- Google procesa la pregunta canónica y la documentación transmitida. Las [condiciones de los servicios gratuitos](https://ai.google.dev/gemini-api/terms) prohíben enviar datos personales, sensibles o confidenciales y describen su tratamiento. No utilizar este prototipo con información sanitaria real.
- El modelo puede producir errores o instrucciones imprecisas. Se filtran respuestas vacías, excesivas, con patrones sensibles, contenido médico, HTML, enlaces externos o bloques de código; la interfaz siempre renderiza texto plano. Estas medidas no garantizan corrección factual ni anonimización absoluta.
- El historial visible vive en memoria, hasta 20 mensajes; no usa base de datos, localStorage ni sessionStorage. Puede contener lo escrito por el usuario hasta limpiar, salir o cambiar de identidad. La autenticación existente conserva su almacenamiento habitual.
- Cambiar usuario o rol desmonta el estado anterior. Se abortan solicitudes y se comprueba la identidad antes de aceptar respuestas o errores. Un observador propio del chat invalida las solicitudes al comenzar `/auth/logout`, antes de esperar la revocación; no modifica los tokens ni el comportamiento de autenticación. Los eventos de sesión y almacenamiento también invalidan el trabajo si cambió la identidad.

## Límites y comportamiento

| Recurso | Límite |
| --- | --- |
| Mensaje | 1.000 caracteres, objeto estricto |
| JSON HTTP | 8 KB |
| Contexto enviado | Un artículo estático, máximo 16.000 caracteres |
| Salida | 768 tokens y hasta 4.000 caracteres |
| Espera | 20 s en backend; 25 s en Axios |
| Usuario | 5 llamadas/minuto; una simultánea |
| Proceso | 10 llamadas/minuto; 100 por ventana de 24 horas |
| Memoria del limitador | Entradas vencidas se eliminan; máximo 1.000 usuarios |

No hay llamadas al abrir o escribir, reintentos automáticos del proveedor, historial remoto ni almacenamiento de conversaciones en backend. Axios conserva su renovación de JWT ante `401`, que ocurre antes de llamar al proveedor. Los rechazos locales no consumen cuota Gemini. Las llamadas fallidas al proveedor sí cuentan para los límites locales.

El limitador es para **una única instancia**; sus contadores se reinician con el proceso. No garantiza respetar una cuota compartida con otras aplicaciones. Para varias réplicas o serverless hace falta un límite coordinado antes de activar el módulo. No se instaló infraestructura ni se cambió el despliegue.

La UI reutiliza los colores e íconos existentes. Escritorio utiliza una ventana no modal; bajo 768 px, un diálogo modal con foco, fondo inerte, áreas seguras y ajuste a Visual Viewport. No aparece en rutas públicas, autenticación ni completar perfil. Se conserva el estado al navegar dentro del layout y al cerrar/reabrir el panel. Escape cierra; Enter envía y Shift+Enter agrega una línea.

## Actualizar conocimiento

Editar `backend/src/config/chatbot-knowledge.ts`. Cada artículo define `id`, `roles`, palabras clave, pregunta canónica, contenido y archivos fuente.

1. Verificar en las pantallas y rutas actuales los botones, pasos y permisos. No inferir procedimientos a partir del nombre de un módulo.
2. Mantener exclusivamente documentación funcional publicable, sin registros reales, nombres de personas, IDs, credenciales ni datos clínicos.
3. Actualizar pregunta canónica y palabras clave para expresar la intención sin copiar el texto del usuario. El selector elige la coincidencia más específica; solo admite artículos autorizados con esa especificidad.
4. Agregar pruebas de selección para cada rol afectado y ejecutar los checks. La interfaz tiene sus sugerencias por rol en `Chatbot.tsx`; mantenerlas alineadas.

El paciente tiene autoservicio de turnos y cobertura; no debe recibir instrucciones del listado administrativo de pacientes. `ADMIN_SALITA` no recibe instrucciones del catálogo global de salitas. `RECEPCION` no tiene este asistente porque no dispone de un recorrido completo en React. La auditoría disponible por API no se presenta como una pantalla implementada. La presencia de una migración de sanciones no prueba que esté aplicada; no se ejecutaron migraciones.

## Pruebas y regresiones

Desde la raíz, en Windows usar `npm.cmd` si PowerShell bloquea `npm.ps1`:

```powershell
npm.cmd run typecheck --prefix backend
npm.cmd run build --prefix backend
npm.cmd run build --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd test --prefix backend
```

Los archivos de pruebas específicos del chatbot y sus fixtures se retiraron a pedido del usuario después de ejecutar las verificaciones. No son necesarios para ejecutar el asistente. Las pruebas originales de los otros módulos se conservaron. No ejecutar scripts `*-live.*` para verificar cambios visuales.

La verificación inicial registró **164 pruebas; 87 pasan y 77 fallan**. Entre los problemas observados hay fixtures administrativos que no cumplen la verificación de correo y expectativas de consultas anteriores a cambios de configuración o notificaciones. No se corrigieron funcionalidades ni tests ajenos. Los informes detallados son artefactos de verificación opcionales, sin uso en el funcionamiento del chatbot; se conservaron localmente en `.tmp/CHATBOT_TEST_BASELINE.json` y `.tmp/CHATBOT_TEST_COMPARISON.json`, fuera de la documentación y excluidos de Git.

La comparación inicial distinguió fallos nuevos, resueltos, iguales y con cambio de causa. Los informes históricos no describen el número actual de pruebas después de retirar los archivos propios del chatbot.

El refinamiento visual se verificó con Edge y la instalación de Playwright ya disponible en `.tmp`, sin agregar dependencias. Se simuló toda la API y se bloqueó el tráfico externo. Los scripts temporales de esta comprobación también se retiraron al finalizar; las capturas y el resumen están en `.tmp/chatbot-visual/`. Resultados y alcance en `CHATBOT_VERIFICACION.md`.

## Presentación del asistente

El aviso compacto permanece visible y ofrece **Más información** para desplegar el texto completo de privacidad dentro del área desplazable. Las respuestas siguen siendo texto plano. Los mensajes del usuario aparecen a la derecha en verde institucional; los del asistente, a la izquierda sobre un fondo claro.

El campo comienza en 48 px y crece hasta tres líneas, con scroll interno para texto adicional. Enter, Shift+Enter, contador y limpieza conservan su comportamiento. Una respuesta nueva desplaza la conversación al final solo si el usuario estaba cerca de ese punto; enviar una consulta lleva al mensaje enviado. Las sesiones, las solicitudes, el historial y los servicios no se modificaron por estos ajustes de presentación.

## Antes de cualquier uso adicional

Esta entrega no incluye habilitación sanitaria, aprobación de tratamiento de datos, acceso confirmado al modelo de la cuenta ni comprobación real de Gemini. Mantener apagado fuera de una demostración académica controlada. Una integración para uso real necesitaría una revisión específica de privacidad, servicio contratado, autorización, monitoreo y límites de despliegue; no se habilita desde esta tarea.
