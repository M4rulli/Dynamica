from dataclasses import dataclass
from threading import Lock

from app.models import AnalysisRequest, AnalysisResult, JobStatus


@dataclass
class AnalysisJob:
  id: str
  request: AnalysisRequest
  status: JobStatus = "queued"
  result: AnalysisResult | None = None
  error: str | None = None


class InMemoryJobStore:
  def __init__(self) -> None:
    self._jobs: dict[str, AnalysisJob] = {}
    self._lock = Lock()

  def create(self, job: AnalysisJob) -> None:
    with self._lock:
      self._jobs[job.id] = job

  def get(self, job_id: str) -> AnalysisJob | None:
    with self._lock:
      return self._jobs.get(job_id)

  def set_running(self, job_id: str) -> None:
    with self._lock:
      job = self._jobs.get(job_id)
      if job:
        job.status = "running"

  def set_completed(self, job_id: str, result: AnalysisResult) -> None:
    with self._lock:
      job = self._jobs.get(job_id)
      if job:
        job.status = "completed"
        job.result = result
        job.error = None

  def set_failed(self, job_id: str, message: str) -> None:
    with self._lock:
      job = self._jobs.get(job_id)
      if job:
        job.status = "failed"
        job.error = message


job_store = InMemoryJobStore()
