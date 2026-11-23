# Reparar la verificación de correo en una base existente

El backend requiere las columnas `intentos`, `nuevo_email` y `email_anterior`
de `public.tokens_verificacion_email`, y las funciones `emitir_codigo_email`
y `consumir_codigo_email`. Se usan al verificar administradores, pacientes y
profesionales, y al cambiar un correo.

Si aparece `column tokens_verificacion_email.nuevo_email does not exist`:

1. Abrir el SQL Editor del proyecto que corresponde a `SUPABASE_URL` en
   `backend/.env`.
2. Ejecutar **todo** el archivo `20260929_patient_email_change.sql` de esta
   carpeta. Agrega las columnas si faltan, instala las funciones y solicita
   actualizar la caché del esquema de la API. Conserva usuarios y tokens.
3. Comprobar que las cuatro columnas del resultado final muestran `true`.
4. Desde `backend`, ejecutar `npm run check:email`. Debe confirmar las columnas
   disponibles y la conexión SMTP. Este diagnóstico no envía mensajes.
5. En la pantalla de verificación, solicitar un código para el correo del
   administrador existente e ingresar el último código recibido. No volver
   a crear la cuenta. El código vence a los diez minutos; el reenvío tiene
   una espera mínima de un minuto.
6. Después de confirmar el correo, iniciar sesión con esa cuenta.

No ejecutar `SAPS_Turno_BBDD3_FINAL.sql` sobre la base existente para esta
reparación: ese archivo de creación elimina tablas. Cambiar archivos SQL
localmente o reiniciar el backend no aplica las migraciones a Supabase.

Las pruebas `tests/email-verification.test.ts` verifican el flujo del backend
con base de datos y correo simulados. No sustituyen los pasos de aplicación
y comprobación en la base real.
