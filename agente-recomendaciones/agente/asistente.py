"""Asistente de consulta del informe (chat).

Responde preguntas sobre un `analisis` ya calculado, sus fallas y los métodos de tratamiento.
No calcula nada nuevo: arma las respuestas con lo que dice el análisis, la narrativa y el catálogo.
Con un modelo de lenguaje el modelo solo redacta sobre esos mismos datos; si inventa una cifra, se descarta su respuesta
y se usa la automática. Sin modelo (AGENTE_USAR_MODELO=0) todas las respuestas son automáticas.
"""
import re
import unicodedata
from functools import lru_cache

from .catalogo import leer
from .narrativa import CAUSAS, CONSECUENCIA, EFECTO, ESTADO, GRUPOS, RAZON_PREVIO, dinero, num

MAX_PREGUNTA = 600
MAX_HISTORIAL = 6
MAX_BLOQUES = 3

FALLA_ALIAS = {
    '1': ['cocodrilo', 'fatiga', 'alligator'], '2': ['exudacion', 'bleeding'],
    '3': ['grietas en bloque', 'grieta en bloque', 'agrietamiento en bloque', 'block cracking'],
    '4': ['abultamiento', 'hundimiento', 'bumps', 'sags'], '5': ['corrugacion', 'corrugation'], '6': ['depresion'],
    '7': ['grieta de borde', 'grietas de borde', 'edge cracking'], '8': ['reflexion'],
    '9': ['desnivel', 'drop-off', 'drop off'],
    '10': ['grieta', 'longitudinal', 'transversal'],
    '11': ['parches', 'patching'], '12': ['agregado pulido', 'pulido'],
    '13': ['bache', 'pothole'], '14': ['ferrea', 'ferrocarril'], '15': ['ahuellamiento', 'rodera', 'rutting', 'huella'],
    '16': ['desplazamiento', 'shoving'], '17': ['parabolica', 'slippage'], '18': ['hinchamiento', 'swell'],
    '19.1': ['desprendimiento', 'raveling'], '19.2': ['meteorizacion', 'weathering', 'desgaste superficial'],
}
TRAT_ALIAS = {
    'monitoreo': ['monitoreo', 'sin intervencion', 'do nothing'],
    'sellado_grietas': ['sellado de grietas', 'sellado', 'relleno de grietas', 'crack sealing', 'crack seal'],
    'fog_seal': ['riego de niebla', 'fog seal'], 'rejuvenecedor': ['rejuvenecedor'],
    'sand_seal': ['sello de arena', 'sand seal'], 'chip_seal': ['chip seal', 'tratamiento superficial', 'gravilla'],
    'slurry_seal': ['lechada', 'slurry'], 'micropavimento': ['micropavimento', 'microsurfacing', 'micro surfacing', 'micro-surfacing'],
    'thin_overlay': ['sobrecapa delgada', 'thin overlay'], 'mill_and_replace': ['fresado y reposicion', 'mill and replace', 'mill and inlay'],
    'sobrecapa_estructural': ['sobrecapa estructural'], 'fresado_sobrecapa_estructural': ['fresado y sobrecapa estructural'],
    'fdr': ['fdr', 'recuperacion a profundidad total', 'reciclado'], 'reconstruccion': ['reconstruccion'],
    'riego_liga': ['riego de liga', 'tack coat'], 'limpieza_superficie': ['barrido', 'limpieza de la superficie'],
    'parcheo_profundidad_parcial': ['parcheo', 'parcheo parcial', 'parcheo a profundidad parcial'],
    'parcheo_profundidad_total': ['parcheo', 'parcheo total', 'parcheo a profundidad total'],
    'parcheo_superficial': ['parcheo superficial'], 'fresado_local': ['fresado localizado', 'fresado local'],
    'arenado_exudacion': ['arenado'], 'relleno_roderas': ['relleno de roderas'],
    'nivelacion_hombros': ['nivelacion de hombros'], 'conformacion_hombros': ['conformacion de hombros'],
}
# Palabras que activan un tema aunque no se nombre un tramo, una falla ni un tratamiento.
TEMAS = [
    ('presupuesto', ['presupuesto', 'costo', 'cuesta', 'cuanto', 'dinero', 'financ', 'faltante', 'inversion', 'imprevisto', 'usd', 'dolar']),
    ('prioridad', ['prioridad', 'orden', 'primero', 'ejecuc', 'beneficio', 'cronograma', 'peor primero']),
    ('alertas', ['alerta', 'riesgo', 'seguridad', 'peligro', 'advertencia', 'urgente']),
    ('supuestos', ['supuesto', 'asum', 'dato faltante', 'datos faltantes', 'ejemplo', 'calibr', 'parametro', 'confiable']),
    ('red', ['pci', 'estado de la red', 'condicion', 'ponderado', 'resumen', 'conclusion', 'red', 'en general', 'como esta']),
    ('equipo', ['equipo', 'maquinaria', 'contratista', 'disponible']),
    ('diferir', ['diferir', 'diferido', 'si no se', 'no se hace', 'esperar', 'consecuencia']),
]
SUGERENCIAS_BASE = ['¿Cómo está la red en general?', '¿Qué se financia y qué no?', '¿Cuáles son las alertas más graves?']


