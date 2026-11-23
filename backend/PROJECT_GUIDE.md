SAPS Turno — Guía de contexto y desarrollo para IA

«Este archivo define el contexto técnico, arquitectura, reglas de desarrollo, seguridad, estructura del proyecto y metodología 
de trabajo de SAPS Turno.

Cualquier IA que participe en el desarrollo debe leer y respetar esta guía antes de proponer cambios, generar código o modificar la arquitectura existente.»

---------------------------------------------------------------------------------------------------------------------------------------

1. Nombre del proyecto

SAPS Turno

Sistema de gestión de turnos para Salas de Atención Primaria de la Salud (SAPS).

El sistema está pensado para administrar pacientes, usuarios, profesionales, administradores de salitas, agendas, turnos, especialidades, disponibilidad, notificaciones, auditorías y demás procesos relacionados con la atención primaria de salud.

---------------------------------------------------------------------------------------------------------------------------------------

2. Objetivo general

Construir una plataforma web segura que permita administrar:

- usuarios;
- pacientes;
- administradores;
- profesionales;
- salitas SAPS;
- especialidades;
- agendas;
- horarios;
- turnos;
- cancelaciones;
- reprogramaciones;
- ausencias;
- permisos;
- roles;
- sesiones;
- recuperación de contraseña;
- verificación de correo;
- auditorías;
- reportes;
- futuras notificaciones.

La plataforma tendrá distintos niveles de acceso dependiendo del rol del usuario.

---------------------------------------------------------------------------------------------------------------------------------------
3. Tecnologías principales

Backend

- Node.js
- TypeScript
- Express
- arquitectura modular por capas
- API REST

Base de datos

- PostgreSQL
- alojado en Supabase

Supabase se utiliza principalmente como infraestructura para PostgreSQL.

La autenticación principal NO depende de Supabase Auth.

La API administra:

- usuarios;
- contraseñas;
- JWT;
- refresh tokens;
- roles;
- permisos;
- bloqueo de cuentas;
- recuperación de contraseña;
- reglas de negocio.

Frontend

Se desarrollará posteriormente con:

- React
- TypeScript

El frontend consumirá exclusivamente nuestra API.

---------------------------------------------------------------------------------------------------------------------------------------

4. Principio fundamental de arquitectura

El proyecto utiliza una arquitectura modular inspirada en MVC y separación por responsabilidades.

Flujo general:

Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
Supabase / PostgreSQL

Cada capa tiene una responsabilidad específica.

---------------------------------------------------------------------------------------------------------------------------------------

5. Routes

Las rutas solamente deben:

- definir endpoints;
- definir método HTTP;
- agregar middlewares;
- llamar al controller correspondiente.

Ejemplo:

router.post(
  "/patients",
  authenticate,
  requireRole(
    "SUPER_ADMIN",
    "ADMIN_SALITA"
  ),
  createPatient
);

Las rutas NO deben contener:

- consultas SQL;
- lógica compleja;
- hashing;
- reglas de negocio;
- generación de tokens.

---

6. Controllers

Los controllers se encargan de:

- recibir "req";
- validar datos mediante validators;
- obtener parámetros;
- llamar al service;
- construir la respuesta HTTP;
- delegar errores al middleware global.

Ejemplo conceptual:

export const createPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validation =
      patientSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos"
      });
    }

    const result =
      await patientService(
        validation.data
      );

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

Los controllers NO deben contener consultas a Supabase.

---------------------------------------------------------------------------------------------------------------------------------------

7. Services

Los services contienen la lógica de negocio.

Ejemplos:

- decidir qué rol se asigna;
- comprobar permisos;
- verificar estados;
- comprobar bloqueos;
- generar tokens;
- validar reglas del sistema;
- coordinar múltiples repositories.

Ejemplo:

registerUser()
   ↓
verificar duplicados
   ↓
buscar rol PACIENTE
   ↓
hash de contraseña
   ↓
crear usuario
   ↓
crear token verificación

Los services pueden llamar a varios repositories.

---

8. Repositories

Los repositories son la única capa que debe comunicarse directamente con Supabase/PostgreSQL.

Ejemplo:

const { data, error } =
  await supabase
    .from("usuarios")
    .select("*");

Toda consulta:

- SELECT;
- INSERT;
- UPDATE;
- DELETE;
- RPC;

debe estar dentro de repositories.

