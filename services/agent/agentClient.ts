const base = (import.meta.env.VITE_AGENT_URL || 'https://pci-agente.onrender.com').replace(/\/$/, '');
// Un servicio gratuito dormido tarda hasta ~1 minuto en despertar: se espera ese tiempo (y se reintenta una vez)
// antes de darlo por caído. Mientras tanto el panel muestra "Comprobando agente…".
const WAKE_TIMEOUT_MS = 65000;
const WAKE_RETRY_DELAY_MS = 4000;

export async function agentHealth(): Promise<any> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${base}/`, { signal: AbortSignal.timeout(WAKE_TIMEOUT_MS) });
      if (response.ok) return response.json();
      last = new Error(`HTTP ${response.status}`);
    } catch (error) {
      last = error;
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, WAKE_RETRY_DELAY_MS));
  }
  throw last;
}
export async function agentCatalog(): Promise<any> {
  const response = await fetch(`${base}/api/recommendations/catalogo`, { signal: AbortSignal.timeout(WAKE_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export interface ChatReply {
  respuesta: string; origen: 'modelo' | 'automatica'; fuentes: string[]; sugerencias: string[];
  /** Servicio nuevo: frase corta, cifras clave y detalle plegable. Un servicio antiguo solo manda `respuesta`. */
  resumen?: string; datos?: { etiqueta: string; valor: string }[]; detalle?: string | null;
}
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
