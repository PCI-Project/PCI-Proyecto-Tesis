import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from jsonschema import Draft202012Validator, FormatChecker
from . import __version__
from .catalogo import leer, cargar

class EntradaInvalida(Exception):
    def __init__(self, errores):
        self.errores = errores
        super().__init__('; '.join(errores))

def beneficio_curva(pci, pci_despues, edad, p):
    """Beneficio por m² en PCI·año: área de condición sobre el PCI mínimo que la obra recupera.

    Curva de deterioro PCI(t) = 100 - alfa * t**beta. La obra devuelve el tramo a la edad efectiva que
    corresponde a su PCI después; el beneficio es el área entre esa curva y la de no hacer nada, por
    encima del PCI mínimo aceptable (las dos curvas se miden hasta que cruzan ese mínimo).
    """
    c = p['curva_deterioro']; beta = c['beta']; L = p['pci_minimo_aceptable']['valor']
    alfa_def = (100 - L) / c['anios_hasta_pci_minimo'] ** beta
    alfa_min = (100 - L) / c['anios_hasta_pci_minimo_max'] ** beta
    alfa_max = (100 - L) / c['anios_hasta_pci_minimo_min'] ** beta
    if edad and edad > 0 and pci < 100:
        alfa = (100 - pci) / edad ** beta; origen = 'edad'
    else:
        alfa = alfa_def; origen = 'defecto'
    acotado = min(max(alfa, alfa_min), alfa_max)
    if acotado != alfa and origen == 'edad': origen = 'edad_acotada'
    alfa = acotado
    T = ((100 - L) / alfa) ** (1 / beta)
    def edad_ef(q): return ((100 - min(q, 100)) / alfa) ** (1 / beta)
    def area(t):
        if t >= T: return 0.0
        return (100 - L) * (T - t) - alfa / (beta + 1) * (T ** (beta + 1) - t ** (beta + 1))
    t0 = edad_ef(pci); t1 = edad_ef(max(pci, pci_despues))
    return dict(alfa=round(alfa, 5), beta=beta, origen_alfa=origen, pci_minimo=L, anios_hasta_pci_minimo=round(T, 2),
                edad_efectiva_antes=round(t0, 2), edad_efectiva_despues=round(t1, 2), anios_recuperados=round(t0 - t1, 2),
                area_pci_anio_m2=round(max(0.0, area(t1) - area(t0)), 3))

def _sin_dinero(res, orden_inspeccion):
    """Modo diagnóstico (C1): quita todo importe, beneficio, B/C y prioridad; los tramos quedan en orden de inspección."""
    for t in res['tramos']:
        for lista in (t['trabajos_previos'], t['partidas_tratamiento']):
            for x in lista:
                for k in ('costo_unitario', 'costo', 'origen_costo'): x.pop(k, None)
        for k in ('costos', 'beneficio', 'relacion_bc', 'beneficio_detalle'): t.pop(k, None)
        t['prioridad'] = dict(posicion=None, estado='sin_presupuesto')
        for a in t['alertas']:
            a['mensaje'] = a['mensaje'].replace('Se presupuesta', 'Se recomienda contratar').replace(' Está incluido en el presupuesto.', '').replace(' y con peso 1.0 en el beneficio', '')
        t['supuestos'] = [x.replace(' y con peso 1.0 en el beneficio', '') for x in t['supuestos']]
    c = res['calibracion_usada']
    for k in ('presupuesto', 'moneda', 'costos', 'modo_priorizacion'): c.pop(k, None)
    c['modo_analisis'] = 'diagnostico'
    r = res['red']
    for k in ('pci_ponderado_despues', 'costo_seguridad', 'costo_total_necesario', 'costo_financiado', 'costo_interinos_diferidos', 'faltante', 'saldo_sin_asignar', 'comparacion_modos'): r.pop(k, None)
    r['orden_ejecucion'] = list(orden_inspeccion)
    res['alertas_globales'] = [a for a in res['alertas_globales'] if a['codigo'] not in ('COSTOS_DE_EJEMPLO', 'PRESUPUESTO_INSUFICIENTE_SEGURIDAD')]
    for a in res['alertas_globales']:
        if a['codigo'] == 'RECALIBRACION_ANUAL': a['mensaje'] = 'Revisar reglas y umbrales al menos una vez al año.'
    res['alertas_globales'].insert(0, dict(codigo='DIAGNOSTICO_SIN_PRIORIDAD', nivel='info', mensaje='Modo diagnóstico: no se calculan costos, presupuesto, beneficio/costo ni prioridad. Los tramos se listan en el orden de inspección; sin curvas de deterioro y análisis costo-beneficio el agente no sugiere cuál intervenir primero.'))

