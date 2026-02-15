"""Canonical API schemas shared by backend endpoints and analysis workers."""

from typing import Literal
from pydantic import BaseModel, Field


ComponentType = Literal[
  "wire",
  "resistor",
  "capacitor",
  "inductor",
  "voltage_source",
  "current_source",
]

AnalysisType = Literal["nodal", "mesh"]
JobStatus = Literal["queued", "running", "completed", "failed"]


class Pin(BaseModel):
  x: float
  y: float


class CircuitComponent(BaseModel):
  """Normalized circuit component payload coming from the editor."""
  id: str
  type: ComponentType
  pinA: Pin
  pinB: Pin
  label: str | None = None
  value: str | None = None
  current: str | None = None
  voltage: str | None = None
  currentUnknown: bool | None = None
  voltageUnknown: bool | None = None
  sourceDirection: Literal["a_to_b", "b_to_a"] | None = None
  sourcePolarity: Literal["a_positive", "b_positive"] | None = None


class CircuitPayload(BaseModel):
  components: list[CircuitComponent] = Field(default_factory=list)


class AnalysisRequest(BaseModel):
  """Input envelope for asynchronous nodal/mesh analysis jobs."""
  analysis_type: AnalysisType
  circuit: CircuitPayload
  options: dict[str, str | int | float | bool] = Field(default_factory=dict)


class AnalysisResult(BaseModel):
  """Serializable analysis output consumed by the report UI."""
  job_id: str
  analysis_type: AnalysisType
  latex: str
  summary: dict[str, str | int | float | bool]
  graph_info: dict[str, str | int | float | bool | list[str]]
  equations: list[str]


class AnalysisJobCreateResponse(BaseModel):
  job_id: str
  status: JobStatus


class AnalysisJobStatusResponse(BaseModel):
  job_id: str
  status: JobStatus
  error: str | None = None


class AnalysisResultResponse(BaseModel):
  status: JobStatus
  result: AnalysisResult | None = None
  error: str | None = None
