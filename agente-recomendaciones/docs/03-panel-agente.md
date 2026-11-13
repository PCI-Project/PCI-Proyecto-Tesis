# Guía de diseño: panel del agente de recomendaciones

Versión 1.0, 2026-11-03. Para la app web AsphaltPCI Pro (React 19 + TypeScript).

## 1. Dónde vive y qué hace

El panel es una vista nueva del proyecto, `AGENT`, que se abre desde Resultados con el botón **Generar recomendaciones**. Recoge lo que el cálculo del PCI no tiene (contexto de cada tramo y calibración del inspector), arma `entrada.json` (ver `01-contrato-entrada-salida.md`), lo manda al servicio del agente y muestra el informe.

El inspector no conversa con el agente: llena el panel una vez, genera, y si no le gusta el resultado cambia la calibración y vuelve a generar.

```
DASHBOARD → SETUP → DATA_ENTRY → CALCULATION_DETAILS → RESULTS ──[Generar recomendaciones]──> AGENT
                                                                                           │
   1 Datos recibidos → 2 Contexto de tramos → 3 Equipo disponible → 4 Costos → 5 Presupuesto → 6 Revisar y generar → 7 Informe
```

Cambios en `types.ts`:

```ts
export type ProjectView = 'SETUP' | 'DATA_ENTRY' | 'CALCULATION_DETAILS' | 'RESULTS' | 'AGENT';

export interface SectionContext {            // va dentro de Section como section.context
  roadType: 'urbana' | 'rural' | null;
  curbHeightCm: number | null;
  esalMillions: number | null;
  trafficClass: 'bajo' | 'medio' | 'alto' | null;
  aadt: number | null;                       // TPDA
  yearBuilt: number | null;
  lastInterventionYear: number | null;
  lastInterventionType: string | null;
  drainage: 'bueno' | 'regular' | 'malo' | null;
  functionalClass: string | null;
  notes: string | null;
}

export interface AgentConfig {               // va dentro de Project como project.agentConfig
  availableTreatments: string[];             // IDs de catalogo/tratamientos.json
  unitCosts: Record<string, { valor: number; unidad: 'm2' | 'm' | 'global'; fuente?: string }>;
  currency: string;                          // 'USD'
  budget: number | null;                     // null = sin tope
  priorityMode: 'costo_beneficio' | 'peor_primero';
  pciThresholds?: Partial<Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1', number>>;
  parameters?: Record<string, unknown>;
}

export interface AgentRun {                  // historial: project.agentRuns[]
  id: string;
  createdAt: string;
  input: unknown;                            // entrada.json enviada
  analysis: unknown;                         // analisis.json recibido
  narrativeSource: 'modelo' | 'automatica';
  reportHtmlUrl?: string;
  reportPdfUrl?: string;
}
```

El equipo disponible y los costos propios también se guardan en el perfil del usuario (o de su empresa) como valores por defecto para proyectos nuevos.

Archivos sugeridos:

| Archivo | Contenido |
|---|---|
| `components/agent/AgentPanel.tsx` | Contenedor con el paso a paso y el estado |
| `components/agent/steps/*.tsx` | Un componente por paso |
| `services/agent/buildAgentInput.ts` | `Project + AgentConfig → entrada.json` (correspondencia de la sección 2.4 del contrato) |
| `services/agent/agentClient.ts` | Llamadas al servicio |
| `services/agent/catalog.ts` | Copia del catálogo (IDs, nombres, unidades, equipo, costos de ejemplo) |
| `services/localApi.ts` | Rutas locales para guardar `agentConfig` y `agentRuns` sin servidor |

## 2. Diseño general

