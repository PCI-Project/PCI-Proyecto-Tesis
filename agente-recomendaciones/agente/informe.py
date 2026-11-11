"""Generador del informe en HTML (A4 imprimible) y PDF opcional con Playwright."""
from pathlib import Path
import base64
import copy
import mimetypes
import re
import sys
from jinja2 import Environment, FileSystemLoader, select_autoescape, StrictUndefined
from .catalogo import leer

DIR = Path(__file__).parent / 'plantillas'
ORDEN_NIVELES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
NOMBRE_NIVEL = {'A1': 'Mantenimiento preventivo', 'A2': 'Mantenimiento preventivo', 'B1': 'Rehabilitación menor',
                'B2': 'Rehabilitación mayor', 'C1': 'Reconstrucción', 'C2': 'Reconstrucción'}
ESTADO = {'financiado': 'Financiado', 'solo_seguridad': 'Solo seguridad', 'diferido': 'Diferido', 'sin_presupuesto': 'Sin tope'}
NIVEL_ALERTA = {'critica': 'Crítica', 'advertencia': 'Advertencia', 'info': 'Información'}
MODOS = {'costo_beneficio': 'Mayor beneficio por dólar', 'peor_primero': 'Reparar primero lo más dañado'}
BIBLIOGRAFIA = [
    'ASTM International. (2024). ASTM D6433-24, Standard Practice for Roads and Parking Lots Pavement Condition Index Surveys. ASTM International.',
    'Asphalt Institute. (2009). Asphalt in Pavement Preservation and Maintenance (Manual Series No. 16 [MS-16], 4th ed.). Asphalt Institute. ISBN 978-1-934154-58-8.',
    'Asphalt Institute. (2014). Asphalt Mix Design Methods (Manual Series No. 2 [MS-2], 7th ed.). Asphalt Institute.',
    'Asphalt Institute. Asphalt Overlays for Highway and Street Rehabilitation (Manual Series No. 17 [MS-17]). Asphalt Institute.',
    'Asphalt Institute. The Asphalt Handbook (Manual Series No. 4 [MS-4]). Asphalt Institute.',
    'Asphalt Institute. Construction of Hot Mix Asphalt Pavements (Manual Series No. 22 [MS-22]). Asphalt Institute.',
    'Haas, R., Hudson, W. R. y Falls, L. C. (2015). Pavement Asset Management. Wiley / Scrivener.',
]


def _num(n, d=2):
    if n is None:
        return '—'
    if isinstance(n, (int, float)):
        s = f"{n:,.{d}f}".replace(',', ' ')
        return s.rstrip('0').rstrip('.') if '.' in s and d != 1 else s
    return str(n)


def _dinero(n):
    return '—' if n is None else f"{n:,.2f}".replace(',', ' ')


def _unidad(u):
    return {'m2': 'm²', 'und': 'und', 'm': 'm', 'global': 'global'}.get(u, u)


def _valor_param(v):
    if isinstance(v, dict):
        if 'valor' in v:
            return _num(v['valor']) if isinstance(v['valor'], (int, float)) else str(v['valor'])
        return ', '.join(f"{k}: {_num(x)}" for k, x in v.items() if k not in ('origen', 'fuente', 'nota') and not isinstance(x, (dict, list)))
    return str(v)


