from typing import TypedDict, Any, Dict
from langchain_ollama import OllamaLLM
from langgraph.graph import StateGraph, END
from prompts import SYSTEM_PROMPT

class AgentState(TypedDict):
    project_data: Dict[str, Any]
    analysis_result: str

# Configuración de Ollama (ej. usando qwen2.5-coder o llama3.2)
llm = OllamaLLM(model="llama3.2", base_url="http://localhost:11434")

def build_context_string(project: Dict[str, Any]) -> str:
    """Extrae y formatea los datos clave del JSON para el prompt"""
    context = f"PROYECTO: {project.get('name')} | PCI PONDERADO: {project.get('weightedPCI')}\n"
    context += f"Inspector: {project.get('inspector')} | Fecha: {project.get('inspectionDate')}\n\n"
    
    for sec in project.get("sections", []):
        context += f"--- SECCIÓN: {sec.get('name')} ---\n"
        context += f"- PCI Sección: {sec.get('pci')} (PCI Aleatorio: {sec.get('randomPCI', 'N/A')})\n"
        context += f"- Muestreo: Evaluadas={len(sec.get('samples', []))}, Requeridas={sec.get('minSampleUnits')}, Revisadas={sec.get('revisedSampleUnits')}\n"
        context += f"- Suficiencia Estadística: {'SÍ' if sec.get('samplesSufficient') else 'NO (Faltan ' + str(sec.get('missingSamples')) + ' muestras)'}\n"
        
        # Extraer fallas más severas (Top Deduct Values)
        context += "- Fallas Principales:\n"
        for sample in sec.get("samples", []):
            details = sample.get("calculationDetails")
            if details and "summaries" in details:
                for summary in details["summaries"]:
                    if summary.get("deductValue", 0) > 10:  # Filtrar fallas relevantes
                        context += f"  * [Muestra {sample.get('id')}] Falla Código {summary.get('type')}, Severidad {summary.get('severity')}, Cantidad: {summary.get('quantity')}, DV: {summary.get('deductValue')}\n"
        context += "\n"
    return context

def run_pci_agent(state: AgentState) -> Dict[str, Any]:
    project = state["project_data"]
    context_str = build_context_string(project)
    
    full_prompt = f"{SYSTEM_PROMPT}\n\nDATOS DE LA INSPECCIÓN:\n{context_str}\n\nEMITE EL INFORME:"
    
    response = llm.invoke(full_prompt)
    return {"analysis_result": response}

# Construir Grafo
workflow = StateGraph(AgentState)
workflow.add_node("analizar_pci", run_pci_agent)
workflow.set_entry_point("analizar_pci")
workflow.add_edge("analizar_pci", END)

pci_graph = workflow.compile()