import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { chatbotErrorMessage, observeChatbotLogout, sendChatbotMessage } from '../../services/chatbot.service';
import { getAccessToken, getStoredUser } from '../../utils/auth-storage';
import { ChatbotSession } from '../../utils/chatbot-session';
import { PROFESSIONAL_MESSAGE_TIMEOUT_MS, useAutoDismiss } from '../../utils/useAutoDismiss';
import type { ChatbotMessage } from '../../types/chatbot.types';
import '../../styles/chatbot.css';
import useChatbotLauncher from './useChatbotLauncher';

const welcome: ChatbotMessage = { id: 0, author: 'assistant',
  text: '¡Hola! Soy el Asistente CORA. Puedo explicarte cómo usar las funciones de tu panel. Cada consulta se responde por separado.' };
const roles = ['SUPER_ADMIN', 'ADMIN_SALITA', 'PROFESIONAL', 'PACIENTE'];
const suggestions: Record<string, string[]> = {
  SUPER_ADMIN: ['¿Cómo registro un paciente?', '¿Cómo creo un turno?', '¿Dónde consulto las salitas?'],
  ADMIN_SALITA: ['¿Cómo busco un paciente?', '¿Cómo creo un turno?', '¿Dónde consulto los reportes?'],
  PROFESIONAL: ['¿Cómo veo mi agenda de hoy?', '¿Cómo registro una inasistencia?', '¿Dónde veo mis notificaciones?'],
  PACIENTE: ['¿Cómo solicito un turno?', '¿Cómo cancelo un turno?', '¿Cómo modifico mi perfil?'],
};

const storedIdentity = () => {
  const stored = getStoredUser();
  return stored && getAccessToken() ? `${stored.id_usuario}:${stored.rol}` : null;
};

// La key del contenedor reinicia completamente el historial al cambiar identidad o rol.
export default function Chatbot({ embedded = false }: { embedded?: boolean }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (!user || !isAuthenticated || isLoading || !roles.includes(user.rol) ||
    location.pathname === '/completar-perfil') return null;
  return <ChatbotPanel key={`${user.id_usuario}:${user.rol}`} identity={`${user.id_usuario}:${user.rol}`} role={user.rol} embedded={embedded} />;
}