Los services NO deberían realizar consultas directas a Supabase.

---------------------------------------------------------------------------------------------------------------------------------------

9. Validators

Se utiliza Zod para validar datos recibidos por la API.

Los validators deben vivir separados de los controllers.

Ejemplo:

src/validators/

Ejemplo:

export const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(3),

    password: z
      .string()
      .min(1)
  })
  .strict();

Utilizar ".strict()" cuando corresponda para evitar campos inesperados.

---------------------------------------------------------------------------------------------------------------------------------------

10. Middlewares

Los middlewares manejan funcionalidades transversales.

Actualmente o planificados:

authenticate
requireRole
requirePermission
errorHandler
notFoundHandler

Ejemplo:

router.post(
  "/admins",
  authenticate,
  requireRole("SUPER_ADMIN"),
  createAdmin
);

---------------------------------------------------------------------------------------------------------------------------------------

11. Regla fundamental sobre archivos

NO crear archivos gigantes.

Cada funcionalidad importante debe dividirse por responsabilidad.

Evitar archivos con cientos o miles de líneas si pueden separarse lógicamente.

Por ejemplo, recuperación de contraseña tiene:

password-recovery.controller.ts
password-recovery.repository.ts
password-recovery.service.ts
password-recovery.validator.ts
password-recovery.routes.ts
recovery-token.service.ts

Verificación de email:

email-verification.controller.ts
email-verification.repository.ts
email-verification.service.ts
email-verification.validator.ts
email-verification.routes.ts
email-verification-token.service.ts

No colocar todas las funciones de autenticación dentro de:

auth.service.ts
auth.controller.ts
user.repository.ts

si pertenecen a funcionalidades diferentes.

---------------------------------------------------------------------------------------------------------------------------------------

12. Estructura aproximada

src/
│
├── config/
│   ├── env.ts
│   └── supabase.ts
│
├── controllers/
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── health.controller.ts
│   ├── password-recovery.controller.ts
│   └── email-verification.controller.ts
│
├── middlewares/
│   ├── auth.middleware.ts
│   ├── role.middleware.ts
│   ├── error.middleware.ts
│   └── not-found.middleware.ts
│
├── repositories/
│   ├── user.repository.ts
│   ├── system.repository.ts
│   ├── session.repository.ts
│   ├── password-recovery.repository.ts
│   └── email-verification.repository.ts
│
├── routes/
│   ├── index.ts
│   ├── health.routes.ts
│   ├── user.routes.ts
│   ├── auth.routes.ts
│   ├── password-recovery.routes.ts
│   └── email-verification.routes.ts
│
├── services/
│   ├── auth.service.ts
│   ├── password.service.ts
│   ├── jwt.service.ts
│   ├── session.service.ts
│   ├── refresh-token.service.ts
│   ├── password-recovery.service.ts
│   ├── recovery-token.service.ts
│   ├── email-verification.service.ts
│   └── email-verification-token.service.ts
│
├── validators/
│   ├── auth.validator.ts
│   ├── user.validator.ts
│   ├── password-recovery.validator.ts
│   └── email-verification.validator.ts
│
├── scripts/
│   └── create-super-admin.ts
│
├── types/
│   ├── auth.types.ts
│   └── express.d.ts
│
├── utils/
│   └── app-error.ts
│
├── app.ts
└── server.ts

La estructura puede crecer, pero se debe mantener separación por módulos.

---------------------------------------------------------------------------------------------------------------------------------------

13. Convenciones de nombres

Utilizar nombres claros y consistentes.

Archivos:

*.controller.ts
*.service.ts
*.repository.ts
*.routes.ts
*.validator.ts
*.middleware.ts
*.types.ts

Funciones:

findUserByEmail()
createUser()
registerUser()
loginUser()
createSession()
refreshSession()
requestPasswordRecovery()
verifyUserEmail()

Evitar nombres ambiguos como:

doSomething()
processData()
handleStuff()

---------------------------------------------------------------------------------------------------------------------------------------

14. Sistema de usuarios

La tabla principal es:

usuarios

Contiene conceptos como:

id_usuario
id_rol
nombre_usuario
email
password_hash
email_verificado
intentos_fallidos
bloqueado_hasta
ultimo_acceso
activo
fecha_creacion
fecha_actualizacion

Nunca devolver:

password_hash

al frontend.

---

