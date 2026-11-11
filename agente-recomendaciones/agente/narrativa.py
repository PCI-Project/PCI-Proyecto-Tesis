"""Textos del informe: narrativa automática, mensajes para un modelo de lenguaje y validación de su respuesta."""
import json
import re
import sys
from jsonschema import Draft202012Validator
from .catalogo import leer, RAIZ

GRUPOS = {
    'estructural': 'daño estructural (piel de cocodrilo, baches o parches deteriorados)',
    'grietas': 'agrietamiento (grietas longitudinales, transversales, en bloque o de borde)',
    'envejecimiento': 'envejecimiento de la superficie (meteorización)',
    'desgaste': 'desprendimiento de agregados',
    'friccion': 'pérdida de fricción por agregado pulido',
    'deformacion': 'deformaciones (ahuellamiento, depresiones, corrugación o desplazamiento)',
    'exudacion': 'exudación de asfalto',
    'borde': 'desnivel entre carril y berma',
    'otro': 'otras fallas',
}
CAUSAS = {
    'estructural': 'indica fatiga de la carpeta asfáltica o pérdida de soporte de la base bajo las cargas del tránsito',
    'grietas': 'se debe a contracción térmica, envejecimiento del ligante o reflexión de capas inferiores, y deja entrar agua a la base',
    'envejecimiento': 'resulta de la oxidación del ligante y la pérdida de finos por sol y lluvia; vuelve frágil la superficie',
    'desgaste': 'se debe a ligante insuficiente o envejecido; la superficie pierde agregado y se vuelve rugosa',
    'friccion': 'reduce la resistencia al deslizamiento, sobre todo con el pavimento mojado',
    'deformacion': 'muestra deformación permanente de las capas por cargas pesadas, mezcla inestable o base débil',
    'exudacion': 'se debe a exceso de asfalto en la mezcla o en riegos anteriores; la superficie se vuelve resbaladiza',
    'borde': 'se debe a erosión o asentamiento del hombro y es un riesgo para vehículos que salen del carril',
    'otro': 'requiere revisión puntual',
}
EFECTO = {
    'monitoreo': 'no requiere tratamiento global en este ciclo; basta con las reparaciones locales y reinspeccionar',
    'sellado_grietas': 'impide que el agua entre por las grietas a la base y frena su crecimiento',
    'fog_seal': 'renueva la película de ligante de la superficie y sella microfisuras',
    'rejuvenecedor': 'restituye parte de los aceites del ligante oxidado y le devuelve flexibilidad',
    'sand_seal': 'sella la superficie y recupera algo de textura con arena',
    'chip_seal': 'sella la superficie y recupera la fricción con una capa de gravilla',
    'slurry_seal': 'sella y renueva la textura con una capa delgada de mortero asfáltico',
    'micropavimento': 'renueva la superficie, recupera la fricción y rellena roderas leves con una mezcla de emulsión modificada apta para tránsito alto',
    'thin_overlay': 'restituye la regularidad y la capa de rodadura con una mezcla en caliente de hasta 40 mm',
    'mill_and_replace': 'retira la capa dañada y la repone con mezcla nueva sin cambiar la rasante',
    'sobrecapa_estructural': 'añade espesor para recuperar la capacidad portante',
    'fresado_sobrecapa_estructural': 'retira la capa dañada y añade espesor estructural manteniendo el nivel del bordillo',
    'fdr': 'pulveriza y estabiliza el paquete existente para formar una base nueva',
    'reconstruccion': 'reemplaza todas las capas hasta la subrasante',
}
RAZON_PREVIO = {
    'sellado_grietas': 'las grietas abiertas se reflejan a través de cualquier capa nueva en pocos meses',
    'parcheo_profundidad_parcial': 'el material suelto o agrietado no adhiere al tratamiento y se desprende',
    'parcheo_profundidad_total': 'los baches y la piel de cocodrilo alta señalan base dañada: sin reponerla, la falla reaparece; además son un riesgo inmediato para el tránsito',
    'parcheo_superficial': 'las depresiones acumulan agua y deben nivelarse antes de colocar otra capa',
    'fresado_local': 'las deformaciones deben retirarse para no copiarlas en la capa nueva',
    'arenado_exudacion': 'el exceso de asfalto en la superficie debe neutralizarse para que el tratamiento adhiera y no resbale',
    'relleno_roderas': 'las roderas retienen agua y causan hidroplaneo; deben rellenarse antes del sello',
    'nivelacion_hombros': 'el desnivel entre carril y berma es un riesgo de pérdida de control del vehículo',
}
CONSECUENCIA = {
    'A': 'Si se difiere, el envejecimiento y las grietas dejarán entrar agua a la base y el tramo pasará a la franja de rehabilitación, donde el costo por metro cuadrado es varias veces mayor.',
    'B': 'Si se difiere, el daño avanzará hacia la base y el tramo pasará a rehabilitación mayor o reconstrucción, con un costo mucho mayor.',
    'C': 'Si se difiere, seguirán creciendo baches, hundimientos y desprendimientos, con riesgo creciente para conductores, motociclistas y peatones.',
}
ESTADO = {
    'financiado': 'queda financiado en este ciclo',
    'solo_seguridad': 'queda diferido; solo se financian sus reparaciones de seguridad',
    'diferido': 'queda diferido por falta de presupuesto',
    'sin_presupuesto': 'se valoró sin tope de presupuesto',
}
MODOS = {
    'costo_beneficio': 'mayor beneficio por dólar (relación beneficio/costo)',
    'peor_primero': 'reparar primero lo más dañado (menor PCI primero)',
}
TERMINOS = [
    ('Pavement Condition Index (PCI)', 'Índice de Condición del Pavimento', 'Calificación de 0 a 100 del estado superficial según ASTM D6433.'),
    ('ESAL (Equivalent Single Axle Load)', 'Carga equivalente de eje simple', 'Número de pasadas de un eje de 80 kN equivalentes al tránsito real; mide la carga de diseño.'),
    ('Sample unit', 'Unidad de muestra', 'Porción del tramo (225 ± 90 m² en asfalto) donde se miden las fallas.'),
    ('Tack coat', 'Riego de liga', 'Emulsión que adhiere una capa nueva de mezcla a la existente.'),
    ('Curb', 'Bordillo', 'Borde de concreto entre la calzada y la acera; limita cuánto puede subir la rasante.'),
    ('Performance curve', 'Curva de comportamiento o de deterioro', 'Evolución del PCI con la edad del pavimento; su área sobre el mínimo aceptable mide el beneficio de una obra.'),
]