function ChatbotPanel({ identity, role, embedded }: { identity: string; role: string; embedded: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<ChatbotMessage[]>([welcome]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useAutoDismiss(error, setError, PROFESSIONAL_MESSAGE_TIMEOUT_MS, role === 'PROFESIONAL');
  const [ended, setEnded] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767.98px)').matches);
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const floating = useChatbotLauncher(identity, launcher);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastPresentedMessage = useRef<number | null>(null);
  const pending = useRef(false);
  const sequence = useRef(0);
  const [session] = useState(() => new ChatbotSession(storedIdentity));

  const clear = () => {
    session.invalidate();
    pending.current = false;
    setBusy(false);
    setDraft('');
    setError('');
    setMessages([welcome]);
  };

  useLayoutEffect(() => {
    const invalidate = () => {
      session.invalidate();
      pending.current = false;
      setBusy(false);
      setDraft('');
      setError('');
      setMessages([welcome]);
      setOpen(false);
      setEnded(true);
    };
    const sync = () => { if (storedIdentity() !== identity) invalidate(); };
    const stopObserving = observeChatbotLogout(invalidate);
    window.addEventListener('saps-session', sync);
    window.addEventListener('storage', sync);
    return () => {
      session.invalidate();
      stopObserving();
      window.removeEventListener('saps-session', sync);
      window.removeEventListener('storage', sync);
    };
  }, [identity, session]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767.98px)');
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const close = () => { setOpen(false); launcher.current?.focus(); };
    const keys = (event: KeyboardEvent) => {
      // Los modales del sistema conservan prioridad sobre el chat no modal.
      if (!mobile && document.querySelector('.modal[aria-modal="true"]')) return;
      if (!embedded && event.key === 'Escape') { event.preventDefault(); close(); }
      if (!embedded && mobile && event.key === 'Tab') {
        const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? [])
          .filter(element => element.getClientRects().length > 0);
        const first = focusable?.[0];
        const last = focusable?.[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const root = document.getElementById('root');
    const previousInert = root?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (mobile && !embedded) {
      if (root) root.inert = true;
      document.body.style.overflow = 'hidden';
    }
    const viewport = window.visualViewport;
    const resize = () => {
      if (!panel.current) return;
      panel.current.style.setProperty('--chatbot-visible-height', `${viewport?.height ?? window.innerHeight}px`);
      panel.current.style.setProperty('--chatbot-visible-top', `${viewport?.offsetTop ?? 0}px`);
      panel.current.dataset.compact = String((viewport?.height ?? window.innerHeight) < 520);
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      if (mobile && !embedded) {
        if (root) root.inert = previousInert;
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [open, mobile, embedded]);

  // Solo presentación: respetar la lectura de mensajes anteriores al llegar una respuesta.
  useLayoutEffect(() => {
    if (!open || !log.current) return;
    const latest = messages.at(-1);
    const userJustSent = latest?.author === 'user' && latest.id !== lastPresentedMessage.current;
    if (nearBottom.current || userJustSent) {
      log.current.scrollTop = log.current.scrollHeight;
      nearBottom.current = true;
    }
    lastPresentedMessage.current = latest?.id ?? null;
  }, [messages, busy, open]);

  useLayoutEffect(() => {
    if (open && privacyExpanded && log.current) {
      log.current.scrollTop = 0;
      nearBottom.current = false;
    }
  }, [open, privacyExpanded]);

  useLayoutEffect(() => {
    const field = input.current;
    if (!open || !field) return;
    const styles = window.getComputedStyle(field);
    const border = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    const maximum = parseFloat(styles.maxHeight);
    field.style.height = 'auto';
    const desired = field.scrollHeight + border;
    field.style.height = `${Math.min(desired, maximum)}px`;
    field.style.overflowY = desired > maximum ? 'auto' : 'hidden';
  }, [draft, open]);

  const send = async (event?: FormEvent, suggestion?: string) => {
    event?.preventDefault();
    const message = (suggestion ?? draft).trim();
    if (!message || message.length > 1_000 || pending.current || ended || storedIdentity() !== identity) return;
    const ticket = session.begin();
    pending.current = true;
    setBusy(true);
    setError('');
    setDraft('');
    setMessages(previous => [...previous, { id: ++sequence.current, author: 'user' as const, text: message }].slice(-20));
    try {
      const reply = await sendChatbotMessage(message, ticket.signal);
      if (ticket.isCurrent()) setMessages(previous => [...previous,
        { id: ++sequence.current, author: 'assistant' as const, text: reply }].slice(-20));
    } catch (cause) {
      if (ticket.isCurrent()) setError(chatbotErrorMessage(cause));
    } finally {
      if (ticket.isCurrent()) { pending.current = false; setBusy(false); }
    }
  };

  if (ended) return null;
  const close = () => { setOpen(false); launcher.current?.focus(); };
  const content = (
    <div className={`cora-chatbot${embedded ? ' cora-chatbot--embedded' : ''}${role === 'PROFESIONAL' ? ' cora-chatbot--professional' : ''}`} data-open={open}>
      {!embedded && !floating.hidden && <button ref={launcher} className="cora-chatbot__launcher" aria-label="Abrir Asistente CORA"
        title="Asistente CORA: arrastrá para mover o tocá para abrir"
        style={floating.style} data-dragging={floating.dragging}
        onPointerDown={floating.onPointerDown} onPointerMove={floating.onPointerMove}
        onPointerUp={floating.onPointerUp} onPointerCancel={floating.onPointerCancel}
        onLostPointerCapture={floating.onLostPointerCapture}
        aria-expanded={open} aria-controls="cora-chatbot-panel" onClick={event => {
          if (event.detail !== 0 && floating.consumeClick()) return;
          setOpen(value => !value);
        }}>
        <i className="bi bi-robot" aria-hidden="true" />
        <span>Asistente CORA</span>
      </button>}
      {open && <div ref={panel} id="cora-chatbot-panel" className="cora-chatbot__panel"
        role={embedded ? 'region' : 'dialog'} aria-modal={!embedded && mobile ? true : undefined} aria-labelledby="cora-chatbot-title">
        <header className="cora-chatbot__header">
          <span className="cora-chatbot__avatar"><i className="bi bi-robot" aria-hidden="true" /></span>
          <div><h2 id="cora-chatbot-title">Asistente CORA</h2><p>Ayuda sobre tu panel con IA de Gemini</p></div>
          {!embedded && <button aria-label="Cerrar Asistente CORA" onClick={close}><i className="bi bi-x-lg" aria-hidden="true" /></button>}
        </header>
        <div className="cora-chatbot__privacy">
          <i className="bi bi-shield-check" aria-hidden="true" />
          <p id="cora-chatbot-privacy">
            Asistente académico. No ingreses datos personales ni clínicos. Las consultas se procesan mediante IA externa.{' '}
            <button type="button" aria-expanded={privacyExpanded} aria-controls="cora-chatbot-privacy-details"
              onClick={() => setPrivacyExpanded(value => !value)}>
              {privacyExpanded ? 'Menos información' : 'Más información'}
            </button>
          </p>
        </div>
        <div ref={log} className="cora-chatbot__conversation" tabIndex={0} aria-label="Área de conversación"
          onScroll={event => {
            const area = event.currentTarget;
            nearBottom.current = area.scrollHeight - area.scrollTop - area.clientHeight <= 48;
          }}>
          <details className="cora-chatbot__preferences">
            <summary>Botón flotante del asistente</summary>
            <p>Arrastralo con el mouse o el dedo para ubicarlo donde prefieras.</p>
            <button type="button" aria-pressed={!floating.hidden} onClick={() => floating.setHidden(!floating.hidden)}>
              {floating.hidden ? 'Mostrar botón flotante' : 'Ocultar botón flotante'}
            </button>
            <button type="button" onClick={floating.resetPosition}>Restablecer posición</button>
            <p>Podés volver a activarlo desde Asistente CORA en el menú. Esta preferencia se guarda en este navegador.</p>
          </details>
          <section id="cora-chatbot-privacy-details" className="cora-chatbot__privacy-details"
            aria-labelledby="cora-chatbot-privacy-title" hidden={!privacyExpanded}>
            <h3 id="cora-chatbot-privacy-title">Sobre tu privacidad</h3>
            <p>Prototipo académico. Solo ayuda sobre CORA; no es un servicio sanitario.
              No ingreses datos personales ni clínicos. Google procesa preguntas funcionales predefinidas;
              tu texto libre no se envía a Gemini. Los filtros no garantizan anonimización.</p>
          </section>
          <div className="cora-chatbot__messages" role="log" aria-label="Conversación con el Asistente CORA"
            aria-live="polite" aria-relevant="additions">
            {messages.map(message => <div key={message.id} className={`cora-chatbot__message cora-chatbot__message--${message.author}`}>
              <strong>{message.author === 'user' ? 'Vos' : 'Asistente CORA'}</strong><p>{message.text}</p>
            </div>)}
            {busy && <div className="cora-chatbot__loading" role="status">
              <i className="bi bi-three-dots" aria-hidden="true" /><span>Preparando respuesta…</span>
            </div>}
          </div>
          {messages.length === 1 && <div className="cora-chatbot__suggestions" aria-label="Preguntas sugeridas">
            {suggestions[role]?.map(question => <button key={question} disabled={busy} onClick={() => void send(undefined, question)}>{question}</button>)}
          </div>}
          {error && <p className="cora-chatbot__error" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" />{error}</p>}
        </div>
        <form className="cora-chatbot__form" onSubmit={event => void send(event)}>
          <label className="visually-hidden" htmlFor="cora-chatbot-message">Tu consulta sobre CORA</label>
          <div className="cora-chatbot__composer">
            <textarea ref={input} id="cora-chatbot-message" rows={1} maxLength={1_000} value={draft}
              aria-describedby="cora-chatbot-privacy" placeholder="Preguntá cómo usar una función..."
              onChange={event => setDraft(event.target.value)} onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault(); void send();
                }
              }} />
            <button className="cora-chatbot__send" type="submit" disabled={busy || !draft.trim()} aria-label="Enviar consulta" aria-busy={busy}>
              <i className={`bi ${busy ? 'bi-hourglass-split' : 'bi-send-fill'}`} aria-hidden="true" />
            </button>
          </div>
          <div className="cora-chatbot__footer"><span>{draft.length}/1000 · consultas independientes</span>
            <button type="button" onClick={clear}>Limpiar conversación</button></div>
        </form>
      </div>}
    </div>
  );
  return embedded ? content : createPortal(content, document.body);
}
