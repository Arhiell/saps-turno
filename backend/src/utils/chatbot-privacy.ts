// Prevención conservadora; no es un anonimizador ni una clasificación clínica completa.
export const normalizeChatbotText = (text: string) => text.normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '')
  .toLowerCase();

const sensitivePatterns = [
  /[\w.+-]+\s*@\s*[\w.-]+\.[a-z]{2,}/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/i,
  /\b(?:bearer|api[_ -]?key|password|contrasena|token|secret|supabase[_ -]?key)\s*[:=]\s*\S+/i,
  /\bAIza[\w-]{15,}/i,
  /(?:\d[\s().+-]*){7,}/,
  /\b(?:dni|documento|telefono|celular|domicilio|direccion|correo|email|nombre|apellido|paciente)\s*(?:es|:|=)\s*\S+/i,
  /\b(?:me llamo|mi nombre es|vivo en|el paciente se llama|mi paciente|historia clinica|resultado de mi|tengo dolor|me duele|mi diagnostico|mi tratamiento|tomo [a-z]|estoy embarazada)\b/i,
];

export const hasSensitiveChatbotData = (text: string) => {
  const normalized = normalizeChatbotText(text);
  return sensitivePatterns.some(pattern => pattern.test(normalized));
};

export const isMedicalChatbotQuestion = (text: string) =>
  /\b(?:diagnosti\w*|tratamiento\w*|medicamento\w*|medicacion|dosis|sintoma\w*|receta\w*|interpret\w* (?:un |mi |el )?(?:estudio|analisis)|enfermedad\w*)\b/.test(normalizeChatbotText(text));