def _pci(x):
    return f'{float(x):.1f}'


def _n(texto):
    s = unicodedata.normalize('NFKD', str(texto)).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', s.lower()).strip()


def _tiene(pregunta_n, alias):
    return re.search(r'(?<![a-z0-9])' + re.escape(alias) + r'(?:s|es)?(?![a-z0-9])', pregunta_n) is not None


@lru_cache(maxsize=1)
def _catalogo():
    return leer('catalogo/fallas.json')['fallas'], leer('catalogo/tratamientos.json')['items']


def _sin_parentesis(texto):
    return re.sub(r'\s*\(.*?\)', '', texto or '').strip()


def _aliases_tratamiento(clave, item):
    alias = set(TRAT_ALIAS.get(clave, []))
    alias.add(_n(_sin_parentesis(item['nombre'])))
    alias.add(_n(_sin_parentesis(item.get('nombre_en', ''))))
    alias.add(_n(clave.replace('_', ' ')))
    return {a for a in alias if len(a) >= 3}


def _aliases_falla(clave, item):
    alias = set(FALLA_ALIAS.get(clave, []))
    alias.add(_n(item['nombre']))
    alias.add(_n(item.get('nombre_en', '')))
    return {a for a in alias if len(a) >= 3}


def _entidades(pregunta_n, analisis):
    """Tramos, fallas y tratamientos que la pregunta nombra. Un alias contenido en otro más largo (grieta ⊂ grieta de borde) se descarta."""
    fallas, trat = _catalogo()
    hallados = []   # (tipo, clave, alias)
    for t in analisis.get('tramos', []):
        ids = {_n(t.get('id', '')), _n(t.get('nombre', ''))}
        digitos = re.sub(r'\D', '', str(t.get('id', '')))
        if digitos:
            ids.add('tramo ' + digitos)
        for a in ids:
            if a and _tiene(pregunta_n, a):
                hallados.append(('tramo', t['id'], a))
    for k, v in fallas.items():
        hallados += [('falla', k, a) for a in _aliases_falla(k, v) if _tiene(pregunta_n, a)]
    for k, v in trat.items():
        hallados += [('trat', k, a) for a in _aliases_tratamiento(k, v) if _tiene(pregunta_n, a)]
    vistos = {(h[0], h[1]) for h in hallados if not any(h[2] != o[2] and h[2] in o[2] for o in hallados)}
    out = {'tramo': [], 'falla': [], 'trat': []}
    for tipo, clave, _ in hallados:
        if (tipo, clave) in vistos and clave not in out[tipo]:
            out[tipo].append(clave)
    tramos = analisis.get('tramos', [])
    if tramos and not out['tramo'] and re.search(r'(tramo|calle|via|avenida)', pregunta_n):
        if re.search(r'(peor|mas danado|mas deteriorado|menor pci|mas critico)', pregunta_n):
            out['tramo'].append(min(tramos, key=lambda t: t.get('pci', 100))['id'])
        elif re.search(r'(mejor|menos danado|mayor pci)', pregunta_n):
            out['tramo'].append(max(tramos, key=lambda t: t.get('pci', 0))['id'])
    return out


