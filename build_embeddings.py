
from pathlib import Path
import cv2
import numpy as np
from insightface.app import FaceAnalysis

BASE_DIR = Path(__file__).resolve().parent
IMAGES_DIR = BASE_DIR / "student_images"
DATABASE_DIR = BASE_DIR / "database"

DATABASE_DIR.mkdir(exist_ok=True)

# Load pretrained face recognition system
app = FaceAnalysis(
    name="buffalo_l",
    providers=["CPUExecutionProvider"],
    allowed_modules=["detection", "recognition"]
)

app.prepare(ctx_id=-1, det_size=(640, 640))

student_ids = []
student_names = []
student_embeddings = []

for folder in sorted(IMAGES_DIR.iterdir()):

    if not folder.is_dir():
        continue

    if "_" not in folder.name:
        continue

    student_id, student_name = folder.name.split("_", 1)

    embeddings = []

    for image_path in sorted(folder.glob("*.jpg")):

        image = cv2.imread(str(image_path))

        if image is None:
            print(f"Cannot read: {image_path.name}")
            continue

        # Detect the face using InsightFace
        faces = app.get(image)

        # Diagnostic information
        print(
            f"{image_path.name}: "
            f"size={image.shape[1]}x{image.shape[0]}, "
            f"faces detected={len(faces)}"
        )

        # Accept images containing exactly one face
        if len(faces) != 1:
            print(f"Skipped: {image_path.name}")
            continue

        # Extract the normalized face embedding
        embedding = faces[0].normed_embedding

        embeddings.append(embedding)

    if not embeddings:
        print(f"No valid images for {student_name}")
        continue

    # Calculate average embedding
    mean_embedding = np.mean(embeddings, axis=0)

    # Normalize embedding
    mean_embedding /= np.linalg.norm(mean_embedding)

    student_ids.append(student_id)
    student_names.append(student_name)
    student_embeddings.append(mean_embedding)

    print(
        f"Registered: {student_name} "
        f"({len(embeddings)} valid images)"
    )

if not student_embeddings:
    raise RuntimeError(
        "No valid student embeddings generated."
    )

# Save embeddings
output_path = DATABASE_DIR / "embeddings.npz"

np.savez(
    output_path,
    ids=np.array(student_ids),
    names=np.array(student_names),
    embeddings=np.array(student_embeddings)
)

print(
    f"Saved {len(student_ids)} students to {output_path}"
)
