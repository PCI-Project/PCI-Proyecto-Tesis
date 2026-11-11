# Guía de integración: agente de recomendaciones de AsphaltPCI Pro

Para integrar el agente en la web AsphaltPCI Pro (repositorio `PCI-Project/PCI-Proyecto-Tesis`) o en otro sistema agéntico. Léela antes que el resto.

## Qué es

Un paquete en Python que recibe la evaluación PCI (ASTM D6433) de varios tramos de pavimento flexible. A partir de ella decide, para cada tramo:

- el tratamiento;
- los trabajos previos obligatorios, con sus cantidades;
- el presupuesto;
- la prioridad cuando el presupuesto es limitado;
- las alertas.

**El agente solo devuelve datos. El informe y el resumen los arma la web** (sección Recomendaciones de la app, estado Resultado).

```
Sección Recomendaciones ──entrada.json──>  POST /api/recommendations
                               1. motor (reglas fijas)      → analisis    cifras y decisiones
                               2. redactor (Ollama)         → narrativa   solo textos
           <──{ success, version, analisis, narrativa, narrativa_origen }──
Sección Recomendaciones: muestra el resumen, dibuja el informe y lo exporta a PDF con jsPDF
```

**Regla clave: el modelo de lenguaje no calcula ni decide.** El motor pone los tratamientos, las cantidades, los costos, el beneficio/costo y el orden de ejecución, siempre iguales para la misma entrada. El modelo solo redacta los textos siguiendo `prompt/sistema.md`. Si el modelo falla, no responde o devuelve un JSON inválido dos veces, el servicio usa textos automáticos y lo indica con `narrativa_origen: "automatica"`. La respuesta nunca falla por culpa del modelo.

## Servicio web (reemplaza al `agent/` actual del repositorio)

El `agent/` del repositorio web (FastAPI + LangGraph + Ollama) devuelve texto libre que inventa el modelo, con cortes de PCI que no son los de la tesis. Este servicio conserva su ruta y su forma de respuesta, pero devuelve datos estructurados.

```bash
cd agente-recomendaciones
pip install -r servicio/requirements.txt          # jinja2, jsonschema, fastapi, uvicorn
uvicorn servicio.main:app --port 8000
```

| Variable | Por defecto | Uso |
|---|---|---|
| `AGENTE_USAR_MODELO` | `1` | `0` = textos automáticos, sin Ollama |
| `OLLAMA_MODEL` | `llama3.2` | Modelo redactor. Con 3B es probable que falle el JSON largo y se usen los automáticos; se recomienda uno de 7–8B (por ejemplo `qwen2.5:7b` o `llama3.1:8b`) |
| `OLLAMA_URL` | `http://localhost:11434` | Servidor de Ollama |
| `OLLAMA_TIMEOUT` | `180` | Segundos por intento (hay hasta dos intentos) |
| `LLM_PROVIDER` | `ollama` | `ollama` = Ollama local · `openai` = API compatible con OpenAI (Gemini, Groq) · `none` = sin modelo. Si el modelo está mal configurado, el servicio arranca con textos automáticos |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | — | Con `LLM_PROVIDER=openai`. Gemini: `https://generativelanguage.googleapis.com/v1beta/openai` + `gemini-3.8-flash`. Groq: `https://api.groq.com/openai/v1` + `openai/gpt-oss-120b`. La llave solo va en el servidor |
| `LLM_JSON_MODE` | `0` | `1` envía `response_format: json_object` (Groq); dejar `0` con Gemini |
| `LLM_REASONING_EFFORT`, `LLM_TEMPERATURE`, `LLM_TIMEOUT`, `LLM_CHAT_TIMEOUT` | — | Opcionales (ver `agente/llm_openai.py`) |
| `AGENTE_CORS` | `http://localhost:3500` | Orígenes permitidos, separados por coma. **En producción se define con el dominio del sitio**; ya no trae valores abiertos por defecto |
| `AGENTE_LIMITE_POR_MIN` | `20` | Máximo de POST por minuto y por IP; al pasarlo responde 429 (`0` = sin límite) |

| Ruta | Respuesta |
|---|---|
| `GET /` | `{status, version, redactor}` |
| `GET /api/recommendations/catalogo` | Tratamientos (id, nombre, unidad, equipo, costo de ejemplo), fallas, niveles con sus opciones e interinas, parámetros por defecto. Para que el panel no copie el catálogo a mano |
| `POST /api/recommendations` | **200** `{success: true, version, analisis, narrativa, narrativa_origen}` · **422** `{success: false, errores: [...]}` |

**Privacidad:** el mensaje que va al modelo no incluye el nombre del proyecto, el inspector, la entidad, la descripción ni la ubicación (`agente/narrativa.py::resumen_para_modelo`); sí incluye los nombres de los tramos. Hay una prueba que lo verifica (`tests/test_privacidad.py`).

El servicio responde con encabezados CORS y `Access-Control-Allow-Private-Network`, para que la página publicada en `https://asphaltpcipro.company` pueda llamar a un agente que corre en `http://localhost:8000` en la máquina del inspector.

### Si quieren conservar LangGraph

`agente/servicio.py` trae los dos nodos listos:

