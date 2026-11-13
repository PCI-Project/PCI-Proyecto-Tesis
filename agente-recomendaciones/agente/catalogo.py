from pathlib import Path
import json
from copy import deepcopy

RAIZ = Path(__file__).resolve().parent.parent

def leer(ruta):
    return json.loads((RAIZ / ruta).read_text(encoding='utf-8'))

def cargar(calibracion):
    fallas = leer('catalogo/fallas.json')['fallas']
    tratamientos = leer('catalogo/tratamientos.json')['items']
    matriz = leer('catalogo/matriz.json')
    parametros = leer('catalogo/parametros_defecto.json')
    for k, v in calibracion.get('parametros', {}).items():
        if isinstance(parametros.get(k), dict) and isinstance(v, dict):
            parametros[k].update(v)
        elif isinstance(parametros.get(k), dict) and 'valor' in parametros[k]:
            parametros[k]['valor'] = v
        else:
            parametros[k] = v
        if isinstance(parametros[k], dict): parametros[k]['origen'] = 'calibrado'
    costos = deepcopy(leer('catalogo/costos_estandar.json')['costos'])
    for c in costos.values(): c['origen'] = 'ejemplo'
    for k, v in calibracion.get('costos_unitarios', {}).items():
        costos[k] = {**costos.get(k, {}), **v, 'origen': 'calibrado'}
    umbrales = {n['id']: n['pci_min'] for n in matriz['niveles']}
    umbrales.update(calibracion.get('umbrales_pci', {}))
    return fallas, tratamientos, matriz, parametros, costos, umbrales
