import unittest
from pathlib import Path
from agente.catalogo import leer
from agente.motor import analizar
from agente.narrativa import narrativa_automatica
from agente.informe import generar_html

class InformeTest(unittest.TestCase):
    def test_html(self):
        a=analizar(leer('ejemplos/entrada_ejemplo.json'))
        path=Path('tests/_informe_prueba.html')
        try:
            h=generar_html(a,narrativa_automatica(a),path).read_text(encoding='utf-8')
            for t in a['tramos']: self.assertIn(t['nombre'],h)
            self.assertIn('Priorización y presupuesto',h); self.assertIn('Revisión y firma',h); self.assertNotIn('{{',h)
        finally:
            if path.exists(): path.unlink()