def _temas(pregunta_n):
    # Las palabras son raíces: deben empezar una palabra (así «presupuesto» no activa «supuesto»).
    return [nombre for nombre, palabras in TEMAS if any(re.search(r'(?<![a-z0-9])' + re.escape(p), pregunta_n) for p in palabras)]


# --- Bloques de respuesta: cada uno devuelve (texto, fuente) --------------------------------------------------------

def _tramo(analisis, t, narrativa, falla_id=None, explicar=False):
    n = next((x for x in (narrativa or {}).get('tramos', []) if x.get('tramo_id') == t['id']), {})
    tr = t.get('tratamiento') or {}
    pr = t.get('prioridad') or {}
    l = [f"{t['nombre']} ({t['id']}): PCI {_pci(t['pci'])} ({t.get('categoria', '')}), nivel «{t.get('nivel', '')}», {num(t.get('area_m2', 0))} m²."]
    if falla_id is not None:
        for f in t.get('fallas', []):
            if f['tipo'] == falla_id:
                l.append(f"- {f['nombre']} severidad {f['severidad']}: densidad {num(f['densidad_pct'])} %, unas {num(f['cantidad_estimada_tramo'])} {f['unidad']} en el tramo. {f['descripcion_severidad']}.")
        if len(l) == 1:
            l.append('En este tramo no se registró esa falla.')
        return '\n'.join(l), f"Tramo {t['id']}"
    if t.get('fallas'):
        top = sorted(t['fallas'], key=lambda f: -f.get('densidad_pct', 0))[:3]
        l.append('Fallas principales: ' + '; '.join(f"{f['nombre']} {f['severidad']} ({num(f['densidad_pct'])} %)" for f in top) + '.')
    if tr.get('nombre'):
        l.append(f"Tratamiento recomendado: {tr['nombre']} ({tr.get('nombre_en', '')}), vida útil estimada {num(tr.get('vida_util_anios', 0))} años, PCI esperado {_pci(tr.get('pci_despues', 0))}.")
        if tr.get('interino'):
            l.append('Es una solución interina: contiene el problema pero no lo resuelve.')
    if explicar and n.get('justificacion'):
        l.append(n['justificacion'])
    if n.get('nota_equipo'):
        l.append(n['nota_equipo'])
    previos = t.get('trabajos_previos') or []
    if previos:
        l.append('Antes del tratamiento: ' + '; '.join(f"{p['nombre']} {num(p['cantidad'])} {p['unidad']}" for p in previos) + '.')
    c = t.get('costos') or {}
    if c.get('total') is not None:
        l.append(f"Costo total {dinero(c['total'], analisis['calibracion_usada'].get('moneda', 'USD'))} ({dinero(c.get('costo_m2', 0), analisis['calibracion_usada'].get('moneda', 'USD'))}/m²).")
    if pr.get('estado'):
        l.append(f"Posición {pr.get('posicion')} en el orden de ejecución: {ESTADO.get(pr['estado'], pr['estado'])}." if pr.get('posicion') else f"Estado: {ESTADO.get(pr['estado'], pr['estado'])} (con un solo tramo no hay orden de ejecución).")
    return '\n'.join(l), f"Tramo {t['id']}"


def _falla(clave, analisis):
    fallas, _ = _catalogo()
    f = fallas[clave]
    l = [f"{f['nombre']} ({f['nombre_en']}) — falla {clave} de ASTM D6433, se mide en {f['unidad']}."]
    l.append('Severidad baja: ' + f['severidad']['L'] + '.' if 'L' in f['severidad'] else '')
    if 'M' in f['severidad']:
        l.append('Severidad media: ' + f['severidad']['M'] + '.')
    if 'H' in f['severidad']:
        l.append('Severidad alta: ' + f['severidad']['H'] + '.')
    g = f.get('grupo', 'otro')
    l.append(f"Grupo «{GRUPOS.get(g, g)}»: {CAUSAS.get(g, '')}.")
    rep = f.get('reparacion_local') or {}
    if rep:
        l.append('Reparación local: ' + '; '.join(f"severidad {s} → {v['actividad'].replace('_', ' ')}{' (seguridad: no se suprime por costo)' if v.get('seguridad') else ''}" for s, v in rep.items()) + '.')
    if f.get('nota'):
        l.append(f['nota'])
    donde = [f"{t['nombre']} {x['severidad']} ({num(x['densidad_pct'])} %)" for t in analisis.get('tramos', []) for x in t.get('fallas', []) if x['tipo'] == clave]
    l.append('En este proyecto: ' + ('; '.join(donde) + '.' if donde else 'no se registró en ningún tramo.'))
    return '\n'.join(x for x in l if x), 'ASTM D6433-24'


