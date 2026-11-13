"""Adaptador del redactor a Ollama (el modelo que ya usa el agente del repositorio web). Solo biblioteca estándar."""
import json
import os
import urllib.request


def crear_llamador(modelo=None, url=None, timeout=None):
    """Devuelve llamar_modelo(system, user) -> str para narrativa.redactar().

    Variables de entorno: OLLAMA_MODEL (llama3.2), OLLAMA_URL (http://localhost:11434), OLLAMA_TIMEOUT (180 s).
    Usa el modo JSON de Ollama para que la respuesta sea un objeto JSON.
    """
    modelo = modelo or os.getenv('OLLAMA_MODEL', 'llama3.2')
    url = (url or os.getenv('OLLAMA_URL', 'http://localhost:11434')).rstrip('/')
    timeout = float(timeout or os.getenv('OLLAMA_TIMEOUT', '180'))

    def llamar(system, user):
        cuerpo = json.dumps({
            'model': modelo,
            'stream': False,
            'format': 'json',
            'options': {'temperature': 0.2, 'num_ctx': 16384},
            'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
        }).encode('utf-8')
        req = urllib.request.Request(url + '/api/chat', data=cuerpo, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))['message']['content']

    return llamar


def crear_llamador_texto(modelo=None, url=None, timeout=None):
    """Devuelve llamar(system, mensajes) -> str para el asistente de consulta: respuesta en texto plano, con historial."""
    modelo = modelo or os.getenv('OLLAMA_MODEL', 'llama3.2')
    url = (url or os.getenv('OLLAMA_URL', 'http://localhost:11434')).rstrip('/')
    timeout = float(timeout or os.getenv('OLLAMA_CHAT_TIMEOUT', '60'))

    def llamar(system, mensajes):
        cuerpo = json.dumps({
            'model': modelo,
            'stream': False,
            'options': {'temperature': 0.2, 'num_ctx': 8192},
            'messages': [{'role': 'system', 'content': system}] + list(mensajes),
        }).encode('utf-8')
        req = urllib.request.Request(url + '/api/chat', data=cuerpo, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))['message']['content']

    return llamar