def dinero(n, moneda='USD'):
    return f"{n:,.2f}".replace(',', ' ') + f' {moneda}'


def num(n):
    return f"{n:,.2f}".replace(',', ' ').rstrip('0').rstrip('.') if isinstance(n, float) else f"{n:,}".replace(',', ' ')


# Datos que identifican al proyecto o a las personas: no se envían a ningún modelo (puede ser un servicio externo).
IDENTIFICADORES_PROYECTO = ('id', 'nombre', 'descripcion', 'inspector', 'entidad', 'ubicacion', 'huella_entrada')
IDENTIFICADORES_TRAMO = ('ubicacion',)


def resumen_para_modelo(analisis):
    """Análisis sin lo que el redactor no necesita (muestras crudas, tabla de costos, parámetros) ni datos que identifiquen
    al proyecto, al inspector o a la entidad (nombre, inspector, entidad, ubicación). Se conservan los nombres de los tramos."""
    cal = analisis['calibracion_usada']
    tramos = []
    for t in analisis['tramos']:
        t = {k: v for k, v in t.items() if k != 'muestras' and k not in IDENTIFICADORES_TRAMO}
        t['n_muestras'] = len(analisis['tramos'][len(tramos)]['muestras'])
        tramos.append(t)
    proyecto = {k: v for k, v in (analisis.get('proyecto') or {}).items() if k not in IDENTIFICADORES_PROYECTO}
    return dict(analisis, proyecto=proyecto, tramos=tramos, calibracion_usada=dict(
        tratamientos_disponibles=cal['tratamientos_disponibles'], modo_priorizacion=cal.get('modo_priorizacion'),
        presupuesto=cal.get('presupuesto'), moneda=cal.get('moneda'),
        costos_de_ejemplo=sorted(k for k, c in cal.get('costos', {}).items() if c['origen'] == 'ejemplo')))


def construir_mensajes(analisis):
    return {'system': (RAIZ / 'prompt/sistema.md').read_text(encoding='utf-8'),
            'user': json.dumps(resumen_para_modelo(analisis), ensure_ascii=False, separators=(',', ':'))}


