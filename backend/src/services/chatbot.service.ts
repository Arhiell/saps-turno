import { CHATBOT_ROLES, chatbotLimits, getChatbotSettings, type ChatbotRole } from '../config/chatbot.config.js';
import { selectChatbotArticle } from '../config/chatbot-knowledge.js';
import { ChatbotRateLimiter } from '../middlewares/chatbot-rate-limit.middleware.js';
import { hasSensitiveChatbotData, isMedicalChatbotQuestion, normalizeChatbotText } from '../utils/chatbot-privacy.js';
import { AppError } from '../utils/app-error.js';
import { chatbotMessageSchema } from '../validators/chatbot.validator.js';
import { generateFunctionalReply, type GeminiFunctionalQuery } from './gemini.service.js';

interface Dependencies {
  generate?: (query: GeminiFunctionalQuery) => Promise<string>;
  settings?: typeof getChatbotSettings;
  limiter?: ChatbotRateLimiter;
}

export const createChatbotService = ({ generate = generateFunctionalReply,
  settings = getChatbotSettings, limiter = new ChatbotRateLimiter() }: Dependencies = {}) =>
  async (body: unknown, user: { id_usuario: string; rol: string }, signal: AbortSignal) => {
    if (!CHATBOT_ROLES.includes(user.rol as ChatbotRole)) {
      throw new AppError('Tu rol no tiene el asistente habilitado.', 403, 'CHATBOT_ROLE');
    }
    const { message } = chatbotMessageSchema.parse(body);
    if (hasSensitiveChatbotData(message)) {
      throw new AppError('No compartas información personal ni clínica. Reformulá tu consulta sin esos datos.',
        400, 'CHATBOT_SENSITIVE_DATA');
    }
    if (isMedicalChatbotQuestion(message)) {
      return 'Solo puedo explicar cómo usar CORA. No brindo orientación médica; consultá a un profesional de salud.';
    }
    const article = selectChatbotArticle(message, user.rol as ChatbotRole);
    if (!article) return 'No tengo un procedimiento autorizado para esa consulta. Preguntá por una función de tu panel o consultá a la administración.';
    const normalized = normalizeChatbotText(message);
    if (/^(?:crea|creame|cancela|cancelame|modifica|modificame|ejecuta|borra|elimina|registra|registrame)\b/.test(normalized)) {
      return 'No puedo realizar operaciones. Puedo explicarte cómo usar las opciones disponibles en CORA.';
    }
    const config = settings();
    if (!config.enabled || !config.apiKey) {
      throw new AppError('El Asistente CORA está deshabilitado o pendiente de configuración. El resto del sistema continúa disponible.',
        503, 'CHATBOT_DISABLED');
    }
    signal.throwIfAborted();
    const release = limiter.reserve(user.id_usuario);
    try {
      // Barrera de privacidad: el texto libre NUNCA sale del backend, ni siquiera si pasa los filtros.
      // Gemini recibe una pregunta canónica y documentación estática revisada, sin datos del usuario.
      const reply = (await generate({ question: article.question,
        context: article.content.slice(0, chatbotLimits.contextCharacters), signal })).trim();
      signal.throwIfAborted();
      if (!reply || reply.length > chatbotLimits.outputCharacters || hasSensitiveChatbotData(reply) ||
        isMedicalChatbotQuestion(reply) || /<\/?[a-z][^>]*>|```|https?:\/\//i.test(reply)) {
        throw new AppError('El asistente no pudo producir una respuesta válida. Reformulá la consulta.',
          502, 'CHATBOT_INVALID_REPLY');
      }
      return reply;
    } finally { release(); }
  };

export const replyToChatbot = createChatbotService();
