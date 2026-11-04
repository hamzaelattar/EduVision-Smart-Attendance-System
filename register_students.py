
import cv2
import re
from pathlib import Path
from ultralytics import YOLO

# -------------------------
# 1. Project configuration
# -------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "yolov8n-face.pt"
DATASET_DIR = BASE_DIR / "student_images"

TARGET_IMAGES = 10
CONFIDENCE = 0.5

if not MODEL_PATH.exists():
    raise FileNotFoundError("YOLO face model not found.")

model = YOLO(str(MODEL_PATH))

# -------------------------
# 2. Student information
# -------------------------
student_id = input("Enter student ID: ").strip()
student_name = input("Enter student name: ").strip()

if not re.fullmatch(r"[A-Za-z0-9_-]+", student_id):
    raise ValueError("Invalid student ID.")

if not re.fullmatch(r"[A-Za-z0-9_-]+", student_name):
    raise ValueError("Use letters, numbers, - or _ in the name.")

consent = input(
    "Student has agreed to face image collection? (yes/no): "
).strip().lower()

if consent != "yes":
    print("Registration cancelled.")
    raise SystemExit

student_folder = DATASET_DIR / f"{student_id}_{student_name}"
student_folder.mkdir(parents=True, exist_ok=True)

existing_images = list(student_folder.glob("face_*.jpg"))

if existing_images:
    print("This student folder already contains images.")
    print("Registration cancelled to avoid overwriting data.")
    raise SystemExit

print(f"Registering: {student_name} ({student_id})")

# -------------------------
# 3. Open webcam
# -------------------------
camera = cv2.VideoCapture(0)

if not camera.isOpened():
    raise RuntimeError("Cannot open webcam.")

count = 0

print("Press S to save a face image.")
print("Press Q to quit.")

try:
    while count < TARGET_IMAGES:
        ret, frame = camera.read()

        if not ret:
            break

        results = model.predict(
            source=frame,
            conf=CONFIDENCE,
            imgsz=640,
            verbose=False
        )

        boxes = results[0].boxes
        face_crop = None

        # Registration requires exactly one detected face.
        if len(boxes) == 1:
            box = boxes[0]
            x1, y1, x2, y2 = map(
                int, box.xyxy[0].tolist()
            )

            height, width = frame.shape[:2]

            # Keep coordinates inside the image.
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(width, x2)
            y2 = min(height, y2)

            if x2 > x1 and y2 > y1:
                
                face_width = x2 - x1
                face_height = y2 - y1

                # Add 50% margin around the face
                margin_x = int(face_width * 0.5)
                margin_y = int(face_height * 0.5)

                # Calculate expanded coordinates
                new_x1 = max(0, x1 - margin_x)
                new_y1 = max(0, y1 - margin_y)

                new_x2 = min(width, x2 + margin_x)
                new_y2 = min(height, y2 + margin_y)

                # Extract a larger face image
                face_crop = frame[
                    new_y1:new_y2,
                    new_x1:new_x2
                ].copy()


                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

        elif len(boxes) > 1:
            cv2.putText(
                frame,
                "Only one student should be visible",
                (20, 100),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2
            )

        cv2.putText(
            frame,
            f"Images: {count}/{TARGET_IMAGES}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255, 0, 0),
            2
        )

        cv2.putText(
            frame,
            "S: Save | Q: Quit",
            (20, 70),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2
        )

        cv2.imshow("Student Registration", frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q"):
            break

        if key == ord("s"):
            if face_crop is None:
                print("Exactly one valid face is required.")
                continue

            filename = student_folder / f"face_{count + 1}.jpg"

            saved = cv2.imwrite(str(filename), face_crop)

            if saved:
                count += 1
                print(f"Saved: {filename.name}")
            else:
                print("Could not save image.")

finally:
    camera.release()
    cv2.destroyAllWindows()

print(f"Registration finished: {count} images saved.")
