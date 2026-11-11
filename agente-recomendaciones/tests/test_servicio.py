import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from jsonschema import validate
from agente.catalogo import leer
from agente.servicio import procesar, catalogo_web, nodo_motor, nodo_redactar
from agente.narrativa import construir_mensajes, narrativa_automatica
from agente.motor import analizar
from agente.ollama import crear_llamador

ENTRADA = leer('ejemplos/entrada_ejemplo.json')


class OllamaFalso(BaseHTTPRequestHandler):
    respuesta = None
    recibido = []

    def do_POST(self):
        cuerpo = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        OllamaFalso.recibido.append(cuerpo)
        datos = json.dumps({'message': {'role': 'assistant', 'content': OllamaFalso.respuesta}}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(datos)

    def log_message(self, *a):
        pass


class ServicioTest(unittest.TestCase):
    def test_respuesta_ok_solo_datos(self):
        cuerpo, codigo = procesar(ENTRADA)
        self.assertEqual(codigo, 200)
        self.assertEqual(set(cuerpo), {'success', 'version', 'analisis', 'narrativa', 'narrativa_origen'})
        validate(cuerpo['analisis'], leer('schemas/analisis.schema.json'))
        validate(cuerpo['narrativa'], leer('schemas/narrativa.schema.json'))
        self.assertEqual(cuerpo['narrativa_origen'], 'automatica')
        json.dumps(cuerpo)                                                    # serializable para la web
        t = cuerpo['analisis']['tramos'][2]
        self.assertEqual(t['tratamiento']['nombre_ideal'], 'Sobrecapa estructural')
        self.assertTrue(all('nombre' in d for d in t['tratamiento']['descartados']))

    def test_entrada_invalida_422(self):
        cuerpo, codigo = procesar({'version': '1.0'})
        self.assertEqual(codigo, 422)
        self.assertFalse(cuerpo['success'])
        self.assertTrue(cuerpo['errores'])

    def test_catalogo_web(self):
        c = catalogo_web()
        ids = {t['id'] for t in c['tratamientos']}
        self.assertNotIn('monitoreo', ids)
        self.assertEqual(len(c['fallas']), 20)
        b2 = next(n for n in c['niveles'] if n['id'] == 'B2')
        self.assertEqual(b2['opciones'], ['sobrecapa_estructural', 'fresado_sobrecapa_estructural', 'fdr'])
        self.assertEqual(b2['interinas'], ['mill_and_replace', 'thin_overlay'])
        self.assertTrue(all(t['costo_ejemplo'] >= 0 for t in c['tratamientos']))
        json.dumps(c)

    def test_nodos_langgraph(self):
        e = nodo_motor({'entrada': ENTRADA})
        self.assertIsNone(e['errores'])
        r = nodo_redactar({'analisis': e['analisis']})
        self.assertEqual(r['narrativa_origen'], 'automatica')
        self.assertIsNotNone(nodo_motor({'entrada': {}})['errores'])

    def test_mensaje_compacto(self):
        a = analizar(ENTRADA)
        user = construir_mensajes(a)['user']
        self.assertLess(len(user), 0.75 * len(json.dumps(a, ensure_ascii=False)))
        d = json.loads(user)
        self.assertNotIn('muestras', d['tramos'][0])
        self.assertEqual([t['id'] for t in d['tramos']], [t['id'] for t in a['tramos']])

    def test_ollama_con_servidor_falso(self):
        a = analizar(ENTRADA)
        OllamaFalso.respuesta = json.dumps(narrativa_automatica(a))
        OllamaFalso.recibido = []
        srv = HTTPServer(('127.0.0.1', 0), OllamaFalso)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            llamar = crear_llamador(modelo='prueba', url=f'http://127.0.0.1:{srv.server_port}', timeout=10)
            cuerpo, codigo = procesar(ENTRADA, llamar)
            self.assertEqual((codigo, cuerpo['narrativa_origen']), (200, 'modelo'))
            pedido = OllamaFalso.recibido[0]
            self.assertEqual((pedido['model'], pedido['format'], pedido['stream']), ('prueba', 'json', False))
            self.assertEqual([m['role'] for m in pedido['messages']], ['system', 'user'])
        finally:
            srv.shutdown()
            srv.server_close()

    def test_ollama_caido_usa_textos_automaticos(self):
        llamar = crear_llamador(url='http://127.0.0.1:9', timeout=2)          # puerto sin servidor
        cuerpo, codigo = procesar(ENTRADA, llamar)
        self.assertEqual((codigo, cuerpo['narrativa_origen']), (200, 'automatica'))


if __name__ == '__main__':
    unittest.main()
