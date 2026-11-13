import unittest
from datetime import datetime, timezone
from agente.catalogo import leer
from agente.motor import analizar, beneficio_curva
from test_reglas import tramo, entrada, PALIATIVOS

AHORA = datetime(2026, 11, 3, tzinfo=timezone.utc)
P = leer('catalogo/parametros_defecto.json')


def numerico(pci, pcid, edad, p=P, n=20000):
    """Área entre curvas por encima del mínimo, integrada paso a paso."""
    d = beneficio_curva(pci, pcid, edad, p)
    a, b, L = d['alfa'], d['beta'], d['pci_minimo']
    curva = lambda t: max(0.0, 100 - a * t ** b - L)
    t0, t1, T = d['edad_efectiva_antes'], d['edad_efectiva_despues'], d['anios_hasta_pci_minimo'] + 1
    h = T / n
    return sum((curva(t1 + (i + .5) * h) - curva(t0 + (i + .5) * h)) * h for i in range(n))


class BeneficioTest(unittest.TestCase):
    def test_formula_cerrada_igual_a_integral(self):
        for pci, pcid, edad in [(80, 85, 0), (62, 95, 10), (47, 71.5, 14), (20, 100, 23), (99, 100, 1)]:
            with self.subTest(pci=pci, pcid=pcid):
                self.assertAlmostEqual(beneficio_curva(pci, pcid, edad, P)['area_pci_anio_m2'], numerico(pci, pcid, edad), delta=0.5)

    def test_bajo_el_minimo_solo_cuenta_lo_recuperado(self):
        d = beneficio_curva(20, 100, 0, P)                                   # alfa = 60 / 20^1.5
        self.assertEqual(d['edad_efectiva_despues'], 0)
        self.assertAlmostEqual(d['area_pci_anio_m2'], 60 * 20 - d['alfa'] / 2.5 * 20 ** 2.5, delta=0.01)   # = 720
        self.assertEqual(beneficio_curva(30, 35, 0, P)['area_pci_anio_m2'], 0)   # mejora que no pasa del mínimo

    def test_alfa_desde_la_edad_y_acotado(self):
        self.assertEqual(beneficio_curva(70, 80, 10, P)['origen_alfa'], 'edad')
        self.assertAlmostEqual(beneficio_curva(70, 80, 10, P)['alfa'], 30 / 10 ** 1.5, places=4)
        self.assertEqual(beneficio_curva(40, 80, 1, P)['origen_alfa'], 'edad_acotada')   # 60 puntos en 1 año: fuera de rango
        self.assertEqual(beneficio_curva(70, 80, 0, P)['origen_alfa'], 'defecto')

    def test_preservacion_supera_a_reconstruccion(self):
        # Antes: reconstruir PCI 20 daba B/C 16.8 y el rejuvenecedor en PCI 80, 5.7.
        e = entrada([tramo('X', 20, []), tramo('Y', 80, [('19.2', 'M', 600)])],
                    ['reconstruccion', 'rejuvenecedor', 'limpieza_superficie'])
        bc = {t['id']: t['relacion_bc'] for t in analizar(e, AHORA)['tramos']}
        self.assertGreater(bc['Y'], 2 * bc['X'])

    def test_detalle_en_el_analisis(self):
        a = analizar(leer('ejemplos/entrada_ejemplo.json'), AHORA)
        for t in a['tramos']:
            d = t['beneficio_detalle']
            self.assertGreaterEqual(d['anios_recuperados'], 0)
            esperado = round(d['area_pci_anio_m2'] * t['area_m2'] * P['peso_trafico'][t['contexto_usado']['clase_trafico']], 2)
            self.assertAlmostEqual(t['beneficio'], esperado, delta=0.05 * t['area_m2'])


if __name__ == '__main__':
    unittest.main()
