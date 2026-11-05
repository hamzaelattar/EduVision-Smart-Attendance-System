"""Real HTTP integration harness using only the Python standard library."""

import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from contextlib import closing
from pathlib import Path

from database.migrate import migrate_database
from services.auth import hash_password

BACKEND_DIR = Path(__file__).resolve().parents[1]


class ApiServer:
    def __enter__(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "api.db"
        migrate_database(self.db_path)
        with closing(sqlite3.connect(self.db_path)) as db:
            db.execute("INSERT INTO users(username,password_hash,role,active) VALUES (?,?,?,1)",
                       ("admin", hash_password("correct-horse-battery"), "admin"))
            db.commit()
        with closing(socket.socket()) as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.base_url = f"http://127.0.0.1:{port}"
        env = dict(os.environ, EDUVISION_DATABASE_PATH=str(self.db_path))
        self.process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port), "--no-access-log"],
            cwd=BACKEND_DIR, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        for _ in range(80):
            if self.process.poll() is not None:
                raise RuntimeError("API server exited during startup")
            try:
                if self.request("GET", "/api/health")[0] == 200:
                    break
            except urllib.error.URLError:
                time.sleep(0.1)
        else:
            raise RuntimeError("API server did not become healthy")
        self.token = self.request("POST", "/api/auth/login", {"username": "admin", "password": "correct-horse-battery"})[1]["accessToken"]
        return self

    def __exit__(self, *_exc):
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
        self.temp.cleanup()

    def request(self, method, path, body=None, auth=True, token=None, extra_headers=None):
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"}
        if auth and hasattr(self, "token"):
            headers["Authorization"] = f"Bearer {token or self.token}"
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            response = urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None, response.headers