def _tratamiento(clave, analisis):
    _, trat = _catalogo()
    t = trat[clave]
    cal = analisis.get('calibracion_usada', {})
    l = [f"{_sin_parentesis(t['nombre'])} ({_sin_parentesis(t.get('nombre_en', ''))})" + (f", nivel «{t['nivel']}»" if t.get('nivel') else ', actividad de apoyo') + '.']
    if clave in EFECTO:
        l.append(f"Qué hace: {EFECTO[clave]}.")
    if clave in RAZON_PREVIO:
        l.append(f"Cuándo se usa antes de otro tratamiento: {RAZON_PREVIO[clave]}.")
    if t.get('vida_util_anios'):
        l.append(f"Vida útil estimada: {num(t['vida_util_anios'])} años.")
    if t.get('trafico_max'):
        l.append(f"Tránsito máximo recomendado: {t['trafico_max']}.")
    if t.get('no_aplicar_si'):
        l.append(f"No aplicar si: {t['no_aplicar_si']}.")
    if t.get('equipo'):
        l.append('Equipo: ' + '; '.join(t['equipo']) + '.')
    if t.get('nota'):
        l.append(t['nota'])
    c = (cal.get('costos') or {}).get(clave)
    if c:
        l.append(f"Costo unitario usado: {num(c['valor'])} {cal.get('moneda', 'USD')}/{c.get('unidad', t.get('unidad', ''))} ({'propio' if c.get('origen') == 'calibrado' else 'de ejemplo'}).")
    l.append('Disponible para este proyecto.' if clave in cal.get('tratamientos_disponibles', []) else 'No está entre los tratamientos disponibles de este proyecto.')
    usos = [f"{x['nombre']} ({'recomendado' if (x.get('tratamiento') or {}).get('seleccionado') == clave else 'ideal, no usado'})"
            for x in analisis.get('tramos', []) if clave in ((x.get('tratamiento') or {}).get('seleccionado'), (x.get('tratamiento') or {}).get('ideal'))]
    usos += [f"{x['nombre']} (trabajo previo, {num(p['cantidad'])} {p['unidad']})" for x in analisis.get('tramos', []) for p in x.get('trabajos_previos', []) if p.get('actividad') == clave]
    if usos:
        l.append('En este proyecto: ' + '; '.join(usos) + '.')
    return '\n'.join(l), 'Catálogo de tratamientos (MS-16)'


def _presupuesto(analisis):
    if analisis.get('modo') == 'diagnostico':
        return 'Este análisis se generó en modo diagnóstico: no incluye costos, presupuesto, beneficio/costo ni prioridad. Los tramos van en el orden de inspección. Para estimar costos y priorizar hay que generar el análisis en modo completo.', 'Modo diagnóstico'
    r, c = analisis['red'], analisis['calibracion_usada']
    mon = c.get('moneda', 'USD')
    tope = c.get('presupuesto')
    l = [f"Costo total necesario: {dinero(r['costo_total_necesario'], mon)}. Presupuesto: {dinero(tope, mon) if tope else 'sin tope'}.",
         f"Financiado: {dinero(r['costo_financiado'], mon)}; faltante: {dinero(r['faltante'], mon)}; saldo sin asignar: {dinero(r['saldo_sin_asignar'], mon)}."]
    l.append(f"Reparaciones de seguridad (no se suprimen por costo): {dinero(r['costo_seguridad'], mon)}.")
    if r.get('costo_interinos_diferidos'):
        l.append(f"Costo interino de los tramos diferidos: {dinero(r['costo_interinos_diferidos'], mon)}.")
    if any(x.get('origen') == 'ejemplo' for x in (c.get('costos') or {}).values()):
        l.append('Hay costos de ejemplo: el presupuesto es preliminar.')
    return '\n'.join(l), 'Red'


