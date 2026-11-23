Avances realizados:
* Se revisó y validó el CRUD de Tutores.
* Se confirmó que los datos personales salen de `personas` y que `tutores` solo maneja `id_persona`, estado y fechas.
* Se probó en Postman:
  * crear tutor;
  * listar tutores;
  * buscar por ID;
  * buscar por DNI;
  * actualizar datos personales;
  * activar/desactivar tutor;
  * manejo de errores y conflictos.
* Se confirmó que la baja de Tutor es lógica mediante `activo`, no con DELETE físico.

También se implementó el módulo `paciente_tutores`:
* validator;
* repository;
* service;
* controller;
* routes;
* registro en `routes/index.ts`.

Se agregó soporte para:
* asociar tutor a paciente;
* listar tutores de un paciente;
* listar pacientes de un tutor;
* actualizar parentesco y permisos;
* definir tutor principal;
* impedir más de un tutor principal vigente;
* permitir varios tutores no principales;
* finalizar la relación usando `fecha_hasta` en vez de borrar;
* impedir finalizar dos veces la misma relación.

Todo lo implementado se probó manualmente en Postman y está funcionando correctamente.

Si esta todo bien, tambien se puede:

* opcionalmente mejorar las respuestas de `paciente_tutores` para incluir también datos personales del tutor/paciente;

* Explayo; Ahora mismo, cuando pedís los tutores de un paciente, la API devuelve básicamente esto:
{
  "id_paciente": "...",
  "id_tutor": "...",
  "parentesco": "TUTORA LEGAL",
  "es_principal": true
}

* Se puede agregar que la misma respuesta incluya tambien datos personales del tutor:
{
  "id_tutor": "...",
  "parentesco": "TUTORA LEGAL",
  "es_principal": true,
  "dni": "39111222",
  "nombres": "Maria Laura",
  "apellidos": "Tutor Prueba",
  "telefono": "3777999999"
}
* Y al revés, cuando consultes los pacientes de un tutor, devolver también los datos básicos del paciente.