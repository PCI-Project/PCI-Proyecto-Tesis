# Contrato de entrada y salida del agente de recomendaciones

Versión 1.0, 2026-11-03. Proyecto AsphaltPCI Pro (tesis UTP Veraguas).

## 1. Arquitectura

El agente no conversa con nadie: recibe un JSON, lo procesa y devuelve un informe. Tiene tres piezas, en este orden:

```
App web (JavaScript)                         Servicio del agente (Python, otro servidor)
┌──────────────────────────┐   POST JSON    ┌──────────────────────────────────────────────┐
│ Proyecto PCI (tramos,     │ ─────────────> │ 1. Motor de reglas (determinista)            │
│ muestras, fallas)         │  entrada.json  │    matriz, paliativos, cantidades, costos,   │
│ + Panel del agente        │                │    priorización  ──> analisis.json           │
│   (datos faltantes,       │                │ 2. Modelo de lenguaje (redactor)              │
│   calibración, costos,    │                │    prompt/sistema.md + analisis.json          │
│   presupuesto, modo)      │                │    ──> narrativa.json (solo texto)            │
│                           │ <───────────── │ 3. Generador de informe                       │
│ Muestra y descarga        │ analisis.json  │    analisis + narrativa ──> informe.html/.pdf │
│ el informe                │ + informe.pdf  └──────────────────────────────────────────────┘
└──────────────────────────┘
```

Por qué así:
- **Los números los pone el código, no el modelo de lenguaje.** Cantidades, costos, beneficio/costo y orden de ejecución salen siempre iguales para la misma entrada. Eso permite validar el agente en la tesis contra el cálculo manual (objetivo específico 3) y auditar cada cifra.
- **El modelo de lenguaje solo redacta:** diagnóstico, justificación, consecuencias de diferir, alertas en lenguaje claro. No puede cambiar una cifra ni elegir otro tratamiento.
- **Si el modelo de lenguaje falla o no está disponible**, el informe se genera igual con textos automáticos.

Archivos:

| Archivo | Qué es |
|---|---|
| `schemas/entrada.schema.json` | Lo que manda la app |
| `schemas/analisis.schema.json` | Lo que produce el motor |
| `schemas/narrativa.schema.json` | Lo que devuelve el modelo de lenguaje |
| `catalogo/fallas.json` | 20 fallas ASTM D6433-24: unidad, severidades, reparación local obligatoria |
| `catalogo/tratamientos.json` | Tratamientos y actividades: equipo, vida útil, paliativos exigidos |
| `catalogo/matriz.json` | Niveles de PCI y orden de preferencia de soluciones |
| `catalogo/costos_estandar.json` | Costos de ejemplo (sin fuente, para reemplazar) |
| `catalogo/parametros_defecto.json` | Factores de conversión y umbrales calibrables |
| `prompt/sistema.md` | Prompt del modelo de lenguaje |

## 2. Entrada (`entrada.json`)

Esquema completo en `schemas/entrada.schema.json`. Tres bloques:

### 2.1 `proyecto`
`id`, `nombre`, `inspector`, `fecha_inspeccion` (obligatorios), `entidad`, `descripcion`, `ubicacion`.

### 2.2 `calibracion` (la llena el inspector en el panel)

| Campo | Obligatorio | Uso |
|---|---|---|
| `tratamientos_disponibles` | sí | IDs del catálogo que su equipo o contratista puede ejecutar. El motor nunca recomienda algo que no esté aquí sin marcarlo como alerta |
| `modo_analisis` | no | `completo` (por defecto) o `diagnostico`. En `diagnostico` el agente entrega solo el informe patológico: no calcula ni devuelve costos, presupuesto, beneficio, relación B/C ni prioridad, y los tramos quedan en el orden de inspección (ver 3.4). Con este modo solo `tratamientos_disponibles` es obligatorio |
| `modo_priorizacion` | solo en `completo` | `costo_beneficio` o `peor_primero` (por defecto `peor_primero`) |
| `presupuesto` | no | Monto en la moneda indicada; `null` = sin tope (se valora todo y solo se ordena) |
| `costos_unitarios` | no | Reemplaza costos estándar: `{"chip_seal": {"valor": 5.1, "unidad": "m2", "fuente": "Tabla empresa 2026"}}` |
| `moneda` | no | Por defecto USD |
| `umbrales_pci` | no | Límite inferior de A1, A2, B1, B2, C1 si la agencia usa otros cortes |
| `parametros` | no | Cambia valores de `parametros_defecto.json` (ej. `{"area_por_bache_m2": {"L":0.2,"M":0.4,"H":0.8}}`) |

