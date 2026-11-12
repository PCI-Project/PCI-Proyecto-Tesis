import unittest

from agente.asistente import AYUDA, estructurar, responder
from agente.catalogo import leer
from agente.motor import analizar
from agente.narrativa import narrativa_automatica


class EstructuraRespuestaTest(unittest.TestCase):
    def setUp(self):
        self.a = analizar(leer('ejemplos/entrada_ejemplo.json'))
        self.n = narrativa_automatica(self.a)

    def datos(self, r):
        return {d['etiqueta']: d['valor'] for d in r['datos']}

    def test_pregunta_por_un_tramo(self):
        r = responder('¿Por qué Calle 2da recibe ese tratamiento?', self.a, self.n)
        self.assertIn('Calle 2da', r['resumen'])
        self.assertEqual(self.datos(r)['PCI'], '33.5')
        self.assertTrue({'Tratamiento', 'Costo', 'Prioridad'} <= set(self.datos(r)))
        self.assertEqual(r['detalle'], r['respuesta'])  # el detalle es la ficha completa
        self.assertLess(len(r['resumen']), len(r['respuesta']))

    def test_pregunta_de_financiacion(self):
        r = responder('¿Qué se financia y qué no?', self.a, self.n)
        self.assertEqual(set(self.datos(r)), {'Financiado', 'Faltante', 'Sin asignar'})
        self.assertIn('financian', r['resumen'])

    def test_pregunta_de_la_red(self):
        r = responder('¿Cómo está la red en general?', self.a, self.n)
        self.assertIn('PCI de la red', self.datos(r))
        self.assertIn('PCI ponderado', r['resumen'])

    def test_sin_forma_clara_usa_la_primera_frase(self):
        r = responder('¿Qué significa piel de cocodrilo?', self.a, self.n)
        self.assertEqual(r['datos'], [])
        self.assertTrue(r['resumen'])
        self.assertIn(r['resumen'][:30], r['respuesta'])

    def test_ayuda_no_tiene_detalle(self):
        r = responder('xyzzy', self.a, self.n)
        self.assertEqual((r['respuesta'], r['detalle'], r['datos']), (AYUDA, None, []))

    def test_respuesta_del_modelo_se_divide_en_frase_y_detalle(self):
        texto = 'Calle 2da necesita reconstrucción. Su PCI es 33.5 y hay daño estructural.\nSe revisa el drenaje.'
        e = estructurar(texto)
        self.assertEqual(e['resumen'], 'Calle 2da necesita reconstrucción.')
        self.assertEqual(e['detalle'], 'Su PCI es 33.5 y hay daño estructural.\nSe revisa el drenaje.')
        self.assertIsNone(estructurar('Una sola frase.')['detalle'])

    def test_modelo_conserva_las_cifras_del_analisis(self):
        modelo = lambda sistema, mensajes: 'Calle 2da recibe reconstrucción. Su PCI es 33.5.'
        r = responder('¿Por qué Calle 2da recibe ese tratamiento?', self.a, self.n, None, modelo)
        self.assertEqual(r['origen'], 'modelo')
        self.assertEqual(r['resumen'], 'Calle 2da recibe reconstrucción.')
        self.assertEqual(self.datos(r)['PCI'], '33.5')


if __name__ == '__main__':
    unittest.main()
