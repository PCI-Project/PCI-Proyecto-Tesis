"""Lógica del servicio web del agente, sin dependencias de FastAPI.

La web arma el informe: el agente solo devuelve datos (analisis + narrativa).
`servicio/main.py` expone estas funciones por HTTP; también sirven como nodos de LangGraph.
"""
from . import __version__
from .catalogo import leer
from .motor import analizar, EntradaInvalida
from .narrativa import redactar
from .asistente import MAX_PREGUNTA, responder


def procesar(entrada, llamar_modelo=None):
    """Entrada del panel -> (cuerpo de respuesta, código HTTP).

    200: {success, version, analisis, narrativa, narrativa_origen}
    422: {success: False, errores: [...]}
    """
    try:
        analisis = analizar(entrada)
    except EntradaInvalida as e:
        return {'success': False, 'version': __version__, 'errores': e.errores}, 422
    narrativa, origen = redactar(analisis, llamar_modelo)
    return {'success': True, 'version': __version__, 'analisis': analisis, 'narrativa': narrativa,
            'narrativa_origen': origen}, 200


def consultar(cuerpo, llamar_texto=None):
    """Pregunta del chat -> (cuerpo de respuesta, código HTTP).

    Entrada: {pregunta, analisis, narrativa?, historial?: [{rol: 'usuario'|'asistente', texto}]}
    200: {success, version, respuesta, origen: 'modelo'|'automatica', fuentes, sugerencias}
    422: {success: False, errores: [...]}
    """
    errores = []
    cuerpo = cuerpo if isinstance(cuerpo, dict) else {}
    pregunta = cuerpo.get('pregunta')
    analisis = cuerpo.get('analisis')
    if not isinstance(pregunta, str) or not pregunta.strip():
        errores.append('pregunta: debe ser un texto no vacío')
    elif len(pregunta) > MAX_PREGUNTA:
        errores.append(f'pregunta: máximo {MAX_PREGUNTA} caracteres')
    if not isinstance(analisis, dict) or not all(k in analisis for k in ('tramos', 'red', 'calibracion_usada')):
        errores.append('analisis: debe ser el análisis que devolvió /api/recommendations')
    narrativa = cuerpo.get('narrativa')
    historial = cuerpo.get('historial')
    if narrativa is not None and not isinstance(narrativa, dict):
        errores.append('narrativa: debe ser un objeto')
    if historial is not None and not (isinstance(historial, list) and all(isinstance(h, dict) for h in historial)):
        errores.append('historial: debe ser una lista de {rol, texto}')
    if errores:
        return {'success': False, 'version': __version__, 'errores': errores}, 422
    try:
        r = responder(pregunta.strip(), analisis, narrativa, historial, llamar_texto)
    except (KeyError, TypeError, ValueError) as e:
        return {'success': False, 'version': __version__, 'errores': [f'analisis: estructura no reconocida ({e})']}, 422
    return {'success': True, 'version': __version__, **r}, 200


def catalogo_web():
    """Lo que la web necesita para el panel: tratamientos, costos de ejemplo, fallas, niveles y parámetros."""
    items = leer('catalogo/tratamientos.json')['items']
    costos = leer('catalogo/costos_estandar.json')
    fallas = leer('catalogo/fallas.json')['fallas']
    matriz = leer('catalogo/matriz.json')
    parametros = leer('catalogo/parametros_defecto.json')
    niveles = []
    for n in matriz['niveles']:
        opciones = []
        for k, v in n.items():
            if k.startswith('opciones') and isinstance(v, list):
                opciones += [x for x in v if x not in opciones]
        if n['regla'] == 'deterioro_dominante':
            for v in matriz['deterioro_dominante'].values():
                if isinstance(v, list):
                    opciones += [x for x in v if x not in opciones]
            opciones += [x for x in n.get('sin_fallas', []) if x not in opciones]
        niveles.append(dict(id=n['id'], franja=n['franja'], pci_min=n['pci_min'], nivel=n['nivel'], categoria=n['categoria'],
                            regla=n['regla'], opciones=[x for x in opciones if x != 'monitoreo'], interinas=n.get('interinas', [])))
    return dict(
        version=__version__,
        moneda=costos['moneda'],
        aviso_costos=costos['_aviso'],
        tratamientos=[dict(id=k, tipo=v['tipo'], nombre=v['nombre'], nombre_en=v['nombre_en'], nivel=v.get('nivel'),
                           unidad=v['unidad'], equipo=v.get('equipo', []), costo_ejemplo=costos['costos'][k]['valor'])
                      for k, v in items.items() if k != 'monitoreo'],
        fallas=[dict(id=k, nombre=v['nombre'], nombre_en=v['nombre_en'], unidad=v['unidad'], grupo=v['grupo'],
                     severidades=v['severidad']) for k, v in fallas.items()],
        niveles=niveles,
        parametros={k: v for k, v in parametros.items() if not k.startswith('_')},
    )


# Nodos para un StateGraph de LangGraph con estado {entrada, analisis, narrativa, narrativa_origen, errores}
def nodo_motor(estado):
    try:
        return {'analisis': analizar(estado['entrada']), 'errores': None}
    except EntradaInvalida as e:
        return {'analisis': None, 'errores': e.errores}


def nodo_redactar(estado, llamar_modelo=None):
    if not estado.get('analisis'):
        return {'narrativa': None, 'narrativa_origen': None}
    narrativa, origen = redactar(estado['analisis'], llamar_modelo)
    return {'narrativa': narrativa, 'narrativa_origen': origen}