- Cabecera fija con el nombre del proyecto y una barra de pasos (1 a 7). Cada paso muestra un punto verde (completo), ámbar (se asumirán datos) o rojo (bloquea).
- Columna principal con el formulario del paso; en escritorio, una columna derecha con el **resumen vivo**: tramos por nivel, datos que se asumirán, tratamientos sin equipo, costos de ejemplo pendientes.
- Botones abajo: **Atrás** y **Siguiente**. Solo los rojos impiden avanzar. Los ámbar avisan pero dejan seguir, porque el agente asume el caso conservador y lo declara.
- En móvil, la barra de pasos se vuelve "Paso 3 de 7" con menú desplegable y el resumen vivo pasa a un panel inferior plegable.
- Todo se guarda solo al cambiar de paso (borrador en `project.agentConfig` y `section.context`).

## 3. Pasos

### Paso 1. Datos recibidos (solo lectura)

Comprueba que el cálculo del PCI esté completo antes de seguir.

```
┌ Datos recibidos de la evaluación PCI ─────────────────────────────────────────────┐
│ Proyecto: Calles de Santiago · Inspector: J. Delgado · Fecha: 2026-10-20          │
│                                                                                   │
│ Tramo          Área m²   PCI   Nivel                    Muestras  Fallas  Estado  │
│ Calle 10ma      2 880   62.4   Rehabilitación menor       5/13      14     ●      │
│ Av. Central     5 400   88.1   Mantenimiento preventivo   6/24       6     ●      │
│ Vía a La Mata   9 000   47.0   Rehabilitación mayor       8/40      21     ● ámbar│
│ Calle 2da       1 600   33.5   Reconstrucción             4/7       17     ●      │
│                                                                                   │
│ ⚠ Vía a La Mata: muestreo insuficiente según ASTM D6433 (faltan 2 muestras).      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Bloquea (rojo): tramo sin PCI calculado, tramo sin muestras, muestra sin área.
Avisa (ámbar): muestreo insuficiente, muestra sin fallas registradas (puede ser correcto), PCI del tramo que difiere más de 5 puntos del promedio de sus muestras.

El nivel se muestra con los umbrales vigentes (paso 5 avanzado) para que el inspector vea desde ya qué franja le toca a cada tramo.

### Paso 2. Contexto de cada tramo (lo que falta para completar la matriz)

Una tarjeta por tramo, con lista lateral para saltar entre tramos y el botón **Copiar este contexto a…** (todos o seleccionados).

| Campo | Control | Validación | Para qué lo usa el agente |
|---|---|---|---|
| Tipo de vía | Botones: Urbana con bordillo / Rural sin bordillo | Obligatorio para no asumir | Rural quita la regla del bordillo y agrega conformación de hombros |
| Altura libre de bordillo (cm) | Número, paso 0.5, ayuda gráfica del corte calzada-bordillo | 0–40; solo si urbana | ≥ 7.6 cm permite sobrecapa; menor obliga a fresar (MS-16, Fig. 1.4 y Tabla 1.1) |
| Tránsito | Pestañas: ESAL (millones) / Clase (bajo, medio, alto) / TPDA | Al menos uno para no asumir | Clase de tránsito: restringe chip seal, slurry y sand seal; pondera el beneficio |
| Año de construcción | Año | ≤ año actual | Tasa de deterioro |
| Última intervención | Año + tipo (lista del catálogo u "otra") | ≥ año de construcción | Tasa de deterioro desde la última obra |
| Drenaje | Bueno / Regular / Malo | Opcional | Malo fuerza reconstrucción en C1 y genera alerta |
| Clasificación funcional | Arterial / Colectora / Local / Rural primaria / Rural secundaria | Opcional | Solo informativo en el informe |
| Observaciones | Texto | 500 caracteres | Se copian al informe |

Cuando un campo queda vacío, la tarjeta muestra en ámbar lo que el agente asumirá, por ejemplo: *"Sin altura de bordillo: se asumirá menor de 7.6 cm (fresado y reposición)"*.

```
┌ Calle 10ma · PCI 62.4 · Rehabilitación menor ─────────────────────────────────────┐
│ Tipo de vía    (●) Urbana con bordillo   ( ) Rural sin bordillo                    │
│ Bordillo       [  5.0 ] cm   ▸ menor de 7.6 cm: no admite sobrecapa, se fresará    │
│ Tránsito       [ESAL] [Clase] [TPDA]   ESAL de diseño [ 0.8 ] millones → medio     │
│ Construido     [2009]   Última intervención [2016] [Sello de lechada ▾]            │
│ Drenaje        ( ) Bueno (●) Regular ( ) Malo                                      │
│ Clasificación  [Colectora ▾]                                                       │
│                                          [Copiar este contexto a…]                 │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Paso 3. Equipo disponible (calibración del inspector)

