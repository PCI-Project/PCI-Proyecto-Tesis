import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest import mock

from agente.asistente import responder
from agente.catalogo import leer
from agente.llm_openai import crear_llamador, crear_llamador_texto
from agente.motor import analizar
from agente.narrativa import narrativa_automatica, redactar

PETICIONES = []
RESPUESTA = {'texto': '{"ok": true}', 'estado': 200}


class ApiFalsa(BaseHTTPRequestHandler):
    def do_POST(self):
        cuerpo = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        PETICIONES.append({'ruta': self.path, 'auth': self.headers.get('Authorization'), 'cuerpo': cuerpo})
        self.send_response(RESPUESTA['estado'])
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'choices': [{'message': {'content': RESPUESTA['texto']}}]}).encode())

    def log_message(self, *args):
        pass


class LlmOpenAiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = HTTPServer(('127.0.0.1', 0), ApiFalsa)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.srv.server_port}/v1beta/openai/'

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def setUp(self):
        PETICIONES.clear()
        RESPUESTA.update(texto='{"ok": true}', estado=200)
        self.env = mock.patch.dict(os.environ, {'LLM_BASE_URL': self.base, 'LLM_API_KEY': 'clave-secreta', 'LLM_MODEL': 'modelo-x'}, clear=False)
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def test_peticion_y_cabeceras(self):
        self.assertEqual(crear_llamador()('SIS', 'USR'), '{"ok": true}')
        p = PETICIONES[0]
        self.assertEqual(p['ruta'], '/v1beta/openai/chat/completions')  # no duplica la barra final de la base
        self.assertEqual(p['auth'], 'Bearer clave-secreta')
        self.assertEqual(p['cuerpo']['model'], 'modelo-x')
        self.assertEqual(p['cuerpo']['messages'], [{'role': 'system', 'content': 'SIS'}, {'role': 'user', 'content': 'USR'}])
        self.assertNotIn('response_format', p['cuerpo'])  # Gemini: modo JSON apagado por defecto
        self.assertNotIn('temperature', p['cuerpo'])

    def test_modo_json_solo_al_redactar(self):
        with mock.patch.dict(os.environ, {'LLM_JSON_MODE': '1', 'LLM_REASONING_EFFORT': 'low', 'LLM_TEMPERATURE': '0.2'}):
            crear_llamador()('S', 'U')
            crear_llamador_texto()('S', [{'role': 'user', 'content': 'hola'}])
        redactor, chat = PETICIONES
        self.assertEqual(redactor['cuerpo']['response_format'], {'type': 'json_object'})
        self.assertEqual(redactor['cuerpo']['reasoning_effort'], 'low')
        self.assertEqual(redactor['cuerpo']['temperature'], 0.2)
        self.assertNotIn('response_format', chat['cuerpo'])  # el chat responde en texto plano
        self.assertEqual(chat['cuerpo']['messages'][0], {'role': 'system', 'content': 'S'})

    def test_falta_configuracion(self):
        with mock.patch.dict(os.environ, {'LLM_API_KEY': ''}):
            with self.assertRaises(RuntimeError) as e:
                crear_llamador()
            self.assertIn('LLM_API_KEY', str(e.exception))

    def test_si_el_modelo_falla_hay_textos_automaticos(self):
        a = analizar(leer('ejemplos/entrada_ejemplo.json'))
        RESPUESTA.update(estado=500)
        self.assertEqual(redactar(a, crear_llamador())[1], 'automatica')
        RESPUESTA.update(estado=200, texto='no es json')
        self.assertEqual(redactar(a, crear_llamador())[1], 'automatica')
        RESPUESTA.update(estado=429)
        r = responder('Que tratamiento recibe el primer tramo?', a, narrativa_automatica(a), None, crear_llamador_texto())
        self.assertEqual(r['origen'], 'automatica')

    def test_narrativa_valida_del_modelo(self):
        a = analizar(leer('ejemplos/entrada_ejemplo.json'))
        RESPUESTA.update(texto=json.dumps(narrativa_automatica(a)))
        self.assertEqual(redactar(a, crear_llamador())[1], 'modelo')
