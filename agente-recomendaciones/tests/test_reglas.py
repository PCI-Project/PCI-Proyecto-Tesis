import unittest
from datetime import datetime, timezone
from pathlib import Path
from jsonschema import validate
from agente.catalogo import leer
from agente.motor import analizar
from agente.narrativa import narrativa_automatica
from agente.informe import generar_html

AHORA = datetime(2026, 11, 3, tzinfo=timezone.utc)
PALIATIVOS = ['sellado_grietas', 'parcheo_profundidad_parcial', 'parcheo_profundidad_total', 'parcheo_superficial', 'fresado_local',
              'arenado_exudacion', 'relleno_roderas', 'nivelacion_hombros', 'conformacion_hombros', 'limpieza_superficie', 'riego_liga']


def tramo(id, pci, fallas, area=1000, muestra=1000, ctx=None):
    return dict(id=id, nombre=f'Tramo {id}', longitud_m=area / 10, ancho_m=10, area_m2=area, pci=pci,
                contexto=ctx or dict(tipo_via='urbana', altura_bordillo_cm=10, esal_millones=0.5),
                muestras=[dict(id=1, area_m2=muestra, fallas=[dict(tipo=t, severidad=s, cantidad=q) for t, s, q in fallas])])


def entrada(tramos, disponibles, presupuesto=None, modo='costo_beneficio'):
    return dict(version='1.0', proyecto=dict(id='p', nombre='Prueba', inspector='X', fecha_inspeccion='2026-10-01'),
                calibracion=dict(tratamientos_disponibles=disponibles, presupuesto=presupuesto, modo_priorizacion=modo), tramos=tramos)


def uno(e):
    return analizar(e, AHORA)['tramos'][0]