El inspector marca qué puede ejecutar con su cuadrilla o contratista. El agente nunca elige una solución sin marcar sin avisarlo: busca la siguiente de la lista y, si ninguna sirve, propone una interina y la marca como crítica.

Grupos de casillas, cada una con su ícono de información que despliega el equipo necesario (de `tratamientos.json`):

- **Paliativos y reparaciones locales:** sellado de grietas, parcheo a profundidad parcial, parcheo a profundidad total, parcheo superficial, fresado localizado, arenado de exudación, relleno de roderas, nivelación de hombros, conformación de hombros, limpieza, riego de liga.
- **Mantenimiento preventivo:** riego de niebla (fog seal), rejuvenecedor, sello de arena (sand seal), tratamiento con gravilla (chip seal), lechada asfáltica (slurry seal), micropavimento (micro-surfacing).
- **Rehabilitación menor:** sobrecapa delgada (thin overlay), fresado y reposición (mill and replace).
- **Rehabilitación mayor:** sobrecapa estructural, fresado y sobrecapa estructural, recuperación a profundidad total (FDR).
- **Reconstrucción:** reconstrucción completa.

Atajos arriba: **Cuadrilla municipal básica** (paliativos + fog seal + slurry), **Contratista completo** (todo), **Igual que mi último proyecto**.

Aviso inmediato en el resumen vivo: *"Vía a La Mata (Rehabilitación mayor) no tiene ninguna opción marcada: se propondrá fresado y reposición como solución interina."* Así el inspector decide antes de generar si contrata o acepta la interina.

### Paso 4. Costos unitarios

Tabla con las filas de lo marcado en el paso 3 (más los paliativos, que siempre se presupuestan):

| Actividad | Unidad | Costo de ejemplo | Costo propio | Fuente |
|---|---|---|---|---|
| Fresado y reposición | m² | 16.00 | [ 18.40 ] | [Tabla empresa 2026] |
| Parcheo a profundidad total | m² | 60.00 | [ ] | |

- Cada fila muestra una etiqueta **ejemplo** (gris) o **calibrado** (verde).
- **Importar tabla** (CSV o Excel con columnas `id, valor, unidad, fuente`) y **Descargar plantilla** con los IDs del catálogo. Al importar, mostrar las filas reconocidas, las desconocidas y las que cambian de unidad antes de aplicar.
- **Guardar como mis costos** los deja como valor por defecto del usuario o la empresa.
- Banner fijo mientras quede algún costo de ejemplo: *"Hay 7 costos de ejemplo. El presupuesto del informe será preliminar."*

### Paso 5. Presupuesto y forma de priorizar