15. Roles

Los roles iniciales son:

SUPER_ADMIN
ADMIN_SALITA
RECEPCION
PROFESIONAL
PACIENTE

Nunca confiar en un rol enviado por el frontend durante un registro público.

Ejemplo incorrecto:

{
  "email": "usuario@gmail.com",
  "rol": "SUPER_ADMIN"
}

El servidor debe decidir el rol.

---------------------------------------------------------------------------------------------------------------------------------------

16. Reglas iniciales de creación de usuarios

Registro público

Solo puede crear:

PACIENTE

SUPER_ADMIN

Puede crear:

ADMIN_SALITA
PACIENTE

El Super Admin tiene alcance global.

No necesita pertenecer a "usuario_salita".

ADMIN_SALITA

Puede crear:

PACIENTE

No puede crear:

SUPER_ADMIN
ADMIN_SALITA

El administrador debe estar relacionado con una salita mediante:

usuario_salita

---------------------------------------------------------------------------------------------------------------------------------------

17. Autenticación

La autenticación es propia de la API.

No utilizar Supabase Auth como autenticación principal salvo que explícitamente se cambie la arquitectura del proyecto.

Flujo:

POST /api/auth/login
        ↓
buscar usuario
        ↓
verificar cuenta
        ↓
verificar bloqueo
        ↓
Argon2.verify()
        ↓
rol
        ↓
Access Token
        ↓
Refresh Token

---------------------------------------------------------------------------------------------------------------------------------------

18. Contraseñas

Las contraseñas utilizan:

Argon2

Nunca guardar contraseñas en texto plano.

Debe almacenarse:

password_hash

Ejemplo esperado:

$argon2id$...

Servicio específico:

password.service.ts

Funciones:

hashPassword()
verifyPassword()

---------------------------------------------------------------------------------------------------------------------------------------

19. JWT

Los Access Tokens utilizan JWT generado por nuestra API.

Actualmente se utiliza una clave propia configurada mediante:

JWT_ACCESS_SECRET

Los Access Tokens deben tener duración relativamente corta.

Ejemplo:

15 - 30 minutos

El JWT contiene información mínima.

Ejemplo conceptual:

sub = id_usuario
email
username
role
iat
exp

No colocar información sensible dentro del JWT.

---------------------------------------------------------------------------------------------------------------------------------------

20. Middleware de autenticación

El middleware:

authenticate

debe:

1. obtener "Authorization";
2. verificar "Bearer";
3. validar JWT;
4. obtener "sub";
5. consultar usuario actual;
6. comprobar que siga activo;
7. consultar su rol;
8. establecer:

req.user

Ejemplo:

req.user = {
  id_usuario,
  email,
  nombre_usuario,
  rol
};

No confiar exclusivamente en datos antiguos dentro del JWT si necesitamos comprobar que la cuenta sigue activa.

---------------------------------------------------------------------------------------------------------------------------------------

21. Refresh Tokens

Los Refresh Tokens NO son JWT.

Se generan utilizando bytes aleatorios criptográficamente seguros.

Ejemplo:

randomBytes()

El cliente recibe:

refreshToken original

La base almacena solamente:

SHA-256(refreshToken)

Nunca guardar el refresh token original.

Tabla:

sesiones_refresh

Campos relevantes:

id_sesion
id_usuario
token_hash
ip_origen
user_agent
fecha_creacion
fecha_expiracion
fecha_revocacion

---------------------------------------------------------------------------------------------------------------------------------------

22. Rotación de Refresh Token

Cada vez que:

POST /api/auth/refresh

es ejecutado:

Refresh A
   ↓
validar
   ↓
revocar A
   ↓
crear Refresh B
   ↓
crear Access B

El token anterior nunca debe reutilizarse.

---------------------------------------------------------------------------------------------------------------------------------------
23. Logout

Logout significa revocar la sesión refresh.

No eliminar necesariamente la fila.

Usar:

fecha_revocacion

Esto conserva trazabilidad.

---------------------------------------------------------------------------------------------------------------------------------------

24. Intentos fallidos

La tabla "usuarios" contempla:

intentos_fallidos
bloqueado_hasta

Política inicial:

5 intentos incorrectos
        ↓
bloqueo temporal
        ↓
15 minutos

Configuración:

LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15

No hardcodear estos valores cuando puedan estar configurados mediante variables de entorno.

