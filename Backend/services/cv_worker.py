"""Private JSON-lines worker launched with the existing OPENCV Python interpreter.

This process reads existing YOLO/InsightFace assets and never modifies them. It does
not serve HTTP or send embeddings to a browser.
"""

import base64
import contextlib
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", "2500000")

PROJECT_DIR = Path(__file__).resolve().parents[2]
YOLO_PATH = PROJECT_DIR / "yolov8n-face.pt"
LEGACY_EMBEDDINGS = PROJECT_DIR / "database" / "embeddings.npz"
_models = None


def models():
    global _models
    if _models is None:
        with contextlib.redirect_stdout(sys.stderr):
            import cv2
            import numpy as np
            from ultralytics import YOLO
            from insightface.app import FaceAnalysis
            if not YOLO_PATH.is_file():
                raise RuntimeError("Existing YOLO model is missing")
            detector = YOLO(str(YOLO_PATH))
            recognizer = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"],
                                      allowed_modules=["detection", "recognition"])
            recognizer.prepare(ctx_id=-1, det_size=(640, 640))
        _models = (cv2, np, detector, recognizer)
    return _models


def _decode(encoded: str):
    cv2, np, _, _ = models()
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 1_500_000 or not raw.startswith(b"\xff\xd8") or not raw.endswith(b"\xff\xd9"):
        raise ValueError("Frame must be a JPEG no larger than 1.5 MB")
    frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Invalid JPEG image")
    height, width = frame.shape[:2]
    if width < 64 or height < 64 or width * height > 2_500_000:
        raise ValueError("Frame dimensions are outside the allowed range")
    return frame


def analyze(encoded: str):
    cv2, np, detector, recognizer = models()
    frame = _decode(encoded)
    with contextlib.redirect_stdout(sys.stderr):
        result = detector.predict(source=frame, conf=0.4, imgsz=640, verbose=False)[0]
    boxes = result.boxes
    if len(boxes) > 8:
        raise ValueError("At most 8 faces may be processed in one frame")
    height, width = frame.shape[:2]
    detections = []
    for box in boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        x1, y1, x2, y2 = max(0, x1), max(0, y1), min(width, x2), min(height, y2)
        if x2 <= x1 or y2 <= y1:
            continue
        margin_x, margin_y = (x2 - x1) // 2, (y2 - y1) // 2
        crop = frame[max(0, y1-margin_y):min(height, y2+margin_y),
                     max(0, x1-margin_x):min(width, x2+margin_x)]
        with contextlib.redirect_stdout(sys.stderr):
            faces = recognizer.get(crop)
        embedding = None
        if len(faces) == 1:
            vector = np.asarray(faces[0].normed_embedding, dtype=np.float32)
            norm = np.linalg.norm(vector)
            if norm > 0 and np.isfinite(vector).all():
                embedding = (vector / norm).tolist()
        detections.append({"box": [x1, y1, x2, y2], "confidence": float(box.conf[0]),
                           "embedding": embedding})
    return detections


def legacy_embeddings():
    import numpy as np
    if not LEGACY_EMBEDDINGS.is_file():
        return []
    with np.load(LEGACY_EMBEDDINGS, allow_pickle=False) as data:
        ids, names, vectors = data["ids"], data["names"], data["embeddings"]
        if len(ids) != len(names) or len(ids) != len(vectors):
            raise ValueError("Legacy embeddings file is inconsistent")
        return [{"id": str(student_id), "name": str(name), "embedding": np.asarray(vector, dtype=np.float32).tolist()}
                for student_id, name, vector in zip(ids, names, vectors)]


def dispatch(message):
    operation = message.get("op")
    if operation == "analyze":
        return analyze(message["image"])
    if operation == "register":
        detections = analyze(message["image"])
        if len(detections) != 1 or detections[0]["embedding"] is None:
            raise ValueError("Registration requires exactly one recognizable face")
        return detections[0]["embedding"]
    if operation == "legacy":
        return legacy_embeddings()
    raise ValueError("Unsupported worker operation")


def main():
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line)
            response = {"id": request.get("id"), "ok": True, "result": dispatch(request)}
        except Exception as error:
            response = {"id": request.get("id") if isinstance(request, dict) else None,
                        "ok": False, "error": str(error)[:250]}
        sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
