import { sendEmail } from "../services/email.service.js";

const main = async () => {
  try {
    const result = await sendEmail({
      to: "g.andre.her@hotmail.com",
      subject: "Prueba SAPS Turnos",
      text: `
Este es un correo de prueba del sistema SAPS Turnos.

Si recibiste este mensaje, la configuración SMTP funciona correctamente.

Este correo fue generado automáticamente.
Por favor, no responda a este correo.
      `.trim(),
      html: `
        <h2>Prueba SAPS Turnos</h2>

        <p>
          Este es un correo de prueba del sistema SAPS Turnos.
        </p>

        <p>
          Si recibiste este mensaje, la configuración SMTP funciona correctamente.
        </p>

        <hr>

        <small>
          Este correo fue generado automáticamente.<br>
          Por favor, no responda a este correo.
        </small>
      `.trim(),
    });

    console.log(
      "Correo enviado correctamente:",
      result.messageId,
    );
  } catch (error) {
    console.error(
      "Error enviando correo de prueba:",
      error,
    );

    process.exitCode = 1;
  }
};

await main();