---------------------------------------------------------------------------------------------------------------------------------------

25. Recuperación de contraseña

Archivos independientes.

Flujo:

POST /api/auth/password/forgot
        ↓
buscar email
        ↓
respuesta genérica
        ↓
token aleatorio
        ↓
SHA-256
        ↓
tokens_recuperacion

Después:

POST /api/auth/password/reset
        ↓
hash del token
        ↓
buscar token
        ↓
verificar expiración
        ↓
verificar fecha_uso
        ↓
Argon2 nueva contraseña
        ↓
marcar token usado
        ↓
revocar sesiones existentes

Nunca informar si un correo existe.

Respuesta:

Si el correo está registrado,
se enviarán instrucciones...

---------------------------------------------------------------------------------------------------------------------------------------

26. Verificación de email

"usuarios.email_verificado" comienza:

false

Se agregó una tabla específica:

tokens_verificacion_email

No reutilizar:

tokens_recuperacion

para verificar correos.

Flujo:

registro
   ↓
crear usuario
   ↓
generar token email
   ↓
SHA-256
   ↓
guardar token_hash
   ↓
usuario recibe token
   ↓
/email/verify
   ↓
email_verificado = true

También existe un endpoint para reenviar verificación.

---------------------------------------------------------------------------------------------------------------------------------------

27. Tokens

Regla general:

Los tokens sensibles deben seguir:

token original
      ↓
cliente

y:

SHA-256(token)
      ↓
base de datos

Aplicado a:

- refresh tokens;
- recuperación de contraseña;
- verificación de email.

Nunca almacenar directamente tokens secretos reutilizables.

---------------------------------------------------------------------------------------------------------------------------------------

28. Variables de entorno

Nunca subir ".env" al repositorio.

Debe estar en:

.gitignore

El repositorio puede contener:

.env.example

sin secretos reales.

Ejemplo conceptual:

NODE_ENV=development
PORT=3000

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES_MINUTES=30

LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15

REFRESH_TOKEN_DAYS=7

PASSWORD_RECOVERY_MINUTES=30
EMAIL_VERIFICATION_HOURS=24

Nunca mostrar, repetir o incluir una clave real de Supabase en ejemplos o respuestas.

---------------------------------------------------------------------------------------------------------------------------------------

29. Supabase

Supabase se utiliza desde backend con:

SUPABASE_SECRET_KEY

Esta clave nunca debe llegar al navegador.

Nunca colocarla en React.

La aplicación frontend solamente debe comunicarse con:

SAPS Turno API

y nuestra API se comunica con Supabase.

Arquitectura:

React
  ↓
SAPS Turno API
  ↓
Supabase PostgreSQL

No:

React
  ↓
Service Role Key
  ↓
Supabase

---------------------------------------------------------------------------------------------------------------------------------------

30. Base de datos como fuente de verdad

Antes de desarrollar un módulo nuevo, revisar siempre el SQL actual.

No inventar:

- nombres de tablas;
- columnas;
- relaciones;
- constraints.

Ejemplo importante:

La tabla real de sesiones utiliza:

token_hash
ip_origen

Por lo tanto el código debe utilizar exactamente esos nombres.

Si una funcionalidad requiere una tabla que no existe:

1. indicar que falta;
2. explicar por qué;
3. diseñar una migración pequeña;
4. no reutilizar incorrectamente otra tabla;
5. continuar solamente después de establecer el esquema correcto.

---------------------------------------------------------------------------------------------------------------------------------------

31. Auditoría

La base contempla auditoría.

Cuando se implementen operaciones críticas, respetar las funciones y triggers existentes.

Especialmente operaciones relacionadas con:

- usuarios;
- turnos;
- salitas;
- profesionales;
- acciones administrativas.

Nunca almacenar hashes secretos dentro de auditorías si el esquema los excluye.

---------------------------------------------------------------------------------------------------------------------------------------

32. Errores

Existe:

AppError

para errores controlados.

Ejemplo:

throw new AppError(
  "Credenciales incorrectas",
  401
);

El middleware global se encarga de la respuesta.

No repetir bloques gigantes "try/catch" de infraestructura si ya existe manejo global.

---------------------------------------------------------------------------------------------------------------------------------------

33. Códigos HTTP

Mantener semántica HTTP consistente.

Ejemplos:

200 OK
→ consulta o acción correcta

