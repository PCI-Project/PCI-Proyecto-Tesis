# Tarea: implementar el motor y el generador de informes en Python

Carpeta de trabajo: `agente-recomendaciones/`. Lee primero, sin modificarlos:

- `docs/01-contrato-entrada-salida.md` (reglas exactas: secciones 3, 4, 5 y 7)
- `schemas/entrada.schema.json`, `schemas/analisis.schema.json`, `schemas/narrativa.schema.json`
- `catalogo/*.json`
- `prompt/sistema.md`
- `ejemplos/entrada_ejemplo.json`

No cambies catálogo, esquemas, prompt ni documentos. Si encuentras una contradicción o un hueco en el contrato, elige la opción más simple y anótala en `README.md`, sección "Decisiones de implementación".

## Entorno

Python 3.11 o superior (aquí hay 3.14). Dependencias: `jinja2` y `jsonschema` (ya instaladas). `playwright` es opcional, solo para PDF. Sin red. Pruebas con `unittest` (no hay pytest). Todo el texto visible en español.

## Archivos a crear

```
agente-recomendaciones/
  agente/
    __init__.py          # __version__ = "1.0.0"
    __main__.py          # CLI
    catalogo.py          # carga y combinación de catálogo, costos, parámetros y umbrales
    motor.py             # analizar(entrada: dict) -> dict   (contrato §3)
    narrativa.py         # narrativa automática, mensajes para el modelo y validación
    informe.py           # HTML con Jinja2 y PDF opcional
    plantillas/
      informe.html.j2
      informe.css
  tests/
    test_motor.py
    test_narrativa.py
    test_informe.py
  requirements.txt       # jinja2, jsonschema ; playwright opcional comentado
  README.md
```

## Requisitos

### motor.py
- `analizar(entrada: dict, ahora: datetime | None = None) -> dict` implementa al pie de la letra el contrato §3 (preparación, por tramo, priorización) y devuelve un dict que valida contra `analisis.schema.json`.
- Lanza `EntradaInvalida(errores: list[str])` si la entrada no valida contra `entrada.schema.json` o trae IDs de tratamientos desconocidos.
- Determinista: la misma entrada da el mismo resultado (salvo `generado`). Ordena listas de forma estable (fallas por tipo numérico y severidad L, M, H, U).
- Redondeo: cantidades a 2 decimales, costos a 2 decimales por partida, PCI a 1 decimal, relación beneficio/costo a 3 decimales.
- `motivo` de cada partida legible, p. ej. `"Baches (13) H: 6.4 und × 0.6 m² = 3.84 m²"`; varios aportes unidos con `"; "`.
- Guarda en `proyecto` además un `huella_entrada` = sha256 del JSON de entrada canónico (`sort_keys=True`, separadores compactos) y `version_motor`.
- Las cantidades estimadas en el tramo usan el factor de extrapolación del §3.2.3; si no hay muestras aleatorias, factor 1 y alerta `DATO_FALTANTE`.

### narrativa.py
- `narrativa_automatica(analisis) -> dict`: textos armados con plantillas a partir del análisis, sin cifras que no estén en él; cumple `narrativa.schema.json`. Debe cubrir todos los tramos y todas las alertas críticas y de advertencia, e incluir siempre las recomendaciones y limitaciones obligatorias que pide `prompt/sistema.md`.
- `construir_mensajes(analisis) -> dict` con `{"system": <contenido de prompt/sistema.md>, "user": <JSON del análisis>}`.
- `redactar(analisis, llamar_modelo=None) -> tuple[dict, str]`: si `llamar_modelo` (callable `(system, user) -> str`) es `None`, devuelve la automática y `"automatica"`. Si no, llama, extrae el JSON (tolerar que venga dentro de un bloque de código), valida contra el esquema y comprueba que haya un texto por cada tramo del análisis; si falla, reintenta una vez añadiendo los errores al mensaje; si vuelve a fallar, usa la automática. Devuelve `(narrativa, "modelo" | "automatica")`.
- No incluyas ningún cliente de un proveedor concreto: solo la interfaz `llamar_modelo`.

