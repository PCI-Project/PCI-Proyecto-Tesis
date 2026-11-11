const base = (import.meta.env.VITE_AGENT_URL || 'http://localhost:8000').replace(/\/$/, '');
export async function agentHealth(): Promise<any> {
  const signal = AbortSignal.timeout(3000);
  const response = await fetch(`${base}/`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export async function agentCatalog(): Promise<any> {
  const response = await fetch(`${base}/api/recommendations/catalogo`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export interface ChatReply { respuesta: string; origen: 'modelo' | 'automatica'; fuentes: string[]; sugerencias: string[] }
export interface ChatTurn { rol: 'usuario' | 'asistente'; texto: string }

/** Pregunta al asistente del agente sobre un análisis ya calculado. No envía las muestras crudas (el asistente no las usa). */
export async function askAgent(question: string, analysis: any, narrative: unknown, history: ChatTurn[], controller: AbortController): Promise<ChatReply> {
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const slim = { ...analysis, tramos: (analysis?.tramos ?? []).map(({ muestras: _muestras, ...rest }: any) => rest) };
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ pregunta: question, analisis: slim, narrativa: narrative, historial: history }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, body });
    return body as ChatReply;
  } finally { clearTimeout(timer); }
}

export async function requestRecommendations(input: unknown, controller: AbortController): Promise<any> {
  const timer = setTimeout(() => controller.abort(), 360000);
  try {
    const response = await fetch(`${base}/api/recommendations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: controller.signal });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, body });
    return body;
  } finally { clearTimeout(timer); }
}