201 Created
→ recurso creado

400 Bad Request
→ validación inválida

401 Unauthorized
→ credenciales/token inválidos

403 Forbidden
→ autenticado pero sin permiso

404 Not Found
→ recurso inexistente

409 Conflict
→ duplicado

423 Locked
→ cuenta temporalmente bloqueada

500 Internal Server Error
→ error inesperado

---------------------------------------------------------------------------------------------------------------------------------------

34. Respuestas JSON

Mantener formato consistente.

Éxito:

{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}

Error:

{
  "success": false,
  "message": "Descripción del error"
}

No devolver:

- stacks;
- consultas internas;
- secretos;
- password_hash;
- claves;
- datos privados innecesarios.

---------------------------------------------------------------------------------------------------------------------------------------

35. Seguridad contra enumeración

En:

- login;
- recuperación de contraseña;
- verificación de email;

evitar revelar información innecesaria.

Por ejemplo recuperación:

No:

Este correo no está registrado

Preferir:

Si el correo está registrado,
recibirá instrucciones...

---------------------------------------------------------------------------------------------------------------------------------------

36. Pruebas

Cada funcionalidad nueva debe probarse antes de continuar.

Orden habitual:

npm run typecheck
npm run build
npm run dev

Después probar endpoints.

---------------------------------------------------------------------------------------------------------------------------------------

38. Forma de trabajar

El desarrollo se realiza en bloques pequeños.

NO generar toda la API completa en una sola respuesta.

Metodología:

1. Explicar qué construiremos.
2. Mostrar archivos nuevos/modificados.
3. Agregar comentarios breves al código.
4. Ejecutar typecheck.
5. Ejecutar build.
6. Ejecutar servidor.
7. Probar con curl.
8. Verificar Supabase si corresponde.
9. Corregir errores.
10. Solo entonces hacer commit.

---------------------------------------------------------------------------------------------------------------------------------------

39. Comentarios en código

Los comentarios deben ser:

- breves;
- educativos;
- útiles;
- explicar el motivo de partes importantes.

Ejemplo:

/**
 * Nunca guardamos el token original.
 * Solamente almacenamos su SHA-256.
 */

Evitar comentar cosas obvias como:

// suma uno
counter++;

---------------------------------------------------------------------------------------------------------------------------------------

40. No avanzar si existen errores

Si:

npm run typecheck

falla, corregir antes.

Si:

npm run build

falla, corregir antes.

Si un "curl" devuelve un resultado inesperado:

- analizar el error;
- corregir;
- repetir prueba;
- no continuar como si hubiese funcionado.

---------------------------------------------------------------------------------------------------------------------------------------

41. Git

Después de terminar y probar correctamente un bloque:

git status

Verificar especialmente que ".env" NO aparezca.

Después:

git add .
git status

Luego:

git commit -m "feat: descripción del cambio"
git push origin main

Nunca hacer commit antes de verificar las pruebas del bloque.

---------------------------------------------------------------------------------------------------------------------------------------

42. Estado actual aproximado

Actualmente se ha desarrollado:

Conexión Node/Express               ✅
TypeScript                          ✅
Supabase PostgreSQL                ✅

Health API                          ✅
Health DB                           ✅

Registro PACIENTE                  ✅

Argon2                              ✅
Login                               ✅
JWT Access Token                    ✅

Intentos fallidos                  ✅
Bloqueo temporal                   ✅

Refresh Token                      ✅
Hash SHA-256                       ✅
Rotación Refresh                   ✅
Logout                              ✅

SUPER_ADMIN                        ✅
ADMIN_SALITA                       ✅
PACIENTE                            ✅

SUPER_ADMIN → crear ADMIN          ✅
SUPER_ADMIN → crear PACIENTE       ✅
ADMIN_SALITA → crear PACIENTE      ✅
ADMIN_SALITA → crear ADMIN         ❌

Recuperación contraseña            ✅
Revocación de sesiones             ✅

Verificación email                 ✅
Reenvío token email                ✅
Token email automático al registro ✅

La implementación exacta debe comprobarse contra el código actual del repositorio antes de asumir que una funcionalidad está finalizada.

---------------------------------------------------------------------------------------------------------------------------------------

43. Próximos pasos aproximados

El orden puede ajustarse según las necesidades del proyecto.

Posibles siguientes bloques:

