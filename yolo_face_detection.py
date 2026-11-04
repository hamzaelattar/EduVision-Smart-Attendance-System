
import cv2
from ultralytics import YOLO
from pathlib import Path

# Load pretrained YOLO face detector
model_path = Path(__file__).parent / "yolov8n-face.pt"

if not model_path.exists():
    raise FileNotFoundError(
        "Download yolov8n-face.pt into the project folder."
    )

model = YOLO(str(model_path))

# Open webcam
camera = cv2.VideoCapture(0)

if not camera.isOpened():
    raise RuntimeError("Could not open webcam")

while True:
    ret, frame = camera.read()

    if not ret:
        break

    # Detect faces with YOLO
    results = model.predict(
        source=frame,
        conf=0.4,
        imgsz=640,
        verbose=False
    )

    # Extract face bounding boxes
    boxes = results[0].boxes

    for box in boxes:
        x1, y1, x2, y2 = map(
            int, box.xyxy[0].tolist()
        )

        confidence = float(box.conf[0])

        # Draw face rectangle
        cv2.rectangle(
            frame,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

        # Display confidence
        cv2.putText(
            frame,
            f"Face: {confidence:.2f}",
            (x1, max(y1 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

    # Display detected face count
    cv2.putText(
        frame,
        f"Detected Faces: {len(boxes)}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 0, 0),
        2
    )

    cv2.imshow("YOLO Classroom Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()