### 2.3 `tramos[]`

Cada tramo trae sus datos geométricos, el PCI, el contexto que el panel completó y **todas las muestras con todas sus fallas**:

```json
{
  "id": "S1", "nombre": "Calle 10ma", "longitud_m": 400, "ancho_m": 7.2, "area_m2": 2880, "pci": 62.4,
  "muestreo_suficiente": true,
  "contexto": { "tipo_via": "urbana", "altura_bordillo_cm": 5, "esal_millones": 0.8, "clase_trafico": null,
                "tpda": 3500, "anio_construccion": 2009, "anio_ultima_intervencion": 2016,
                "drenaje": "regular", "clasificacion_funcional": "colectora" },
  "muestras": [
    { "id": 3, "area_m2": 230.4, "pci": 60.1, "adicional": false, "evaluada": true,
      "fallas": [ { "tipo": "10", "severidad": "M", "cantidad": 38.5 },
                  { "tipo": "13", "severidad": "H", "cantidad": 2 } ] }
  ]
}
```

**Regla de cobertura (C2).** `muestras` trae **todas** las unidades que generó el plan de muestreo del tramo, no una selección. `evaluada` (por defecto `true`) dice si el inspector ya la evaluó: una unidad con fallas está evaluada; una sin fallas lo está solo si el inspector la marcó expresamente (`Sample.evaluated` en la app). Si alguna muestra de algún tramo trae `evaluada: false`, el motor no recomienda nada y el servicio responde 422 con un error `COBERTURA_INCOMPLETA: tramo <id>: faltan por evaluar N de M muestras generadas (ids)…`. El panel lo detecta antes de llamar al servicio y bloquea el botón con el mismo conteo.

`cantidad` va en la unidad que exige ASTM D6433 para esa falla (m², m o unidades; ver `catalogo/fallas.json`). El motor calcula la densidad; no hace falta mandarla. Si la app ya tiene el valor deducido, puede mandarlo en `valor_deducido` y el motor lo usa para escoger el deterioro dominante.

### 2.4 Correspondencia con la app (`types.ts`)

| Entrada del agente | App |
|---|---|
| `proyecto.id / nombre / inspector / fecha_inspeccion` | `Project.id / name / inspector / inspectionDate` |
| `tramos[].id / nombre / longitud_m / ancho_m / area_m2` | `Section.id / name / length / width / area` |
| `tramos[].pci` | `Section.pci` |
| `tramos[].total_unidades_muestra / muestreo_suficiente` | `Section.totalSampleUnits / samplesSufficient` |
| `tramos[].ubicacion` | `Section.location` |
| `muestras[].id / area_m2 / adicional` | `Sample.id / area / isAdditional` |
| `muestras[].pci` | `Sample.calculationDetails.pci` |
| `muestras[].evaluada` | `Sample.evaluated === true` o al menos una falla registrada (`isSampleEvaluated`) |
| `calibracion.modo_analisis` | `AgentConfig.analysisMode` |
| `fallas[].tipo / severidad / cantidad` | `Distress.type / severity / quantity` |
| `fallas[].valor_deducido` | `calculationDetails.summaries[].deductValue` (sumar por tipo y severidad) |
| `contexto.*` y `calibracion.*` | **No existen en la app: los agrega el panel del agente** |

La app hoy solo maneja pavimento flexible, que es lo único que cubre el catálogo.

## 3. Proceso del motor (reglas exactas)

### 3.1 Preparación
1. Validar la entrada contra el esquema. Si falla, devolver error 422 con la lista de campos.
2. Combinar: `parametros_defecto` ← `calibracion.parametros`; `costos_estandar` ← `calibracion.costos_unitarios` (estos quedan con origen `calibrado`, el resto `ejemplo`); umbrales de `matriz.json` ← `calibracion.umbrales_pci`.
3. Rechazar IDs de `tratamientos_disponibles` que no existan en el catálogo (error 422).