### informe.py
- `generar_html(analisis, narrativa, ruta_html, logo=None) -> Path` con la estructura del contrato §7, en este orden: portada; resumen ejecutivo con tarjetas de indicadores; alcance y metodología; datos y calibración; resultados por tramo; priorización y presupuesto; alertas consolidadas; conclusiones, recomendaciones y limitaciones; referencias; revisión y firma (campos en blanco: nombre, idoneidad JTIA, firma, fecha); anexos A (fallas por muestra), B (glosario), C (parámetros y supuestos con su origen).
- Estilo profesional para A4 impreso: CSS en `informe.css` incrustado en el HTML (un solo archivo autocontenido), tipografía del sistema, tablas con encabezado repetido al cortar página (`thead { display: table-header-group }`), `tr { page-break-inside: avoid }`, cada tramo empieza en página nueva, colores por nivel (A verde, B ámbar, C rojo) siempre acompañados de texto.
- Marcar con asterisco y nota al pie los datos de contexto asumidos; etiqueta "ejemplo" o "calibrado" en cada costo; insignias para alertas por nivel; estado de financiamiento con texto.
- Moneda con separador de miles y 2 decimales (`1 234.56 USD`); áreas `m²`.
- Pie de cada página en PDF: nombre del proyecto, código del informe (primeros 8 caracteres de la huella) y "Página X de Y".
- `generar_pdf(ruta_html, ruta_pdf, navegador: str | None = None) -> Path | None`: con Playwright (Chromium; si `navegador` trae una ruta, usarla como `executable_path`), formato A4, márgenes 18 mm, `print_background=True`, pie con `footer_template`. Si Playwright o el navegador no están, devolver `None` y avisar por `stderr` sin fallar.

### __main__.py (CLI)
```
python -m agente analizar entrada.json -o analisis.json
python -m agente mensajes analisis.json -o mensajes.json
python -m agente informe analisis.json [-n narrativa.json] -o informe.html [--pdf informe.pdf] [--navegador RUTA] [--logo RUTA]
python -m agente todo entrada.json -d carpeta_salida [--pdf] [--navegador RUTA]
```
Errores de entrada: imprime la lista y sale con código 2.

### Pruebas (unittest, sin red)
Cubre como mínimo:
1. Nivel correcto en los bordes de cada umbral (85, 84.99, 71, 70.99, 56, 55.99, 41, 40.99, 26, 25.99, 0, 100) y con umbrales calibrados.
2. Regla del bordillo: urbana ≥ 7.6 cm → thin overlay; < 7.6 cm o nulo → mill and replace, con supuesto y alerta si es nulo; rural → thin overlay y conformación de hombros.
3. Disponibilidad: si falta el ideal se usa la siguiente opción y se anota en `descartados`; si no hay ninguna, se usa una interina con alerta crítica; si tampoco, `seleccionado = null` y `SIN_SOLUCION_DISPONIBLE`.
4. Restricciones: chip seal descartado con tránsito alto; fog seal descartado con exudación M.
5. Conversiones de cantidades (cada tipo de la tabla del §3.2.10), incluido baches por severidad.
6. Absorción: reconstrucción sin trabajos previos de parcheo pero con `costo_interino_si_diferido` > 0 si hay baches; sellado global no se cuenta dos veces.
7. Extrapolación con muestras adicionales.
8. Priorización: seguridad primero; presupuesto que no cubre seguridad → alerta global crítica; `costo_beneficio` frente a `peor_primero` con un caso donde el orden cambie; presupuesto nulo → `sin_presupuesto`; comparación de modos presente.
9. `entrada_ejemplo.json` produce un análisis que valida contra el esquema.
10. Narrativa automática valida contra el esquema y cubre todos los tramos; `redactar` con un `llamar_modelo` falso que devuelve JSON inválido cae a la automática tras un reintento; con uno válido devuelve `"modelo"`.
11. El HTML se genera, contiene cada tramo, la tabla de priorización, la sección de firma y no tiene `{{` sin resolver.

### README.md
Qué es, arquitectura en 5 líneas (remitir al contrato), instalación, comandos, cómo conectar un modelo de lenguaje con `llamar_modelo` (ejemplo genérico de 10 líneas sin proveedor concreto), cómo calibrar, cómo correr las pruebas (`python -m unittest discover -s tests -v` desde `agente-recomendaciones`), y "Decisiones de implementación".

## Al terminar
Corre las pruebas y `python -m agente todo ejemplos/entrada_ejemplo.json -d ejemplos/salida` si tu entorno lo permite, y resume qué archivos creaste, qué decisiones tomaste y cualquier punto del contrato que te pareció ambiguo.
