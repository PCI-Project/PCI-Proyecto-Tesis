import React, { useEffect, useRef, useState } from 'react';
import type { AgentRun } from '../../types';
import { useTranslations } from '../../hooks/useTranslations';
import { askAgent } from '../../services/agent/agentClient';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** Frase corta, cifras clave y detalle plegable (servicio nuevo); sin ellos se muestra el texto completo. */
  summary?: string;
  facts?: { etiqueta: string; valor: string }[];
  detail?: string | null;
  origin?: 'modelo' | 'automatica';
  sources?: string[];
  error?: boolean;
}

interface Saved { messages: Message[]; suggestions: string[] }

const MAX_LEN = 600;
const HISTORY_SENT = 6;
/** La conversación sobrevive al cambio de pestaña; se pierde al recargar la página. */
const saved = new Map<string, Saved>();

/** Preguntas de arranque; el asistente entiende español, por eso no se traducen. */
function startingQuestions(analysis: any): string[] {
  const sections: any[] = analysis?.tramos ?? [];
  const worst = [...sections].sort((a, b) => a.pci - b.pci)[0];
  const faults = sections.flatMap(s => s.fallas ?? []);
  const topFault = [...faults].sort((a, b) => (b.densidad_pct ?? 0) - (a.densidad_pct ?? 0))[0];
  return [
    worst ? `¿Por qué ${worst.nombre} recibe ese tratamiento?` : '',
    topFault ? `¿Qué significa «${String(topFault.nombre).toLowerCase()}»?` : '',
    '¿Cómo está la red en general?',
    analysis?.modo === 'diagnostico' ? '' : '¿Qué se financia y qué no?', // C1: sin presupuesto no hay financiación
    '¿Cuáles son las alertas más graves?',
  ].filter(Boolean);
}

const Avatar: React.FC = () => (
  <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 text-primary-dark flex items-center justify-center" aria-hidden="true">
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>
  </div>
);

