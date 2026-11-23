type TurnoEmailData = {
  pacienteNombre: string;

  codigoTurno?: string | null;

  fecha: string;
  hora: string;

  profesional: string;
  especialidad: string;

  salita: string;
  zona?: string | null;
  direccion?: string | null;
  telefono?: string | null;
};

type CambioAnterior = {
  fecha?: string;
  hora?: string;
  profesional?: string;
};

const buildLocationText = (data: TurnoEmailData) => {
  const lines = [
    `Salita: ${data.salita}`,
    data.zona ? `Zona: ${data.zona}` : null,
    data.direccion ? `Dirección: ${data.direccion}` : null,
    data.telefono ? `Teléfono: ${data.telefono}` : null,
  ];

  return lines.filter(Boolean).join("\n");
};

const buildLocationHtml = (data: TurnoEmailData) => {
  return `
    <p>
      <strong>Salita:</strong> ${data.salita}<br>
      ${
        data.zona
          ? `<strong>Zona:</strong> ${data.zona}<br>`
          : ""
      }
      ${
        data.direccion
          ? `<strong>Dirección:</strong> ${data.direccion}<br>`
          : ""
      }
      ${
        data.telefono
          ? `<strong>Teléfono:</strong> ${data.telefono}<br>`
          : ""
      }
    </p>
  `;
};

export const buildTurnoCreadoEmail = (
  data: TurnoEmailData,
) => {
  const subject = "Turno registrado - SAPS";

  const text = `
Hola ${data.pacienteNombre}.

Su turno fue registrado correctamente.

${data.codigoTurno ? `Código de turno: ${data.codigoTurno}` : ""}
Fecha: ${data.fecha}
Hora: ${data.hora}
Especialidad: ${data.especialidad}
Profesional: ${data.profesional}

Lugar de atención:
${buildLocationText(data)}

Este correo fue generado automáticamente.
Por favor, no responda a este correo.
  `.trim();

  const html = `
    <h2>Turno registrado</h2>

    <p>Hola ${data.pacienteNombre}.</p>

    <p>Su turno fue registrado correctamente.</p>

    <p>
      ${
        data.codigoTurno
          ? `<strong>Código de turno:</strong> ${data.codigoTurno}<br>`
          : ""
      }
      <strong>Fecha:</strong> ${data.fecha}<br>
      <strong>Hora:</strong> ${data.hora}<br>
      <strong>Especialidad:</strong> ${data.especialidad}<br>
      <strong>Profesional:</strong> ${data.profesional}
    </p>

    <h3>Lugar de atención</h3>

    ${buildLocationHtml(data)}

    <hr>

    <p>
      <small>
        Este correo fue generado automáticamente.<br>
        Por favor, no responda a este correo.
      </small>
    </p>
  `.trim();

  return {
    subject,
    text,
    html,
  };
};

export const buildTurnoCanceladoEmail = (
  data: TurnoEmailData,
) => {
  const subject = "Turno cancelado - SAPS";

  const text = `
Hola ${data.pacienteNombre}.

Le informamos que su turno fue cancelado.

${data.codigoTurno ? `Código de turno: ${data.codigoTurno}` : ""}
Fecha: ${data.fecha}
Hora: ${data.hora}
Especialidad: ${data.especialidad}
Profesional: ${data.profesional}

Lugar de atención:
${buildLocationText(data)}

Este correo fue generado automáticamente.
Por favor, no responda a este correo.
  `.trim();

  const html = `
    <h2>Turno cancelado</h2>

    <p>Hola ${data.pacienteNombre}.</p>

    <p>Le informamos que su turno fue cancelado.</p>

    <p>
      ${
        data.codigoTurno
          ? `<strong>Código de turno:</strong> ${data.codigoTurno}<br>`
          : ""
      }
      <strong>Fecha:</strong> ${data.fecha}<br>
      <strong>Hora:</strong> ${data.hora}<br>
      <strong>Especialidad:</strong> ${data.especialidad}<br>
      <strong>Profesional:</strong> ${data.profesional}
    </p>

    <h3>Lugar de atención</h3>

    ${buildLocationHtml(data)}

    <hr>

    <p>
      <small>
        Este correo fue generado automáticamente.<br>
        Por favor, no responda a este correo.
      </small>
    </p>
  `.trim();

  return {
    subject,
    text,
    html,
  };
};

