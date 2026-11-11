import copy
import unittest
from datetime import datetime, timezone
from jsonschema import validate
from agente.motor import analizar, EntradaInvalida
from agente.catalogo import leer

class MotorTest(unittest.TestCase):
    def setUp(self):
        self.e=leer('ejemplos/entrada_ejemplo.json'); self.e['tramos']=self.e['tramos'][:1]
        self.ahora=datetime(2026,11,3,tzinfo=timezone.utc)
    def ejecutar(self): return analizar(self.e,self.ahora)['tramos'][0]
    def test_bordes(self):
        for pci,nivel in [(100,'A1'),(85,'A1'),(84.99,'A2'),(71,'A2'),(70.99,'B1'),(56,'B1'),(55.99,'B2'),(41,'B2'),(40.99,'C1'),(26,'C1'),(25.99,'C2'),(0,'C2')]:
            with self.subTest(pci=pci):
                self.e['tramos'][0]['pci']=pci; self.assertEqual(self.ejecutar()['nivel_id'],nivel)
        self.e['calibracion']['umbrales_pci']={'A1':90}; self.e['tramos'][0]['pci']=88; self.assertEqual(self.ejecutar()['nivel_id'],'A2')
    def test_bordillo(self):
        ctx=self.e['tramos'][0]['contexto']
        for altura,ideal in [(7.6,'thin_overlay'),(7.59,'mill_and_replace'),(None,'mill_and_replace')]:
            ctx['altura_bordillo_cm']=altura; resultado=self.ejecutar(); self.assertEqual(resultado['tratamiento']['ideal'],ideal)
            if altura is None: self.assertTrue(resultado['supuestos'])
        ctx['tipo_via']='rural'; r=self.ejecutar(); self.assertEqual(r['tratamiento']['ideal'],'thin_overlay'); self.assertIn('conformacion_hombros',[x['actividad'] for x in r['partidas_tratamiento']])
    def test_disponibilidad(self):
        ctx=self.e['tramos'][0]['contexto']; ctx['altura_bordillo_cm']=8
        self.e['calibracion']['tratamientos_disponibles']=['mill_and_replace']; r=self.ejecutar(); self.assertEqual(r['tratamiento']['seleccionado'],'mill_and_replace'); self.assertTrue(r['tratamiento']['descartados'])
        self.e['calibracion']['tratamientos_disponibles']=['micropavimento']; r=self.ejecutar(); self.assertTrue(r['tratamiento']['interino'])
        self.e['calibracion']['tratamientos_disponibles']=['reconstruccion']; r=self.ejecutar(); self.assertIsNone(r['tratamiento']['seleccionado']); self.assertIn('SIN_SOLUCION_DISPONIBLE',[a['codigo'] for a in r['alertas']])
    def test_reconstruccion_absorbe(self):
        self.e['tramos'][0]['pci']=10; r=self.ejecutar(); self.assertEqual(r['trabajos_previos'],[]); self.assertGreater(r['prioridad']['costo_interino_si_diferido'],0)
    def test_extrapolacion(self):
        r=self.ejecutar(); f=next(x for x in r['fallas'] if x['tipo']=='13' and x['severidad']=='H'); self.assertAlmostEqual(f['cantidad_estimada_tramo'],round(2*r['factor_extrapolacion']+3,2))
    def test_presupuesto(self):
        self.e['calibracion']['presupuesto']=0; a=analizar(self.e,self.ahora); self.assertIn('PRESUPUESTO_INSUFICIENTE_SEGURIDAD',[x['codigo'] for x in a['alertas_globales']]); self.assertNotEqual(a['tramos'][0]['prioridad']['estado'],'financiado')
        self.e['calibracion']['presupuesto']=None; self.assertEqual(self.ejecutar()['prioridad']['estado'],'sin_presupuesto')
    def test_validacion(self):
        validate(analizar(leer('ejemplos/entrada_ejemplo.json'),self.ahora),leer('schemas/analisis.schema.json'))
        self.e['calibracion']['tratamientos_disponibles']=['inexistente']
        with self.assertRaises(EntradaInvalida): self.ejecutar()
    def test_cobertura_incompleta(self):
        # C2: con una muestra generada pero sin evaluar el motor rechaza el tramo
        self.e['tramos'][0]['muestras'][0]['evaluada']=False
        with self.assertRaises(EntradaInvalida) as cm: self.ejecutar()
        self.assertTrue(cm.exception.errores[0].startswith('COBERTURA_INCOMPLETA'))
        self.e['tramos'][0]['muestras'][0]['evaluada']=True
        self.assertEqual(self.ejecutar()['id'],self.e['tramos'][0]['id'])
    def test_un_solo_tramo(self):
        # C3: con un solo tramo no hay ranking ni comparación de modos
        a=analizar(self.e,self.ahora)
        self.assertTrue(a['red']['un_solo_tramo']); self.assertNotIn('comparacion_modos',a['red'])
        self.assertIsNone(a['tramos'][0]['prioridad']['posicion']); self.assertIn('UN_SOLO_TRAMO',[x['codigo'] for x in a['alertas_globales']])
        validate(a,leer('schemas/analisis.schema.json'))
        otro=leer('ejemplos/entrada_ejemplo.json'); b=analizar(otro,self.ahora)
        self.assertFalse(b['red']['un_solo_tramo']); self.assertIn('comparacion_modos',b['red']); self.assertEqual(b['tramos'][0]['prioridad']['posicion'] is not None or b['tramos'][1]['prioridad']['posicion'] is not None,True)
    def test_modo_diagnostico(self):
        # C1: sin dinero, sin B/C ni prioridad; tramos en orden de inspección; esquemas válidos
        import json
        from agente.narrativa import redactar
        from agente import asistente
        e=leer('ejemplos/entrada_ejemplo.json'); e['calibracion']['modo_analisis']='diagnostico'; e['calibracion'].pop('presupuesto',None)
        a=analizar(e,self.ahora); validate(a,leer('schemas/analisis.schema.json'))
        self.assertEqual(a['modo'],'diagnostico'); self.assertEqual(a['red']['orden_ejecucion'],[t['id'] for t in e['tramos']])
        for t in a['tramos']:
            for k in ('costos','beneficio','relacion_bc','beneficio_detalle'): self.assertNotIn(k,t)
            self.assertIsNone(t['prioridad']['posicion']); self.assertTrue(all('costo' not in p for p in t['trabajos_previos']+t['partidas_tratamiento']))
        for k in ('costo_total_necesario','costo_financiado','faltante','comparacion_modos'): self.assertNotIn(k,a['red'])
        codigos=[x['codigo'] for x in a['alertas_globales']]
        self.assertIn('DIAGNOSTICO_SIN_PRIORIDAD',codigos); self.assertNotIn('COSTOS_DE_EJEMPLO',codigos)
        n,_=redactar(a,None); validate(n,leer('schemas/narrativa.schema.json'))
        self.assertNotRegex(json.dumps(n,ensure_ascii=False),r'USD|\d\s?\d{3}[.,]\d{2} ')
        r=asistente.responder('cuanto cuesta en total',a,n,None,None); self.assertIn('modo diagnóstico',r['respuesta'])
        # el modo completo no cambia
        e['calibracion']['modo_analisis']='completo'; b=analizar(e,self.ahora); self.assertEqual(b['modo'],'completo'); self.assertIn('costos',b['tramos'][0])