### 3.2 Por tramo
1. **Área:** `area_m2`, o `longitud_m × ancho_m`.
2. **Contexto resuelto** (cada valor asumido se agrega a `supuestos` y genera alerta `DATO_FALTANTE`):
   - `tipo_via` nulo → `urbana`.
   - Urbana con `altura_bordillo_cm` nulo → bordillo `limitado` (caso conservador).
   - Bordillo suficiente si `altura_bordillo_cm ≥ bordillo_min_cm` (7.6 cm, MS-16).
   - Rural: no hay restricción de bordillo.
   - `clase_trafico`: la dada; si no, por `esal_millones` (< 0.3 bajo, < 3 medio, resto alto; MS-2); si no, `desconocido` (para restricciones se trata como `medio`).
3. **Extrapolación:** muestras aleatorias (`adicional = false`) y adicionales. `factor = (área tramo − área adicionales) / área aleatorias`. Cantidad estimada en el tramo = suma en aleatorias × factor + suma en adicionales (las adicionales no se extrapolan, como en ASTM D6433).
4. **Fallas del tramo:** agrupar por `tipo` + `severidad`. Para cada grupo: cantidad en muestras, densidad % = cantidad en muestras / área inspeccionada total × 100, cantidad estimada en el tramo, lista de muestras, descripción de la severidad (de `fallas.json`), grupo y si es estructural.
5. **Deterioro dominante** (solo franja A): puntaje por grupo = suma de valores deducidos si vienen; si no, Σ densidad × peso de severidad (L 1, M 2, H 3). Grupos con densidad total < `densidad_minima_dominante_pct` no cuentan. Sin grupos → `null`.
6. **% de área estructural:** área estimada de fallas `estructural = true` en M o H (m²) + baches × `area_por_bache_m2` por severidad, sobre el área del tramo.
7. **Nivel:** según PCI y umbrales: A1 85–100, A2 71–84.99, B1 56–70.99, B2 41–55.99, C1 26–40.99, C2 0–25.99. Nombres: A = Mantenimiento preventivo, B1 = **Rehabilitación menor**, B2 = **Rehabilitación mayor**, C = Reconstrucción.
8. **Opciones según la regla del nivel** (`matriz.json`):
   - `deterioro_dominante`: lista del grupo dominante; sin grupo → lista `sin_fallas`.
   - `monitoreo` no necesita equipo: siempre cuenta como disponible.
   - `bordillo`: rural → `opciones_rural`; urbana con bordillo suficiente → `opciones_bordillo_suficiente`; si no → `opciones_bordillo_limitado`.
   - `estructural`: `% estructural ≥ umbral_estructural_pct` o drenaje `malo` → `opciones_estructura_perdida`; si no → `opciones_estructura_recuperable`.
   - `fija`: `opciones`.
   - `ideal` = primera opción de la lista.
9. **Filtro de cada opción, en orden.** Se descarta (y se anota la razón en `descartados`) si:
   - no está en `tratamientos_disponibles` → "sin equipo o contratista";
   - la clase de tránsito supera `trafico_max`;
   - hay una falla de `no_aplicar_si` en el tramo;
   - exige bordillo (`requiere_bordillo_min_cm`), la vía es urbana y el bordillo es limitado.
   
   `seleccionado` = primera que pasa. Si es distinta de `ideal` → alerta `TRATAMIENTO_IDEAL_NO_DISPONIBLE`. Si ninguna pasa, probar `interinas` con el mismo filtro → `interino = true` y alerta crítica `SOLUCION_INTERINA`. Si tampoco → `seleccionado = null` y alerta crítica `SIN_SOLUCION_DISPONIBLE` (el tramo se presupuesta con el ideal para mostrar cuánto costaría contratarlo).
