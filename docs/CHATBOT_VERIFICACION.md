# Verificación del Asistente CORA

Fecha: 25/10/2026. Todas las llamadas a Gemini de las pruebas son simuladas.

## Estado inicial

- Typecheck del backend y compilaciones de ambos proyectos: correctos.
- Lint del frontend: salida correcta con advertencias previas.
- Backend: 164 pruebas, 87 correctas y 77 fallidas. El registro detallado se conserva localmente en `.tmp/CHATBOT_TEST_BASELINE.json`, como artefacto opcional excluido de Git.
- Árbol de trabajo inicialmente limpio. No se alteraron pruebas existentes.

## Resultados de entrega inicial (antes de retirar los archivos de pruebas)

| Comprobación | Resultado |
| --- | --- |
| Typecheck backend | Correcto |
| Build backend | Correcto |
| Build frontend, incluido TypeScript | Correcto |
| Lint frontend | Salida 0; advertencias en código previo, ninguna en los archivos nuevos |
| Pruebas propias del chatbot | 23 correctas; 0 fallidas |
| Suite completa final | 187 pruebas: 110 correctas y 77 fallidas |
| Comparación por archivo, nombre y causa normalizada | Los mismos 77 fallos; 0 nuevos, 0 con cambio de causa y 0 resueltos |
| `git diff --check` | Correcto |
| Edge sin interfaz, API completamente simulada | Correcto en 360, 390, 768, 1366 y 1920 px |

La suite completa conserva salida distinta de cero por los fallos previos. La comparación se realizó por identificación y firma de la causa; los 77 fallos coincidieron con el registro inicial. El informe detallado se conserva localmente en `.tmp/CHATBOT_TEST_COMPARISON.json` y no es necesario para ejecutar el chatbot. No se cambió autenticación ni se editaron tests anteriores para alterar el resultado.

Las pruebas nuevas cubren entrada Zod, tamaño JSON, JWT, rol vigente del servidor, cuenta deshabilitada, verificación y perfil requeridos, filtros preventivos, contexto por rol, ausencia de transmisión del texto libre, configuración ausente, cuotas locales, concurrencia, cancelación, timeout externo, errores del proveedor, salida vacía/truncada/insegura e invalidación de sesión.

En Edge se verificaron apertura sin llamadas, foco inicial y restauración, foco modal en móvil, envío, historial al cerrar y navegar, errores seguros, HTML renderizado como texto, envíos duplicados y descarte de respuestas pendientes al cambiar de usuario/rol y al cerrar sesión. Se comprobaron límites del viewport y ausencia de scroll horizontal. La reducción por teclado se **simuló** a 330 px mediante Visual Viewport en los anchos 360 y 390; no se probó un teclado físico de teléfono.

Capturas y resultado reproducible del navegador: `.tmp/chatbot-browser-results/`. El navegador no produjo errores de ejecución. Playwright está instalado solo en `.tmp/chatbot-browser/`, ignorado por Git.

Los scripts propios del chatbot usados para estas verificaciones se eliminaron posteriormente a pedido del usuario. Los resultados anteriores se conservan como registro histórico, sin implicar que esos scripts continúen en el proyecto.

## Refinamiento visual de desktop y mobile

