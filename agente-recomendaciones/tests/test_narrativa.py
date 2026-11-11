import json
import unittest
from jsonschema import validate
from agente.catalogo import leer
from agente.motor import analizar
from agente.narrativa import narrativa_automatica, redactar

class NarrativaTest(unittest.TestCase):
    def setUp(self): self.a=analizar(leer('ejemplos/entrada_ejemplo.json'))
    def test_automatica(self):
        n=narrativa_automatica(self.a); validate(n,leer('schemas/narrativa.schema.json')); self.assertEqual([x['tramo_id'] for x in n['tramos']],[x['id'] for x in self.a['tramos']])
    def test_reintento(self):
        llamadas=[]
        def fallo(s,u): llamadas.append(u); return 'error'
        self.assertEqual(redactar(self.a,fallo)[1],'automatica'); self.assertEqual(len(llamadas),2)
        n=narrativa_automatica(self.a); self.assertEqual(redactar(self.a,lambda s,u:'```json\n'+json.dumps(n)+'\n```')[1],'modelo')