const AssistantMessage: React.FC<{ message: Message }> = ({ message: m }) => {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const structured = Boolean(m.summary) && !m.error;
  const detail = structured ? m.detail : null;
  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="min-w-0 max-w-[88%] space-y-2">
        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm space-y-3 ${m.error ? 'border border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' : 'border border-border-muted bg-bg-surface text-text-base'}`}>
          <p className="text-[15px] leading-relaxed whitespace-pre-line break-words">{structured ? m.summary : m.text}</p>
          {structured && m.facts && m.facts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {m.facts.map(f => (
                <div key={f.etiqueta} className="rounded-lg bg-secondary/15 px-3 py-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-text-muted">{f.etiqueta}</div>
                  <div className="text-sm font-semibold text-text-base">{f.valor}</div>
                </div>
              ))}
            </div>
          )}
          {detail && (
            <>
              <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="text-sm font-semibold text-primary-dark hover:underline focus:outline-none focus:ring-2 focus:ring-primary/40 rounded">
                {open ? t('agent.chat.hideDetail') : t('agent.chat.showDetail')}
              </button>
              {open && <p className="text-sm whitespace-pre-line break-words border-t border-border-muted pt-3">{detail}</p>}
            </>
          )}
        </div>
        {!m.error && (
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            {m.sources && m.sources.length > 0 && (
              <>
                <span className="text-xs text-text-muted">{t('agent.chat.sources')}</span>
                {m.sources.map(s => <span key={s} className="rounded-full border border-border-muted px-2.5 py-0.5 text-xs text-text-muted">{s}</span>)}
              </>
            )}
            <span className="text-xs text-text-muted">{m.sources && m.sources.length > 0 ? '· ' : ''}{t(`agent.chat.origin.${m.origin ?? 'automatica'}`)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface Props { run: AgentRun; online: boolean }

export const ChatView: React.FC<Props> = ({ run, online }) => {
  const { t } = useTranslations();
  const analysis: any = run.analysis;
  const narrative: any = run.narrative;
  const [messages, setMessages] = useState<Message[]>(() => saved.get(run.id)?.messages ?? []);
  const [suggestions, setSuggestions] = useState<string[]>(() => saved.get(run.id)?.suggestions ?? startingQuestions(analysis));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(messages.length + 1);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => { saved.set(run.id, { messages, suggestions }); }, [run.id, messages, suggestions]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages, busy]);
  // El cuadro de texto crece con lo que se escribe (hasta un máximo) y vuelve a una línea al enviar.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);

  const add = (message: Omit<Message, 'id'>) => setMessages(list => [...list, { ...message, id: nextId.current++ }]);

  const send = async (raw: string) => {
    const question = raw.trim().slice(0, MAX_LEN);
    if (!question || busy || !online) return;
    const history = messages.filter(m => !m.error).slice(-HISTORY_SENT).map(m => ({ rol: m.role === 'user' ? 'usuario' as const : 'asistente' as const, texto: m.text }));
    add({ role: 'user', text: question });
    setText('');
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const reply = await askAgent(question, analysis, narrative, history, controller);
      if (!alive.current) return;
      add({ role: 'assistant', text: reply.respuesta, summary: reply.resumen, facts: reply.datos, detail: reply.detalle, origin: reply.origen, sources: reply.fuentes });
      setSuggestions(reply.sugerencias ?? []);
    } catch (e: any) {
      if (!alive.current) return;
      const detail = e?.status === 422 && Array.isArray(e.body?.errores) ? e.body.errores.join('; ') : '';
      add({
        role: 'assistant', error: true,
        text: e?.name === 'AbortError' ? t('agent.chat.cancelled') : e?.status === 404 ? t('agent.chat.noEndpoint') : e?.status === 429 ? t('agent.error.rateLimit') : detail || t('agent.chat.error'),
      });
    } finally {
      if (alive.current) setBusy(false);
      abort.current = null;
    }
  };

  const asked = new Set(messages.filter(m => m.role === 'user').map(m => m.text));
  const shownSuggestions = suggestions.filter(q => !asked.has(q));

  const clear = () => { abort.current?.abort(); setMessages([]); setSuggestions(startingQuestions(analysis)); saved.delete(run.id); };

  return (
    <section aria-label={t('agent.chat.title')} className="flex flex-col overflow-hidden rounded-2xl border border-border-muted bg-bg-surface shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border-muted px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-text-base leading-tight">{t('agent.chat.title')}</h3>
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className={`h-2 w-2 shrink-0 rounded-full ${online ? 'bg-primary' : 'bg-amber-500'}`} aria-hidden="true" />
              <span className="truncate">{t(online ? 'agent.health.online' : 'agent.health.offline')} · {t('agent.chat.about', { n: run.number })}</span>
            </p>
          </div>
        </div>
        <button type="button" disabled={!messages.length && !busy} onClick={clear} className="shrink-0 rounded-lg border border-border-base px-3 py-1.5 text-sm font-semibold text-text-muted hover:text-text-base disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40">{t('agent.chat.clear')}</button>
      </header>

      <div role="log" aria-live="polite" aria-label={t('agent.chat.log')} className="space-y-5 px-4 py-5 min-h-[16rem] max-h-[min(36rem,70vh)] overflow-y-auto bg-bg-base/40">
        {!messages.length && (
          <div className="flex gap-3">
            <Avatar />
            <p className="max-w-[88%] rounded-2xl rounded-tl-sm border border-border-muted bg-bg-surface px-4 py-3 text-[15px] leading-relaxed text-text-base shadow-sm">{t('agent.chat.intro')}</p>
          </div>
        )}
        {messages.map(m => m.role === 'user' ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-[15px] text-text-inverted shadow-sm whitespace-pre-line break-words">{m.text}</div>
          </div>
        ) : <AssistantMessage key={m.id} message={m} />)}
        {busy && (
          <div className="flex items-center gap-3" role="status" aria-label={t('agent.chat.thinking')}>
            <Avatar />
            <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-border-muted bg-bg-surface px-4 py-3">
              <span className="flex items-center gap-1.5" aria-hidden="true">
                {[0, 150, 300].map(delay => <span key={delay} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}
              </span>
              <span className="text-sm text-text-muted">{t('agent.chat.thinking')}</span>
              <button type="button" className="text-sm font-semibold text-primary-dark underline" onClick={() => abort.current?.abort()}>{t('agent.chat.stop')}</button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="border-t border-border-muted bg-bg-surface px-4 pb-3 pt-3 space-y-3" onSubmit={e => { e.preventDefault(); void send(text); }}>
        {shownSuggestions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]" aria-label={t('agent.chat.suggestions')}>
            {shownSuggestions.map(q => (
              <button key={q} type="button" disabled={busy || !online} onClick={() => void send(q)} className="shrink-0 rounded-full border border-border-base bg-bg-surface px-3 py-1.5 text-sm text-text-base hover:border-primary hover:text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40">{q}</button>
            ))}
          </div>
        )}
        {!online && <p role="status" className="text-xs font-semibold text-amber-800 dark:text-amber-200">{t('agent.chat.offline')}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-border-base bg-bg-base/40 px-3 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            maxLength={MAX_LEN}
            aria-label={t('agent.chat.input')}
            placeholder={t('agent.chat.placeholder')}
            disabled={!online}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(text); } }}
            className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[15px] text-text-base outline-none placeholder:text-text-muted disabled:opacity-60"
          />
          <button type="submit" aria-label={t('agent.chat.send')} disabled={!online || busy || !text.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-text-inverted disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
        <p className="text-center text-xs text-text-muted">
          {t('agent.chat.note')}
          {text.length > MAX_LEN * 0.8 && <span className="ml-2 tabular-nums">{text.length}/{MAX_LEN}</span>}
        </p>
      </form>
    </section>
  );
};
