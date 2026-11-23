export interface ChatbotResponse {
  success: true;
  data: { reply: string };
}

export interface ChatbotMessage {
  id: number;
  author: 'user' | 'assistant';
  text: string;
}