10. **Trabajos previos (paliativos).** Para cada falla del tramo con `reparacion_local` en su severidad, convertir la cantidad estimada:

    | Conversión | Cantidad de la actividad |
    |---|---|
    | `area` | m² × `sobreancho_parcheo` si la actividad es parcheo o fresado local; m² × 1 en las demás |
    | `longitud` | m |
    | `area_a_longitud_bloque` | m² × `factor_grieta_bloque_m_por_m2` |
    | `longitud_por_ancho_grieta` | m × `ancho_franja_grieta_m` × `sobreancho_parcheo` |
    | `longitud_por_ancho_borde` | m × `ancho_franja_borde_m` × `sobreancho_parcheo` |
    | `longitud_por_ancho_deformacion` | m × `ancho_deformacion_m` |
    | `conteo_a_area_bache` | unidades × `area_por_bache_m2[severidad]` |

    Sumar por actividad (guardando el motivo de cada aporte, p. ej. "Baches H: 4 und × 0.6 m²", las fallas de origen y `seguridad` = alguna lo es). Se incluyen solo las actividades que el tratamiento seleccionado tiene en `previos`; las demás quedan absorbidas. Si el tratamiento seleccionado es `sellado_grietas`, el sellado no va en previos sino como partida del tratamiento (no se cuenta dos veces). Si un paliativo no está disponible → alerta `PALIATIVO_NO_DISPONIBLE` (hay que subcontratarlo; se presupuesta igual). Si el área total de parcheo supera el 30 % del tramo → alerta `PARCHEO_EXCESIVO` (conviene el nivel siguiente).
11. **Partidas del tratamiento:** el tratamiento sobre el área del tramo (m²), o sobre la longitud de grietas si es sellado (m), o 0 si es monitoreo; más `adicionales` sobre el área (limpieza, riego de liga) y, si es rural, `adicionales_rural` sobre 2 × longitud (ambos hombros).
12. **Costos:** cada partida = cantidad × costo unitario (redondeo a 2 decimales al final de cada partida). `seguridad` = previos con seguridad; `previos`; `tratamiento`; `subtotal`; `imprevistos` = subtotal × `imprevistos_pct`; `total`; `costo_m2`. Además `costo_interino_si_diferido` = todas las reparaciones de seguridad del tramo, absorbidas o no, más imprevistos.
13. **Después de la obra:** `pci_despues` según `pci_resultante` (suma con tope 100, o fijo); `vida_util_anios`. Si la solución es interina se cuenta solo la mitad de la mejora y se declara como supuesto. `sellado_grietas` se descarta si no hay grietas L o M que sellar.
14. **Beneficio** (área entre curvas de comportamiento sobre el PCI mínimo):
    - Curva de deterioro del tramo: PCI(t) = 100 − α·t^β, con β = `curva_deterioro.beta` (1.5).
    - α = (100 − PCI) / edad^β si se conoce la edad (años desde la última intervención o la construcción); si no, α = (100 − L) / `anios_hasta_pci_minimo`^β. Se acota para que el tramo llegue al mínimo en 5 a 40 años.
    - L = `pci_minimo_aceptable` (40, límite de condición mala del MS-16, Sec. 3.3.2). T = edad en que la curva llega a L.
    - Edad efectiva antes t0 = ((100 − PCI)/α)^(1/β); después t1, con el `pci_despues`.
    - A(t) = (100 − L)(T − t) − α/(β+1)·(T^(β+1) − t^(β+1)) si t < T, y 0 si no.
    - Beneficio por m² = A(t1) − A(t0), en PCI·año. Beneficio del tramo = beneficio por m² × área × `peso_trafico[clase]`.
    - `relacion_bc` = beneficio / total (0 si el total es 0). El detalle va en `beneficio_detalle` (α, β, edades, años recuperados, área por m²).
    - Por qué: el área entre la curva con obra y la curva sin obra, sobre un mínimo aceptable, es la medida usual de beneficio en gestión de pavimentos (área bajo la curva de comportamiento). Con β > 1, recuperar años cuando el pavimento aún está alto vale más que hacerlo cuando está bajo el mínimo, lo que refleja el valor de la preservación. La fórmula anterior (0.5 × ΔPCI × vida útil) favorecía las obras grandes y se descartó.