- Archivos de aplicación modificados en esta fase: `frontend/src/components/chatbot/Chatbot.tsx` y `frontend/src/styles/chatbot.css`.
- Aviso compacto siempre visible, con texto completo accesible mediante **Más información**. Encabezado verde de 68 px y controles con foco visible.
- Burbujas diferenciadas: usuario a la derecha, asistente a la izquierda; se conservan saltos de línea y texto plano seguro.
- Campo inicial de 48 px con crecimiento hasta tres líneas, envío y pie compactos. Carga y errores integrados visualmente en la conversación.
- La conversación es el área desplazable; al llegar una respuesta se respeta la posición de quien está leyendo mensajes anteriores. En ventanas cortas se ajusta el espacio disponible sin ocultar el envío.
- Build del frontend y TypeScript correctos. Lint termina con salida 0 y conserva advertencias previas, sin advertencias en el componente del chatbot.
- Edge con API simulada: correctos los anchos 360, 390, 768, 1366 y 1920 px; también ventanas de 360 px de alto y reducción simulada de Visual Viewport a 330 px en móvil.
- Se comprobaron expansión del aviso mediante teclado, foco modal, apertura/cierre y restauración del foco, Enter/Shift+Enter, crecimiento del campo, estado de carga, errores, HTML inerte, respuestas extensas, scroll respetuoso, navegación, bloqueo de duplicados e invalidación por cambio de sesión. No se registraron errores de ejecución del navegador.
- Capturas: `.tmp/chatbot-visual/captures/`; ventanas cortas: `.tmp/chatbot-visual/captures-short/`. El teclado fue simulado; no se probó un dispositivo físico ni un lector de pantalla.
- Se compararon hashes antes y después: ningún archivo de `backend/src` cambió, ni el cliente HTTP del chatbot, ni la utilidad de sesiones, ni `AppLayout`. El cuerpo de la función de envío se mantuvo idéntico. No se modificaron variables de entorno, configuración de Gemini, roles, permisos, filtros, historial ni contratos HTTP.
- No se instalaron dependencias nuevas ni se realizaron llamadas reales a Gemini, commits, pushes o despliegues.
- Al finalizar se eliminaron los seis archivos de pruebas propios del chatbot y los scripts temporales de esta fase. Las pruebas de los demás módulos se conservaron.

## Límites de lo comprobado

- No hubo llamadas reales a Gemini. No se verificaron credenciales, disponibilidad del modelo ni nivel gratuito de la cuenta; [los pasos manuales](CHATBOT.md#configuración-manual) son obligatorios antes de activar una demostración autorizada.
- No se utilizó una base de datos real ni se probaron procesos sanitarios con datos reales. No se ejecutaron migraciones.
- No se confirmó el comportamiento en dispositivos físicos, lectores de pantalla ni un despliegue con múltiples procesos. La adaptación al teclado se simuló.
- No se modificó ningún `.env` real. `CHATBOT_ENABLED` permanece apagado por defecto; solo una configuración explícita `true` lo habilita.
- El selector de temas es deliberadamente sencillo y puede pedir reformular consultas. Gemini recibe una pregunta canónica por tema, no los detalles del mensaje ni la conversación. Los filtros preventivos no garantizan anonimización ni la corrección factual de la respuesta.
- No se realizaron commits, pushes ni despliegues.

## Archivos de la funcionalidad

Archivos existentes modificados: `backend/package.json`, `backend/package-lock.json`, `backend/.env.example`, `backend/src/config/env.ts`, `backend/src/app.ts`, `backend/src/routes/index.ts`, `frontend/src/components/layout/AppLayout.tsx` y `README.md`.

Archivos nuevos del backend: `src/config/chatbot.config.ts`, `src/config/chatbot-knowledge.ts`, `src/validators/chatbot.validator.ts`, `src/utils/chatbot-privacy.ts`, `src/middlewares/chatbot-rate-limit.middleware.ts`, `src/services/gemini.service.ts`, `src/services/chatbot.service.ts`, `src/controllers/chatbot.controller.ts` y `src/routes/chatbot.routes.ts`.

Archivos nuevos del frontend: `src/components/chatbot/Chatbot.tsx`, `src/styles/chatbot.css`, `src/types/chatbot.types.ts`, `src/services/chatbot.service.ts` y `src/utils/chatbot-session.ts`.

Archivos de pruebas retirados a pedido del usuario: `backend/tests/chatbot-fixtures.ts`, `chatbot.test.ts`, `chatbot-http.test.ts`, `chatbot-session.test.ts`, `chatbot-regressions.mjs` y `chatbot-browser.mjs`. Ninguno es una dependencia del funcionamiento del chatbot.

Documentación nueva: `docs/CHATBOT.md` y `CHATBOT_VERIFICACION.md`. Los dos informes JSON de pruebas se retiraron de `docs` a pedido del usuario; sus copias locales en `.tmp` son opcionales y no forman parte de la aplicación.

Única dependencia nueva de ejecución: `@google/genai@2.31.0` en backend. Playwright se utiliza temporalmente desde `.tmp`, sin añadirlo a los manifests del proyecto.