def _rango(analisis, nivel_id):
    u = analisis['calibracion_usada']['umbrales_pci']
    orden = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    i = orden.index(nivel_id)
    alto = 100 if i == 0 else u[orden[i - 1]]
    return f"{num(float(u[nivel_id]))} a menos de {num(float(alto))}" if i else f"{num(float(u[nivel_id]))} a 100"


def _tramo(analisis, t, items, moneda, param):
    dg = analisis.get('modo') == 'diagnostico'
    trat = t['tratamiento']
    sel = trat['seleccionado'] or trat['ideal']
    nombre_sel = f"{items[sel]['nombre'].lower()} ({items[sel]['nombre_en']})"
    ctx = t['contexto_usado']
    muestras = t['muestras']
    n_ad = sum(1 for m in muestras if m.get('adicional'))
    area_insp = sum(m['area_m2'] for m in muestras)

    # Diagnóstico
    if t['fallas']:
        top = sorted(t['fallas'], key=lambda f: -f['densidad_pct'])[:4]
        lista = '; '.join(
            f"{f['nombre'].lower()} ({f['nombre_en']}) de severidad {f['severidad']} ({f['descripcion_severidad'][0].lower() + f['descripcion_severidad'][1:]}), "
            f"densidad {num(f['densidad_pct'])} % y {num(f['cantidad_estimada_tramo'])} {f['unidad'].replace('m2', 'm²')} estimados en el tramo"
            for f in top)
        grupos = []
        for f in sorted(t['fallas'], key=lambda f: -f['densidad_pct']):
            if f['grupo'] not in grupos:
                grupos.append(f['grupo'])
        causas = ' '.join(f"El {GRUPOS[g].split(' (')[0]} {CAUSAS[g]}." for g in grupos[:2])
        diag = (f"Se inspeccionaron {len(muestras)} unidades de muestra ({num(area_insp)} m², {num(round(100 * area_insp / t['area_m2'], 1))} % del tramo"
                f"{f', {n_ad} adicional' + ('es' if n_ad > 1 else '') if n_ad else ''}). Las fallas de mayor densidad son: {lista}. {causas} "
                f"El área con daño estructural de severidad media o alta equivale al {num(t['pct_area_estructural'])} % del tramo.")
    else:
        diag = f"Se inspeccionaron {len(muestras)} unidades de muestra y no se registraron fallas."

    # Justificación
    base = (f"Con PCI {num(t['pci'])} el tramo está en el rango {_rango(analisis, t['nivel_id'])} ({t['categoria'].lower()}), que la matriz del agente asigna a "
            f"{t['nivel'].lower()} (nivel {t['nivel_id']}). Los cortes de la matriz son de la tesis y unifican los ejemplos del MS-16, 4.ª ed. 2009 (Fig. 3.1, p. 33, y Tabla 1.1, p. 14).")
    min_cm = param['bordillo_min_cm']['valor']
    if trat['regla'] == 'deterioro_dominante':
        dom = t['deterioro_dominante']
        regla = (f"En la franja A el PCI solo no define el tratamiento: se elige por el deterioro dominante, que es {GRUPOS[dom]}." if dom
                 else "No hay un deterioro dominante con densidad suficiente.")
    elif trat['regla'] == 'bordillo':
        if ctx['tipo_via'] == 'rural':
            regla = "La vía es rural y no tiene bordillo, por lo que la rasante puede subir; se agrega la conformación de hombros para no dejar desnivel en el borde."
        elif ctx['bordillo'] == 'suficiente':
            regla = (f"La vía es urbana con bordillo de {num(ctx['altura_bordillo_cm'])} cm, igual o mayor que {min_cm} cm (3 in): se puede subir la rasante con una sobrecapa "
                     "sin ahogar la cuneta (MS-16, 4.ª ed. 2009, Fig. 1.4 y Tabla 1.1).")
        else:
            h = f"de {num(ctx['altura_bordillo_cm'])} cm" if ctx.get('altura_bordillo_cm') is not None else "de altura desconocida (se asumió el caso conservador)"
            regla = (f"La vía es urbana con bordillo {h}, menor que {min_cm} cm (3 in): una sobrecapa subiría la rasante hasta el bordillo y desviaría el agua de lluvia "
                     "hacia aceras y viviendas, por lo que se retira la capa dañada y se repone al mismo nivel (MS-16, 4.ª ed. 2009, Fig. 1.4 y Tabla 1.1).")
    elif trat['regla'] == 'estructural':
        u = param['umbral_estructural_pct']['valor']
        perdida = t['pct_area_estructural'] >= u or ctx.get('drenaje') == 'malo'
        motivo = (f"el área con daño estructural es {num(t['pct_area_estructural'])} % (umbral {u} %)" + (" y el drenaje está en mal estado" if ctx.get('drenaje') == 'malo' else ''))
        regla = (f"En este rango se revisa si la estructura es recuperable: {motivo}, por lo que " +
                 ("se considera perdida y se requiere reconstruir." if perdida else "aún se prueba una solución estructural antes de reconstruir."))
    else:
        regla = "Por debajo de PCI 26 el paquete de capas perdió su capacidad portante: la única solución duradera es reconstruir."
    eleccion = f"Se recomienda {nombre_sel}, que {EFECTO.get(sel, 'atiende el deterioro principal')}."
    if trat['seleccionado'] is None:
        eleccion = f"No hay solución ejecutable con el equipo disponible; {'se recomienda contratar' if dg else 'se presupuesta'} {nombre_sel}."
    elif trat['interino']:
        eleccion = (f"Se propone {nombre_sel} como solución interina: {EFECTO.get(sel, '')}, pero no corrige la causa; la solución requerida es "
                    f"{items[trat['ideal']]['nombre'].lower()}.")
    if t['nivel_id'] in ('B2', 'C1', 'C2'):
        eleccion += " El espesor no lo calcula el agente: debe diseñarse con MS-17, MS-4 y MS-22 a partir de deflexiones, tránsito y suelos."
    bd = t.get('beneficio_detalle')
    if bd and bd['anios_recuperados'] > 0:
        eleccion += (f" La obra devuelve el tramo a la condición que tenía hace {num(bd['anios_recuperados'])} años de deterioro (edad efectiva de "
                     f"{num(bd['edad_efectiva_antes'])} a {num(bd['edad_efectiva_despues'])} años) y recupera {num(bd['area_pci_anio_m2'])} PCI·año por m² "
                     f"sobre el PCI mínimo de {num(float(bd['pci_minimo']))}.")
    just = f"{base} {regla} {eleccion}"
    if t['supuestos']:
        just += ' Supuestos: ' + ' '.join(t['supuestos'])

    # Trabajos previos
    if t['trabajos_previos']:
        partes = []
        for p in t['trabajos_previos']:
            razon = RAZON_PREVIO.get(p['actividad'], 'es necesario antes del tratamiento')
            costo_txt = '' if dg else f" ({dinero(p['costo'], moneda)})"
            partes.append(f"{p['nombre']}: {num(p['cantidad'])} {p['unidad'].replace('m2', 'm²')}{costo_txt}, porque {razon}"
                          + ('; no hay equipo propio y debe subcontratarse' if not p['disponible'] else ''))
        previos = 'Antes del tratamiento son obligatorios: ' + '. '.join(partes) + '.'
    else:
        previos = f"El tratamiento seleccionado ({items[sel]['nombre'].lower()}) retira o reemplaza las zonas dañadas, por lo que absorbe las reparaciones localizadas."
    if t['prioridad'].get('costo_interino_si_diferido') and not t['trabajos_previos']:
        previos += f" Mientras la obra no se ejecute, las reparaciones de seguridad cuestan {dinero(t['prioridad']['costo_interino_si_diferido'], moneda)}."

    # Consecuencia
    cons = CONSECUENCIA[t['franja']]
    if t['prioridad'].get('costo_interino_si_diferido'):
        cons += f" Si no se financia la obra completa, deben hacerse al menos las reparaciones de seguridad ({dinero(t['prioridad']['costo_interino_si_diferido'], moneda)})."
    if not dg:
        cons += f" Con el presupuesto disponible el tramo {ESTADO[t['prioridad']['estado']]}."

    d = dict(tramo_id=t['id'], diagnostico=diag, justificacion=just, trabajos_previos=previos, consecuencia_si_se_difiere=cons)
    sin_eq = [p for p in t['trabajos_previos'] if not p['disponible']]
    if trat['ideal'] != trat['seleccionado'] or sin_eq:
        nota = []
        if trat['ideal'] != trat['seleccionado']:
            desc = '; '.join(f"{items[x['id']]['nombre'].lower()}: {x['razon']}" for x in trat['descartados'])
            nota.append(f"La solución preferida era {items[trat['ideal']]['nombre'].lower()} ({items[trat['ideal']]['nombre_en']}). Se descartaron: {desc}.")
            if trat['interino']:
                nota.append("La alternativa es interina: conviene contratar la solución requerida en el próximo ciclo.")
        if sin_eq:
            nota.append('Sin equipo propio para: ' + ', '.join(p['nombre'].lower() for p in sin_eq) + '; ' + ('deben subcontratarse.' if dg else 'se presupuestan para subcontratar.'))
        d['nota_equipo'] = ' '.join(nota)
    return d


