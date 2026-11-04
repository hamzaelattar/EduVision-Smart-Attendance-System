import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  BookOpen,
  Users,
  MapPin,
  ArrowRight,
  Pencil,
  Trash2,
  GraduationCap,
  ArrowLeft,
  Clock3,
  Search,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
function ClassForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
      initial ? { ...initial } : { name: "", code: "", teacher: "", room: "" },
    ),
    [error, setError] = useState("");
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.code.trim() || !form.teacher.trim()) {
          setError("Name, code, and teacher are required.");
          return;
        }
        onSave({
          name: form.name.trim(),
          code: form.code.trim(),
          teacher: form.teacher.trim(),
          room: form.room.trim(),
        });
      }}
    >
      <div className="modal-body form-grid">
        <div className="field">
          <label className="label" htmlFor="class-name">
            Class name *
          </label>
          <input
            id="class-name"
            className="input"
            value={form.name}
            onChange={(e) => change("name", e.target.value)}
            placeholder="Computer Science 101"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="class-code">
            Class code *
          </label>
          <input
            id="class-code"
            className="input"
            value={form.code}
            onChange={(e) => change("code", e.target.value)}
            placeholder="CS-101"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="class-teacher">
            Assigned teacher *
          </label>
          <input
            id="class-teacher"
            className="input"
            value={form.teacher}
            onChange={(e) => change("teacher", e.target.value)}
            placeholder="Dr. Sarah Mitchell"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="class-room">
            Room
          </label>
          <input
            id="class-room"
            className="input"
            value={form.room}
            onChange={(e) => change("room", e.target.value)}
            placeholder="Room B-204"
          />
        </div>
        {error && <p className="field-error col-span-full">{error}</p>}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit">
          {initial ? "Save class" : "Create class"}
        </button>
      </div>
    </form>
  );
}
function CourseForm({ classId, onSave, onClose }) {
  const [form, setForm] = useState({
      classId,
      name: "",
      code: "",
      schedule: "",
    }),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.code.trim()) {
          setError("Course name and code are required.");
          return;
        }
        onSave(form);
      }}
    >
      <div className="modal-body space-y-4">
        {[
          ["name", "Course name", "Introduction to Programming"],
          ["code", "Course code", "CS101-A"],
          ["schedule", "Schedule", "Mon · Wed, 09:00"],
        ].map(([key, label, placeholder]) => (
          <div className="field" key={key}>
            <label className="label" htmlFor={`course-${key}`}>
              {label}
              {key !== "schedule" ? " *" : ""}
            </label>
            <input
              id={`course-${key}`}
              className="input"
              value={form[key]}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
              placeholder={placeholder}
            />
          </div>
        ))}
        {error && <p className="field-error">{error}</p>}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary">Add course</button>
      </div>
    </form>
  );
}
export default function Classes() {
  const { classes, courses, students, addClass, editClass, deleteClass } =
      useApp(),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(null),
    list = classes.filter((c) =>
      `${c.name} ${c.code} ${c.teacher}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <div className="eyebrow mb-2">Academics / Classes</div>
          <h1 className="page-title">Classes & Courses</h1>
          <p className="page-subtitle">
            Organize your classes, courses, teachers, and students.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ type: "add" })}
        >
          <Plus size={16} /> Add class
        </button>
      </div>
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="section-title">Class directory</div>
          <div className="section-subtitle">
            {classes.length} active classes · demo data
          </div>
        </div>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search classes"
          className="w-[250px]"
        />
      </div>
      {list.length ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => (
            <div
              key={c.id}
              className="card card-pad group hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div
                  className="stat-icon"
                  style={{ background: `${c.color}18`, color: c.color }}
                >
                  <BookOpen size={21} />
                </div>
                <div className="flex gap-1">
                  <button
                    className="icon-button !w-8 !h-8"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => setModal({ type: "edit", classItem: c })}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button !w-8 !h-8 hover:!text-red-600"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => setModal({ type: "delete", classItem: c })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-5 text-[11px] text-blue-600 font-extrabold tracking-wide">
                {c.code}
              </div>
              <h2 className="section-title mt-1">{c.name}</h2>
              <div className="mt-4 space-y-2 text-xs text-slate-500">
                <div className="flex gap-2 items-center">
                  <GraduationCap size={15} /> {c.teacher}
                </div>
                <div className="flex gap-2 items-center">
                  <MapPin size={15} /> {c.room || "Room not assigned"}
                </div>
              </div>
              <div className="divider my-5" />
              <div className="flex justify-between items-center">
                <div className="flex gap-4 text-[11px] text-slate-500">
                  <span>
                    <b className="text-slate-800">
                      {students.filter((s) => s.classId === c.id).length}
                    </b>{" "}
                    students
                  </span>
                  <span>
                    <b className="text-slate-800">
                      {courses.filter((x) => x.classId === c.id).length}
                    </b>{" "}
                    courses
                  </span>
                </div>
                <Link
                  className="text-blue-600 text-xs font-bold flex gap-1 items-center"
                  to={`/classes/${c.id}`}
                >
                  Details <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="No classes found"
            description="Try another search or create a new class."
            action={
              <button
                className="btn btn-primary"
                onClick={() => setModal({ type: "add" })}
              >
                Add class
              </button>
            }
          />
        </div>
      )}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <Modal
          title={modal.type === "add" ? "Create class" : "Edit class"}
          description="Class changes affect demo state only."
          onClose={() => setModal(null)}
        >
          <ClassForm
            initial={modal.classItem}
            onClose={() => setModal(null)}
            onSave={(data) => {
              modal.type === "add"
                ? addClass(data)
                : editClass(modal.classItem.id, data);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal?.type === "delete" && (
        <ConfirmDialog
          title="Delete class?"
          danger
          confirmText="Delete class"
          message={`Deleting ${modal.classItem.name} removes its demo courses and sessions. Students will become unassigned.`}
          onClose={() => setModal(null)}
          onConfirm={() => deleteClass(modal.classItem.id)}
        />
      )}
    </div>
  );
}
export function ClassDetails() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { classes, courses, students, addCourse, editStudent } = useApp(),
    c = classes.find((x) => x.id === id),
    [modal, setModal] = useState(null),
    [studentSearch, setStudentSearch] = useState("");
  if (!c)
    return (
      <div className="card">
        <EmptyState
          title="Class not found"
          action={
            <Link className="btn btn-primary" to="/classes">
              Back to classes
            </Link>
          }
        />
      </div>
    );
  const members = students.filter(
      (s) =>
        s.classId === id &&
        `${s.firstName} ${s.lastName} ${s.id}`
          .toLowerCase()
          .includes(studentSearch.toLowerCase()),
    ),
    options = students.filter((s) => s.classId !== id);
  return (
    <div className="space-y-6">
      <button
        className="btn btn-ghost !px-0"
        onClick={() => navigate("/classes")}
      >
        <ArrowLeft size={15} /> Back to classes
      </button>
      <div className="card card-pad flex flex-wrap items-center gap-4">
        <div
          className="stat-icon !w-14 !h-14"
          style={{ background: `${c.color}18`, color: c.color }}
        >
          <BookOpen size={27} />
        </div>
        <div className="flex-1">
          <div className="eyebrow text-blue-600">{c.code}</div>
          <h1 className="page-title mt-1">{c.name}</h1>
          <div className="text-xs text-slate-500 mt-2">
            {c.teacher} · {c.room || "No room assigned"}
          </div>
        </div>
        <span className="demo-pill">Demo class</span>
      </div>
      <div className="detail-grid">
        <section className="card">
          <div className="card-pad flex justify-between items-center gap-3">
            <div>
              <h2 className="section-title">Assigned courses</h2>
              <p className="section-subtitle">
                {courses.filter((x) => x.classId === id).length} courses
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setModal({ type: "course" })}
            >
              <Plus size={14} /> Add course
            </button>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {courses
              .filter((x) => x.classId === id)
              .map((course) => (
                <div
                  key={course.id}
                  className="border border-slate-100 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="avatar purple">
                    <BookOpen size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-700">
                      {course.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {course.code} · {course.schedule || "Schedule pending"}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
        <section className="card">
          <div className="card-pad flex justify-between items-center gap-3">
            <div>
              <h2 className="section-title">Enrolled students</h2>
              <p className="section-subtitle">
                {students.filter((s) => s.classId === id).length} students
              </p>
            </div>
            <button
              className="btn btn-outline"
              onClick={() => setModal({ type: "assign" })}
            >
              <Plus size={14} /> Assign
            </button>
          </div>
          <div className="px-5 pb-3">
            <SearchBar
              value={studentSearch}
              onChange={setStudentSearch}
              placeholder="Search enrolled students"
            />
          </div>
          <div className="max-h-[340px] overflow-auto px-5 pb-5 space-y-2">
            {members.length ? (
              members.map((s) => (
                <div
                  key={s.id}
                  className="flex gap-3 items-center p-2 rounded-lg hover:bg-slate-50"
                >
                  <div className="avatar">
                    {s.firstName[0]}
                    {s.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-[10px] text-slate-400">{s.id}</div>
                  </div>
                  <button
                    className="text-[10px] text-red-500 font-bold"
                    onClick={() => editStudent(s.id, { classId: "" })}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <EmptyState icon={Users} title="No students found" />
            )}
          </div>
        </section>
      </div>
      {modal?.type === "course" && (
        <Modal
          title="Add course"
          description={`For ${c.name}`}
          onClose={() => setModal(null)}
        >
          <CourseForm
            classId={id}
            onSave={(data) => {
              addCourse(data);
              setModal(null);
            }}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "assign" && (
        <Modal
          title="Assign student"
          description="Move an existing demo student into this class."
          onClose={() => setModal(null)}
        >
          <div className="modal-body space-y-2 max-h-[350px] overflow-auto">
            {options.length ? (
              options.map((s) => (
                <button
                  key={s.id}
                  className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg text-left"
                  onClick={() => {
                    editStudent(s.id, { classId: id });
                    setModal(null);
                  }}
                >
                  <div className="avatar">
                    {s.firstName[0]}
                    {s.lastName[0]}
                  </div>
                  <div>
                    <div className="font-bold text-xs">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="text-[10px] text-slate-400">{s.id}</div>
                  </div>
                  <Plus size={15} className="ml-auto text-blue-600" />
                </button>
              ))
            ) : (
              <EmptyState title="All students are assigned" />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
