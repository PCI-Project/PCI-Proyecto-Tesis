import json
import re
import unittest
from agente.catalogo import leer
from agente.motor import analizar
from agente.narrativa import narrativa_automatica
from agente.asistente import AYUDA, cifras_inventadas, respuesta_automatica, responder
from agente.servicio import consultar

ANALISIS = analizar(leer('ejemplos/entrada_ejemplo.json'))
NARRATIVA = narrativa_automatica(ANALISIS)
REFERENCIA = json.dumps(ANALISIS, ensure_ascii=False) + json.dumps(NARRATIVA, ensure_ascii=False) + json.dumps(leer('catalogo/fallas.json')) + json.dumps(leer('catalogo/tratamientos.json'))


def ask(q):
    return respuesta_automatica(q, ANALISIS, NARRATIVA)


class AsistenteTest(unittest.TestCase):
    def test_red(self):
        texto, fuentes, _ = ask('¿Cómo está la red en general?')
        self.assertIn(str(ANALISIS['red']['pci_ponderado']), texto)
        self.assertEqual(fuentes, ['Red'])

    def test_falla_con_severidades_y_donde_aparece(self):
        texto, fuentes, _ = ask('¿Qué es la piel de cocodrilo?')
        self.assertIn('Piel de cocodrilo', texto)
        self.assertIn('Severidad alta', texto)
        self.assertIn('En este proyecto', texto)
        self.assertIn('ASTM D6433-24', fuentes)

    def test_falla_por_nombre_en_ingles_y_sinonimo(self):
        self.assertIn('Ahuellamiento', ask('que son las roderas')[0])
        self.assertIn('Potholes', ask('pothole')[0])

    def test_alias_mas_largo_gana(self):
        texto = ask('grieta de borde')[0]
        self.assertIn('Grieta de borde', texto)
        self.assertNotIn('Grietas longitudinales y transversales (', texto)

    def test_tratamiento_equipo_costo_y_uso(self):
        texto, fuentes, _ = ask('que es el micropavimento')
        self.assertIn('Micropavimento', texto)
        self.assertIn('Equipo:', texto)
        self.assertIn('En este proyecto', texto)

    def test_tratamiento_no_disponible(self):
        self.assertIn('No está entre los tratamientos disponibles', ask('que es el fdr')[0])

    def test_tramo_por_id_nombre_y_numero(self):
        for q in ('que pasa en S3', 'cuentame de Vía a La Mata', 'tramo 3'):
            self.assertIn('Vía a La Mata (S3)', ask(q)[0], q)

    def test_tramo_y_falla_filtra_por_tramo(self):
        texto = ask('Qué piel de cocodrilo tiene Calle 2da?')[0]
        self.assertIn('Calle 2da (S4)', texto)
        self.assertIn('severidad M', texto)
        self.assertNotIn('Calle 10ma', texto)

    def test_peor_tramo(self):
        peor = min(ANALISIS['tramos'], key=lambda t: t['pci'])
        self.assertIn(peor['nombre'], ask('cual es el peor tramo')[0])

    def test_por_que_incluye_justificacion_y_si_no_se_pregunta_no(self):
        corto = ask('Avenida Central')[0]
        largo = ask('¿Por qué Avenida Central recibe ese tratamiento?')[0]
        self.assertGreater(len(largo), len(corto))

    def test_presupuesto_no_activa_supuestos(self):
        texto, fuentes, _ = ask('cuanto falta de presupuesto')
        self.assertIn('faltante', texto)
        self.assertNotIn('Calibración usada', fuentes)

    def test_diferir(self):
        self.assertIn('Si se difiere', ask('que pasa si no se hace la Calle 2da')[0])

    def test_alertas_y_prioridad(self):
        self.assertIn('[critica]', ask('alertas graves')[0])
        self.assertIn('Orden de ejecución', ask('cual es la prioridad')[0])

    def test_fuera_de_tema_da_ayuda_sin_inventar(self):
        texto, fuentes, sugerencias = ask('cual es la capital de Francia')
        self.assertEqual(texto, AYUDA)
        self.assertEqual(fuentes, [])
        self.assertTrue(sugerencias)

    def test_ninguna_cifra_sale_de_la_nada(self):
        preguntas = ['red', 'piel de cocodrilo', 'micropavimento', 'S1', 'S2', 'S3', 'S4', 'presupuesto', 'prioridad', 'alertas',
                     'supuestos', 'equipo disponible', 'que pasa si se difiere', 'baches', 'ahuellamiento', 'fresado y reposicion']
        for q in preguntas:
            texto = ask(q)[0]
            self.assertEqual(cifras_inventadas(texto, REFERENCIA, q), [], q)

    def test_modelo_valido_se_usa_y_recibe_datos_e_historial(self):
        recibido = {}

        def modelo(system, mensajes):
            recibido.update(system=system, mensajes=mensajes)
            return 'El PCI ponderado es 60.'
        historial = [{'rol': 'usuario', 'texto': 'hola'}, {'rol': 'asistente', 'texto': 'buenas'}]
        r = responder('como esta la red', ANALISIS, NARRATIVA, historial, modelo)
        self.assertEqual(r['origen'], 'modelo')
        self.assertEqual(r['respuesta'], 'El PCI ponderado es 60.')
        self.assertEqual([m['role'] for m in recibido['mensajes']], ['user', 'assistant', 'user'])
        self.assertIn('DATOS:', recibido['mensajes'][-1]['content'])
        self.assertIn('No diseñes espesores', recibido['system'])

    def test_modelo_que_inventa_cifra_se_descarta(self):
        r = responder('como esta la red', ANALISIS, NARRATIVA, None, lambda s, m: 'El PCI ponderado es 99.7.')
        self.assertEqual(r['origen'], 'automatica')
        self.assertNotIn('99.7', r['respuesta'])

    def test_modelo_que_falla_cae_a_automatica(self):
        def roto(s, m):
            raise OSError('sin Ollama')
        self.assertEqual(responder('como esta la red', ANALISIS, NARRATIVA, None, roto)['origen'], 'automatica')

    def test_fuera_de_tema_no_llama_al_modelo(self):
        llamadas = []
        responder('capital de Francia', ANALISIS, NARRATIVA, None, lambda s, m: llamadas.append(1) or 'x')
        self.assertEqual(llamadas, [])