def _red(analisis):
    r, ts = analisis['red'], analisis.get('tramos', [])
    niveles = {}
    for t in ts:
        niveles.setdefault(t.get('nivel', ''), []).append(t['nombre'])
    despues = f"; esperado después de intervenir: {_pci(r['pci_ponderado_despues'])}" if r.get('pci_ponderado_despues') is not None else ''
    l = [f"PCI ponderado de la red: {_pci(r['pci_ponderado'])}{despues}. Área total {num(r['area_total_m2'])} m², {len(ts)} tramos."]
    l.append('Por nivel: ' + '; '.join(f"{n}: {', '.join(v)}" for n, v in niveles.items()) + '.')
    return '\n'.join(l), 'Red'


def _prioridad(analisis, narrativa):
    if analisis.get('modo') == 'diagnostico':
        return 'Este análisis se generó en modo diagnóstico: no incluye costos, presupuesto, beneficio/costo ni prioridad. Los tramos van en el orden de inspección. Para estimar costos y priorizar hay que generar el análisis en modo completo.', 'Modo diagnóstico'
    r, ts = analisis['red'], {t['id']: t for t in analisis.get('tramos', [])}
    if r.get('un_solo_tramo'):
        return ('Con un solo tramo no hay red: no se calcula ranking de prioridad ni comparación de modos de priorización. '
                'El costo y la relación B/C del tramo se muestran solo como dato.'), 'Priorización'
    l = [f"Modo de priorización: {'beneficio/costo' if analisis['calibracion_usada'].get('modo_priorizacion') == 'costo_beneficio' else 'peor primero'}. Orden de ejecución:"]
    for i, tid in enumerate(r.get('orden_ejecucion', []), 1):
        t = ts.get(tid)
        if t:
            l.append(f"{i}. {t['nombre']} — PCI {_pci(t['pci'])}, B/C {num(t.get('relacion_bc', 0))}, {ESTADO.get((t.get('prioridad') or {}).get('estado'), '')}.")
    cm = r.get('comparacion_modos')
    if cm:
        l.append(f"Con el otro modo ({'peor primero' if cm.get('modo') == 'peor_primero' else 'beneficio/costo'}) el PCI después sería {_pci(cm['pci_ponderado_despues'])}.")
    if (narrativa or {}).get('priorizacion'):
        l.append(narrativa['priorizacion'])
    return '\n'.join(l), 'Priorización'


def _alertas(analisis, narrativa):
    textos = {(a.get('codigo'), a.get('tramo_id')): a.get('texto') for a in (narrativa or {}).get('alertas', [])}
    orden = {'critica': 0, 'advertencia': 1, 'info': 2}
    items = [(a['nivel'], a['codigo'], None, a['mensaje']) for a in analisis.get('alertas_globales', [])]
    for t in analisis.get('tramos', []):
        items += [(a['nivel'], a['codigo'], t['nombre'], a['mensaje']) for a in t.get('alertas', [])]
    items.sort(key=lambda x: orden.get(x[0], 3))
    graves = [i for i in items if i[0] != 'info']
    if not items:
        return 'El análisis no generó alertas.', 'Alertas'
    l = [f"{len(graves)} alerta(s) crítica(s) o de advertencia y {len(items) - len(graves)} informativa(s)."]
    for nivel, codigo, tramo, msg in (graves or items)[:8]:
        l.append(f"- [{nivel}] {tramo + ': ' if tramo else ''}{textos.get((codigo, None)) or msg}")
    return '\n'.join(l), 'Alertas'


def _supuestos(analisis):
    c = analisis['calibracion_usada']
    ejemplo = sorted(k for k, v in (c.get('costos') or {}).items() if v.get('origen') == 'ejemplo')
    l = []
    for t in analisis.get('tramos', []):
        asum = (t.get('contexto_usado') or {}).get('asumidos') or []
        if asum:
            l.append(f"- {t['nombre']}: se asumió {', '.join(map(str, asum))}.")
    l.insert(0, 'Datos asumidos por el agente:' if l else 'No se asumió ningún dato de contexto.')
    l.append(f"Costos de ejemplo (no calibrados): {len(ejemplo)} de {len(c.get('costos') or {})}." if ejemplo else 'Todos los costos usados son propios.')
    return '\n'.join(l), 'Calibración usada'