def contexto(analisis, narrativa, origen='automatica', logo=None):
    if analisis.get('modo') == 'diagnostico':
        raise NotImplementedError('El informe HTML/PDF del agente aún no admite el modo diagnóstico; el informe patológico se genera desde el panel.')
    analisis = copy.deepcopy(analisis)
    for t in analisis['tramos']:
        for m in t['muestras']:
            m.setdefault('adicional', False)
    items = leer('catalogo/tratamientos.json')['items']
    cal = analisis['calibracion_usada']
    red = analisis['red']
    tramos = analisis['tramos']
    por_id = {t['id']: t for t in tramos}
    textos = {x['tramo_id']: x for x in narrativa.get('tramos', [])}

    # Barra de niveles de PCI (0 a 100)
    u = cal['umbrales_pci']
    segmentos = []
    for i, nid in enumerate(ORDEN_NIVELES):
        alto = 100 if i == 0 else u[ORDEN_NIVELES[i - 1]]
        segmentos.append(dict(id=nid, desde=u[nid], hasta=alto, ancho=alto - u[nid], franja=nid[0]))
    segmentos.reverse()

    # Área por nivel
    area_total = red['area_total_m2'] or 1
    dist = []
    for nid in ORDEN_NIVELES:
        a = sum(t['area_m2'] for t in tramos if t['nivel_id'] == nid)
        if a:
            dist.append(dict(id=nid, nivel=NOMBRE_NIVEL[nid], area=a, pct=100 * a / area_total, franja=nid[0],
                             tramos=[t['nombre'] for t in tramos if t['nivel_id'] == nid]))

    # Priorización con acumulado
    ranking, acumulado = [], 0.0
    for tid in red['orden_ejecucion']:
        t = por_id[tid]
        est = t['prioridad']['estado']
        aporte = t['costos']['total'] if est == 'financiado' else (t['prioridad']['costo_interino_si_diferido'] if est == 'solo_seguridad' else 0)
        acumulado += aporte
        ranking.append(dict(t=t, aporte=aporte, acumulado=acumulado))

    # Alertas consolidadas
    alertas = []
    for t in tramos:
        for a in t['alertas']:
            alertas.append(dict(a, tramo=t['nombre']))
    for a in analisis['alertas_globales']:
        alertas.append(dict(a, tramo='Red'))
    orden_nivel = {'critica': 0, 'advertencia': 1, 'info': 2}
    alertas.sort(key=lambda a: orden_nivel[a['nivel']])
    textos_alerta = {(x['codigo'], x.get('tramo_id')): x['texto'] for x in narrativa.get('alertas', [])}

    # Costos usados en alguna partida
    usados = []
    for t in tramos:
        for p in t['trabajos_previos'] + t['partidas_tratamiento']:
            if p['actividad'] not in usados:
                usados.append(p['actividad'])
    costos = [dict(id=k, nombre=items[k]['nombre'], **cal['costos'][k]) for k in usados]

    disponibles = set(cal['tratamientos_disponibles']) | {'monitoreo'}
    grupos_eq = {}
    for k, it in items.items():
        if k == 'monitoreo':
            continue
        g = 'Paliativos y reparaciones locales' if it['tipo'] == 'actividad' or k == 'sellado_grietas' else it['nivel']
        grupos_eq.setdefault(g, []).append(dict(id=k, nombre=it['nombre'], en=it['nombre_en'], ok=k in disponibles))
    orden_g = ['Paliativos y reparaciones locales', 'Mantenimiento preventivo', 'Rehabilitación menor', 'Rehabilitación mayor', 'Reconstrucción']
    equipo = [(g, grupos_eq[g]) for g in orden_g if g in grupos_eq]

    referencias = []
    for t in tramos:
        for r in t['referencias']:
            if r not in referencias:
                referencias.append(r)

    parametros = []
    for k, v in cal['parametros'].items():
        if k.startswith('_'):
            continue
        origen_p = v.get('origen', '') if isinstance(v, dict) else ''
        fuente = (v.get('fuente') or v.get('nota') or '') if isinstance(v, dict) else ''
        parametros.append(dict(clave=k, valor=_valor_param(v), origen=origen_p, fuente=fuente))

    logo_src = None
    if logo:
        p = Path(logo)
        logo_src = 'data:' + (mimetypes.guess_type(p.name)[0] or 'image/png') + ';base64,' + base64.b64encode(p.read_bytes()).decode('ascii')

    return dict(a=analisis, n=narrativa, cal=cal, red=red, tramos=tramos, textos=textos, items=items,
                fcat=leer('catalogo/fallas.json')['fallas'], segmentos=segmentos,
                dist=dist, ranking=ranking, alertas=alertas, textos_alerta=textos_alerta, costos=costos, equipo=equipo,
                referencias=referencias, bibliografia=BIBLIOGRAFIA, parametros=parametros, origen=origen, logo=logo_src,
                codigo=analisis['proyecto']['huella_entrada'][:8].upper(), fecha=analisis['generado'][:10],
                moneda=cal['moneda'], ESTADO=ESTADO, NIVEL_ALERTA=NIVEL_ALERTA, MODOS=MODOS,
                n_criticas=sum(1 for x in alertas if x['nivel'] == 'critica'))


def generar_html(analisis, narrativa, ruta_html, logo=None, origen='automatica'):
    env = Environment(loader=FileSystemLoader(DIR), autoescape=select_autoescape(['html', 'j2']), undefined=StrictUndefined,
                      trim_blocks=True, lstrip_blocks=True)
    env.filters.update(dinero=_dinero, num=_num, unidad=_unidad)
    html = env.get_template('informe.html.j2').render(css=(DIR / 'informe.css').read_text(encoding='utf-8'),
                                                      **contexto(analisis, narrativa, origen, logo))
    ruta = Path(ruta_html)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(html, encoding='utf-8')
    return ruta


def generar_pdf(ruta_html, ruta_pdf, navegador=None):
    """Imprime el HTML a PDF A4 con Chromium (Playwright). Devuelve None si no es posible."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('No se pudo generar el PDF: Playwright no está instalado (pip install playwright).', file=sys.stderr)
        return None
    try:
        html = Path(ruta_html).read_text(encoding='utf-8')
        proyecto = re.search(r'<meta name="proyecto" content="([^"]*)"', html)
        codigo = re.search(r'<meta name="codigo" content="([^"]*)"', html)
        pie = ('<div style="font:7.5pt Segoe UI,Arial,sans-serif;color:#5b6b78;width:100%;padding:0 16mm;display:flex;justify-content:space-between">'
               f'<span>{proyecto.group(1) if proyecto else ""}</span><span>Informe {codigo.group(1) if codigo else ""}</span>'
               '<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>')
        with sync_playwright() as pw:
            opciones = {'executable_path': navegador} if navegador else {}
            browser = pw.chromium.launch(**opciones)
            page = browser.new_page()
            page.goto(Path(ruta_html).resolve().as_uri(), wait_until='load')
            page.pdf(path=str(ruta_pdf), format='A4', margin={'top': '16mm', 'bottom': '18mm', 'left': '16mm', 'right': '16mm'},
                     print_background=True, display_header_footer=True, header_template='<span></span>', footer_template=pie)
            browser.close()
        return Path(ruta_pdf)
    except Exception as exc:  # navegador ausente u otro fallo de impresión
        print(f'No se pudo generar el PDF: {exc}', file=sys.stderr)
        return None