15. **Alertas del tramo:**

    | Código | Nivel | Cuándo |
    |---|---|---|
    | `DATO_FALTANTE` | advertencia | Se asumió un dato del contexto |
    | `TRATAMIENTO_IDEAL_NO_DISPONIBLE` | advertencia | Se usó una alternativa por equipo, tránsito, fallas o bordillo |
    | `SOLUCION_INTERINA` | crítica | Solo hay una solución por debajo de la requerida |
    | `SIN_SOLUCION_DISPONIBLE` | crítica | Ninguna opción es ejecutable con lo disponible |
    | `PALIATIVO_NO_DISPONIBLE` | advertencia | Falta equipo para un trabajo previo |
    | `PARCHEO_EXCESIVO` | advertencia | Parcheo > 30 % del área |
    | `DANO_ESTRUCTURAL_FRANJA_A` | advertencia | PCI ≥ 71 pero hay piel de cocodrilo M/H, baches o ahuellamiento H |
    | `DETERIORO_ACELERADO` | advertencia | (100 − PCI) / años desde la construcción o la última intervención > `tasa_deterioro_alerta_pts_anio` |
    | `DRENAJE_MALO` | advertencia | Drenaje malo: corregir antes de cualquier tratamiento |
    | `MUESTREO_INSUFICIENTE` | advertencia | `muestreo_suficiente = false` |
    | `PCI_INCONSISTENTE` | advertencia | El PCI del tramo difiere > 5 puntos del promedio ponderado de sus muestras |
    | `CRUCE_FERREO` | info | Falla 14: coordinar con el operador ferroviario |
    | `EXUDACION` | info | Falla 2 M/H: no usar fog seal ni rejuvenecedor |
    | `REQUIERE_DISENO` | info | Nivel B2 o C: el espesor se diseña con MS-17 / MS-4 / MS-22; el agente no lo calcula |
    | `FUERA_ALCANCE_MS16` | info | PCI ≤ 70: el procedimiento excede el MS-16 |

16. **Referencias:** `remision` del nivel, `fuente` del tratamiento, y siempre "ASTM D6433-24 (fallas, severidades y medición)".

### 3.3 Priorización de la red
1. **Seguridad primero (en ambos modos).** Se reserva el `costo_interino_si_diferido` de todos los tramos, del PCI más bajo al más alto. Si el presupuesto no alcanza, se financia seguridad hasta agotarlo y se emite la alerta global crítica `PRESUPUESTO_INSUFICIENTE_SEGURIDAD`; ningún paquete completo se financia.
2. **Orden del resto:**
   - `costo_beneficio`: por `relacion_bc` de mayor a menor.
   - `peor_primero`: por PCI de menor a mayor (empate: mayor área primero).
3. **Asignación voraz:** recorrer el orden; costo incremental del tramo = `total − costo_interino` ya reservado (si el tratamiento absorbe las reparaciones de seguridad, el dinero reservado se libera). Si cabe en lo que queda → `financiado`. Si no → `solo_seguridad` (si tenía reserva) o `diferido`, y seguir con el siguiente.
4. **Sin presupuesto** (`null`): todos quedan `sin_presupuesto`, con el orden calculado.
5. **Red:** área total, saldo sin asignar (presupuesto que sobra porque ninguna obra pendiente cabe completa), PCI ponderado por área antes y después (lo financiado toma `pci_despues`), costo de seguridad, costo total necesario, financiado, faltante, orden de ejecución (financiados en su orden, luego solo seguridad, luego diferidos).
6. **Comparación:** repetir los pasos 2–3 con el otro modo y guardar tramos financiados, PCI después y beneficio total, para que el informe muestre la diferencia.
7. **Alertas globales:** `COSTOS_DE_EJEMPLO` (advertencia) si algún costo usado no fue calibrado; `UN_SOLO_TRAMO` (info) si hay un único tramo; `RECALIBRACION_ANUAL` (info) siempre.

### 3.4 Casos especiales de la red

**Un solo tramo (C3).** `red.un_solo_tramo = true`; no hay ranking ni reserva de seguridad entre tramos ni `comparacion_modos`, y `prioridad.posicion = null`. El costo y la relación B/C del tramo se entregan solo como dato, con la alerta global `UN_SOLO_TRAMO`.

