# Agente de recomendaciones AsphaltPCI Pro

Motor local de recomendaciones para pavimentos flexibles, con informe en español. Produce estimaciones que deben ser revisadas por un ingeniero idóneo.

## Arquitectura

1. La entrada se valida con el esquema JSON.
2. Los catálogos se combinan con la calibración del inspector.
3. El motor calcula tratamientos, cantidades, costos y prioridades.
4. Un redactor opcional transforma el análisis en textos; existe una alternativa automática.
5. Jinja2 genera el HTML y Playwright puede imprimirlo a PDF. Las reglas completas están en `docs/01-contrato-entrada-salida.md`.

## Instalación y uso

Python 3.11 o superior. Instalar dependencias disponibles localmente con `python -m pip install -r requirements.txt`. Para PDF, instalar Playwright y disponer de Chromium por separado.

```text
python -m agente analizar entrada.json -o analisis.json
python -m agente mensajes analisis.json -o mensajes.json
python -m agente informe analisis.json -n narrativa.json -o informe.html --pdf informe.pdf
python -m agente todo ejemplos/entrada_ejemplo.json -d ejemplos/salida
python -m unittest discover -s tests -v
```

`--navegador RUTA` permite usar un Chromium local; `--logo RUTA` incrusta una imagen en el informe. Sin Playwright o navegador, el HTML se conserva y el PDF se omite con un aviso.

## Conexión de un modelo

El adaptador recibe las instrucciones y el JSON y devuelve texto; el paquete no incluye clientes ni realiza llamadas de red.

```python
from agente.motor import analizar
from agente.narrativa import redactar

def llamar_modelo(system, user):
    # Sustituir por el adaptador de su aplicación.
    respuesta = mi_adaptador(system, user)
    return respuesta

analisis = analizar(entrada)
narrativa, origen = redactar(analisis, llamar_modelo)
```

La respuesta se valida, se reintenta una vez y, si falla, se usa la narrativa automática.

## Calibración

El inspector puede proporcionar costos, umbrales y parámetros en `calibracion` de la entrada, así como tratamientos disponibles, presupuesto y modo. Los costos no reemplazados se identifican como ejemplo. Los costos y parámetros deben revisarse anualmente y contrastarse con datos locales.

## Decisiones de implementación

- La entrada canónica se serializa con claves ordenadas, separadores compactos y UTF-8 sin escapar caracteres Unicode.
- El contrato no define cómo combinar valores deducidos parcialmente presentes: se usan los disponibles para cada grupo de tipo y severidad y, si no hay ninguno en ese grupo, densidad ponderada.
- El contrato no determina cómo distribuir un presupuesto insuficiente para la seguridad de un tramo: se asigna lo restante a ese tramo y se marca como solo seguridad; no se financia ningún paquete completo.
- Para el presupuesto nulo se mantienen todos los estados `sin_presupuesto` y el PCI posterior de la red conserva el valor anterior, ya que no existe financiación asignada.
- El costo de seguridad reservado se libera al financiar el paquete completo, incluso si el tratamiento absorbe la reparación. Se considera el costo interino por separado para tramos diferidos.
- El esquema permite severidades sin definición para una falla concreta; se conserva el dato y se indica que el catálogo no contiene su criterio.
- La narrativa automática sugiere reinspección cada 2 años (franja A), cada año (B) y antes y después de la obra (C), marcada como sugerencia del agente: no hay norma que la fije.

Añadidas en la revisión del 2026-11-03:

- **Solución interina:** se cuenta solo la mitad de la mejora de PCI del tratamiento (y se declara como supuesto), porque no corrige la causa. Sin esto, una interina barata aparecía con beneficio/costo de obra completa y subía en la prioridad.
- **Sellado sin grietas:** `sellado_grietas` se descarta si el tramo no tiene grietas L o M que sellar (evita un tratamiento de 0 m en la franja A); queda `monitoreo`.
- **Contexto asumido:** `contexto_usado.asumidos` lista las claves que el motor tuvo que suponer; el informe las marca con asterisco.
- **Beneficio (corregido):** la fórmula inicial 0.5 × ΔPCI × vida útil favorecía las obras grandes (reconstruir un PCI 20 daba B/C ≈ 16.8 frente a ≈ 5.7 de un rejuvenecedor en PCI 80). Se reemplazó por el área entre curvas de deterioro PCI(t) = 100 − α·t^β sobre el PCI mínimo de 40 (`beneficio_curva` en `motor.py`, contrato §3.2.14). Ahora el rejuvenecedor queda con más del doble de B/C que la reconstrucción. β, los años hasta el mínimo y el PCI mínimo son calibrables en `parametros_defecto.json`; `vida_util_anios` ya no entra en el beneficio y solo se informa.
- **Saldo sin asignar:** la asignación voraz puede dejar presupuesto sin usar cuando la siguiente obra no cabe completa; se informa en `red.saldo_sin_asignar` y en el texto, sin dividir obras por etapas.

## Pruebas

`python -m unittest discover -s tests -v` desde `agente-recomendaciones` (33 pruebas): umbrales, bordillo, rural, disponibilidad e interinas, restricciones de tránsito y de fallas, cada conversión de cantidades, absorción, sellado sin duplicar, extrapolación, seguridad primero, modos de priorización con resultados distintos, costos calibrados, fórmula de beneficio contra integración numérica, preservación frente a reconstrucción, esquemas, narrativa con modelo falso e informe completo.

## PDF con Brave o Chrome instalados

```text
python -m agente todo ejemplos/entrada_ejemplo.json -d ejemplos/salida --pdf --navegador "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"
```

## Servicio web

`uvicorn servicio.main:app --port 8000` expone `POST /api/recommendations` (devuelve solo `analisis` y `narrativa`; el informe lo arma la web) y `GET /api/recommendations/catalogo`. Ver `INTEGRACION.md`.
