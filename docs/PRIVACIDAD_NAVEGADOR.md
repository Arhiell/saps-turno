# Aviso de privacidad y almacenamiento del navegador

## Objetivo actual

El aviso es informativo: explica el uso de datos personales para gestionar la cuenta, los turnos y los servicios de atención disponibles, y el almacenamiento del navegador para mantener la sesión y permitir el funcionamiento del sitio. No es un gestor de consentimiento de cookies ni configura categorías opcionales.

- **Entendido**: guarda solamente la versión del aviso y la fecha de lectura en este navegador. Oculta el cartel, incluso después de recargar o cerrar sesión. No autoriza tratamientos de datos médicos, publicidad, analítica ni otros usos; no cambia ajustes del chatbot ni datos de sesión.
- **Ver política de privacidad**: navega a `/privacidad` dentro del área protegida. No registra lectura ni modifica el almacenamiento. En esa página se oculta temporalmente el cartel para facilitar la lectura; al salir vuelve a aparecer si aún no se pulsó Entendido.
- **Privacidad y datos**, en el perfil de pacientes y administradores/profesionales: muestra el estado de lectura y permite consultar la política en cualquier momento.

Se retiraron Aceptar todas / Solo necesarias, las categorías de consentimiento y toda vinculación del aviso con el almacenamiento del botón del asistente. `useChatbotLauncher.ts` conserva su comportamiento original del repositorio.

## Alcance y presentación

`AppLayout.tsx` monta el banner solo dentro de las rutas protegidas. No aparece en portada (`/`), noticias (`/noticias/*`), login, registro, recuperación ni verificación de acceso, aunque exista una sesión iniciada. Al salir del área protegida se desmontan el banner y sus ajustes de espacio.

La política puede consultarse también con un perfil todavía incompleto; la excepción de `/privacidad` no elimina la verificación de sesión ni habilita otras rutas.

En desktop (desde 768 px) el cartel comienza 32 px después del sidebar y reserva 240 px a la derecha para el acceso al asistente en su posición predeterminada. No requiere margen adicional en la navegación lateral. Se conservan las reglas visuales mobile: separación de la navegación inferior, botón del asistente por encima de la tarjeta y adaptación a `visualViewport` con teclado virtual. El texto y las etiquetas nuevas pueden cambiar la altura de la tarjeta, medida con ResizeObserver.

## Política de prueba

`frontend/src/pages/auth/PrivacyPolicyPage.tsx` contiene un borrador informativo claramente identificado como versión de prueba, pendiente de validación institucional. Incluye uso de datos, almacenamiento y cookies, servicios externos y significado de Entendido.

Antes de publicar la política definitiva deben confirmarse la entidad responsable, los canales de contacto y ejercicio de derechos, los plazos de conservación, las finalidades completas y la intervención de proveedores. No se incluyeron contactos ficticios, garantías absolutas ni promesas de uso exclusivo no verificadas.

La revisión estática del frontend identificó localStorage para sesión y ajustes, y sessionStorage para mensajes temporales. No se encontraron escrituras directas de cookies propias, IndexedDB, analítica o seguimiento. Esto no inventaría exhaustivamente cookies del backend ni de proveedores: Google Identity Services carga su SDK en las pantallas de acceso/registro cuando está configurado, y el asistente utiliza procesamiento externo con Gemini, con sus aclaraciones existentes.

## Lectura guardada

Clave nueva: `cora_privacy_notice`.

```json
{
  "version": 1,
  "acknowledgedAt": "2026-11-01T18:00:00.000Z"
}
```

No contiene identidad, datos médicos, categorías ni autorizaciones. La lectura corresponde al origen y navegador, no a una cuenta. Se sincroniza entre pestañas y no se elimina al cerrar sesión.

Las decisiones de la implementación anterior (`cora_privacy_preferences`) no se reutilizan: el nuevo aviso debe mostrarse aunque existan. Esa clave antigua se deja inerte; no se borran ajustes ni otros datos del navegador.

Incrementar `PRIVACY_NOTICE_VERSION` en `frontend/src/utils/privacy-notice.ts` cuando el contenido del aviso requiera informar de nuevo. Los registros corruptos, versiones distintas y fechas inválidas/futuras vuelven a mostrarlo. Si falla el guardado, se informa el error y el cartel permanece visible.

## Validación y prueba manual

Desde `frontend`:

```powershell
npm.cmd run build
npm.cmd run lint
node --test tests/privacy-notice.test.mjs
```

Para volver a mostrar el aviso, ejecutar en la consola del navegador y recargar:

```js
localStorage.removeItem('cora_privacy_notice');
location.reload();
```

No usar `localStorage.clear()`: eliminaría también la sesión.

Comprobar: ausencia en rutas públicas y de acceso; presencia en el panel; consulta de política sin registrar lectura; regreso al panel con aviso pendiente; Entendido, recarga y sincronización entre pestañas; consulta desde el perfil; acceso a la política con perfil incompleto; almacenamiento bloqueado. Confirmar que los ajustes del chatbot y las claves de autenticación no cambian al pulsar Entendido. Revisar desktop, mobile y detalles expandidos con las etiquetas nuevas.

## Registro de una revisión anterior

En una revisión anterior se registraron un build aprobado, lint sin errores (con advertencias del proyecto) y cinco pruebas unitarias aprobadas. También se probaron componentes con Edge headless, MemoryRouter y almacenamiento aislado: presencia inicial, apertura del borrador sin registrar lectura, ocultamiento temporal del banner en la política, regreso con aviso pendiente, Entendido, conservación de sesión y ajustes del chatbot, persistencia al remontar y enlace desde el perfil. La prueba no incluyó autenticación contra el backend real. Este resultado es histórico y no certifica el estado actual del código, las pruebas ni un despliegue.