export const buildTurnoReprogramadoEmail = (
  data: TurnoEmailData,
  anterior?: CambioAnterior,
) => {
  const subject = "Turno reprogramado - SAPS";

  const text = `
Hola ${data.pacienteNombre}.

Le informamos que su turno fue reprogramado por un cambio en la agenda de atención.

${
  anterior?.fecha || anterior?.hora
    ? `
Turno anterior:
${anterior.fecha ? `Fecha: ${anterior.fecha}` : ""}
${anterior.hora ? `Hora: ${anterior.hora}` : ""}
`
    : ""
}

Nuevo turno:
Fecha: ${data.fecha}
Hora: ${data.hora}
Especialidad: ${data.especialidad}
Profesional: ${data.profesional}

Lugar de atención:
${buildLocationText(data)}

Este correo fue generado automáticamente.
Por favor, no responda a este correo.
  `.trim();

  const html = `
    <h2>Turno reprogramado</h2>

    <p>Hola ${data.pacienteNombre}.</p>

    <p>Le informamos que su turno fue reprogramado por un cambio en la agenda de atención.</p>

    ${
      anterior?.fecha || anterior?.hora
        ? `
          <h3>Turno anterior</h3>
          <p>
            ${
              anterior.fecha
                ? `<strong>Fecha:</strong> ${anterior.fecha}<br>`
                : ""
            }
            ${
              anterior.hora
                ? `<strong>Hora:</strong> ${anterior.hora}`
                : ""
            }
          </p>
        `
        : ""
    }

    <h3>Nuevo turno</h3>

    <p>
      <strong>Fecha:</strong> ${data.fecha}<br>
      <strong>Hora:</strong> ${data.hora}<br>
      <strong>Especialidad:</strong> ${data.especialidad}<br>
      <strong>Profesional:</strong> ${data.profesional}
    </p>

    <h3>Lugar de atención</h3>

    ${buildLocationHtml(data)}

    <hr>

    <p>
      <small>
        Este correo fue generado automáticamente.<br>
        Por favor, no responda a este correo.
      </small>
    </p>
  `.trim();

  return {
    subject,
    text,
    html,
  };
};

export const buildCambioProfesionalEmail = (
  data: TurnoEmailData,
  anterior?: CambioAnterior,
) => {
  const subject = "Cambio de profesional en su turno - SAPS";

  const text = `
Hola ${data.pacienteNombre}.

Le informamos que se realizó un cambio de profesional en su turno.

${
  anterior?.profesional
    ? `Profesional anterior: ${anterior.profesional}`
    : ""
}
Nuevo profesional: ${data.profesional}

Fecha: ${data.fecha}
Hora: ${data.hora}
Especialidad: ${data.especialidad}

Lugar de atención:
${buildLocationText(data)}

Este correo fue generado automáticamente.
Por favor, no responda a este correo.
  `.trim();

  const html = `
    <h2>Cambio de profesional</h2>

    <p>Hola ${data.pacienteNombre}.</p>

    <p>
      Le informamos que se realizó un cambio de profesional en su turno.
    </p>

    <p>
      ${
        anterior?.profesional
          ? `<strong>Profesional anterior:</strong> ${anterior.profesional}<br>`
          : ""
      }
      <strong>Nuevo profesional:</strong> ${data.profesional}
    </p>

    <p>
      <strong>Fecha:</strong> ${data.fecha}<br>
      <strong>Hora:</strong> ${data.hora}<br>
      <strong>Especialidad:</strong> ${data.especialidad}
    </p>

    <h3>Lugar de atención</h3>

    ${buildLocationHtml(data)}

    <hr>

    <p>
      <small>
        Este correo fue generado automáticamente.<br>
        Por favor, no responda a este correo.
      </small>
    </p>
  `.trim();

  return {
    subject,
    text,
    html,
  };
};