```
┌ Presupuesto ──────────────────────────────────────────────────────────────────────┐
│ Monto disponible  [ 120 000.00 ] USD     [ ] Sin tope (solo valorar y ordenar)    │
│ Imprevistos       [ 10 ] %                                                         │
│                                                                                   │
│ ¿Cómo repartir el presupuesto?                                                     │
│ (●) Mayor beneficio por dólar (recomendado)                                        │
│     Ordena por beneficio/costo: protege primero los tramos que aún están bien y   │
│     da más condición a la red con el mismo dinero.                                 │
│ ( ) Reparar primero lo más dañado                                                  │
│     Ordena del PCI más bajo al más alto. Atiende lo urgente, pero suele dejar     │
│     que los tramos buenos se deterioren.                                           │
│                                                                                   │
│ En ambos casos se financian primero las reparaciones de seguridad (baches,        │
│ piel de cocodrilo alta, desniveles altos). El informe compara los dos modos.      │
│                                                                                   │
│ ▸ Opciones avanzadas: umbrales de PCI · área por bache · factores de conversión   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Opciones avanzadas (plegadas por defecto, con **Restablecer**):
- Umbrales de PCI de cada nivel (85, 71, 56, 41, 26), con una barra 0–100 que muestra los rangos y no deja huecos ni solapes.
- Parámetros de `parametros_defecto.json` con su origen (norma o supuesto) al lado de cada uno.

### Paso 6. Revisar y generar

Resumen de todo lo que se mandará:
- Tramos y muestras, total de fallas registradas.
- Datos que se asumirán (lista por tramo).
- Tratamientos sin equipo que afectan a algún tramo.
- Costos de ejemplo pendientes.
- Presupuesto, modo e imprevistos.

Botones: **Ver JSON** (para depurar y para la tesis) y **Generar informe**.

Al generar, barra de estado con los pasos del servicio: *Validando datos → Aplicando matriz y costos → Redactando informe → Armando PDF*. Si el servicio responde 422, volver al paso con el campo señalado.

### Paso 7. Informe

```
┌ Informe generado · 2026-11-03 10:42 · v3 ─────────────────────────────────────────┐
│ PCI de la red 63.1 → 78.4 con lo financiado                                       │
│ Necesario 186 420 USD · Presupuesto 120 000 · Financiado 117 900 · Faltante 66 420│
│                                                                                   │
│ #  Tramo          PCI   Nivel                  Tratamiento            Costo   Estado │
│ 1  Av. Central    88.1  Mant. preventivo       Rejuvenecedor          8 210   Financ.│
│ 2  Calle 10ma     62.4  Rehabilitación menor   Fresado y reposición  52 300   Financ.│
│ 3  Vía a La Mata  47.0  Rehabilitación mayor   Fresado y reposición* 57 390   Financ.│
│ 4  Calle 2da      33.5  Reconstrucción         Reconstrucción        68 520   Solo seg.│
│ * solución interina: no hay equipo para la rehabilitación mayor                    │
│                                                                                   │
│ Alertas críticas (2) ▸    Supuestos (5) ▸                                          │
│ [Ver informe]  [Descargar PDF]  [Descargar JSON]  [Recalibrar y volver a generar]  │
│ Historial: v1 · v2 · v3                                                             │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- **Ver informe** abre el HTML en un `iframe` (o pestaña nueva).
- **Recalibrar** vuelve a los pasos 3, 4 o 5 conservando todo; cada generación queda en el historial (`agentRuns`) para comparar versiones.
- Las cifras de esta pantalla salen de `analisis.json`; la app no recalcula nada.

## 4. Conexión con el servicio

| Llamada | Uso |
|---|---|
| `POST {AGENT_URL}/v1/analisis` con `entrada.json` | Responde `202` y `{ "trabajo_id": "…" }` |
| `GET {AGENT_URL}/v1/trabajos/{id}` | Estado: `validando`, `motor`, `redactando`, `pdf`, `listo`, `error`; al terminar trae la respuesta de la sección 6 del contrato |
| `GET {AGENT_URL}/v1/catalogo` | Catálogo vigente (IDs, nombres, unidades, equipo, costos de ejemplo) para no desincronizar la app |

- La URL del servicio va en una variable de entorno de Vite (`VITE_AGENT_URL`).
- El servicio pide el mismo token de sesión que el backend de la app.
- En la versión local sin servidor, el panel funciona hasta el paso 6 y guarda la entrada; el botón **Generar** avisa que se necesita conexión, y **Ver JSON** permite correr el agente a mano (`python -m agente todo entrada.json`).

## 5. Accesibilidad y detalles

- Cada control con su `label`; los estados verde, ámbar y rojo llevan también ícono y texto, no solo color.
- Números con separador de miles y la unidad al lado del campo, no dentro.
- Los nombres de tratamientos siempre en español con el inglés en gris pequeño la primera vez.
- Los textos de ayuda citan la fuente cuando la hay (p. ej. "MS-16, Tabla 1.1").
