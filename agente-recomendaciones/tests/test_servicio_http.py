import importlib
import os
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from agente.catalogo import leer

ENTRADA = leer('ejemplos/entrada_ejemplo.json')
BASE = {'LLM_PROVIDER': 'none', 'AGENTE_CORS': 'https://asphaltpcipro.company', 'AGENTE_LIMITE_POR_MIN': '3'}


def cargar(**env):
    """Importa servicio.main de nuevo con el entorno indicado (la configuración se lee al importar)."""
    with mock.patch.dict(os.environ, {**BASE, **env}, clear=False):
        import servicio.main as m
        m = importlib.reload(m)
        m._golpes.clear()
        return m


class ServicioHttpTest(unittest.TestCase):
    def test_estado_sin_modelo(self):
        c = TestClient(cargar().app)
        r = c.get('/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()['status'], r.json()['redactor']), ('online', 'automatico'))

    def test_recomendaciones_automaticas(self):
        c = TestClient(cargar().app)
        r = c.post('/api/recommendations', json=ENTRADA)
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()['success'], r.json()['narrativa_origen']), (True, 'automatica'))

    def test_entrada_invalida_da_422(self):
        r = TestClient(cargar().app).post('/api/recommendations', json={})
        self.assertEqual(r.status_code, 422)
        self.assertFalse(r.json()['success'])

    def test_configuracion_incompleta_no_tumba_el_servicio(self):
        m = cargar(LLM_PROVIDER='openai', LLM_BASE_URL='', LLM_API_KEY='', LLM_MODEL='')
        c = TestClient(m.app)
        self.assertEqual(c.get('/').json()['redactor'], 'automatico')
        r = c.post('/api/recommendations', json=ENTRADA)
        self.assertEqual((r.status_code, r.json()['narrativa_origen']), (200, 'automatica'))

    def test_proveedor_openai_configurado(self):
        m = cargar(LLM_PROVIDER='openai', LLM_BASE_URL='http://127.0.0.1:9/v1', LLM_API_KEY='k', LLM_MODEL='gemini-x')
        self.assertEqual(TestClient(m.app).get('/').json()['redactor'], 'gemini-x')

    def test_limite_por_minuto_devuelve_429_con_cors(self):
        c = TestClient(cargar().app)
        cab = {'Origin': 'https://asphaltpcipro.company'}
        for _ in range(3):
            self.assertEqual(c.post('/api/chat', json={}, headers=cab).status_code, 422)
        r = c.post('/api/chat', json={}, headers=cab)
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.headers.get('access-control-allow-origin'), 'https://asphaltpcipro.company')
        self.assertFalse(r.json()['success'])

    def test_el_limite_es_por_ip(self):
        c = TestClient(cargar().app)
        for _ in range(3):
            c.post('/api/chat', json={}, headers={'X-Forwarded-For': '1.1.1.1'})
        self.assertEqual(c.post('/api/chat', json={}, headers={'X-Forwarded-For': '1.1.1.1'}).status_code, 429)
        self.assertEqual(c.post('/api/chat', json={}, headers={'X-Forwarded-For': '2.2.2.2'}).status_code, 422)

    def test_cors_cerrado(self):
        c = TestClient(cargar().app)
        ok = c.get('/', headers={'Origin': 'https://asphaltpcipro.company'})
        otro = c.get('/', headers={'Origin': 'https://otro.com'})
        self.assertEqual(ok.headers.get('access-control-allow-origin'), 'https://asphaltpcipro.company')
        self.assertIsNone(otro.headers.get('access-control-allow-origin'))