1. Exigir email verificado para login
2. Google OAuth
3. permisos dinámicos
4. middleware requirePermission
5. módulo completo PACIENTES
6. tutores/dependientes
7. profesionales
8. especialidades
9. salitas
10. agendas
11. disponibilidad
12. turnos
13. cancelaciones
14. reprogramaciones
15. sanciones
16. notificaciones
17. auditorías
18. reportes

No implementar varios módulos gigantes al mismo tiempo.

---------------------------------------------------------------------------------------------------------------------------------------

44. Google OAuth

Cuando se implemente Google OAuth, revisar antes el esquema.

Actualmente el diseño tradicional de "usuarios" exige:

password_hash NOT NULL

Un usuario exclusivamente Google no debería necesitar una contraseña falsa.

NO solucionar esto guardando una contraseña inventada.

Antes de Google OAuth se debe diseñar correctamente una estrategia como:

usuario_identidades

Ejemplo conceptual:

id_identidad
id_usuario
proveedor
provider_user_id
email
fecha_creacion

Esto permite:

usuarios
   ↓
identidades
   ├── LOCAL
   └── GOOGLE

Diseñar y aprobar la migración antes de desarrollar Google OAuth.

---------------------------------------------------------------------------------------------------------------------------------------
45. Módulo pacientes

No confundir:

usuarios

con:

pacientes

"usuarios" representa una cuenta de acceso.

"pacientes" contiene información funcional del paciente.

Un paciente puede tener:

usuarios.id_usuario
      ↓
pacientes.id_usuario

El módulo de pacientes deberá desarrollarse separado del módulo general de autenticación.

---------------------------------------------------------------------------------------------------------------------------------------

46. Permisos

Existe sistema:

roles
permisos
rol_permisos

Actualmente se utilizan roles para ciertas restricciones.

En etapas siguientes se deberá poder implementar:

requirePermission(
  "GESTIONAR_USUARIOS"
)

No llenar las rutas permanentemente con lógica hardcodeada si el modelo de permisos de base permite hacerlo dinámico.

---------------------------------------------------------------------------------------------------------------------------------------

47. Salitas

Los usuarios administrativos pueden tener relación con:

usuario_salita

Debe utilizarse para determinar qué establecimiento pueden administrar.

Un "SUPER_ADMIN" es global.

Un "ADMIN_SALITA" debe respetar su alcance de salita.

Nunca permitir que un administrador modifique arbitrariamente datos de una salita que no tenga asignada.

---------------------------------------------------------------------------------------------------------------------------------------
48. Principio de mínimo privilegio

Todo endpoint debe preguntarse:

¿Necesita autenticación?
¿Quién puede ejecutarlo?
¿Sobre qué recursos?
¿De qué salita?
¿Con qué permiso?

No crear endpoints administrativos públicos.

---------------------------------------------------------------------------------------------------------------------------------------

49. Datos sensibles

Evitar exponer:

password_hash
token_hash
SUPABASE_SECRET_KEY
JWT_ACCESS_SECRET
recovery tokens almacenados
datos internos de seguridad

Cuando se devuelva un token original durante desarrollo, debe estar condicionado a:

NODE_ENV === "development"

Nunca hacerlo en producción.

---------------------------------------------------------------------------------------------------------------------------------------
50. Desarrollo vs producción

Algunas funciones actualmente existen para facilitar pruebas.

Ejemplo:

verificationToken
recoveryToken

pueden devolverse durante desarrollo.

Cuando:

NODE_ENV=production

estos tokens no deben formar parte de respuestas HTTP.

En producción deberán enviarse mediante mecanismos externos como email.

---------------------------------------------------------------------------------------------------------------------------------------

51. Reglas para una IA que continúe el proyecto

Antes de generar código:

1. Leer este archivo completo.
2. Revisar la estructura actual del repositorio.
3. Revisar la base de datos SQL.
4. Identificar qué módulo estamos desarrollando.
5. Comprobar si existen archivos reutilizables.
6. Evitar duplicar lógica.
7. Evitar archivos excesivamente grandes.
8. Respetar Route → Middleware → Controller → Service → Repository.
9. No inventar columnas ni tablas.
10. Mantener seguridad existente.
11. Proponer migración si la base necesita cambios.
12. Explicar brevemente cada archivo.
13. Incluir comentarios breves en código.
14. Dar pruebas con curl para Git Bash.
15. No pasar al siguiente bloque hasta validar el actual.

