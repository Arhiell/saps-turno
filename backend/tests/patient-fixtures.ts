import assert from "node:assert/strict";

Object.assign(process.env, {
  SUPABASE_URL: "http://supabase.invalid",
  SUPABASE_PUBLISHABLE_KEY: "test-key",
  SUPABASE_SECRET_KEY: "test-secret",
  JWT_ACCESS_SECRET: "test-secret-for-patients",
  GOOGLE_CLIENT_ID: "test-client"
});

export const input = {
  dni: "40111222", nombres: "Juan", apellidos: "Perez",
  fecha_nacimiento: "1995-05-20", sexo: "MASCULINO" as const,
  direccion: "Belgrano 123",
  id_barrio: "11111111-1111-4111-8111-111111111111",
  id_salita_asignada: "22222222-2222-4222-8222-222222222222"
};
export const person = {
  id_persona: "33333333-3333-4333-8333-333333333333",
  dni: input.dni, nombres: input.nombres, apellidos: input.apellidos,
  fecha_nacimiento: input.fecha_nacimiento, sexo: input.sexo,
  direccion: input.direccion, telefono: null, email: null,
  localidad: "Goya", provincia: "Corrientes", codigo_postal: null
};
export const row = {
  id_paciente: "44444444-4444-4444-8444-444444444444",
  id_persona: person.id_persona, id_barrio: input.id_barrio,
  id_salita_asignada: input.id_salita_asignada, activo: true,
  obra_social: null, numero_afiliado: null,
  contacto_emergencia_nombre: null, contacto_emergencia_telefono: null,
  fecha_registro: "2026-01-01", fecha_actualizacion: "2026-01-01", persona: person
};

type Step = {
  table: string; method?: string; result: unknown; status?: number;
  check?: (url: URL, body: Record<string, unknown> | undefined) => void;
};
let steps: Step[] = [];
export const queue = (...next: Step[]) => { steps = [...next]; };
export const drained = () => assert.equal(steps.length, 0, "Faltan consultas esperadas");
globalThis.fetch = async (request, options) => {
  const url = new URL(String(request));
  const step = steps.shift();
  assert.ok(step, "Consulta inesperada: " + url);
  assert.equal(url.hostname, "supabase.invalid");
  assert.equal(url.pathname, "/rest/v1/" + step.table);
  assert.equal(options?.method ?? "GET", step.method ?? "GET");
  step.check?.(url, options?.body ? JSON.parse(String(options.body)) : undefined);
  return new Response(JSON.stringify(step.result), {
    status: step.status ?? 200,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" }
  });
};
export const conflict = (error: unknown) =>
  error instanceof Error && "statusCode" in error && error.statusCode === 409;