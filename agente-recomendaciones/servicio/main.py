"""Servicio HTTP del agente para la web AsphaltPCI Pro.

Devuelve solo datos (analisis + narrativa); el informe lo arma la web.
Reemplaza al agent/main.py actual del repositorio web y mantiene su ruta POST /api/recommendations.

Ejecutar desde la carpeta agente-recomendaciones:
    pip install -r servicio/requirements.txt
    uvicorn servicio.main:app --port 8000

Variables de entorno:
    AGENTE_USAR_MODELO = 1 | 0       0 = textos automáticos, sin modelo
    LLM_PROVIDER = ollama | openai | none   ollama (por defecto) = Ollama local; openai = API compatible con OpenAI (Gemini, Groq);
                                      none = sin modelo. Si el modelo no está bien configurado, el servicio arranca con textos automáticos.
    OLLAMA_MODEL, OLLAMA_URL, OLLAMA_TIMEOUT                     (ver agente/ollama.py)
    LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_JSON_MODE, ...     (ver agente/llm_openai.py)
    AGENTE_CORS = orígenes permitidos separados por coma (por defecto solo http://localhost:3500)
    AGENTE_LIMITE_POR_MIN = máximo de POST por minuto y por IP (20)
"""
import collections
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Body, FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from agente import __version__  # noqa: E402
from agente.servicio import catalogo_web, consultar, procesar  # noqa: E402

PROVEEDOR = os.getenv('LLM_PROVIDER', 'ollama').strip().lower()
USAR_MODELO = os.getenv('AGENTE_USAR_MODELO', '1') != '0' and PROVEEDOR != 'none'
llamar_modelo = llamar_texto = None
REDACTOR = 'automatico'
if USAR_MODELO:
    try:
        if PROVEEDOR == 'openai':
            from agente.llm_openai import crear_llamador, crear_llamador_texto  # noqa: E402
            REDACTOR = os.getenv('LLM_MODEL', '').strip() or 'openai'
        else:
            from agente.ollama import crear_llamador, crear_llamador_texto  # noqa: E402
            REDACTOR = os.getenv('OLLAMA_MODEL', 'llama3.2')
        llamar_modelo, llamar_texto = crear_llamador(), crear_llamador_texto()
    except Exception as e:  # configuración incompleta: el servicio sigue vivo con textos automáticos
        print(f'[agente] Sin modelo ({e}). Se usarán textos automáticos.', file=sys.stderr)
        llamar_modelo = llamar_texto = None
        REDACTOR = 'automatico'

# Sin valores por defecto abiertos: en producción se define AGENTE_CORS con el dominio del sitio.
ORIGENES = [o.strip() for o in os.getenv('AGENTE_CORS', 'http://localhost:3500').split(',') if o.strip()]
LIMITE_POR_MIN = int(os.getenv('AGENTE_LIMITE_POR_MIN', '20'))

app = FastAPI(title='Agente de recomendaciones AsphaltPCI Pro', version=__version__)

_golpes = collections.defaultdict(collections.deque)


def _ip_cliente(request):
    # Detrás del proxy de Render/Cloudflare la IP real llega en estas cabeceras; es una aproximación, no una barrera de seguridad.
    ip = request.headers.get('cf-connecting-ip') or request.headers.get('x-forwarded-for', '').split(',')[0].strip()
    return ip or (request.client.host if request.client else 'desconocida')


@app.middleware('http')
async def limitar_uso(request, call_next):
    # Protege la cuota del modelo: máximo AGENTE_LIMITE_POR_MIN consultas POST por minuto y por IP (0 = sin límite).
    if request.method == 'POST' and LIMITE_POR_MIN > 0:
        ahora, cola = time.time(), _golpes[_ip_cliente(request)]
        while cola and ahora - cola[0] > 60:
            cola.popleft()
        if len(cola) >= LIMITE_POR_MIN:
            return JSONResponse({'success': False, 'errores': ['Demasiadas consultas. Intenta de nuevo en un minuto.']}, status_code=429)
        cola.append(ahora)
        if len(_golpes) > 5000:  # evita crecer sin límite
            for clave in [k for k, v in _golpes.items() if not v or ahora - v[-1] > 60]:
                del _golpes[clave]
    return await call_next(request)


@app.middleware('http')
async def red_privada(request, call_next):
    # Chrome pide este encabezado cuando una página pública (https) llama a http://localhost.
    respuesta = await call_next(request)
    respuesta.headers['Access-Control-Allow-Private-Network'] = 'true'
    return respuesta


# CORS se registra al final: el último middleware es el más externo y así también las respuestas 429 llevan sus cabeceras.
app.add_middleware(CORSMiddleware, allow_origins=ORIGENES, allow_methods=['GET', 'POST', 'OPTIONS'], allow_headers=['*'])


@app.get('/')
def estado():
    return {'status': 'online', 'version': __version__, 'redactor': REDACTOR}


@app.get('/api/recommendations/catalogo')
def catalogo():
    return catalogo_web()


@app.post('/api/recommendations')
def recomendar(entrada: dict = Body(...)):
    # Función síncrona: FastAPI la corre en un hilo aparte mientras el modelo redacta.
    cuerpo, codigo = procesar(entrada, llamar_modelo)
    return JSONResponse(cuerpo, status_code=codigo)


@app.post('/api/chat')
def chat(cuerpo: dict = Body(...)):
    # Asistente de consulta: responde sobre el análisis ya calculado, sin recalcular nada.
    respuesta, codigo = consultar(cuerpo, llamar_texto)
    return JSONResponse(respuesta, status_code=codigo)