def _equipo(analisis):
    _, trat = _catalogo()
    disp = analisis['calibracion_usada'].get('tratamientos_disponibles', [])
    gl = [_sin_parentesis(trat[k]['nombre']) for k in disp if k in trat and trat[k].get('tipo') != 'actividad']
    desc = {}
    for t in analisis.get('tramos', []):
        for d in (t.get('tratamiento') or {}).get('descartados', []):
            desc.setdefault(d['id'], d['razon'])
    l = ['Tratamientos disponibles: ' + ('; '.join(gl) if gl else 'ninguno') + '.']
    if desc:
        l.append('Descartados: ' + '; '.join(f"{_sin_parentesis(trat[k]['nombre']) if k in trat else k} ({r})" for k, r in desc.items()) + '.')
    return '\n'.join(l), 'Equipo'


def _diferir(analisis, tramo=None):
    ts = [t for t in analisis.get('tramos', []) if tramo is None or t['id'] == tramo]
    l = []
    for t in ts:
        pr = t.get('prioridad') or {}
        if pr.get('estado') in ('solo_seguridad', 'diferido') or tramo:
            nivel = (t.get('franja') or 'C')[0]
            l.append(f"- {t['nombre']}: {CONSECUENCIA.get(nivel, CONSECUENCIA['C'])}" + (f" Costo interino de seguridad: {num(pr['costo_interino_si_diferido'])}." if pr.get('costo_interino_si_diferido') else ''))
    if not l:
        return 'Ningún tramo queda diferido: todos se financian.', 'Priorización'
    return 'Qué pasa en los tramos diferidos:\n' + '\n'.join(l), 'Priorización'


# --- Construcción de la respuesta -----------------------------------------------------------------------------------

def _bloques(pregunta, analisis, narrativa):
    pn = _n(pregunta)
    ent = _entidades(pn, analisis)
    temas = _temas(pn)
    explicar = any(p in pn for p in ('por que', 'porque', 'justific', 'razon', 'explica', 'motivo', 'diagnostic', 'detalle'))
    tramos = {t['id']: t for t in analisis.get('tramos', [])}
    bloques = []
    for tid in ent['tramo']:
        if ent['falla']:
            bloques += [_tramo(analisis, tramos[tid], narrativa, f) for f in ent['falla'][:2]]
        elif 'diferir' in temas:
            bloques.append(_diferir(analisis, tid))
        else:
            bloques.append(_tramo(analisis, tramos[tid], narrativa, explicar=explicar))
    if not ent['tramo']:
        bloques += [_falla(f, analisis) for f in ent['falla']]
    bloques += [_tratamiento(k, analisis) for k in ent['trat']]
    for tema in temas:
        if len(bloques) >= MAX_BLOQUES:
            break
        if ent['tramo'] and tema in ('diferir', 'red'):
            continue
        if tema == 'presupuesto' and not ent['tramo']:
            bloques.append(_presupuesto(analisis))
        elif tema == 'prioridad':
            bloques.append(_prioridad(analisis, narrativa))
        elif tema == 'alertas':
            bloques.append(_alertas(analisis, narrativa))
        elif tema == 'supuestos':
            bloques.append(_supuestos(analisis))
        elif tema == 'red' and not ent['tramo']:
            bloques.append(_red(analisis))
        elif tema == 'equipo':
            bloques.append(_equipo(analisis))
        elif tema == 'diferir' and not ent['tramo']:
            bloques.append(_diferir(analisis))
    return bloques[:MAX_BLOQUES], ent


def _sugerencias(analisis, ent):
    ts = analisis.get('tramos', [])
    out = []
    if ts:
        peor = min(ts, key=lambda t: t.get('pci', 100))
        out.append(f"¿Por qué {peor['nombre']} recibe ese tratamiento?")
    fallas = [f for t in ts for f in t.get('fallas', [])]
    if fallas:
        f = max(fallas, key=lambda x: x.get('densidad_pct', 0))
        out.append(f"¿Qué significa «{f['nombre'].lower()}»?")
    # En modo diagnóstico no hay presupuesto: se omite la pregunta de financiación.
    out += [s for s in SUGERENCIAS_BASE if not (analisis.get('modo') == 'diagnostico' and 'financia' in s)]
    return [s for s in out if s][:4]