```python
from langgraph.graph import StateGraph, END
from agente.servicio import nodo_motor, nodo_redactar
from agente.ollama import crear_llamador

llamar = crear_llamador()
g = StateGraph(dict)
g.add_node('motor', nodo_motor)
g.add_node('redactar', lambda s: nodo_redactar(s, llamar))
g.set_entry_point('motor'); g.add_edge('motor', 'redactar'); g.add_edge('redactar', END)
grafo = g.compile()
estado = grafo.invoke({'entrada': entrada})      # -> analisis, narrativa, narrativa_origen, errores
```

## Uso sin servidor

```bash
python -m agente analizar entrada.json -o analisis.json
python -m agente mensajes analisis.json -o mensajes.json      # {system, user} para probar otro modelo
python -m agente todo entrada.json -d salida                  # analisis.json + narrativa.json + informe.html de referencia
```

El panel puede importar `analisis.json` y `narrativa.json` cuando no hay servicio. El `informe.html` de Python solo sirve como referencia visual de lo que debe dibujar la web.

## Desde Python (otro agente)

```python
from agente.servicio import procesar
from agente.ollama import crear_llamador        # o tu propio llamar_modelo(system, user) -> str

cuerpo, codigo = procesar(entrada, crear_llamador())
```

## Qué entra

Esquema completo: `schemas/entrada.schema.json`. Ejemplo: `ejemplos/entrada_ejemplo.json`. Resumen:

- **`proyecto`:** id, nombre, inspector, fecha de inspección.
- **`calibracion`:**
  - `tratamientos_disponibles`: lo que el inspector puede ejecutar con su equipo o contratista;
  - `modo_priorizacion`: `costo_beneficio` o `peor_primero`;
  - `presupuesto`: monto, o `null` sin tope;
  - opcionales: costos unitarios propios, umbrales y parámetros.
- **`tramos[]`:** geometría y PCI, más el `contexto` (tipo de vía, bordillo, ESAL o clase de tránsito, edad, drenaje). Cada tramo trae sus `muestras[]`, y cada muestra sus `fallas[]` (tipo ASTM, severidad, cantidad).

## Qué sale

- **`analisis`** (`schemas/analisis.schema.json`):
  - **Por tramo:**
    - nivel;
    - tratamiento ideal y seleccionado, con nombres; los descartados, con nombre y razón;
    - trabajos previos y partidas, con cantidad, precio y motivo;
    - costos;
    - beneficio (con `beneficio_detalle`: años recuperados) y relación beneficio/costo;
    - estado de financiamiento, alertas, supuestos y referencias;
    - muestras y fallas agregadas, con el criterio ASTM de cada severidad.
  - **Para la red:** PCI antes y después, costo necesario, financiado, faltante, saldo sin asignar, orden de ejecución y comparación entre los dos modos.
- **`narrativa`** (`schemas/narrativa.schema.json`): resumen ejecutivo, un texto por tramo (diagnóstico, justificación, trabajos previos, consecuencia de diferir, nota de equipo), priorización, alertas, conclusiones, recomendaciones, limitaciones y glosario.

## Qué se puede ajustar sin programar

| Archivo | Contenido |
|---|---|
| `catalogo/costos_estandar.json` | Costos unitarios por defecto |
| `catalogo/parametros_defecto.json` | Curva de deterioro, PCI mínimo, factores de conversión, imprevistos, pesos de tránsito |
| `catalogo/matriz.json` | Umbrales de PCI y orden de preferencia de soluciones |
| `catalogo/tratamientos.json` | Paliativos que exige cada tratamiento, restricciones, PCI esperado |

También se ajustan por proyecto en `calibracion`, sin tocar archivos.

## Pruebas

```bash
python -m unittest discover -s tests      # 33 pruebas; incluyen el servicio y un Ollama simulado
```

La capa FastAPI (`servicio/main.py`) no tiene pruebas automáticas: es una envoltura delgada de `agente/servicio.py`, que sí las tiene. Al instalarla, comprobar a mano:

- `GET /` responde;
- `POST /api/recommendations` con `ejemplos/entrada_ejemplo.json` devuelve 200.

## Advertencias

- **Los costos unitarios son de ejemplo y no tienen fuente.** Cada costo lleva `origen: "ejemplo"` hasta que se reemplace.
- **Hay valores que son supuestos calibrables, no de norma:** la curva de deterioro (β = 1.5, 20 años hasta PCI 40), el PCI esperado tras cada tratamiento y los factores de conversión.
- **Los cortes de PCI (85, 71, 56, 41, 26) son de la tesis.** Unifican los ejemplos del MS-16 del Asphalt Institute (4.ª ed. 2009); ninguna norma los fija.
- **Solo cubre pavimento flexible.** No diseña espesores: para rehabilitación mayor y reconstrucción remite a MS-17, MS-4 y MS-22.
- **El informe es un apoyo a la decisión.** Debe revisarlo y firmarlo un ingeniero idóneo.

Reglas exactas: `docs/01-contrato-entrada-salida.md`. Diseño del panel: `docs/panel/diseno-panel-agente.pdf`.

Autoría: proyecto de tesis AsphaltPCI Pro, Universidad Tecnológica de Panamá, Centro Regional de Veraguas.
