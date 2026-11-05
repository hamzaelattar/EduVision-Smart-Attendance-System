import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CameraGrid from "../components/camera/CameraGrid";
import FaceEnrollment from "../components/camera/FaceEnrollment";
import RealReports from "../components/camera/RealReports";
import { clearLiveToken, liveRequest, liveToken, saveLiveToken } from "../services/liveApi";

const statuses = ["Unverified", "Present", "Absent", "Late", "Excused"];
const statusLabels = { Unverified: "À vérifier", Present: "Présent", Absent: "Absent", Late: "En retard", Excused: "Excusé" };
const savedSelection = (key) => sessionStorage.getItem(`eduvision-${key}`) || "";

export default function IoTConsole() {
  const [token, setToken] = useState(liveToken);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [records, setRecords] = useState([]);
  const [sessionId, setSessionId] = useState(() => savedSelection("session"));
  const [classId, setClassId] = useState(() => savedSelection("class"));
  const [courseId, setCourseId] = useState(() => savedSelection("course"));
  const [newCamera, setNewCamera] = useState({ id: "", name: "", room: "" });
  const [newClass, setNewClass] = useState({ name: "", code: "", room: "" });
  const [newCourse, setNewCourse] = useState({ name: "", code: "" });
  const [newStudent, setNewStudent] = useState({ id: "", firstName: "", lastName: "" });
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "teacher" });
  const [deviceCredential, setDeviceCredential] = useState(null);
  const secretRef = useRef(null);
  const selectionInitialized = useRef(false);

  useEffect(() => {
    if (deviceCredential) {
      const panel = secretRef.current?.closest("details");
      if (panel) panel.open = true;
      secretRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [deviceCredential]);

  useEffect(() => {
    for (const [key, value] of [["class", classId], ["course", courseId], ["session", sessionId]]) {
      if (value) sessionStorage.setItem(`eduvision-${key}`, value);
      else sessionStorage.removeItem(`eduvision-${key}`);
    }
  }, [classId, courseId, sessionId]);

  const refresh = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    const [me, cameraRows, classRows, courseRows, studentRows, sessionRows] = await Promise.all([
      liveRequest("/auth/me", { token: activeToken }),
      liveRequest("/webrtc/cameras", { token: activeToken }),
      liveRequest("/classes?limit=100", { token: activeToken }),
      liveRequest("/courses?limit=100", { token: activeToken }),
      liveRequest("/students?limit=100", { token: activeToken }),
      liveRequest("/sessions?limit=100", { token: activeToken }),
    ]);
    setUser(me);
    setCameras(cameraRows);
    setClasses(classRows);
    setCourses(courseRows);
    setStudents(studentRows);
    setSessions(sessionRows);
    const latestDraft = sessionRows.find((row) => row.status === "Draft");
    const firstLoad = !selectionInitialized.current;
    setClassId((current) => classRows.some((row) => row.id === current) ? current : firstLoad ? latestDraft?.classId || classRows[0]?.id || "" : "");
    setCourseId((current) => courseRows.some((row) => row.id === current) ? current : firstLoad ? latestDraft?.courseId || "" : "");
    setSessionId((current) => sessionRows.some((row) => row.id === current) ? current : firstLoad ? latestDraft?.id || "" : "");
    selectionInitialized.current = true;
    if (me.role === "admin") setUsers(await liveRequest("/auth/users", { token: activeToken }));
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    refresh(token).catch((reason) => setError(reason.message));
    const timer = setInterval(() => {
      liveRequest("/webrtc/cameras", { token }).then(setCameras).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [token, refresh]);

  useEffect(() => {
    if (!token || !sessionId) { setRecords([]); return; }
    let active = true;
    const sync = () => liveRequest(`/attendance?sessionId=${encodeURIComponent(sessionId)}&limit=500`, { token })
      .then((rows) => { if (active) setRecords(rows); })
      .catch((reason) => { if (active) setError(reason.message); });
    sync();
    const timer = setInterval(sync, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [token, sessionId]);

  const selectedSession = sessions.find((item) => item.id === sessionId && item.classId === classId && (!courseId || item.courseId === courseId));
  const availableCourses = courses.filter((item) => item.classId === classId);
  const availableSessions = sessions.filter((item) => item.classId === classId && (!courseId || item.courseId === courseId));
  const classStudents = students.filter((item) => item.classId === classId);
  const enrolledStudents = classStudents.filter((item) => item.faceRegistered);
  const sessionCameras = selectedSession ? cameras.filter((item) => item.sessionId === sessionId) : [];
  const onlineCamera = sessionCameras.find((item) => item.online);
  const recognizedName = onlineCamera?.candidates?.find((item) => item.candidateStudentName)?.candidateStudentName;
  const unverifiedCount = records.filter((item) => item.status === "Unverified").length;
  const setupReady = !!classId && availableCourses.length > 0 && classStudents.length > 0;
  const steps = [
    { label: "Préparer", done: setupReady, target: "setup" },
    { label: "Inscrire un visage", done: enrolledStudents.length > 0, target: "enrollment" },
    { label: "Créer la séance", done: !!selectedSession, target: "session" },
    { label: "Associer une caméra", done: sessionCameras.length > 0 || selectedSession?.status === "Finalized", target: "cameras" },
    { label: "Suivre les présences", done: selectedSession?.status === "Finalized" || records.length > 0 && unverifiedCount === 0, target: "validation" },
  ];
  const nextStep = selectedSession?.status === "Draft" && records.length > 0 && unverifiedCount === 0
    ? { label: "Terminer la séance", target: "validation" }
    : steps.find((item) => !item.done) || { label: "Voir le rapport", target: "reports" };

  useEffect(() => {
    if (!selectionInitialized.current || !classId) return;
    if (courseId && !courses.some((item) => item.id === courseId && item.classId === classId)) {
      setCourseId("");
      setSessionId("");
    } else if (sessionId && !sessions.some((item) => item.id === sessionId && item.classId === classId && (!courseId || item.courseId === courseId))) {
      setSessionId("");
    }
  }, [classId, courseId, sessionId, courses, sessions]);

  function goTo(targetId) {
    const target = document.getElementById(targetId) || document.getElementById("session");
    if (target?.tagName === "DETAILS") target.open = true;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function act(work, success) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await work();
      await refresh();
      if (sessionId) {
        setRecords(await liveRequest(`/attendance?sessionId=${encodeURIComponent(sessionId)}&limit=500`));
      }
      if (success) setNotice(success);
      return result;
    } catch (reason) {
      setError(reason.message || "Opération impossible");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await liveRequest("/auth/login", {
        method: "POST", token: "", body: { username, password },
      });
      saveLiveToken(response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      setPassword("");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function logout() {
    await liveRequest("/auth/logout", { method: "POST" }).catch(() => {});
    clearLiveToken(); setToken(""); setUser(null); setCameras([]); setRecords([]);
  }

  async function createCamera(event) {
    event.preventDefault();
    const created = await issueSecret(() => liveRequest("/webrtc/cameras", {
      method: "POST", body: newCamera,
    }));
    if (created) {
      setNewCamera({ id: "", name: "", room: "" });
    }
  }

  async function issueSecret(work, cameraId = null) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await work();
      setDeviceCredential({ id: cameraId || result.camera.id, secret: result.deviceSecret });
      setNotice("Secret créé. Copiez-le dans la page du téléphone.");
      refresh().catch((reason) => setError(reason.message));
      return result;
    } catch (reason) {
      setError(reason.message || "Impossible de créer le secret");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createSession() {
    if (!classId || !courseId) { setError("Choisissez une classe et un cours."); return; }
    const date = new Date();
    const created = await act(() => liveRequest("/sessions", {
      method: "POST", body: {
        classId, courseId,
        date: date.toLocaleDateString("en-CA"),
        startTime: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      },
    }), "Séance créée. Les présences restent à vérifier.");
    if (created) setSessionId(created.id);
  }

  if (!token) return <div className="max-w-md mx-auto space-y-5">
    <div><div className="eyebrow mb-2">EduVision IoT</div><h1 className="page-title">Connexion opérateur</h1>
      <p className="page-subtitle">Compte administrateur ou enseignant requis pour accéder aux flux.</p></div>
    <form className="card card-pad space-y-4" onSubmit={login}>
      <label className="field"><span className="label">Identifiant</span><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
      <label className="field"><span className="label">Mot de passe</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <button className="btn btn-primary" disabled={busy}>Se connecter</button>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </form>
  </div>;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="eyebrow mb-2">EduVision IoT · {user?.role || "…"}</div>
        <h1 className="page-title">Caméras et présences réelles</h1>
        <p className="page-subtitle">Reconnaissance en direct et présences enregistrées automatiquement.</p></div>
      <div className="flex gap-2"><Link to="/iot-camera" className="btn btn-outline">Ouvrir la page téléphone</Link>
        <button className="btn btn-outline" onClick={logout}>Déconnexion</button></div>
    </header>
    {error && <p className="p-3 bg-red-50 text-red-700 rounded-lg text-sm" role="alert">{error}</p>}
    {notice && <p className="p-3 bg-green-50 text-green-700 rounded-lg text-sm" role="status">{notice}</p>}
    <section className="card card-pad space-y-4" aria-label="Parcours de présence">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Votre parcours</p>
          <h2 className="section-title">{selectedSession?.status === "Finalized" ? "Séance terminée" : recognizedName ? `Visage proposé : ${recognizedName}` : `Étape suivante : ${nextStep.label}`}</h2>
          <p className="text-sm text-slate-600 mt-1">{selectedSession?.status === "Finalized"
            ? "Les présences sont enregistrées. Consultez ou exportez le rapport."
            : recognizedName
              ? "Après trois correspondances fortes, la présence devient automatiquement Présent. Vérifiez son statut ci-dessous."
              : onlineCamera && selectedSession?.status === "Draft"
                ? "La caméra est en direct. Les présences reconnues apparaissent automatiquement ci-dessous."
                : selectedSession?.status === "Draft" && sessionCameras.length > 0
                  ? "La caméra est hors ligne. Reconnectez-la pour enregistrer d'autres présences."
                : "Suivez les étapes dans l'ordre. Votre sélection est conservée pendant cette session."}</p>
        </div>
        <button className="btn btn-primary" onClick={() => goTo(selectedSession?.status === "Finalized" ? "reports" : recognizedName ? "validation" : nextStep.target)}>
          {selectedSession?.status === "Finalized" ? "Voir le rapport" : recognizedName ? "Voir les présences" : `Aller à : ${nextStep.label}`}
        </button>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => <li key={step.label}>
          <button className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${step.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            onClick={() => goTo(step.target)}>
            <span className="font-semibold">{step.done ? "✓" : index + 1}. {step.label}</span>
          </button>
        </li>)}
      </ol>
    </section>
    {user?.role === "admin" && <details id="setup" className="card card-pad space-y-4">
      <summary className="section-title cursor-pointer">Préparer les données : classe, cours, étudiant</summary>
      <div className="space-y-4 pt-4">
      <label className="field max-w-md"><span className="label">Classe pour le nouveau cours et le nouvel étudiant</span>
        <select className="select" value={classId} onChange={(event) => { setClassId(event.target.value); setCourseId(""); setSessionId(""); }}>
          <option value="">Sélectionner une classe</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
        </select>
      </label>
      <div className="grid lg:grid-cols-3 gap-4">
        <form className="space-y-2" onSubmit={async (event) => {
          event.preventDefault();
          const result = await act(() => liveRequest("/classes", { method: "POST", body: newClass }), "Classe créée");
          if (result) {
            setNewClass({ name: "", code: "", room: "" });
            setClassId(result.id);
            setCourseId("");
            setSessionId("");
          }
        }}><h3 className="font-semibold text-sm">Nouvelle classe</h3>
          <input className="input" placeholder="Nom" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} required />
          <input className="input" placeholder="Code" value={newClass.code} onChange={(e) => setNewClass({ ...newClass, code: e.target.value })} required />
          <input className="input" placeholder="Salle" value={newClass.room} onChange={(e) => setNewClass({ ...newClass, room: e.target.value })} />
          <button className="btn btn-outline" disabled={busy}>Créer la classe</button>
        </form>
        <form className="space-y-2" onSubmit={async (event) => {
          event.preventDefault();
          const result = await act(() => liveRequest("/courses", { method: "POST", body: { ...newCourse, classId } }), "Cours créé");
          if (result) setNewCourse({ name: "", code: "" });
        }}><h3 className="font-semibold text-sm">Nouveau cours pour la classe sélectionnée</h3>
          <input className="input" placeholder="Nom" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} required />
          <input className="input" placeholder="Code" value={newCourse.code} onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })} required />
          <button className="btn btn-outline" disabled={busy || !classId}>Créer le cours</button>
        </form>
        <form className="space-y-2" onSubmit={async (event) => {
          event.preventDefault();
          const result = await act(() => liveRequest("/students", { method: "POST", body: { ...newStudent, classId } }), "Étudiant créé");
          if (result) setNewStudent({ id: "", firstName: "", lastName: "" });
        }}><h3 className="font-semibold text-sm">Nouvel étudiant dans la classe sélectionnée</h3>
          <input className="input" placeholder="Matricule" value={newStudent.id} onChange={(e) => setNewStudent({ ...newStudent, id: e.target.value })} required />
          <input className="input" placeholder="Prénom" value={newStudent.firstName} onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })} required />
          <input className="input" placeholder="Nom" value={newStudent.lastName} onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })} required />
          <button className="btn btn-outline" disabled={busy || !classId}>Créer l'étudiant</button>
        </form>
      </div>
      </div>
    </details>}

    {user?.role === "admin" && <details id="enrollment" className="scroll-mt-5">
      <summary className="card card-pad section-title cursor-pointer">Inscrire ou modifier un visage</summary>
      <div className="mt-3"><FaceEnrollment students={students} onUpdated={() => refresh().catch((reason) => setError(reason.message))} /></div>
    </details>}

    <section id="session" className="card card-pad space-y-4 scroll-mt-5">
      <h2 className="section-title">Séance de présence</h2>
      <p className="text-sm text-slate-600">Choisissez votre classe et votre cours. Pour continuer une séance, sélectionnez-la ; pour en créer une autre, utilisez le bouton ci-dessous.</p>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="field"><span className="label">Classe</span><select className="select" value={classId} onChange={(e) => { setClassId(e.target.value); setCourseId(""); setSessionId(""); }}>
          <option value="">Sélectionner</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="field"><span className="label">Cours</span><select className="select" value={courseId} onChange={(e) => { setCourseId(e.target.value); setSessionId(""); }}>
          <option value="">Sélectionner</option>{availableCourses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="field"><span className="label">Séance existante</span><select className="select" value={selectedSession?.id || ""} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">Aucune séance sélectionnée</option>{availableSessions.map((item) => <option key={item.id} value={item.id}>{item.date} à {item.startTime} · {item.status === "Draft" ? "En cours" : "Finalisée"}</option>)}
        </select></label>
      </div>
      <button className={`btn ${selectedSession?.status === "Draft" ? "btn-outline" : "btn-primary"}`} onClick={createSession} disabled={busy || !classId || !courseId}>Créer une nouvelle séance</button>
      {selectedSession && <p className="text-sm text-slate-600">Séance sélectionnée : <strong>{selectedSession.status === "Draft" ? "En cours" : "Finalisée"}</strong> · {selectedSession.date} · {classes.find((item) => item.id === selectedSession.classId)?.name}</p>}
    </section>

    {user?.role === "admin" && <details id="camera-setup" className="card card-pad space-y-4">
      <summary className="section-title cursor-pointer">Ajouter une caméra</summary>
      <div className="space-y-4 pt-4">
      <form className="flex flex-wrap gap-2" onSubmit={createCamera}>
        <input className="input max-w-40" placeholder="CAM-001" value={newCamera.id} onChange={(e) => setNewCamera({ ...newCamera, id: e.target.value })} required />
        <input className="input max-w-52" placeholder="Nom" value={newCamera.name} onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })} required />
        <input className="input max-w-40" placeholder="Salle" value={newCamera.room} onChange={(e) => setNewCamera({ ...newCamera, room: e.target.value })} />
        <button className="btn btn-primary" disabled={busy}>Créer</button>
      </form>
      {deviceCredential && <div ref={secretRef} className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2" role="status">
        <h3 className="font-bold">Secret de {deviceCredential.id}</h3>
        <p className="text-sm">Copiez-le maintenant : il ne sera plus affiché après fermeture ou actualisation.</p>
        <code className="block break-all p-3 bg-white rounded text-sm select-all">{deviceCredential.secret}</code>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(deviceCredential.secret).catch(() => {})}>Copier le secret</button>
          <button className="btn btn-outline" onClick={() => setDeviceCredential(null)}>J'ai copié</button>
        </div>
      </div>}
      </div>
    </details>}

    <section id="cameras" className="space-y-4 scroll-mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="section-title">Caméras ({cameras.length})</h2>
        {user?.role === "admin" && <button className="btn btn-outline" onClick={() => goTo("camera-setup")}>Ajouter une caméra</button>}</div>
      {cameras.length ? <CameraGrid cameras={cameras} token={token}>{(camera) => user?.role === "admin" && <div className="space-y-2 border-t pt-3">
        <label className="field"><span className="label">Séance associée</span><select className="select" value={camera.sessionId || ""}
          onChange={(e) => act(() => liveRequest(`/webrtc/cameras/${encodeURIComponent(camera.id)}/session`, {
            method: "PUT", body: { sessionId: e.target.value || null },
          }), "Association mise à jour")}>
          <option value="">Aucune</option>{sessions.filter((item) => item.status === "Draft").map((item) => <option key={item.id} value={item.id}>{item.date} à {item.startTime} · {classes.find((row) => row.id === item.classId)?.name || item.classId}</option>)}
        </select></label>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-outline" disabled={busy} onClick={() => act(() => liveRequest(`/webrtc/cameras/${encodeURIComponent(camera.id)}/enabled`, {
            method: "PUT", body: { enabled: !camera.enabled },
          }), camera.enabled ? "Caméra désactivée" : "Caméra activée")}>{camera.enabled ? "Désactiver" : "Activer"}</button>
          <button className="btn btn-outline" disabled={busy} onClick={async () => {
            if (!window.confirm(`Remplacer le secret de ${camera.id} ? Son flux sera interrompu.`)) return;
            await issueSecret(() => liveRequest(`/webrtc/cameras/${encodeURIComponent(camera.id)}/rotate-secret`, { method: "POST" }), camera.id);
          }}>Renouveler le secret</button>
        </div>
      </div>}</CameraGrid> : <p className="text-sm text-slate-500">Aucune caméra enregistrée ou accessible.</p>}
    </section>

    {selectedSession && <section id="validation" className="card card-pad space-y-4 scroll-mt-5">
      <div className="flex justify-between items-center gap-3"><div><h2 className="section-title">Présences de la séance</h2>
        <p className="section-subtitle">Une correspondance forte sur trois images consécutives marque Présent automatiquement. Vous pouvez corriger une décision avant de terminer la séance.</p></div>
        <button className="btn btn-primary" onClick={() => act(() => liveRequest(`/sessions/${sessionId}/finalize`, {
          method: "POST", body: { confirmed: true },
        }), "Séance finalisée")} disabled={busy || selectedSession.status !== "Draft" || unverifiedCount > 0}>Terminer la séance</button>
      </div>
      {selectedSession.status === "Draft" && <p className="text-sm text-slate-600">{unverifiedCount > 0
        ? `${unverifiedCount} étudiant${unverifiedCount > 1 ? "s restent" : " reste"} à vérifier. Un visage reconnu passera automatiquement à Présent ; vous pouvez aussi choisir un statut manuellement.`
        : "Toutes les présences sont enregistrées. Vous pouvez terminer la séance."}</p>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Étudiant</th><th>Matricule</th><th>Statut</th><th>Décision</th></tr></thead>
        <tbody>{records.map((record) => <tr key={record.id}>
          <td>{students.find((student) => student.id === record.studentId)?.name || record.studentId}</td>
          <td>{record.studentId}</td><td>{statusLabels[record.status] || record.status}
            {record.status === "Present" && record.updatedBy == null && record.updatedAt && <span className="block text-xs text-emerald-700">Reconnaissance automatique</span>}</td><td>
            <div className="flex flex-wrap items-center gap-2">
              {record.status === "Unverified" && selectedSession.status === "Draft" && <button className="btn btn-primary" disabled={busy}
                onClick={() => act(() => liveRequest(`/attendance/${record.id}`, {
                  method: "PUT", body: { status: "Present", confirmed: true },
                }), "Présence confirmée")}>Marquer présent manuellement</button>}
              <select className="select min-w-36" aria-label={`Autre décision pour ${record.studentId}`} value={record.status} disabled={busy || selectedSession.status !== "Draft"}
                onChange={(e) => act(() => liveRequest(`/attendance/${record.id}`, {
                  method: "PUT", body: { status: e.target.value, confirmed: true },
                }), "Présence enregistrée")}>
                {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
            </div>
          </td>
        </tr>)}</tbody></table></div>
    </section>}
    <div id="reports" className="scroll-mt-5"><RealReports refreshKey={sessions.map((item) => item.status).join(",") + records.map((item) => item.status).join(",")} /></div>
    {user?.role === "admin" && <details className="card card-pad space-y-4">
      <summary className="section-title cursor-pointer">Enseignants et accès aux classes</summary>
      <div className="space-y-4 pt-4">
      <form className="flex flex-wrap gap-2" onSubmit={async (event) => {
        event.preventDefault();
        const result = await act(() => liveRequest("/auth/users", { method: "POST", body: newUser }), "Compte créé");
        if (result) setNewUser({ username: "", password: "", role: "teacher" });
      }}>
        <input className="input max-w-48" placeholder="Identifiant" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
        <input className="input max-w-56" type="password" placeholder="Mot de passe (12 caractères min.)" minLength={12} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
        <button className="btn btn-outline" disabled={busy}>Créer un enseignant</button>
      </form>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {classes.map((item) => <label key={item.id} className="field"><span className="label">{item.name} · enseignant responsable</span>
          <select className="select" value={item.teacherUserId || ""} onChange={(e) => act(() => liveRequest(`/classes/${item.id}`, {
            method: "PUT", body: { teacherUserId: e.target.value ? Number(e.target.value) : null },
          }), "Affectation enregistrée")}>
            <option value="">Non attribuée</option>
            {users.filter((account) => account.role === "teacher" && account.active).map((account) => <option key={account.id} value={account.id}>{account.username}</option>)}
          </select></label>)}
      </div>
      </div>
    </details>}
  </div>;
}
