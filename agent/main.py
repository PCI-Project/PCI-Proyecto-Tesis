from fastapi import FastAPI, HTTPException
import json
from schemas import AgentInputRequest
from agent import pci_graph

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "online", "message": "PCI Agent Backend running"}


@app.post("/api/recommendations")
async def generate_recommendations(project_data: AgentInputRequest):
    try:
        # Convertir el modelo de Pydantic a Diccionario dict()
        inputs = {
            "project_data": project_data.model_dump(),
            "analysis_result": ""
        }
        
        result = pci_graph.invoke(inputs)
        analysis = result["analysis_result"]
        
        # Intentar parsear la salida como JSON estructurado
        try:
            recomendaciones = json.loads(analysis)
            # Validar que tenga los campos requeridos
            campos_requeridos = ["tratamiento_recomendado", "costo_estimado", "beneficio_costo", 
                               "prioridad", "alerta_suficiencia_estadistica", "observaciones"]
            for campo in campos_requeridos:
                if campo not in recomendaciones:
                    raise ValueError(f"Faltando campo: {campo}")
            
            # Asegurar que prioridad tenga un valor válido
            if recomendaciones["prioridad"] not in ["alta", "media", "baja"]:
                recomendaciones["prioridad"] = "media"
                
        except (json.JSONDecodeError, ValueError):
            # Si no es JSON válido, crear estructura por defecto
            recomendaciones = {
                "tratamiento_recomendado": analysis[:100] if analysis else "Sin datos",
                "costo_estimado": 0,
                "beneficio_costo": 0,
                "prioridad": "media",
                "alerta_suficiencia_estadistica": False,
                "observaciones": analysis or "Respuesta del modelo no en formato JSON"
            }
        
        return {
            "success": True, 
            "recommendations": recomendaciones
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))