ACCION = {
    'DATO_FALTANTE': 'Completar el dato en la próxima inspección y volver a generar el informe.',
    'TRATAMIENTO_IDEAL_NO_DISPONIBLE': 'Valorar contratar la solución preferida.',
    'SOLUCION_INTERINA': 'Programar la solución requerida; la interina solo gana tiempo.',
    'SIN_SOLUCION_DISPONIBLE': 'Contratar la solución presupuestada.',
    'PALIATIVO_NO_DISPONIBLE': 'Subcontratar el trabajo previo antes del tratamiento.',
    'PARCHEO_EXCESIVO': 'Evaluar el nivel de intervención siguiente.',
    'DANO_ESTRUCTURAL_FRANJA_A': 'Verificar en campo; un tratamiento superficial no corrige daño estructural.',
    'DETERIORO_ACELERADO': 'Investigar la causa antes de invertir.',
    'DRENAJE_MALO': 'Incluir la corrección del drenaje en la obra.',
    'MUESTREO_INSUFICIENTE': 'Evaluar unidades de muestra adicionales.',
    'PCI_INCONSISTENTE': 'Revisar el cálculo del PCI del tramo.',
    'PRESUPUESTO_INSUFICIENTE_SEGURIDAD': 'La entidad debe conocer este riesgo por escrito y buscar fondos de emergencia.',
    'COSTOS_DE_EJEMPLO': 'Reemplazarlos por costos reales en el panel.',
}