class ReglasTest(unittest.TestCase):
    def test_chip_seal_descartado_por_transito_alto(self):
        t = tramo('T', 78, [('12', 'U', 400)], ctx=dict(tipo_via='urbana', altura_bordillo_cm=10, clase_trafico='alto'))
        r = uno(entrada([t], ['chip_seal', 'micropavimento']))
        self.assertEqual(r['deterioro_dominante'], 'friccion')
        self.assertEqual(r['tratamiento']['seleccionado'], 'micropavimento')
        self.assertIn(('chip_seal', 'tránsito superior al permitido'), [(d['id'], d['razon']) for d in r['tratamiento']['descartados']])

    def test_fog_seal_y_rejuvenecedor_descartados_por_exudacion(self):
        t = tramo('T', 90, [('19.2', 'M', 500), ('2', 'M', 5)])
        r = uno(entrada([t], ['fog_seal', 'rejuvenecedor', 'micropavimento'] + PALIATIVOS))
        razones = {d['id']: d['razon'] for d in r['tratamiento']['descartados']}
        self.assertEqual(razones['rejuvenecedor'], 'falla incompatible con el tratamiento')
        self.assertEqual(razones['fog_seal'], 'falla incompatible con el tratamiento')
        self.assertEqual(r['tratamiento']['seleccionado'], 'micropavimento')
        self.assertIn('EXUDACION', [a['codigo'] for a in r['alertas']])

    def test_conversiones_de_cantidades(self):
        fallas = [('3', 'L', 10), ('10', 'H', 10), ('7', 'H', 10), ('4', 'M', 5), ('13', 'L', 2), ('13', 'H', 1), ('6', 'M', 4)]
        r = uno(entrada([tramo('T', 60, fallas)], ['thin_overlay'] + PALIATIVOS))
        self.assertEqual(r['tratamiento']['seleccionado'], 'thin_overlay')
        q = {p['actividad']: p['cantidad'] for p in r['trabajos_previos']}
        self.assertAlmostEqual(q['sellado_grietas'], 13.3)                    # 10 m² × 1.33 m/m²
        self.assertAlmostEqual(q['parcheo_profundidad_parcial'], 9.6)         # 10 m × 0.3 × 1.2 + 10 m × 0.5 × 1.2
        self.assertAlmostEqual(q['fresado_local'], 5.0)                       # 5 m × 1.0 m
        self.assertAlmostEqual(q['parcheo_profundidad_total'], 0.9)           # 2 × 0.15 + 1 × 0.6
        self.assertAlmostEqual(q['parcheo_superficial'], 4.8)                 # 4 m² × 1.2
        seg = {p['actividad']: p['seguridad'] for p in r['trabajos_previos']}
        self.assertTrue(seg['parcheo_profundidad_total'])
        self.assertNotIn('m2', ' '.join(p['motivo'] for p in r['trabajos_previos']))

    def test_sellado_global_no_se_cuenta_dos_veces(self):
        r = uno(entrada([tramo('T', 80, [('10', 'L', 50)])], ['sellado_grietas']))
        self.assertEqual(r['tratamiento']['seleccionado'], 'sellado_grietas')
        self.assertNotIn('sellado_grietas', [p['actividad'] for p in r['trabajos_previos']])
        self.assertEqual(r['partidas_tratamiento'][0]['cantidad'], 50)

    def test_sellado_descartado_sin_grietas(self):
        r = uno(entrada([tramo('T', 80, [])], ['sellado_grietas']))
        self.assertEqual(r['tratamiento']['seleccionado'], 'monitoreo')
        self.assertEqual(r['costos']['total'], 0)

    def test_interina_cuenta_media_mejora(self):
        r = uno(entrada([tramo('T', 48, [('1', 'M', 20)])], ['mill_and_replace'] + PALIATIVOS))
        self.assertTrue(r['tratamiento']['interino'])
        self.assertEqual(r['tratamiento']['pci_despues'], 71.5)               # 48 + 0.5 × (95 − 48)
        self.assertTrue(any('interina' in s for s in r['supuestos']))
        self.assertIn('SOLUCION_INTERINA', [a['codigo'] for a in r['alertas']])

    def test_modos_de_priorizacion_dan_resultados_distintos(self):
        # X: reconstrucción a 200/m² → 220 000; B/C = 0.5 × 80 × 20 × 1000 × 1.5 / 220 000 = 5.45
        # Y: rejuvenecedor + limpieza → 1 980;   B/C = 0.5 × 5 × 3 × 1000 × 1.5 / 1 980 = 5.68
        malo = tramo('X', 20, [])
        bueno = tramo('Y', 80, [('19.2', 'M', 600)])
        disp = ['reconstruccion', 'rejuvenecedor', 'limpieza_superficie']
        def con_costo(modo):
            e = entrada([malo, bueno], disp, 221000, modo)
            e['calibracion']['costos_unitarios'] = {'reconstruccion': {'valor': 200, 'unidad': 'm2'}}
            return analizar(e, AHORA)
        cb, pp = con_costo('costo_beneficio'), con_costo('peor_primero')
        estado = lambda a: {t['id']: t['prioridad']['estado'] for t in a['tramos']}
        self.assertEqual(estado(cb), {'X': 'diferido', 'Y': 'financiado'})
        self.assertEqual(estado(pp), {'X': 'financiado', 'Y': 'diferido'})
        self.assertEqual(cb['red']['comparacion_modos']['tramos_financiados'], ['X'])
        self.assertEqual(cb['red']['comparacion_modos']['modo'], 'peor_primero')

    def test_seguridad_primero(self):
        t = tramo('T', 30, [('13', 'H', 10), ('1', 'H', 100)])               # reconstrucción con baches: queda solo seguridad
        a = analizar(entrada([t], ['reconstruccion'] + PALIATIVOS, 20000), AHORA)
        r = a['tramos'][0]
        self.assertEqual(r['trabajos_previos'], [])
        self.assertEqual(r['prioridad']['estado'], 'solo_seguridad')
        self.assertGreater(r['prioridad']['costo_interino_si_diferido'], 0)
        self.assertEqual(a['red']['costo_financiado'], r['prioridad']['costo_interino_si_diferido'])
        self.assertNotIn('PRESUPUESTO_INSUFICIENTE_SEGURIDAD', [x['codigo'] for x in a['alertas_globales']])

    def test_rural_sin_bordillo_y_transito_desconocido(self):
        t = tramo('T', 62, [('10', 'M', 30)], ctx=dict(tipo_via='rural'))
        r = uno(entrada([t], ['thin_overlay'] + PALIATIVOS))
        self.assertEqual(r['tratamiento']['seleccionado'], 'thin_overlay')
        self.assertEqual(r['contexto_usado']['clase_trafico'], 'desconocido')
        self.assertEqual(r['contexto_usado']['asumidos'], ['clase_trafico'])
        hombros = next(p for p in r['partidas_tratamiento'] if p['actividad'] == 'conformacion_hombros')
        self.assertEqual(hombros['cantidad'], 200)                            # 2 × 100 m

    def test_costos_calibrados(self):
        e = entrada([tramo('T', 60, [])], ['thin_overlay'] + PALIATIVOS)
        e['calibracion']['costos_unitarios'] = {'thin_overlay': {'valor': 10, 'unidad': 'm2', 'fuente': 'Empresa'}}
        a = analizar(e, AHORA)
        p = a['tramos'][0]['partidas_tratamiento'][0]
        self.assertEqual((p['costo_unitario'], p['origen_costo']), (10, 'calibrado'))
        self.assertEqual(a['calibracion_usada']['costos']['riego_liga']['origen'], 'ejemplo')

    def test_informe_completo_del_ejemplo(self):
        a = analizar(leer('ejemplos/entrada_ejemplo.json'), AHORA)
        validate(a, leer('schemas/analisis.schema.json'))
        n = narrativa_automatica(a)
        validate(n, leer('schemas/narrativa.schema.json'))
        ruta = Path('tests/_informe_reglas.html')
        try:
            h = generar_html(a, n, ruta).read_text(encoding='utf-8')
            for texto in ['Resumen ejecutivo', 'Alcance y metodología', 'Datos de entrada y calibración', 'Priorización y presupuesto',
                          'Comparación de modos', 'Revisión y firma', 'Idoneidad JTIA', 'Anexo A', 'Anexo B', 'Anexo C', 'Solución interina']:
                self.assertIn(texto, h)
            for t in a['tramos']:
                self.assertIn(t['nombre'], h)
            self.assertNotIn('{{', h)
        finally:
            if ruta.exists():
                ruta.unlink()


if __name__ == '__main__':
    unittest.main()
