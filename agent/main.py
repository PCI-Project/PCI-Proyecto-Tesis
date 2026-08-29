from fastapi import FastAPI, HTTPException
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
        return {
            "success": True, 
            "recommendations": result["analysis_result"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))