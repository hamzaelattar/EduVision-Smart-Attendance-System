
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
from insightface.app import FaceAnalysis

# =====================================
# 1. CONFIGURATION
# =====================================

BASE_DIR = Path(__file__).resolve().parent

YOLO_PATH = BASE_DIR / "yolov8n-face.pt"
EMBEDDINGS_PATH = BASE_DIR / "database" / "embeddings.npz"

THRESHOLD = 0.5  # Experimental similarity threshold

# =====================================
# 2. LOAD YOLO
# =====================================

yolo = YOLO(str(YOLO_PATH))

# =====================================
# 3. LOAD INSIGHTFACE
# =====================================

face_app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"]
)

face_app.prepare(
    ctx_id=-1,
    det_size=(640, 640)
)

# =====================================
# 4. LOAD STUDENT EMBEDDINGS
# =====================================

data = np.load(EMBEDDINGS_PATH, allow_pickle=False)

student_ids = data["ids"]
student_names = data["names"]
known_embeddings = data["embeddings"]

print("Registered students:")
for student_id, student_name in zip(student_ids, student_names):
    print(f"{student_id} - {student_name}")

# =====================================
# 5. OPEN CAMERA
# =====================================

camera = cv2.VideoCapture(0)

if not camera.isOpened():
    raise RuntimeError("Cannot open webcam")

print("Camera started. Press Q to quit.")

try:
    while True:

        ret, frame = camera.read()

        if not ret:
            print("Cannot read camera frame")
            break

        height, width = frame.shape[:2]

        # =====================================
        # 6. DETECT FACES USING YOLO
        # =====================================

        results = yolo.predict(
            source=frame,
            conf=0.4,
            imgsz=640,
            verbose=False
        )

        boxes = results[0].boxes

        # =====================================
        # 7. RECOGNIZE EACH FACE
        # =====================================

        for box in boxes:

            x1, y1, x2, y2 = map(
                int, box.xyxy[0].tolist()
            )

            # Add 50% margin around the face
            face_width = x2 - x1
            face_height = y2 - y1

            margin_x = int(face_width * 0.5)
            margin_y = int(face_height * 0.5)

            new_x1 = max(0, x1 - margin_x)
            new_y1 = max(0, y1 - margin_y)

            new_x2 = min(width, x2 + margin_x)
            new_y2 = min(height, y2 + margin_y)

            face_crop = frame[
                new_y1:new_y2,
                new_x1:new_x2
            ].copy()

            name = "Unknown"
            similarity = 0.0

            if face_crop.size > 0:

                # Extract face embedding
                detected_faces = face_app.get(face_crop)

                if len(detected_faces) == 1:

                    embedding = detected_faces[0].normed_embedding

                    # Compare with registered students
                    similarities = known_embeddings @ embedding

                    best_index = int(np.argmax(similarities))
                    similarity = float(similarities[best_index])

                    if similarity >= THRESHOLD:
                        name = str(student_names[best_index])

            # =====================================
            # 8. DRAW BOUNDING BOX
            # =====================================

            if name != "Unknown":
                color = (0, 255, 0)
            else:
                color = (0, 0, 255)

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                color,
                2
            )

            label = f"{name}: {similarity:.2f}"

            cv2.putText(
                frame,
                label,
                (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2
            )

        # =====================================
        # 9. DISPLAY TOTAL DETECTED FACES
        # =====================================

        cv2.putText(
            frame,
            f"Detected Faces: {len(boxes)}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (255, 0, 0),
            2
        )

        cv2.imshow("Smart Attendance - Face Recognition", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

finally:
    camera.release()
    cv2.destroyAllWindows()

print("Camera closed.")
