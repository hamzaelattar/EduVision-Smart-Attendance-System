"""Serialized, timeout-bound IPC to the OPENCV worker."""

import base64
import json
import os
import queue
import subprocess
import threading
from pathlib import Path
from uuid import uuid4

from config import CV_PYTHON

WORKER_SCRIPT = Path(__file__).with_name("cv_worker.py")


class CVUnavailable(Exception):
    pass


class CVInputError(Exception):
    pass


class CVWorkerClient:
    def __init__(self):
        self._lock = threading.Lock()
        self._process = None
        self._responses = queue.Queue()

    def _read(self, process):
        for line in process.stdout:
            try:
                self._responses.put(json.loads(line))
            except json.JSONDecodeError:
                continue
        self._responses.put(None)

    def _start(self):
        if self._process and self._process.poll() is None:
            return
        if not CV_PYTHON.is_file():
            raise CVUnavailable(f"CV Python interpreter not found: {CV_PYTHON}")
        self._responses = queue.Queue()
        self._process = subprocess.Popen(
            [str(CV_PYTHON), "-u", str(WORKER_SCRIPT)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="utf-8", bufsize=1, cwd=str(WORKER_SCRIPT.parents[2]),
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            env={**os.environ, "OPENCV_IO_MAX_IMAGE_PIXELS": "2500000"},
        )
        threading.Thread(target=self._read, args=(self._process,), daemon=True).start()

    def call(self, op: str, image: bytes | None = None, timeout: int = 90):
        with self._lock:
            self._start()
            request_id = str(uuid4())
            payload = {"id": request_id, "op": op}
            if image is not None:
                payload["image"] = base64.b64encode(image).decode("ascii")
            try:
                self._process.stdin.write(json.dumps(payload, separators=(",", ":")) + "\n")
                self._process.stdin.flush()
                response = self._responses.get(timeout=timeout)
            except (BrokenPipeError, OSError, queue.Empty):
                self.close()
                raise CVUnavailable("CV worker did not respond in time")
            if response is None or response.get("id") != request_id:
                self.close()
                raise CVUnavailable("CV worker stopped unexpectedly")
            if not response.get("ok"):
                raise CVInputError(response.get("error", "CV processing failed"))
            return response["result"]

    def close(self):
        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self._process.kill()
        self._process = None


cv_client = CVWorkerClient()
