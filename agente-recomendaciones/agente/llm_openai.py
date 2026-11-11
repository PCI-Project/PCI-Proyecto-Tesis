"""Adaptador del redactor y del asistente a cualquier API compatible con OpenAI (Gemini, Groq, ...). Solo biblioteca estándar.

Variables de entorno:
    LLM_BASE_URL          p. ej. https://generativelanguage.googleapis.com/v1beta/openai  |  https://api.groq.com/openai/v1
    LLM_API_KEY           secreto (solo en el servidor, nunca en el front)
    LLM_MODEL             p. ej. gemini-3.8-flash  |  openai/gpt-oss-120b
    LLM_JSON_MODE         1 = enviar response_format json_object (Groq); 0 = no enviarlo (Gemini). Por defecto 0
    LLM_REASONING_EFFORT  low | medium | high (opcional; baja la latencia en modelos con razonamiento)
    LLM_TEMPERATURE       opcional; si no se define se usa la del proveedor
    LLM_TIMEOUT           segundos por intento al redactar (120)
    LLM_CHAT_TIMEOUT      segundos por respuesta del chat (60)

Si el modelo falla (red, llave, cuota, JSON inválido), narrativa.redactar y asistente.responder usan los textos automáticos.
"""
import json
import os
import urllib.request


def _config():
    """Lee las variables de entorno. Lanza RuntimeError con un mensaje claro si falta alguna obligatoria."""
    faltan = [v for v in ('LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL') if not os.getenv(v, '').strip()]
    if faltan:
        raise RuntimeError('Falta configurar el modelo: ' + ', '.join(faltan) + ' (o usa LLM_PROVIDER=none para textos automáticos).')
    return {
        'base': os.environ['LLM_BASE_URL'].strip().rstrip('/'),
        'key': os.environ['LLM_API_KEY'].strip(),
        'model': os.environ['LLM_MODEL'].strip(),
        'json_mode': os.getenv('LLM_JSON_MODE', '0').strip() == '1',
        'effort': os.getenv('LLM_REASONING_EFFORT', '').strip(),
        'temperature': os.getenv('LLM_TEMPERATURE', '').strip(),
    }


def _chat(cfg, mensajes, timeout, pedir_json):
    cuerpo = {'model': cfg['model'], 'messages': mensajes}
    if cfg['temperature']:
        cuerpo['temperature'] = float(cfg['temperature'])
    if cfg['effort']:
        cuerpo['reasoning_effort'] = cfg['effort']
    if pedir_json and cfg['json_mode']:
        cuerpo['response_format'] = {'type': 'json_object'}
    req = urllib.request.Request(
        cfg['base'] + '/chat/completions',
        data=json.dumps(cuerpo).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg['key']},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        respuesta = json.loads(r.read().decode('utf-8'))
    return respuesta['choices'][0]['message']['content'] or ''


def crear_llamador(timeout=None):
    """Devuelve llamar(system, user) -> str para narrativa.redactar()."""
    cfg = _config()
    espera = float(timeout or os.getenv('LLM_TIMEOUT', '120'))

    def llamar(system, user):
        return _chat(cfg, [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}], espera, True)

    return llamar


def crear_llamador_texto(timeout=None):
    """Devuelve llamar(system, mensajes) -> str para el asistente de consulta (texto plano, con historial)."""
    cfg = _config()
    espera = float(timeout or os.getenv('LLM_CHAT_TIMEOUT', '60'))

    def llamar(system, mensajes):
        return _chat(cfg, [{'role': 'system', 'content': system}] + list(mensajes), espera, False)

    return llamar
