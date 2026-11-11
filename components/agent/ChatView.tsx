import React, { useEffect, useRef, useState } from 'react';
import type { AgentRun } from '../../types';
import { useTranslations } from '../../hooks/useTranslations';
import { Button } from '../ui/Button';
import { askAgent } from '../../services/agent/agentClient';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
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
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => { saved.set(run.id, { messages, suggestions }); }, [run.id, messages, suggestions]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages, busy]);

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
      add({ role: 'assistant', text: reply.respuesta, origin: reply.origen, sources: reply.fuentes });
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
    <section aria-label={t('agent.chat.title')} className="rounded-xl border border-border-muted bg-bg-surface">
      <header className="flex flex-wrap items-center gap-2 justify-between p-3 border-b border-border-muted">
        <div>
          <h3 className="text-base font-bold text-text-base">{t('agent.chat.title')}</h3>
          <p className="text-xs text-text-muted">{t('agent.chat.about', { n: run.number })}</p>
        </div>
        <Button variant="ghost" className="border border-border-base !py-1.5" disabled={!messages.length && !busy} onClick={clear}>{t('agent.chat.clear')}</Button>
      </header>

      <div role="log" aria-live="polite" aria-label={t('agent.chat.log')} className="p-3 space-y-3 max-h-[28rem] min-h-[10rem] overflow-y-auto bg-bg-base">
        {!messages.length && <p className="text-sm text-text-muted">{t('agent.chat.intro')}</p>}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-primary text-text-inverted' : m.error ? 'border border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' : 'border border-border-muted bg-bg-surface text-text-base'}`}>
              <p className="whitespace-pre-line break-words">{m.text}</p>
              {m.role === 'assistant' && !m.error && (
                <p className="mt-2 text-xs text-text-muted">
                  {t(`agent.chat.origin.${m.origin ?? 'automatica'}`)}
                  {m.sources && m.sources.length > 0 && ` · ${t('agent.chat.sources')}: ${m.sources.join(', ')}`}
                </p>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start" role="status">
            <div className="rounded-2xl px-3.5 py-2.5 text-sm border border-border-muted bg-bg-surface text-text-muted flex items-center gap-3">
              <span>{t('agent.chat.thinking')}</span>
              <button type="button" className="text-primary font-semibold underline" onClick={() => abort.current?.abort()}>{t('agent.chat.stop')}</button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {shownSuggestions.length > 0 && (
        <div className="px-3 pt-3 flex flex-wrap gap-2" aria-label={t('agent.chat.suggestions')}>
          {shownSuggestions.map(q => (
            <button key={q} type="button" disabled={busy || !online} onClick={() => void send(q)} className="rounded-full border border-border-base px-3 py-1 text-xs font-semibold text-text-muted hover:text-primary hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40">{q}</button>
          ))}
        </div>
      )}

      <form className="p-3 space-y-2" onSubmit={e => { e.preventDefault(); void send(text); }}>
        {!online && <p role="status" className="text-xs font-semibold text-amber-800 dark:text-amber-200">{t('agent.chat.offline')}</p>}
        <div className="flex gap-2 items-end">
          <textarea
            value={text}
            rows={2}
            maxLength={MAX_LEN}
            aria-label={t('agent.chat.input')}
            placeholder={t('agent.chat.placeholder')}
            disabled={!online}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(text); } }}
            className="flex-1 border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-text-base bg-bg-surface p-3 shadow-sm text-sm resize-none disabled:opacity-60"
          />
          <Button type="submit" disabled={!online || busy || !text.trim()}>{t('agent.chat.send')}</Button>
        </div>
        <p className="text-xs text-text-muted flex flex-wrap justify-between gap-2">
          <span>{t('agent.chat.note')}</span>
          <span className="tabular-nums">{text.length}/{MAX_LEN}</span>
        </p>
      </form>
    </section>
  );
};
