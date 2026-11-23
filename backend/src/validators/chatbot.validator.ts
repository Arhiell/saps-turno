import { z } from 'zod';
import { chatbotLimits } from '../config/chatbot.config.js';

export const chatbotMessageSchema = z.strictObject({
  message: z.string().trim().min(1, 'Escribí una consulta funcional sobre CORA.')
    .max(chatbotLimits.messageCharacters, 'La consulta admite hasta 1000 caracteres.'),
});
