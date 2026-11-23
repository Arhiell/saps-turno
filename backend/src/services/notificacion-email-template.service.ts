import {
  env,
} from '../config/env.js';

// Escapa caracteres especiales antes de insertarlos en el HTML.
const escapeHtml = (
  value: string
) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!
  );

// Tablas y estilos inline mantienen el diseño legible
// en distintos clientes de correo.
export const buildNotificacionEmail =
  (data: {
    titulo: string;
    mensaje: string;
    remitente: string;
  }) => {
    // Genera el enlace hacia las notificaciones del usuario.
    const url = new URL(
      'mis-notificaciones',
      `${env.FRONTEND_URL.replace(
        /\/$/,
        ''
      )}/`
    ).toString();

    const footer =
      'Este correo fue generado automáticamente por SAPS Turno. Por favor, no respondas a este mensaje.';

    const help =
      'Si necesitás hacer una consulta, comunicate con tu salita por sus canales habituales de atención.';

    return {
      subject:
        data.titulo,

      // Versión de texto plano para clientes sin soporte HTML.
      text:
        `SAPS Turno\n\n` +
        `${data.titulo}\n\n` +
        `${data.mensaje}\n\n` +
        `Enviado por: ${data.remitente}\n\n` +
        `Ver mis notificaciones: ${url}\n\n` +
        `${footer}\n` +
        `${help}`,

      // Versión HTML del correo.
      html: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>${escapeHtml(data.titulo)}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background-color:#f4f7f6;
    color:#17212b;
    font-family:Arial,Helvetica,sans-serif;
    -webkit-text-size-adjust:100%;
  "
>
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      mso-hide:all;
    "
  >
    Tenés una nueva notificación de SAPS Turno.
  </div>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background-color:#f4f7f6;"
  >
    <tr>
      <td
        align="center"
        style="padding:24px 12px;"
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            max-width:600px;
            background-color:#ffffff;
            border:1px solid #e2e8e5;
            border-radius:12px;
          "
        >
          <tr>
            <td
              style="
                padding:26px 24px;
                background-color:#0b7a3b;
                border-radius:12px 12px 0 0;
              "
            >
              <p
                style="
                  margin:0;
                  color:#ffffff;
                  font-size:26px;
                  font-weight:700;
                  line-height:1.3;
                "
              >
                SAPS Turno
              </p>

              <p
                style="
                  margin:6px 0 0;
                  color:#ffffff;
                  font-size:14px;
                  line-height:1.5;
                "
              >
                Salas de Atención Primaria de la Salud
              </p>
            </td>
          </tr>

          <tr>
            <td
              style="padding:28px 24px;"
            >
              <p
                style="
                  margin:0 0 10px;
                  color:#0b7a3b;
                  font-size:12px;
                  font-weight:700;
                  letter-spacing:1px;
                "
              >
                NUEVA NOTIFICACIÓN
              </p>

              <h1
                style="
                  margin:0 0 20px;
                  color:#17212b;
                  font-size:24px;
                  line-height:1.35;
                  overflow-wrap:anywhere;
                  word-break:break-word;
                "
              >
                ${escapeHtml(data.titulo)}
              </h1>

              <p
                style="
                  margin:0 0 24px;
                  font-size:16px;
                  line-height:1.7;
                  overflow-wrap:anywhere;
                  word-break:break-word;
                "
              >
                ${escapeHtml(
                  data.mensaje
                ).replace(
                  /\r?\n/g,
                  '<br>'
                )}
              </p>

              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
              >
                <tr>
                  <td
                    style="
                      padding:16px;
                      background-color:#e8f5ed;
                      border-left:3px solid #0b7a3b;
                    "
                  >
                    <p
                      style="
                        margin:0 0 5px;
                        color:#667085;
                        font-size:12px;
                        line-height:1.5;
                      "
                    >
                      ENVIADO POR
                    </p>

                    <p
                      style="
                        margin:0;
                        color:#075c2c;
                        font-size:15px;
                        font-weight:700;
                        line-height:1.5;
                        overflow-wrap:anywhere;
                        word-break:break-word;
                      "
                    >
                      ${escapeHtml(data.remitente)}
                    </p>
                  </td>
                </tr>
              </table>

              <p
                style="margin:26px 0 16px;"
              >
                <a
                  href="${escapeHtml(url)}"
                  style="
                    display:inline-block;
                    background-color:#0b7a3b;
                    border:1px solid #0b7a3b;
                    border-radius:8px;
                    padding:14px 18px;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:15px;
                    font-weight:700;
                    line-height:1.4;
                  "
                >
                  Ver mis notificaciones
                </a>
              </p>

              <p
                style="
                  margin:0;
                  color:#667085;
                  font-size:13px;
                  line-height:1.6;
                "
              >
                Ingresá con tu cuenta para consultar este aviso
                y tus notificaciones anteriores.
              </p>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:20px 24px;
                border-top:1px solid #e2e8e5;
                background-color:#f8faf9;
                border-radius:0 0 12px 12px;
              "
            >
              <p
                style="
                  margin:0 0 8px;
                  color:#17212b;
                  font-size:13px;
                  font-weight:700;
                  line-height:1.6;
                "
              >
                Por favor, no respondas a este mensaje.
              </p>

              <p
                style="
                  margin:0 0 8px;
                  color:#667085;
                  font-size:12px;
                  line-height:1.6;
                "
              >
                Este correo fue generado automáticamente
                por SAPS Turno.
              </p>

              <p
                style="
                  margin:0;
                  color:#667085;
                  font-size:12px;
                  line-height:1.6;
                "
              >
                ${help}
              </p>
            </td>
          </tr>
        </table>

        <p
          style="
            margin:18px 0 0;
            color:#667085;
            font-size:12px;
            line-height:1.5;
          "
        >
          SAPS Turno · Información y atención cerca tuyo
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };
  };