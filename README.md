# EduVision IoT

Gestion des présences avec caméras WebRTC et reconnaissance faciale. Trois correspondances fortes consécutives enregistrent automatiquement un étudiant comme présent dans une séance active. Le backend FastAPI conserve les classes, étudiants, séances et décisions dans SQLite. Le Dashboard `/` et la console `/iot` utilisent les vraies API ; la page `/demo` et les anciennes pages historiques utilisent des données locales.

## Architecture

```text
Android / webcam PC (CAM-001, CAM-002, ...)
          │ WebRTC chiffré (DTLS-SRTP)
          ▼
FastAPI + aiortc ── MediaRelay ──► React Dashboard /iot (plusieurs flux)
          │ 1 frame/s/caméra, sans file croissante
          ▼
Processus CV séparé (YOLO + InsightFace/ArcFace)
          │ correspondances fortes répétées
          ▼
SQLite (Présent automatique) ──► fin de séance ──► rapports CSV/XLSX
```

Une caméra possède un identifiant `CAM-*`, une salle, un secret aléatoire et une association facultative à une séance **Draft**. Le secret est affiché une fois et seul son SHA-256 est stocké. Seul un administrateur crée, désactive, associe ou renouvelle une caméra. Un enseignant voit uniquement les caméras associées à ses classes accessibles. Les vidéos et les propositions ne sont pas enregistrées. Seuls les étudiants consentants, inscrits dans la classe et encore `Unverified` peuvent passer automatiquement à `Present` ; les décisions déjà prises ne sont pas écrasées.

## Démarrage local

1. Dans `Backend`, installer `requirement.txt` dans l'environnement Python de l'API (`EDUVISION_API`). Installer les dépendances CV (`ultralytics`, `insightface`, `opencv-python`, `onnxruntime`) dans l'interpréteur indiqué par `EDUVISION_CV_PYTHON`.
2. Définir `EDUVISION_BIOMETRIC_KEY` avec une clé Fernet permanente et conserver cette clé dans un gestionnaire de secrets. Les autres variables sont décrites dans `Backend/.env.example`. L'application lit les variables du processus, pas les fichiers `.env` automatiquement.
3. Depuis `Backend`, exécuter `python -m database.migrate`, puis `python -m scripts.create_admin admin` et `python -m uvicorn main:app --host 127.0.0.1 --port 8000 --ws-max-size 2200000`. Utiliser **un seul worker Uvicorn** : les flux WebRTC sont conservés en mémoire dans ce processus.
4. Depuis `frontend`, exécuter `npm ci` puis `npm run dev`. Ouvrir `/iot` et se connecter avec le compte administrateur.
5. Pour Android sur le réseau local, placer un certificat TLS **approuvé par le téléphone** dans `frontend/dev-lan-cert.pem` et sa clé privée dans `frontend/dev-lan-key.pem` (ou utiliser `dev-cert.pem` / `dev-key.pem`). Ces fichiers sont ignorés par Git. Sans eux, Vite n'écoute que `127.0.0.1` ; avec eux, il écoute le réseau local en HTTPS. Le certificat doit contenir l'adresse IP actuelle du PC. Utiliser cette adresse HTTPS sur le téléphone, puis `/iot-camera`.
6. Dans `/iot`, créer une caméra, copier son secret, préparer une classe, un cours et une séance, puis associer cette séance à la caméra. Sur chaque téléphone (ou webcam PC), entrer son propre ID et secret dans `/iot-camera` et démarrer la diffusion. Le Dashboard et `/iot` affichent les flux.
7. Après consentement explicite, inscrire chaque étudiant depuis la console avec des captures temporaires. Présenter son visage à la caméra : après trois correspondances fortes, la ligne passe automatiquement à `Present`. Terminer la séance quand toutes les lignes sont décidées, puis exporter les rapports CSV ou XLSX.

Le modèle `yolov8n-face.pt` est requis à la racine. Le worker CV utilise aussi le modèle InsightFace `buffalo_l`. Préparer ces modèles dans l'environnement CV avant une démonstration hors ligne. L'ancien `database/embeddings.npz` et les photos `student_images/` sont des données biométriques locales ignorées par Git ; l'import d'une empreinte ancienne exige le consentement explicite via l'API.

## Sécurité et exploitation

- FastAPI doit rester sur `127.0.0.1` derrière le proxy HTTPS Vite pour le développement. Pour un déploiement, utiliser un proxy HTTPS de confiance et limiter l'accès réseau. Ne pas exposer directement le port 8000 en clair.
- Le navigateur conserve le jeton de l'opérateur uniquement dans `sessionStorage` ; se déconnecter après utilisation et éviter les extensions non fiables.
- La base SQLite contient des noms, des décisions de présence et des empreintes faciales chiffrées. Protéger son répertoire, ses sauvegardes et la clé Fernet. Les clichés d'inscription sont envoyés au backend, analysés et non sauvegardés.
- L'analyse est limitée à un échantillon par seconde et par caméra ; une analyse lente fait ignorer les échantillons suivants, sans ralentir la vidéo. Le Dashboard expose la charge CPU, mémoire et GPU NVIDIA quand elle est disponible. La console expose FPS, RTT WebRTC, perte de paquets RTP, durée d'analyse, frames reçues et échantillons ignorés.
- Les autorisations, les limites de taille JPEG et le consentement sont vérifiés côté backend. Une correspondance incertaine ne marque aucune présence ; l'interface permet de corriger une décision automatique tant que la séance est en cours.

## Tests et état de validation

```powershell
cd Backend
python -m unittest discover -s tests -v
cd ../frontend
npm run build
```

Les tests backend couvrent notamment les migrations, l'authentification, les présences validées et un relais WebRTC avec **deux caméras synthétiques et deux spectateurs**. Ils ne prouvent pas le fonctionnement sur de vrais appareils Android ni la qualité de reconnaissance YOLO/ArcFace. Avant utilisation avec de vrais étudiants, vérifier sur place deux téléphones et une webcam, le certificat approuvé, les droits d'accès, le consentement, le débit, les résultats de reconnaissance et les exports.

Sur une machine avec peu de mémoire libre, la compilation Vite peut nécessiter une limite de mémoire pour esbuild, par exemple `GOMEMLIMIT=128MiB` et `GOGC=20` dans l'environnement de build.