def analizar(entrada, ahora=None):
    errores = [f"{'/'.join(map(str,e.absolute_path)) or '$'}: {e.message}" for e in Draft202012Validator(leer('schemas/entrada.schema.json'), format_checker=FormatChecker()).iter_errors(entrada)]
    if errores: raise EntradaInvalida(sorted(errores))
    # Regla C2: solo se recomienda si se evaluó el 100 % de las muestras que generó el plan de muestreo.
    pendientes = []
    for t in entrada['tramos']:
        faltan = [str(m['id']) for m in t['muestras'] if m.get('evaluada') is False]
        if faltan:
            pendientes.append(f"COBERTURA_INCOMPLETA: tramo {t['id']}: faltan por evaluar {len(faltan)} de {len(t['muestras'])} muestras generadas ({', '.join(faltan)}). Las recomendaciones de intervención solo se emiten con el 100 % de las muestras evaluadas.")
    if pendientes: raise EntradaInvalida(pendientes)
    cal = entrada['calibracion']
    fallas, items, matriz, p, costos, umbrales = cargar(cal)
    errores = [f'Tratamiento desconocido: {x}' for x in cal['tratamientos_disponibles'] if x not in items]
    if errores: raise EntradaInvalida(errores)
    val = lambda k: p[k]['valor'] if isinstance(p[k], dict) and 'valor' in p[k] else p[k]
    disponibles = set(cal['tratamientos_disponibles'])
    fecha = ahora or datetime.now().astimezone()
    if fecha.tzinfo is None: fecha = fecha.replace(tzinfo=timezone.utc)
    proyecto = dict(entrada['proyecto'], huella_entrada=hashlib.sha256(json.dumps(entrada, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest(), version_motor=__version__)
    usados = dict(tratamientos_disponibles=cal['tratamientos_disponibles'], modo_priorizacion=cal.get('modo_priorizacion','peor_primero'), presupuesto=cal.get('presupuesto'), moneda=cal.get('moneda','USD'), costos=costos, umbrales_pci=umbrales, parametros=p)
    tramos = []
    for t in entrada['tramos']:
        area = t.get('area_m2', t['longitud_m'] * t['ancho_m']); pci = t['pci']; ctx = dict(t.get('contexto') or {}); alertas=[]; supuestos=[]
        def alerta(codigo, nivel, mensaje): alertas.append(dict(codigo=codigo,nivel=nivel,mensaje=mensaje,tramo_id=t['id']))
        asumidos=[]
        def asumir(texto, clave=None):
            supuestos.append(texto); alerta('DATO_FALTANTE','advertencia',texto)
            if clave: asumidos.append(clave)
        if not ctx.get('tipo_via'): ctx['tipo_via']='urbana'; asumir('Tipo de vía no indicado: se asume urbana con bordillo.','tipo_via')
        if ctx['tipo_via']=='urbana' and ctx.get('altura_bordillo_cm') is None: asumir(f"Altura de bordillo no indicada: se asume menor de {val('bordillo_min_cm')} cm (caso conservador), lo que impide subir la rasante.",'altura_bordillo_cm')
        limitado = ctx['tipo_via']=='urbana' and (ctx.get('altura_bordillo_cm') is None or ctx['altura_bordillo_cm'] < val('bordillo_min_cm'))
        ctx['bordillo'] = 'limitado' if limitado else ('suficiente' if ctx['tipo_via']=='urbana' else 'no aplica')
        if not ctx.get('clase_trafico'):
            esal=ctx.get('esal_millones')
            if esal is None: ctx['clase_trafico']='desconocido'; asumir('Tránsito no indicado (ni ESAL ni clase): se trata como medio para las restricciones y con peso 1.0 en el beneficio.','clase_trafico')
            else: ctx['clase_trafico']='bajo' if esal < p['clase_trafico_por_esal']['bajo_max_millones'] else 'medio' if esal < p['clase_trafico_por_esal']['medio_max_millones'] else 'alto'
        muestras=t['muestras']; ar=sum(m['area_m2'] for m in muestras if not m.get('adicional',False)); ad=sum(m['area_m2'] for m in muestras if m.get('adicional',False)); inspeccion=ar+ad
        factor=(area-ad)/ar if ar else 1
        if not ar: asumir('Sin muestras aleatorias: factor de extrapolación igual a 1.')
        ctx['asumidos']=asumidos
        grupos={}
        for m in muestras:
            for f in m['fallas']:
                k=(f['tipo'],f['severidad']); g=grupos.setdefault(k,dict(cantidad=0,estimada=0,muestras=[],deducido=0,tiene_deducido=False))
                g['cantidad']+=f['cantidad']; g['estimada']+=f['cantidad']*(1 if m.get('adicional',False) else factor)
                if m['id'] not in g['muestras']: g['muestras'].append(m['id'])
                if 'valor_deducido' in f: g['deducido']+=f['valor_deducido']; g['tiene_deducido']=True
        agregadas=[]; puntajes=defaultdict(float); densidades=defaultdict(float); estructural=0
        for (tipo,sev),g in sorted(grupos.items(),key=lambda x:(float(x[0][0]),'LMHU'.index(x[0][1]))):
            f=fallas[tipo]; dens=g['cantidad']/inspeccion*100; estim=g['estimada']; grupo=f['grupo']
            densidades[grupo]+=dens; puntajes[grupo]+=g['deducido'] if g['tiene_deducido'] else dens*p['peso_severidad'][sev]
            if f['estructural'] and sev in ('M','H') and f['unidad']=='m2': estructural+=estim
            if tipo=='13': estructural+=estim*p['area_por_bache_m2'].get(sev,0)
            agregadas.append(dict(tipo=tipo,nombre=f['nombre'],nombre_en=f['nombre_en'],severidad=sev,descripcion_severidad=f['severidad'].get(sev,'Sin criterio de severidad en el catálogo'),unidad=f['unidad'],cantidad_muestras=round(g['cantidad'],2),densidad_pct=round(dens,2),cantidad_estimada_tramo=round(estim,2),muestras=g['muestras'],grupo=grupo,estructural=f['estructural']))
        pct=100*estructural/area
        nivel=next((n for n in matriz['niveles'] if pci>=umbrales[n['id']]), matriz['niveles'][-1]); dominantes=[g for g in puntajes if densidades[g]>=val('densidad_minima_dominante_pct')]; dominante=max(sorted(dominantes),key=lambda g:puntajes[g]) if dominantes and nivel['franja']=='A' else None
        regla=nivel['regla']
        if regla=='deterioro_dominante': opciones=matriz['deterioro_dominante'].get(dominante,nivel['sin_fallas']) if dominante else nivel['sin_fallas']
        elif regla=='bordillo': opciones=nivel['opciones_rural' if ctx['tipo_via']=='rural' else 'opciones_bordillo_limitado' if limitado else 'opciones_bordillo_suficiente']
        elif regla=='estructural': opciones=nivel['opciones_estructura_perdida' if pct>=val('umbral_estructural_pct') or ctx.get('drenaje')=='malo' else 'opciones_estructura_recuperable']
        else: opciones=nivel['opciones']
        ideal=opciones[0]; descartados=[]
        hay_grietas=any(fallas[f['tipo']]['reparacion_local'].get(f['severidad'],{}).get('actividad')=='sellado_grietas' for f in agregadas)
        def filtrar(opciones):
            for i in opciones:
                it=items[i]; razon=None
                if i=='sellado_grietas' and not hay_grietas: razon='no hay grietas de severidad baja o media que sellar'
                elif i!='monitoreo' and i not in disponibles: razon='sin equipo o contratista'
                elif it.get('trafico_max') and {'bajo':0,'medio':1,'alto':2}.get(ctx['clase_trafico'],1)>{'bajo':0,'medio':1,'alto':2}[it['trafico_max']]: razon='tránsito superior al permitido'
                elif any(f['tipo'] in it.get('no_aplicar_si',{}) and f['severidad'] in it['no_aplicar_si'][f['tipo']] for f in agregadas): razon='falla incompatible con el tratamiento'
                elif limitado and it.get('requiere_bordillo_min_cm') and (ctx.get('altura_bordillo_cm') or 0)<it['requiere_bordillo_min_cm']: razon='bordillo limitado'
                if razon: descartados.append(dict(id=i,nombre=it['nombre'],razon=razon))
                else: return i
            return None
        elegido=filtrar(opciones); interino=False
        nom=lambda i: items[i]['nombre']
        motivos=lambda: '; '.join(f"{nom(d['id'])}: {d['razon']}" for d in descartados)
        if elegido and elegido!=ideal: alerta('TRATAMIENTO_IDEAL_NO_DISPONIBLE','advertencia',f"Se usa {nom(elegido)} en lugar de {nom(ideal)}. Descartados: {motivos()}.")
        if not elegido:
            elegido=filtrar(nivel['interinas']); interino=bool(elegido)
            if elegido: alerta('SOLUCION_INTERINA','critica',f"Ninguna solución de {nivel['nivel'].lower()} es ejecutable ({motivos()}). Se propone {nom(elegido)} como solución interina: contiene el deterioro pero no lo resuelve.")
            else: alerta('SIN_SOLUCION_DISPONIBLE','critica',f"Ninguna solución es ejecutable con el equipo disponible ({motivos()}). Se presupuesta {nom(ideal)} para contratarla.")
        aplicado=elegido or ideal; it=items[aplicado]
        aportes=defaultdict(list)
        for f in agregadas:
            rep=fallas[f['tipo']]['reparacion_local'].get(f['severidad'])
            if not rep: continue
            q=grupos[(f['tipo'],f['severidad'])]['estimada']; conv=rep['conversion']; act=rep['actividad']; factores=[]
            if conv=='area' and (act.startswith('parcheo') or act=='fresado_local'): factores=[val('sobreancho_parcheo')]
            elif conv=='area_a_longitud_bloque': factores=[val('factor_grieta_bloque_m_por_m2')]
            elif conv=='longitud_por_ancho_grieta': factores=[val('ancho_franja_grieta_m'),val('sobreancho_parcheo')]
            elif conv=='longitud_por_ancho_borde': factores=[val('ancho_franja_borde_m'),val('sobreancho_parcheo')]
            elif conv=='longitud_por_ancho_deformacion': factores=[val('ancho_deformacion_m')]
            elif conv=='conteo_a_area_bache': factores=[p['area_por_bache_m2'][f['severidad']]]
            cantidad=q
            for x in factores: cantidad*=x
            u=lambda x: {'m2':'m²','und':'und'}.get(x,x)
            motivo=f"{f['nombre']} ({f['tipo']}) {f['severidad']}: {round(q,2)} {u(f['unidad'])}"+''.join(f' × {x}' for x in factores)+f" = {round(cantidad,2)} {u(items[act]['unidad'])}"
            aportes[act].append((cantidad,motivo,f['tipo']+' '+f['severidad'],rep['seguridad']))
        def partida(act, cantidad, motivo, origen=(), seguridad=False):
            c=costos[act]; cantidad=round(cantidad,2)
            return dict(actividad=act,nombre=items[act]['nombre'],cantidad=cantidad,unidad=c['unidad'],costo_unitario=c['valor'],costo=round(cantidad*c['valor'],2),origen_costo=c['origen'],motivo=motivo,fallas_origen=list(origen),seguridad=seguridad,disponible=act in disponibles or act=='monitoreo')
        previos=[]; seguridad_costos=[]
        for act, lista in aportes.items():
            seg=[x for x in lista if x[3]]
            if seg: seguridad_costos.append(partida(act,sum(x[0] for x in seg),'; '.join(x[1] for x in seg),[x[2] for x in seg],True))
            if act in it.get('previos',[]) and not (aplicado=='sellado_grietas' and act=='sellado_grietas'):
                part=partida(act,sum(x[0] for x in lista),'; '.join(x[1] for x in lista),[x[2] for x in lista],bool(seg)); previos.append(part)
                if not part['disponible']: alerta('PALIATIVO_NO_DISPONIBLE','advertencia',f"{part['nombre']} ({part['cantidad']} {part['unidad']}) es obligatorio antes del tratamiento y no hay equipo propio: debe subcontratarse. Está incluido en el presupuesto.")
        parcheo=sum(x['cantidad'] for x in previos if x['actividad'].startswith('parcheo'))
        if parcheo>area*.3: alerta('PARCHEO_EXCESIVO','advertencia',f"El parcheo previo ({round(parcheo,2)} m²) supera el 30 % del área del tramo: conviene evaluar el nivel de intervención siguiente.")
        cantidad=0 if aplicado=='monitoreo' else sum(x[0] for x in aportes.get('sellado_grietas',[])) if aplicado=='sellado_grietas' else area
        partes=[partida(aplicado,cantidad,'Tratamiento del tramo')]
        for act in it.get('adicionales',[]): partes.append(partida(act,area,'Actividad sobre el área del tramo'))
        if ctx['tipo_via']=='rural':
            for act in it.get('adicionales_rural',[]): partes.append(partida(act,2*t['longitud_m'],'Ambos hombros'))
        costo_prev=round(sum(x['costo'] for x in previos),2); costo_trat=round(sum(x['costo'] for x in partes),2); sub=round(costo_prev+costo_trat,2); imp=round(sub*val('imprevistos_pct')/100,2); total=round(sub+imp,2); seguridad=round(sum(x['costo'] for x in seguridad_costos)*(1+val('imprevistos_pct')/100),2)
        pcid=min(100, pci+it['pci_resultante']['valor'] if it['pci_resultante']['tipo']=='suma' else it['pci_resultante']['valor'])
        if interino:
            pcid=pci+0.5*max(0,pcid-pci); supuestos.append('Solución interina: se cuenta solo la mitad de la mejora de PCI del tratamiento, porque no corrige la causa del deterioro.')
        pcid=round(pcid,1); vida=it['vida_util_anios']
        if nivel['franja']=='A' and any((f['tipo']=='1' and f['severidad'] in 'MH') or f['tipo']=='13' or (f['tipo']=='15' and f['severidad']=='H') for f in agregadas): alerta('DANO_ESTRUCTURAL_FRANJA_A','advertencia','Hay daño estructural pese al PCI elevado.')
        anio=ctx.get('anio_ultima_intervencion') or ctx.get('anio_construccion'); edad=fecha.year-anio if anio else 0
        bd=beneficio_curva(pci,pcid,edad,p); beneficio=round(bd['area_pci_anio_m2']*area*p['peso_trafico'][ctx['clase_trafico']],2)
        if bd['origen_alfa']=='defecto': supuestos.append(f"Sin edad del pavimento: la curva de deterioro usa el valor por defecto (de PCI 100 al mínimo {bd['pci_minimo']} en {p['curva_deterioro']['anios_hasta_pci_minimo']} años).")
        elif bd['origen_alfa']=='edad_acotada': supuestos.append("La velocidad de deterioro calculada con la edad quedó fuera del rango admitido y se acotó.")
        if edad>0 and (100-pci)/edad>val('tasa_deterioro_alerta_pts_anio'): alerta('DETERIORO_ACELERADO','advertencia',f"El tramo perdió {round((100-pci)/edad,1)} puntos de PCI por año desde {anio}, más que el umbral de {val('tasa_deterioro_alerta_pts_anio')}: revisar estructura, drenaje y cargas.")
        if ctx.get('drenaje')=='malo': alerta('DRENAJE_MALO','advertencia','Drenaje en mal estado: debe corregirse antes de cualquier tratamiento, o el agua volverá a dañar la base.')
        if t.get('muestreo_suficiente') is False: alerta('MUESTREO_INSUFICIENTE','advertencia','El número de unidades de muestra no alcanza el mínimo de ASTM D6433 para el 95 % de confianza: el PCI y las cantidades tienen más incertidumbre.')
        mp=[m for m in muestras if 'pci' in m]
        if mp:
            prom=sum(m['pci']*m['area_m2'] for m in mp)/sum(m['area_m2'] for m in mp)
            if abs(pci-prom)>5: alerta('PCI_INCONSISTENTE','advertencia',f"El PCI del tramo ({pci}) difiere en más de 5 puntos del promedio ponderado de sus muestras ({round(prom,1)}).")
        if any(f['tipo']=='14' for f in agregadas): alerta('CRUCE_FERREO','info','Coordinar con el operador ferroviario.')
        if any(f['tipo']=='2' and f['severidad'] in 'MH' for f in agregadas): alerta('EXUDACION','info','No usar riego de niebla ni rejuvenecedor.')
        if nivel['id'] in ('B2','C1','C2'): alerta('REQUIERE_DISENO','info','Diseñar el espesor mediante estudios de campo según MS-17, MS-4 y MS-22.')
        if pci<=70: alerta('FUERA_ALCANCE_MS16','info','El procedimiento excede el MS-16.')
        refs=nivel['remision']+([it['fuente']] if it.get('fuente') else [])+['ASTM D6433-24 (fallas, severidades y medición)']
        tramos.append(dict(id=t['id'],nombre=t['nombre'],area_m2=round(area,2),longitud_m=t['longitud_m'],pci=round(pci,1),nivel_id=nivel['id'],franja=nivel['franja'],nivel=nivel['nivel'],categoria=nivel['categoria'],contexto_usado=ctx,muestras=muestras,factor_extrapolacion=round(factor,6),fallas=agregadas,deterioro_dominante=dominante,pct_area_estructural=round(pct,2),tratamiento=dict(ideal=ideal,nombre_ideal=items[ideal]['nombre'],seleccionado=elegido,nombre=it['nombre'],nombre_en=it['nombre_en'],disponible=elegido is not None,interino=interino,descartados=descartados,regla=regla,vida_util_anios=vida,pci_despues=pcid),trabajos_previos=previos,partidas_tratamiento=partes,costos=dict(seguridad=round(sum(x['costo'] for x in previos if x['seguridad']),2),previos=costo_prev,tratamiento=costo_trat,subtotal=sub,imprevistos=imp,total=total,costo_m2=round(total/area,2)),beneficio=beneficio,beneficio_detalle=bd,relacion_bc=round(beneficio/total,3) if total else 0,prioridad=dict(posicion=None,estado='sin_presupuesto',costo_interino_si_diferido=seguridad),alertas=alertas,supuestos=supuestos,referencias=list(dict.fromkeys(refs))))
    def asignar(modo):
        orden=sorted(tramos,key=(lambda x:(-x['relacion_bc'],x['pci'],-x['area_m2'],x['id'])) if modo=='costo_beneficio' else (lambda x:(x['pci'],-x['area_m2'],x['id'])))
        presupuesto=cal.get('presupuesto'); estados={}; reservas={x['id']:0 for x in tramos}
        if presupuesto is None: return orden,{x['id']:'sin_presupuesto' for x in tramos},reservas,0,False
        restante=presupuesto
        for x in sorted(tramos,key=lambda x:(x['pci'],-x['area_m2'],x['id'])):
            reserva=min(restante,x['prioridad']['costo_interino_si_diferido']); reservas[x['id']]=reserva; restante=round(restante-reserva,2)
        insuf=sum(x['prioridad']['costo_interino_si_diferido'] for x in tramos)>presupuesto
        for x in orden:
            id=x['id']; reserva=reservas[id]; incremental=x['costos']['total']-reserva
            if not insuf and incremental<=restante:
                restante=round(restante-incremental,2); estados[id]='financiado'
            else: estados[id]='solo_seguridad' if reserva>0 else 'diferido'
        orden=sorted(orden,key=lambda x:{'financiado':0,'solo_seguridad':1,'diferido':2}[estados[x['id']]])
        return orden,estados,reservas,round(presupuesto-restante,2),insuf
    modo=cal.get('modo_priorizacion','peor_primero'); orden,estados,reservas,financiado,insuf=asignar(modo)
    for i,x in enumerate(orden,1): x['prioridad'].update(posicion=i if len(tramos)>1 else None,estado=estados[x['id']])
    total_area=sum(x['area_m2'] for x in tramos)
    def pci_red(est): return round(sum(x['area_m2']*(x['tratamiento']['pci_despues'] if est[x['id']]=='financiado' else x['pci']) for x in tramos)/total_area,1)
    otro='peor_primero' if modo=='costo_beneficio' else 'costo_beneficio'; oo,eo,_,_,_=asignar(otro)
    total=round(sum(x['costos']['total'] for x in tramos),2)
    red=dict(area_total_m2=round(total_area,2),pci_ponderado=round(sum(x['pci']*x['area_m2'] for x in tramos)/total_area,1),pci_ponderado_despues=pci_red(estados),costo_seguridad=round(sum(x['prioridad']['costo_interino_si_diferido'] for x in tramos),2),costo_total_necesario=total,costo_financiado=financiado,costo_interinos_diferidos=round(sum(reservas[x['id']] for x in tramos if estados[x['id']]!='financiado'),2),faltante=round(max(0,total-financiado),2),saldo_sin_asignar=round(max(0,(cal.get('presupuesto') or 0)-financiado),2) if cal.get('presupuesto') is not None else 0,orden_ejecucion=[x['id'] for x in orden],un_solo_tramo=len(tramos)==1)
    if len(tramos)>1: red['comparacion_modos']=dict(modo=otro,tramos_financiados=[x['id'] for x in oo if eo[x['id']]=='financiado'],pci_ponderado_despues=pci_red(eo),beneficio_total=round(sum(x['beneficio'] for x in tramos if eo[x['id']]=='financiado'),2))
    ag=[]
    if insuf: ag.append(dict(codigo='PRESUPUESTO_INSUFICIENTE_SEGURIDAD',nivel='critica',mensaje='El presupuesto no cubre las reparaciones de seguridad; comunicar el riesgo por escrito.'))
    if any(x['origen_costo']=='ejemplo' for t in tramos for x in t['trabajos_previos']+t['partidas_tratamiento']): ag.append(dict(codigo='COSTOS_DE_EJEMPLO',nivel='advertencia',mensaje='Hay costos de ejemplo; el presupuesto es preliminar.'))
    if len(tramos)==1: ag.append(dict(codigo='UN_SOLO_TRAMO',nivel='info',mensaje='Con un solo tramo no hay red: no se calcula ranking de prioridad, reserva de seguridad entre tramos ni comparación de modos de priorización. El costo y la relación B/C del tramo se muestran solo como dato.'))
    ag.append(dict(codigo='RECALIBRACION_ANUAL',nivel='info',mensaje='Revisar reglas y costos al menos una vez al año.'))
    resultado=dict(version='1.0',generado=fecha.isoformat(),proyecto=proyecto,calibracion_usada=usados,tramos=tramos,red=red,alertas_globales=ag)
    resultado['modo']=cal.get('modo_analisis','completo')
    if resultado['modo']=='diagnostico': _sin_dinero(resultado,[t['id'] for t in entrada['tramos']])
    return resultado
