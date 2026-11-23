import { GoogleGenAI } from '@google/genai';
import { chatbotInstructions, chatbotLimits, getChatbotSettings } from '../config/chatbot.config.js';
import { AppError } from '../utils/app-error.js';

export interface GeminiFunctionalQuery {
  question: string;
  context: string;
  signal: AbortSignal;
}

// Sin tools, chat persistente, archivos, búsqueda ni acceso a repositorios de CORA.
export const generateFunctionalReply = async ({ question, context, signal }: GeminiFunctionalQuery) => {
  const settings = getChatbotSettings();
  const client = new GoogleGenAI({ apiKey: settings.apiKey,
    httpOptions: { timeout: chatbotLimits.timeoutMs, retryOptions: { attempts: 1 } } });
  const timeout = AbortSignal.timeout(chatbotLimits.timeoutMs);
  const combined = AbortSignal.any([signal, timeout]);
  try {
    const response = await client.models.generateContent({
      model: settings.model,
      contents: question,
      config: {
        systemInstruction: `${chatbotInstructions}\n\nDOCUMENTACIÓN AUTORIZADA:\n${context}`,
        maxOutputTokens: chatbotLimits.outputTokens,
        abortSignal: combined,
      },
    });
    if (response.candidates?.[0]?.finishReason !== 'STOP') {
      throw new AppError('El asistente no pudo completar una respuesta segura. Reformulá la consulta.',
        502, 'CHATBOT_INVALID_REPLY');
    }
    return response.text ?? '';
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (combined.aborted) throw new AppError('La consulta fue cancelada o demoró demasiado.', 504, 'CHATBOT_TIMEOUT');
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
    if (status === 429) throw new AppError('La cuota del asistente está temporalmente agotada. Intentá más tarde.',
      429, 'CHATBOT_QUOTA', { retryAfter: 60 });
    // Nunca adjuntar cause, request, respuesta ni configuración del SDK a un error público/log.
    throw new AppError('No pudimos comunicarnos con el asistente. Intentá nuevamente más tarde.',
      503, 'CHATBOT_UNAVAILABLE');
  }
};