**Modo diagnóstico (C1).** Con `calibracion.modo_analisis = "diagnostico"` el motor calcula todo lo físico (nivel, tratamiento, trabajos previos, cantidades) y luego elimina el dinero de la salida: se quitan las claves (no se ponen en `null`) `costo`, `costo_unitario` y `origen_costo` de las partidas; `costos`, `beneficio`, `relacion_bc` y `beneficio_detalle` de los tramos; los montos y `comparacion_modos` de `red`; y `presupuesto`, `moneda`, `costos` y `modo_priorizacion` de `calibracion_usada`. `analisis.modo = "diagnostico"`, `prioridad = {posicion: null, estado: "sin_presupuesto"}` y `red.orden_ejecucion` es el **orden de inspección** (el de `tramos[]` en la entrada). El agente no sugiere qué intervenir primero: sin curvas de deterioro ni análisis costo-beneficio no hay base. Se añade la alerta global `DIAGNOSTICO_SIN_PRIORIDAD` (info) y se omiten `COSTOS_DE_EJEMPLO` y `PRESUPUESTO_INSUFICIENTE_SEGURIDAD`. La narrativa y el asistente de consulta se redactan sin costos. El informe HTML/PDF de línea de comandos (`agente/informe.py`) no soporta este modo; lo arma el panel.

El panel ofrece, solo en pantalla, un filtro opcional «ordenar de peor a mejor PCI» sobre la tabla; es un ordenamiento, no una prioridad.

## 4. Salida del motor (`analisis.json`)

Esquema en `schemas/analisis.schema.json`. Incluye la calibración realmente usada (con el origen de cada costo), cada tramo con muestras, fallas agregadas, tratamiento (ideal, seleccionado, descartados y por qué), trabajos previos y partidas con cantidad, unidad, precio unitario, costo y motivo, costos, beneficio, prioridad, alertas, supuestos y referencias, y el bloque `red`.

## 5. Salida del redactor (`narrativa.json`)

Esquema en `schemas/narrativa.schema.json`: resumen ejecutivo, texto por tramo (diagnóstico, justificación, trabajos previos, consecuencia de diferir, nota de equipo), explicación de la priorización, alertas redactadas, conclusiones, recomendaciones, limitaciones y glosario inglés-español. El servicio valida la respuesta; si no cumple el esquema, reintenta una vez y si vuelve a fallar usa los textos automáticos.

## 6. Respuesta del servicio a la app

```json
{
  "estado": "ok",
  "analisis": { "...": "analisis.json" },
  "narrativa_origen": "modelo | automatica",
  "informe_html_url": "...",
  "informe_pdf_url": "...",
  "errores": []
}
```

Errores: 422 entrada inválida (lista de campos), 500 error del motor. Un fallo del modelo de lenguaje no es error: se usa la narrativa automática y se informa en `narrativa_origen`.

## 7. Informe (estructura)

1. Portada: proyecto, entidad, inspector, fecha, código del informe.
2. Resumen ejecutivo e indicadores: área, PCI ponderado antes y después, costo necesario, presupuesto, financiado, faltante.
3. Alcance y metodología: ASTM D6433-24, matriz de franjas, modo de priorización, versión del motor y huella (hash) de la entrada.
4. Datos y calibración: tramos con su contexto (los asumidos marcados), tratamientos disponibles, costos usados con su origen, parámetros cambiados.
5. Resultados por tramo: ficha, tabla de fallas (tipo, nombre en español e inglés, severidad y su criterio ASTM, cantidad en muestras, densidad, cantidad estimada), tratamiento seleccionado frente al ideal y los descartados, trabajos previos y partidas con precios, costos, beneficio/costo, textos de justificación, alertas.
6. Priorización y presupuesto: orden, costo acumulado, estado, comparación entre modos, costo de seguridad interina de lo diferido.
7. Alertas consolidadas.
8. Conclusiones, recomendaciones y limitaciones.
9. Referencias normativas.
10. Revisión y firma del ingeniero responsable (nombre, idoneidad, fecha): el informe es un apoyo a la decisión, no la reemplaza.
11. Anexos: A detalle de fallas por muestra; B glosario inglés-español; C parámetros y supuestos usados.