class ConsultarTest(unittest.TestCase):
    def test_ok_serializable(self):
        cuerpo, codigo = consultar({'pregunta': 'como esta la red', 'analisis': ANALISIS, 'narrativa': NARRATIVA})
        self.assertEqual(codigo, 200)
        self.assertEqual(set(cuerpo), {'success', 'version', 'respuesta', 'origen', 'fuentes', 'sugerencias', 'resumen', 'datos', 'detalle'})
        json.dumps(cuerpo)

    def test_validaciones(self):
        casos = [({}, 2), ({'pregunta': '  ', 'analisis': ANALISIS}, 1), ({'pregunta': 'x' * 601, 'analisis': ANALISIS}, 1),
                 ({'pregunta': 'hola', 'analisis': {'tramos': []}}, 1), ({'pregunta': 'hola', 'analisis': ANALISIS, 'historial': 'x'}, 1),
                 ('no es objeto', 2)]
        for entrada, n in casos:
            cuerpo, codigo = consultar(entrada)
            self.assertEqual(codigo, 422, entrada)
            self.assertFalse(cuerpo['success'])
            self.assertEqual(len(cuerpo['errores']), n, entrada)

    def test_analisis_con_estructura_rota_da_422_no_500(self):
        roto = {'tramos': [{'id': 'S1'}], 'red': {}, 'calibracion_usada': {}}
        cuerpo, codigo = consultar({'pregunta': 'como esta la red', 'analisis': roto})
        self.assertEqual(codigo, 422)


if __name__ == '__main__':
    unittest.main()