AYUDA = ('No encontré eso en el informe. Puedo explicar el estado de la red, un tramo (por nombre o código), una falla '
         '(p. ej. «piel de cocodrilo»), un tratamiento (p. ej. «micropavimento»), el presupuesto, la prioridad, las alertas, '
         'los supuestos o el equipo disponible.')


def respuesta_automatica(pregunta, analisis, narrativa=None):
    bloques, ent = _bloques(pregunta, analisis, narrativa)
    if not bloques:
        return AYUDA, [], _sugerencias(analisis, ent)
    return '\n\n'.join(b[0] for b in bloques), sorted({b[1] for b in bloques}), _sugerencias(analisis, ent)


# --- Modelo de lenguaje (opcional) ----------------------------------------------------------------------------------

SISTEMA = (
    'Eres el asistente de consulta de AsphaltPCI Pro, un sistema de evaluación de pavimentos flexibles por el PCI (ASTM D6433-24). '
    'Respondes en español técnico de Panamá, con frases cortas, a un ingeniero, un jefe de mantenimiento o un funcionario sin formación técnica. '
    'Reglas: 1) Usa solo los DATOS que recibes; si lo que preguntan no está, dilo. 2) Copia las cifras tal cual; no calcules, no redondees, no estimes. '
    '3) No cambies el tratamiento ni el orden que decidió el motor; si una decisión parece discutible, dilo como limitación. '
    '4) No diseñes espesores: para rehabilitación mayor y reconstrucción el espesor se diseña con MS-17, MS-4 y MS-22 y estudios de campo. '
    '5) No inventes normas ni páginas. 6) La seguridad no se suprime por costo. 7) El informe es apoyo a la decisión y lo debe revisar un ingeniero idóneo. '
    'Responde en texto plano, sin JSON, en 150 palabras o menos.')

_NUM = re.compile(r'\d[\d ,.]*\d|\d')


def _canon(cifra):
    c = re.sub(r'[ ,]', '', cifra).rstrip('.')
    try:
        return ('%.4f' % float(c)).rstrip('0').rstrip('.')
    except ValueError:
        return c


def _cifras(texto):
    return {_canon(m.group()) for m in _NUM.finditer(texto)}


def cifras_inventadas(respuesta, contexto, pregunta=''):
    """Cifras de 2 o más dígitos de la respuesta que no salen de los datos ni de la pregunta.

    Se acepta el redondeo (una cifra con d decimales vale si algún dato redondeado a d decimales la da) pero no un número nuevo.
    """
    fuente = _cifras(contexto) | _cifras(pregunta)
    valores = []
    for c in fuente:
        try:
            valores.append(float(c))
        except ValueError:
            pass

    def sale_de_los_datos(c):
        if c in fuente:
            return True
        decimales = len(c.split('.')[1]) if '.' in c else 0
        return decimales > 0 and any(abs(round(v, decimales) - float(c)) < 1e-9 for v in valores)

    return sorted(c for c in _cifras(respuesta) if len(c.replace('.', '')) >= 2 and not sale_de_los_datos(c))


def responder(pregunta, analisis, narrativa=None, historial=None, llamar_texto=None):
    """Pregunta -> {respuesta, origen, fuentes, sugerencias}. `llamar_texto(system, mensajes) -> str` es opcional."""
    auto, fuentes, sugerencias = respuesta_automatica(pregunta, analisis, narrativa)
    resultado = dict(respuesta=auto, origen='automatica', fuentes=fuentes, sugerencias=sugerencias)
    if llamar_texto is None or auto == AYUDA:
        return resultado
    try:
        mensajes = []
        for h in (historial or [])[-MAX_HISTORIAL:]:
            mensajes.append({'role': 'assistant' if h.get('rol') == 'asistente' else 'user', 'content': str(h.get('texto', ''))[:MAX_PREGUNTA * 3]})
        mensajes.append({'role': 'user', 'content': f"DATOS:\n{auto}\n\nPREGUNTA: {pregunta}"})
        texto = (llamar_texto(SISTEMA, mensajes) or '').strip()
        if texto and not cifras_inventadas(texto, auto, pregunta):
            resultado.update(respuesta=texto, origen='modelo')
    except Exception:
        pass
    return resultado
