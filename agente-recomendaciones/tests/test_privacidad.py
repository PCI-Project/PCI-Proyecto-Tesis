import json
import unittest

from agente.catalogo import leer
from agente.motor import analizar
from agente.narrativa import construir_mensajes, resumen_para_modelo


class PrivacidadTest(unittest.TestCase):
    def setUp(self):
        self.a = analizar(leer('ejemplos/entrada_ejemplo.json'))

    def test_el_mensaje_al_modelo_no_identifica_al_proyecto(self):
        p = self.a['proyecto']
        texto = json.dumps(construir_mensajes(self.a), ensure_ascii=False)
        for campo in ('nombre', 'inspector', 'entidad', 'descripcion', 'ubicacion'):
            if p.get(campo):
                self.assertNotIn(str(p[campo]), texto, campo)
        self.assertNotIn(p['id'], texto)

    def test_se_conserva_lo_que_el_redactor_necesita(self):
        r = resumen_para_modelo(self.a)
        self.assertEqual(r['proyecto'].get('fecha_inspeccion'), self.a['proyecto']['fecha_inspeccion'])
        self.assertEqual([t['id'] for t in r['tramos']], [t['id'] for t in self.a['tramos']])
        self.assertEqual([t['nombre'] for t in r['tramos']], [t['nombre'] for t in self.a['tramos']])
        self.assertTrue(all('muestras' not in t and 'ubicacion' not in t for t in r['tramos']))

    def test_no_modifica_el_analisis_original(self):
        antes = json.dumps(self.a, sort_keys=True)
        resumen_para_modelo(self.a)
        self.assertEqual(json.dumps(self.a, sort_keys=True), antes)