def narrativa_automatica(analisis):
    items = leer('catalogo/tratamientos.json')['items']
    red = analisis['red']
    cal = analisis['calibracion_usada']
    dg = analisis.get('modo') == 'diagnostico'
    moneda = cal.get('moneda')
    param = cal['parametros']
    tramos = analisis['tramos']
    ts = [_tramo(analisis, t, items, moneda, param) for t in tramos]

    alertas = []
    for t in tramos:
        for a in t['alertas']:
            if a['nivel'] in ('advertencia', 'critica'):
                alertas.append(dict(codigo=a['codigo'], tramo_id=t['id'], texto=f"{t['nombre']}: {a['mensaje']} {ACCION.get(a['codigo'], '')}".strip()))
    for a in analisis['alertas_globales']:
        if a['nivel'] in ('advertencia', 'critica'):
            alertas.append(dict(codigo=a['codigo'], tramo_id=None, texto=f"{a['mensaje']} {ACCION.get(a['codigo'], '')}".strip()))

    por_nivel = {}
    for t in tramos:
        por_nivel.setdefault(t['nivel'], []).append(t['nombre'])
    niveles = '; '.join(f"{k.lower()}: {', '.join(v)}" for k, v in por_nivel.items())
    fin = [t for t in tramos if t['prioridad']['estado'] == 'financiado']
    seg = [t for t in tramos if t['prioridad']['estado'] == 'solo_seguridad']
    dif = [t for t in tramos if t['prioridad']['estado'] == 'diferido']
    presupuesto = cal.get('presupuesto')
    criticas = [a for a in alertas if any(x['codigo'] == a['codigo'] and x['nivel'] == 'critica' for t in tramos for x in t['alertas']) or a['codigo'] == 'PRESUPUESTO_INSUFICIENTE_SEGURIDAD']
    preliminar = any(a['codigo'] == 'COSTOS_DE_EJEMPLO' for a in analisis['alertas_globales'])

    if dg:
        resumen = (f"Informe patológico de {len(tramos)} {'tramo' if len(tramos) == 1 else 'tramos'} de pavimento flexible con un área total de {num(red['area_total_m2'])} m² y un PCI ponderado de {num(red['pci_ponderado'])}. "
                   f"Por nivel de intervención: {niveles}. Este informe no incluye costos ni presupuesto: solo el diagnóstico y las intervenciones que se deberían hacer, con sus cantidades físicas.")
        if len(tramos) > 1:
            resumen += " Los tramos se listan en el orden de inspección."
    else:
      resumen = (f"Se {'evaluó 1 tramo' if len(tramos) == 1 else f'evaluaron {len(tramos)} tramos'} de pavimento flexible con un área total de {num(red['area_total_m2'])} m² y un PCI ponderado de {num(red['pci_ponderado'])}. "
                 f"Por nivel de intervención: {niveles}. El costo total para atender {'el tramo' if len(tramos) == 1 else 'todos los tramos'} es {dinero(red['costo_total_necesario'], moneda)}")
      if presupuesto is None:
          resumen += ", sin tope de presupuesto definido."
      else:
          resumen += (f" frente a un presupuesto de {dinero(presupuesto, moneda)}. Con el modo {MODOS[cal['modo_priorizacion']]} se financian "
                      f"{dinero(red['costo_financiado'], moneda)}, primero las reparaciones de seguridad de todos los tramos ({dinero(red['costo_seguridad'], moneda)})")
          resumen += (f" y luego las obras completas de {', '.join(t['nombre'] for t in fin)}." if fin else "; no alcanza para ninguna obra completa.")
          if seg:
              resumen += f" Sin obra completa pero con sus reparaciones de seguridad financiadas quedan: {', '.join(t['nombre'] for t in seg)}."
          if dif:
              resumen += f" Quedan diferidos sin ninguna partida: {', '.join(t['nombre'] for t in dif)}."
          if seg or dif:
              resumen += f" El faltante para atender toda la red es {dinero(red['faltante'], moneda)}."
          resumen += f" El PCI ponderado de la red pasaría de {num(red['pci_ponderado'])} a {num(red['pci_ponderado_despues'])}."
      if criticas:
          resumen += f" Hay {len(criticas)} alerta{'s' if len(criticas) > 1 else ''} crítica{'s' if len(criticas) > 1 else ''}: {criticas[0]['texto']}"
      if preliminar:
          resumen += " Parte de los costos unitarios son de ejemplo, por lo que el presupuesto es preliminar."

    cm = red.get('comparacion_modos') or {}
    if dg:
        prio = ("Modo diagnóstico: el agente no sugiere un orden de intervención. Los tramos se listan en el orden en que se inspeccionaron, porque sin curvas de deterioro "
                "ni análisis costo-beneficio no hay base para decir cuál atender primero. Si necesita un orden, use el filtro «ordenar de peor a mejor PCI» del panel; es solo un ordenamiento, no una prioridad.")
    elif red.get('un_solo_tramo'):
        t0 = tramos[0]
        prio = ("El análisis tiene un solo tramo, por lo que no hay red que priorizar: no se ordena ni se compara el modo de priorización. "
                f"{t0['nombre']} requiere una inversión de {dinero(t0['costos']['total'], moneda)}"
                + ('.' if presupuesto is None else (' y queda financiado con el presupuesto indicado.' if t0['prioridad']['estado'] == 'financiado'
                                                    else ' y el presupuesto indicado no alcanza para ejecutarlo completo.')))
    elif presupuesto is None:
        prio = f"No se definió presupuesto: los tramos se ordenan por {MODOS[cal['modo_priorizacion']]} solo como referencia."
    else:
        orden = [next(t for t in tramos if t['id'] == i) for i in red['orden_ejecucion']]
        prio = (f"Se usó el modo {MODOS[cal['modo_priorizacion']]}. " +
                ("Este modo protege primero los tramos donde cada dólar rinde más condición durante más años, y evita que los tramos aún buenos caigan a rehabilitación. "
                 if cal['modo_priorizacion'] == 'costo_beneficio' else
                 "Este modo atiende primero lo más dañado; suele dar menos condición global por dólar, porque las obras de rehabilitación y reconstrucción son más caras. ") +
                f"En ambos modos se reservan primero {dinero(red['costo_seguridad'], moneda)} para las reparaciones de seguridad de todos los tramos. Orden resultante: " +
                '; '.join(f"{t['prioridad']['posicion']}. {t['nombre']} ({ESTADO[t['prioridad']['estado']]}, {dinero(t['costos']['total'], moneda)})" for t in orden) + '.')
        saldo = red.get('saldo_sin_asignar', 0)
        if saldo > 0:
            pend = [t for t in orden if t['prioridad']['estado'] != 'financiado']
            prio += (f" Quedan {dinero(saldo, moneda)} sin asignar porque la siguiente obra pendiente ({pend[0]['nombre'] if pend else '—'}) no cabe completa; "
                     "se pueden reservar para el próximo ciclo, ampliar con otra partida o ejecutar la obra por etapas, decisión que corresponde a la entidad.")
        if cm:
            nombres = ', '.join(next(t['nombre'] for t in tramos if t['id'] == i) for i in cm['tramos_financiados']) or 'ninguna obra completa'
            ben = sum(t['beneficio'] for t in tramos if t['prioridad']['estado'] == 'financiado')
            prio += (f" Con el modo {MODOS[cm['modo']]} y el mismo presupuesto se financiaría: {nombres}. El PCI de la red justo después de las obras quedaría en "
                     f"{num(cm['pci_ponderado_despues'])} (frente a {num(red['pci_ponderado_despues'])} con el modo elegido) y el beneficio acumulado en el tiempo sería "
                     f"{num(round(cm['beneficio_total']))} PCI·año·m² (frente a {num(round(ben))}).")
            if (red['pci_ponderado_despues'] < cm['pci_ponderado_despues']) != (ben < cm['beneficio_total']):
                prio += (" Los dos indicadores no coinciden: el PCI inmediato mide la condición el día después de la obra, mientras que el beneficio mide la condición "
                         "que se conserva durante los años siguientes. La preservación de tramos buenos sube poco el PCI inmediato, pero evita que esos tramos "
                         "caigan a rehabilitación; las obras grandes sobre tramos malos suben más el PCI inmediato, pero cuestan mucho más por cada año de condición recuperado.")

    if dg:
        concl = [f"La red tiene un PCI ponderado de {num(red['pci_ponderado'])}; {sum(1 for t in tramos if t['franja'] != 'A')} de {len(tramos)} tramos requieren rehabilitación o reconstrucción."]
    else:
        costo_bc = sum(t['costos']['total'] for t in tramos if t['franja'] in ('B', 'C'))
        concl = [f"La red tiene un PCI ponderado de {num(red['pci_ponderado'])}; {sum(1 for t in tramos if t['franja'] != 'A')} de {len(tramos)} tramos requieren rehabilitación o reconstrucción y concentran el "
                 f"{num(round(100 * costo_bc / red['costo_total_necesario'], 1)) if red['costo_total_necesario'] else 0} % del costo necesario."]
    if not dg and presupuesto is not None and red['costo_total_necesario']:
        concl.append(f"El presupuesto cubre el {num(round(100 * min(presupuesto, red['costo_total_necesario']) / red['costo_total_necesario'], 1))} % del costo necesario.")
    concl.append("Las reparaciones de seguridad (baches, piel de cocodrilo alta, desniveles y deformaciones altas) " + ("deben hacerse antes que cualquier obra, en todos los tramos." if dg else "se financian antes que cualquier obra, en todos los tramos."))
    alt = [t['nombre'] for t in tramos if t['tratamiento']['ideal'] != t['tratamiento']['seleccionado']]
    if alt:
        concl.append(f"Por equipo, tránsito o fallas incompatibles, {', '.join(alt)} usan una solución distinta de la preferida.")
    concl.append("Los tratamientos preventivos sobre tramos en buen estado cuestan una fracción de la rehabilitación y alargan la vida de la red.")

    recom = ["Completar en la próxima inspección los datos que el agente tuvo que asumir y volver a generar el informe."]
    if preliminar:
        recom.append("Sustituir los costos unitarios de ejemplo por costos reales de la entidad o de cotizaciones antes de usar el presupuesto.")
    if any(t['nivel_id'] in ('B2', 'C1', 'C2') for t in tramos):
        recom.append("Para los tramos de rehabilitación mayor y reconstrucción, contratar estudios de deflexión, tránsito y suelos y diseñar el espesor según MS-17, MS-4 y MS-22.")
    if any(a['codigo'] == 'DRENAJE_MALO' for t in tramos for a in t['alertas']):
        recom.append("Incluir la corrección del drenaje en el alcance de las obras donde se señaló drenaje malo.")
    if any(a['codigo'] in ('PALIATIVO_NO_DISPONIBLE', 'SOLUCION_INTERINA', 'SIN_SOLUCION_DISPONIBLE') for t in tramos for a in t['alertas']):
        recom.append("Evaluar la contratación del equipo o los servicios que faltan para ejecutar las soluciones requeridas.")
    recom.append("Revisar los umbrales de la matriz " + ("" if dg else "y los costos unitarios ") + "al menos una vez al año (MS-16, 4.ª ed. 2009, Sec. 1.5.2, p. 14).")
    if dg:
        recom.append("Para estimar costos y priorizar la inversión, volver a generar el análisis en modo completo con costos unitarios y presupuesto reales.")
    recom.append("Sugerencia del agente para la reinspección: cada 2 años los tramos de mantenimiento preventivo, cada año los de rehabilitación, y antes y después de la obra los de reconstrucción.")

    limit = ["Este informe es un apoyo a la decisión: debe revisarlo y firmarlo un ingeniero idóneo antes de usarlo para contratar u ordenar obras.",
             "Las cantidades se extrapolan desde las unidades de muestra inspeccionadas al área total de cada tramo.",
             ("El PCI esperado después de cada tratamiento es una estimación por defecto del agente, no un valor normativo; en modo diagnóstico no se usa curva de deterioro ni beneficio." if dg else
              "El PCI esperado después de cada tratamiento, la curva de deterioro (β y años hasta el PCI mínimo) y el beneficio son estimaciones por defecto del agente, no valores normativos; deben calibrarse con el historial de inspecciones de la red."),
             "Los factores de conversión (metros de grieta por m² de bloque, área por bache, franjas de parcheo) son supuestos calibrables."]
    if any(a['codigo'] == 'MUESTREO_INSUFICIENTE' for t in tramos for a in t['alertas']):
        limit.append("En los tramos con muestreo insuficiente el PCI y las cantidades tienen más incertidumbre.")
    if preliminar:
        limit.append("Los costos marcados como «ejemplo» no tienen fuente y el presupuesto resultante es solo indicativo.")

    usados = []
    for t in tramos:
        for x in [t['tratamiento']['ideal'], t['tratamiento']['seleccionado']] + [p['actividad'] for p in t['trabajos_previos'] + t['partidas_tratamiento']] + [d['id'] for d in t['tratamiento']['descartados']]:
            if x and x not in usados:
                usados.append(x)
    glos = [dict(termino_en=a, termino_es=b, definicion=c) for a, b, c in TERMINOS if not (dg and a == 'Performance curve')]
    for x in usados:
        it = items[x]
        if x != 'monitoreo':
            glos.append(dict(termino_en=it['nombre_en'], termino_es=it['nombre'], definicion=(EFECTO.get(x) or RAZON_PREVIO.get(x) or 'Actividad del catálogo del agente.').capitalize() + '.'))
    vistos = set()
    for t in tramos:
        for f in t['fallas']:
            if f['tipo'] not in vistos:
                vistos.add(f['tipo'])
                glos.append(dict(termino_en=f['nombre_en'], termino_es=f['nombre'], definicion=f"Falla ASTM D6433 n.º {f['tipo']}; se mide en {f['unidad'].replace('m2', 'm²').replace('und', 'unidades')}."))

    return dict(resumen_ejecutivo=resumen, tramos=ts, priorizacion=prio, alertas=alertas, conclusiones=concl,
                recomendaciones=recom, limitaciones=limit, glosario=glos)


def redactar(analisis, llamar_modelo=None):
    if llamar_modelo is None:
        return narrativa_automatica(analisis), 'automatica'
    mensajes = construir_mensajes(analisis)
    user = mensajes['user']
    esquema = leer('schemas/narrativa.schema.json')
    for _ in range(2):
        try:
            texto = llamar_modelo(mensajes['system'], user)
            texto = re.sub(r'^\s*```(?:json)?\s*|\s*```\s*$', '', texto, flags=re.I)
            data = json.loads(texto)
            errores = list(Draft202012Validator(esquema).iter_errors(data))
            ids = [x['id'] for x in analisis['tramos']]
            recibidos = [x.get('tramo_id') for x in data.get('tramos', [])] if isinstance(data, dict) else []
            if errores or sorted(ids) != sorted(recibidos):
                raise ValueError('; '.join(e.message for e in errores) + '; debe haber un texto por cada tramo del análisis')
            return data, 'modelo'
        except Exception as exc:
            print(f'[agente] el modelo no redactó la narrativa: {exc}'[:500], file=sys.stderr)
            user = mensajes['user'] + '\nCorrige estos errores y devuelve solo el JSON válido: ' + str(exc)
    return narrativa_automatica(analisis), 'automatica'
