"""Agent pipeline runs. For now this only creates queued runs (the trigger); the LangGraph
agents that move the steps forward are added in Milestone 2."""
from .models import PipelineRun

# Same order and IDs as AGENTS in src/agents/registry.ts.
AGENT_IDS = ["feasibility", "scope_tech", "planner", "risk"]


def new_run(project_id: str) -> PipelineRun:
    return PipelineRun(project_id=project_id, status="queued", steps=[{"agentId": a, "status": "queued"} for a in AGENT_IDS])