---------------------------------------------------------------------------------------------------------------------------------------


53. Reutilización de código

Antes de crear nuevas funciones comprobar si existen:

hashPassword()
verifyPassword()
generateAccessToken()
findUserByEmail()
findRoleByCode()
createUser()
createSession()

No duplicar funciones equivalentes en distintos módulos.

---------------------------------------------------------------------------------------------------------------------------------------

54. Transacciones

Cuando una operación involucre varios cambios que deban ser atómicos, considerar utilizar transacciones o una función PostgreSQL/RPC.

Ejemplo:

crear usuario
+
crear relación usuario_salita

Si en el futuro se necesita garantizar que ambas ocurran juntas, diseñar una transacción.

No asumir que varias llamadas Supabase independientes forman automáticamente una transacción.

---------------------------------------------------------------------------------------------------------------------------------------
55. Consistencia histórica

No cambiar datos históricos automáticamente cuando cambian configuraciones futuras.

Las operaciones que representen hechos históricos deben conservar información necesaria para auditoría y trazabilidad.

---------------------------------------------------------------------------------------------------------------------------------------

56. CORS

Actualmente durante desarrollo puede utilizarse una configuración flexible.

Cuando exista frontend definitivo:

CLIENT_URL

debe configurarse explícitamente.

No mantener:

origin: true

indefinidamente en producción.

---------------------------------------------------------------------------------------------------------------------------------------

57. Rate limiting

Antes de producción se debe agregar rate limiting especialmente a:

/login
/password/forgot
/password/reset
/email/request
/register

para reducir ataques automatizados.

---------------------------------------------------------------------------------------------------------------------------------------

58. Seguridad del frontend futuro

El frontend React nunca debe recibir:

SUPABASE_SECRET_KEY
JWT_ACCESS_SECRET
hashes

El frontend manejará únicamente información necesaria para la interfaz.

Cuando se implemente almacenamiento web de refresh tokens, preferir estrategia segura mediante cookies:

HttpOnly
Secure
SameSite

en lugar de exponer refresh tokens permanentemente a JavaScript.

---------------------------------------------------------------------------------------------------------------------------------------

59. Principio general de desarrollo

Priorizar:

seguridad
claridad
separación de responsabilidades
mantenibilidad
consistencia
validación
trazabilidad

por encima de hacer el código rápidamente.

---------------------------------------------------------------------------------------------------------------------------------------

60. Instrucción final para la IA

Cuando el desarrollador solicite:

«"Seguimos con el siguiente bloque"»

NO generar todo SAPS Turno.

Primero identificar exactamente cuál es el siguiente módulo lógico y desarrollar solamente ese bloque.

La respuesta ideal debe seguir aproximadamente:

OBJETIVO DEL BLOQUE

ESTRUCTURA

ARCHIVOS A CREAR

ARCHIVOS A MODIFICAR

CÓDIGO COMENTADO

EXPLICACIÓN BREVE

npm run typecheck

npm run build

npm run dev

PRUEBAS CURL PARA GIT BASH

RESULTADOS ESPERADOS

VERIFICACIÓN EN SUPABASE

COMMIT GIT

Si una prueba falla, resolver ese error antes de continuar.

---------------------------------------------------------------------------------------------------------------------------------------

Resumen arquitectónico

                     ┌────────────────┐
                     │ React Frontend │
                     └───────┬────────┘
                             │ HTTPS
                             ▼
                     ┌────────────────┐
                     │  Express API   │
                     │   TypeScript   │
                     └───────┬────────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
             ▼               ▼               ▼
        Middleware       Controllers       Validators
             │               │
             └───────┬───────┘
                     ▼
                  Services
                     │
                     ▼
                Repositories
                     │
                     ▼
             Supabase PostgreSQL

Autenticación:

Cliente
   │
   ├── Login
   │     ↓
   │   Argon2
   │     ↓
   │   Access JWT
   │     +
   │   Refresh Token
   │
   ├── Refresh
   │     ↓
   │   rotación sesión
   │
   ├── Logout
   │     ↓
   │   revocación
   │
   ├── Forgot Password
   │     ↓
   │   Recovery Token
   │
   └── Verify Email
         ↓
      Email Token

---

Este documento debe mantenerse actualizado a medida que evolucione SAPS Turno.