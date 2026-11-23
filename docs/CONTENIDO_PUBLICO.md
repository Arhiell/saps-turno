# Portada y contenido público

## Instalación

1. Instalar dependencias del backend con `npm install` (se agregó `fast-xml-parser` para RSS).
2. Comprobar si `backend/src/BBDD/20261007_contenido_publico.sql` ya se aplicó en el entorno. Si está pendiente, revisar sus dependencias y aplicarla una sola vez en el SQL Editor de Supabase, sobre la base existente. La migración es transaccional y requiere las tablas de usuarios, roles, salitas, asignaciones y la función `auditar_cambios` del esquema base.
3. Reiniciar backend y frontend. No se necesitan nuevas variables de entorno.

**Registro de la entrega inicial (07/10/2026):** en esa implementación no se aplicó la migración a una base remota. Ese dato histórico no confirma el estado actual de ningún entorno. La presencia del archivo tampoco demuestra que esté aplicado; verificarlo con el procedimiento de [migraciones](MIGRACIONES.md) antes de desplegar.

## Integración

- `/`: portada pública, sin sidebar ni autenticación obligatoria.
- `/noticias/:id`: detalle público, solo de una noticia publicada y vigente.
- `/login` y `/registro`: pantallas existentes; registro exclusivo de pacientes.
- `/acceso-personal`: redirige al login existente.
- `/panel`: inicio interno anterior. Solo se ajustaron destinos de navegación tras el login/verificación/Google y enlaces del menú; no se reimplementó autenticación.
- `/contenido`, `/contenido/nueva`, `/contenido/:id/editar`: gestión de noticias para SUPER_ADMIN y ADMIN_SALITA.

Se reutilizan variables CSS, tipografía, botones, cards, badges y Bootstrap Icons. El carrusel usa clases Bootstrap con controles React manuales, sin dependencia JS adicional ni rotación automática. No se agregan modales.

La portada se compone en `PublicHomePage`; datos y estados se resuelven por sección. Las peticiones públicas reutilizan el cliente Axios sin credenciales; administración utiliza el cliente autenticado existente.

## API y datos

| Método y ruta | Acceso / función |
| --- | --- |
| GET `/api/public/noticias` | Público, paginado; `page`, `limit` (máximo 30), `destacada`, `avisos` |
| GET `/api/public/noticias/:id` | Público; devuelve 404 para borradores, archivadas, futuras o vencidas |
| GET `/api/salitas?vista=publica` | Proyección segura del endpoint existente; solo salitas activas y sus datos públicos |
| GET `/api/public/noticias-municipales` | RSS municipal con caché y estado de disponibilidad |
| GET `/api/contenido/categorias` | Categorías activas desde la base de datos |
| GET/POST `/api/contenido/noticias` | Listado administrativo / creación |
| GET/PUT `/api/contenido/noticias/:id` | Detalle administrativo / actualización completa |

Noticias y categorías tienen tablas propias con RLS y acceso reservado a `service_role`. La API valida roles y asignaciones vigentes. La RPC de escritura vuelve a comprobar autor y alcance dentro de la transacción y utiliza la auditoría existente. Las consultas públicas tienen listas explícitas de campos y no seleccionan autores individuales, cuentas, contactos privados ni auditoría.

SUPER_ADMIN crea noticias globales o de salitas y modera todas. ADMIN_SALITA puede crear, publicar, destacar y editar **sus propias** noticias de salitas vigentes; no puede editar noticias globales ni publicaciones de otros autores. Perder la asignación impide seguir editando. El servidor determina la autoría y la conserva al moderar.

Estados: BORRADOR (también despublicar), PUBLICADA y ARCHIVADA (retirar sin DELETE). Una fecha de publicación futura programa la visibilidad sin worker; la fecha de finalización excluye la noticia tanto del listado como del detalle. Las fechas son ISO con zona horaria; el formulario usa la zona local del dispositivo y la portada muestra fechas de Argentina.

Categorías iniciales: Salud, Vacunación, Atención, Campañas, Prevención, Comunidad y Avisos. El indicador `es_aviso` controla el bloque de avisos. Se administran como catálogo en la base; no hay una pantalla nueva de edición del catálogo.

Límites: título 160, resumen 300, contenido 20.000 caracteres. Texto plano sin HTML ni controles invisibles (se permiten saltos de línea). React representa texto, nunca HTML. Imagen opcional mediante URL HTTPS; no se implementa subida ni almacenamiento local.

## Fuente municipal

Se verificó el 07/10/2026 que `https://www.goya.gob.ar/?q=rss.xml` responde HTTP 200 con `application/rss+xml`. Es el RSS institucional. Se muestran hasta seis títulos, fechas y enlaces al sitio oficial; no se copian cuerpos, imágenes ni autores externos a la base.

La integración está aislada en repository/service del backend. Timeout 8 segundos, límite de respuesta 1 MB, sin redirecciones ni DTD/entidades XML externas. Los enlaces deben pertenecer al dominio institucional y usar HTTPS.

Caché en memoria por instancia: 30 minutos para novedades municipales que no requieren inmediatez, 5 minutos ante fallos y una única consulta simultánea. Si falla, se conservan datos de hasta 24 horas, identificados como última consulta. La interfaz mantiene el aviso de indisponibilidad y enlace oficial. No hay polling del navegador. En despliegues de varias instancias, evaluar caché compartida según tráfico real.

No se implementó estado del río: aparece como ejemplo en el pedido, pero no en la composición final requerida ni con una fuente de datos definida. No se inventan niveles ni teléfonos.

## Pruebas manuales sugeridas

1. Sin sesión, abrir `/`, navegar por secciones, registro/login y detalle de noticia; probar enlace inexistente.
2. Ingresar con cada rol y comprobar destino `/panel`, permisos previos y acceso directo del personal.
3. SUPER_ADMIN: crear borrador global, publicar, destacar, editar, despublicar y archivar; moderar una noticia local.
4. ADMIN_SALITA: crear en una salita asignada; intentar mediante API otra salita, noticia global y noticia de otro autor. Verificar rechazo sin cambios.
5. Quitar o vencer una asignación y comprobar que deja de permitir edición. Confirmar rechazo a PACIENTE/PROFESIONAL y a solicitudes sin token.
6. Crear publicaciones futuras y vencidas. Verificar que no aparecen en listados, destacados, avisos ni detalle público.
7. Ingresar tildes, ñ, signos y párrafos; comprobar límites, fecha final inválida, HTML, controles y URL que no sea HTTPS.
8. Revisar auditoría: actor, alcance y valores anteriores/nuevos; confirmar que archivar no elimina registros.
9. Probar carga, vacío y error por sección. Simular caída del RSS: la portada debe seguir usable, sin consultas repetidas por visitante.
10. Revisar 320, 375, 425, 768, 1024 y 1440 px: menú, botones, cards, imágenes, editor y ausencia de scroll horizontal; teclado, Escape, foco y carruseles.

**Registro de verificación de la entrega inicial:** no se agregaron tests automáticos y la revisión visual quedó pendiente en esa implementación. Estas notas no acreditan el resultado actual de builds, pruebas o despliegues; ejecutar las comprobaciones pertinentes al cambio antes de publicarlo.
