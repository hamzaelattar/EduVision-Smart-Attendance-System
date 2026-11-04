import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Users,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  ScanFace,
  Mail,
  Phone,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import StatusBadge from "../components/ui/StatusBadge";
import SearchBar from "../components/ui/SearchBar";
import EmptyState from "../components/ui/EmptyState";
import FaceRegistration from "../components/camera/FaceRegistration";
import useDemoLoading from "../hooks/useDemoLoading";
const blank = {
  id: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  classId: "",
};
function StudentForm({ initial, classes, students, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...initial } : blank),
    [errors, setErrors] = useState({});
  const change = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const submit = (e) => {
    e.preventDefault();
    const issues = {};
    if (!form.id.trim()) issues.id = "Student ID is required";
    else if (
      !initial &&
      students.some((s) => s.id.toLowerCase() === form.id.trim().toLowerCase())
    )
      issues.id = "Student ID already exists";
    if (!form.firstName.trim()) issues.firstName = "First name is required";
    if (!form.lastName.trim()) issues.lastName = "Last name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      issues.email = "Enter a valid email";
    if (!form.classId) issues.classId = "Choose a class";
    setErrors(issues);
    if (Object.keys(issues).length === 0)
      onSave({
        ...form,
        id: form.id.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      });
  };
  return (
    <form onSubmit={submit}>
      <div className="modal-body form-grid">
        <div className="field">
          <label className="label" htmlFor="student-id">
            Student ID *
          </label>
          <input
            id="student-id"
            className="input"
            value={form.id}
            disabled={!!initial}
            onChange={(e) => change("id", e.target.value)}
            placeholder="STU-1021"
          />
          {errors.id && <div className="field-error">{errors.id}</div>}
        </div>
        <div className="field">
          <label className="label" htmlFor="student-class">
            Class *
          </label>
          <select
            id="student-class"
            className="select"
            value={form.classId}
            onChange={(e) => change("classId", e.target.value)}
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.classId && (
            <div className="field-error">{errors.classId}</div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="first-name">
            First name *
          </label>
          <input
            id="first-name"
            className="input"
            value={form.firstName}
            onChange={(e) => change("firstName", e.target.value)}
            placeholder="First name"
          />
          {errors.firstName && (
            <div className="field-error">{errors.firstName}</div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="last-name">
            Last name *
          </label>
          <input
            id="last-name"
            className="input"
            value={form.lastName}
            onChange={(e) => change("lastName", e.target.value)}
            placeholder="Last name"
          />
          {errors.lastName && (
            <div className="field-error">{errors.lastName}</div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="student-email">
            Email *
          </label>
          <input
            id="student-email"
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => change("email", e.target.value)}
            placeholder="student@campus.edu"
          />
          {errors.email && <div className="field-error">{errors.email}</div>}
        </div>
        <div className="field">
          <label className="label" htmlFor="student-phone">
            Phone (optional)
          </label>
          <input
            id="student-phone"
            className="input"
            value={form.phone || ""}
            onChange={(e) => change("phone", e.target.value)}
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit">
          {initial ? "Save changes" : "Add student"}
        </button>
      </div>
    </form>
  );
}
export default function Students() {
  const { students, classes, addStudent, editStudent, deleteStudent } =
      useApp(),
    [params] = useSearchParams(),
    [search, setSearch] = useState(params.get("q") || ""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [menu, setMenu] = useState(null),
    loading = useDemoLoading();
  useEffect(() => setSearch(params.get("q") || ""), [params]);
  const filtered = useMemo(
    () =>
      students.filter((s) => {
        const q = search.toLowerCase();
        return (
          (filter === "all" || s.classId === filter) &&
          `${s.firstName} ${s.lastName} ${s.id}`.toLowerCase().includes(q)
        );
      }),
    [students, search, filter],
  );
  useEffect(() => setPage(1), [search, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / 8)),
    shown = filtered.slice((page - 1) * 8, page * 8),
    className = (id) => classes.find((c) => c.id === id)?.name || "Unassigned";
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4 items-start">
        <div>
          <div className="eyebrow mb-2">People / Directory</div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            Manage student profiles and demo face registration.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ type: "add" })}
        >
          <Plus size={16} /> Add student
        </button>
      </div>
      <div className="grid-auto !gap-3">
        <div className="card card-pad col-span-1">
          <div className="text-[11px] text-slate-500 font-semibold">
            Total students
          </div>
          <div className="metric-number mt-2">{students.length}</div>
        </div>
        <div className="card card-pad">
          <div className="text-[11px] text-slate-500 font-semibold">
            Demo registered
          </div>
          <div className="metric-number mt-2">
            {students.filter((s) => s.faceRegistered).length}
          </div>
        </div>
        <div className="card card-pad">
          <div className="text-[11px] text-slate-500 font-semibold">
            Pending registration
          </div>
          <div className="metric-number mt-2">
            {students.filter((s) => !s.faceRegistered).length}
          </div>
        </div>
        <div className="card card-pad">
          <div className="text-[11px] text-slate-500 font-semibold">
            Active classes
          </div>
          <div className="metric-number mt-2">{classes.length}</div>
        </div>
      </div>
      <section className="card">
        <div className="card-pad flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h2 className="section-title">Student directory</h2>
            <p className="section-subtitle">
              Sample data stays in this browser
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search name or ID"
              className="w-[210px]"
            />
            <div className="relative">
              <Filter
                size={14}
                className="absolute left-3 top-3 text-slate-400"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="select !pl-8 !w-[175px]"
                aria-label="Filter by class"
              >
                <option value="all">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : shown.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Student ID</th>
                  <th>Class</th>
                  <th>Email</th>
                  <th>Face status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <button
                        className="flex items-center gap-2.5 text-left"
                        onClick={() => setSelected(s.id)}
                      >
                        <span className="avatar">
                          {s.firstName[0]}
                          {s.lastName[0]}
                        </span>
                        <span className="font-bold text-slate-700">
                          {s.firstName} {s.lastName}
                        </span>
                      </button>
                    </td>
                    <td className="font-semibold">{s.id}</td>
                    <td>{className(s.classId)}</td>
                    <td>{s.email}</td>
                    <td>
                      <StatusBadge
                        status={
                          s.faceRegistered ? "Registered" : "Not Registered"
                        }
                      />
                    </td>
                    <td>
                      <div className="relative">
                        <button
                          className="icon-button !w-8 !h-8"
                          aria-label={`Actions for ${s.firstName} ${s.lastName}`}
                          onClick={() => setMenu(menu === s.id ? null : s.id)}
                        >
                          <MoreHorizontal size={17} />
                        </button>
                        {menu === s.id && (
                          <div className="absolute right-0 top-9 card z-10 shadow-xl p-1 w-40">
                            <button
                              className="w-full flex gap-2 items-center p-2 hover:bg-slate-50 text-xs rounded"
                              onClick={() => {
                                setSelected(s.id);
                                setMenu(null);
                              }}
                            >
                              <Eye size={14} /> View profile
                            </button>
                            <button
                              className="w-full flex gap-2 items-center p-2 hover:bg-slate-50 text-xs rounded"
                              onClick={() => {
                                setModal({ type: "edit", student: s });
                                setMenu(null);
                              }}
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              className="w-full flex gap-2 items-center p-2 hover:bg-slate-50 text-xs rounded"
                              onClick={() => {
                                setModal({ type: "face", student: s });
                                setMenu(null);
                              }}
                            >
                              <ScanFace size={14} /> Register face
                            </button>
                            <button
                              className="w-full flex gap-2 items-center p-2 hover:bg-red-50 text-red-600 text-xs rounded"
                              onClick={() => {
                                setModal({ type: "delete", student: s });
                                setMenu(null);
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No students found"
            description="Try another search or add a student to the demo directory."
            action={
              <button
                className="btn btn-primary"
                onClick={() => setModal({ type: "add" })}
              >
                <Plus size={14} /> Add student
              </button>
            }
          />
        )}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Showing {filtered.length ? (page - 1) * 8 + 1 : 0}–
            {Math.min(page * 8, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="icon-button !w-7 !h-7"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="font-bold text-slate-700">
              {page} / {pages}
            </span>
            <button
              className="icon-button !w-7 !h-7"
              aria-label="Next page"
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      {selected &&
        (() => {
          const s = students.find((x) => x.id === selected);
          return s ? (
            <div
              className="modal-backdrop"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSelected(null);
              }}
            >
              <div
                className="modal !w-[420px]"
                role="dialog"
                aria-modal="true"
                aria-label="Student profile"
              >
                <div className="modal-head">
                  <h2 className="section-title">Student profile</h2>
                  <button
                    className="icon-button"
                    onClick={() => setSelected(null)}
                    aria-label="Close profile"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="flex gap-3 items-center">
                    <div className="avatar !w-14 !h-14 !text-base">
                      {s.firstName[0]}
                      {s.lastName[0]}
                    </div>
                    <div>
                      <div className="text-lg font-extrabold text-slate-800">
                        {s.firstName} {s.lastName}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{s.id}</div>
                    </div>
                  </div>
                  <div className="divider my-5" />
                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex gap-2">
                      <Users size={15} /> {className(s.classId)}
                    </div>
                    <div className="flex gap-2">
                      <Mail size={15} /> {s.email}
                    </div>
                    <div className="flex gap-2">
                      <Phone size={15} /> {s.phone || "No phone provided"}
                    </div>
                    <div className="flex gap-2">
                      <CalendarDays size={15} /> Joined {s.joined}
                    </div>
                  </div>
                  <div className="mt-5">
                    <StatusBadge
                      status={
                        s.faceRegistered ? "Registered" : "Not Registered"
                      }
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-4">
                    Face registration status is demo metadata only. No biometric
                    images are stored here.
                  </p>
                </div>
                <div className="modal-foot">
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setModal({ type: "edit", student: s });
                      setSelected(null);
                    }}
                  >
                    <Pencil size={14} /> Edit profile
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setModal({ type: "face", student: s });
                      setSelected(null);
                    }}
                  >
                    <ScanFace size={14} /> Face registration
                  </button>
                </div>
              </div>
            </div>
          ) : null;
        })()}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <Modal
          title={modal.type === "add" ? "Add student" : "Edit student"}
          description="This changes demo data in your browser only."
          onClose={() => setModal(null)}
        >
          <StudentForm
            initial={modal.student}
            classes={classes}
            students={students}
            onClose={() => setModal(null)}
            onSave={(data) => {
              modal.type === "add"
                ? addStudent(data)
                : editStudent(modal.student.id, data);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal?.type === "delete" && (
        <ConfirmDialog
          title="Delete student?"
          message={`Remove ${modal.student.firstName} ${modal.student.lastName} from the demo directory and attendance records?`}
          confirmText="Delete student"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => deleteStudent(modal.student.id)}
        />
      )}
      {modal?.type === "face" && (
        <FaceRegistration
          student={modal.student}
          onClose={() => setModal(null)}
          onSave={() => editStudent(modal.student.id, { faceRegistered: true })}
        />
      )}
    </div>
  );
}
