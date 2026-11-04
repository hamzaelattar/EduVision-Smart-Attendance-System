import { createContext, useContext, useEffect, useState } from "react";
import {
  initialStudents,
  initialClasses,
  initialCourses,
  initialSessions,
  initialAttendance,
  initialSettings,
  uid,
} from "../data/mockData";

const AppContext = createContext(null);
const seed = {
  students: initialStudents,
  classes: initialClasses,
  courses: initialCourses,
  sessions: initialSessions,
  attendance: initialAttendance,
  settings: initialSettings,
};
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem("eduvision-demo-v1"));
    return saved ? { ...seed, ...saved } : seed;
  } catch {
    return seed;
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(readState);
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    localStorage.setItem("eduvision-demo-v1", JSON.stringify(state));
  }, [state]);
  const toast = (message, type = "success") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(
      () => setToasts((t) => t.filter((item) => item.id !== id)),
      4200,
    );
  };
  const update = (key, value) =>
    setState((s) => ({
      ...s,
      [key]: typeof value === "function" ? value(s[key]) : value,
    }));
  const addStudent = (data) => {
    const student = {
      ...data,
      id: data.id.trim(),
      faceRegistered: false,
      joined: new Date().toLocaleDateString("en-CA"),
    };
    update("students", (a) => [student, ...a]);
    toast("Student added to demo data");
  };
  const editStudent = (id, data) => {
    update("students", (a) =>
      a.map((s) => (s.id === id ? { ...s, ...data } : s)),
    );
    toast("Student updated");
  };
  const deleteStudent = (id) => {
    setState((s) => ({
      ...s,
      students: s.students.filter((x) => x.id !== id),
      attendance: s.attendance.filter((x) => x.studentId !== id),
    }));
    toast("Student removed from demo data");
  };
  const addClass = (data) => {
    update("classes", (a) => [...a, { ...data, id: uid(), color: "#2563eb" }]);
    toast("Class created");
  };
  const editClass = (id, data) => {
    update("classes", (a) =>
      a.map((c) => (c.id === id ? { ...c, ...data } : c)),
    );
    toast("Class updated");
  };
  const deleteClass = (id) => {
    setState((s) => {
      const deletedSessionIds = new Set(
        s.sessions.filter((se) => se.classId === id).map((se) => se.id),
      );
      return {
        ...s,
        classes: s.classes.filter((c) => c.id !== id),
        courses: s.courses.filter((c) => c.classId !== id),
        students: s.students.map((st) =>
          st.classId === id ? { ...st, classId: "" } : st,
        ),
        sessions: s.sessions.filter((se) => se.classId !== id),
        attendance: s.attendance.filter(
          (a) => !deletedSessionIds.has(a.sessionId),
        ),
      };
    });
    toast("Class removed");
  };
  const addCourse = (data) => {
    update("courses", (a) => [...a, { ...data, id: uid() }]);
    toast("Course created");
  };
  const addSession = (data) => {
    const id = uid();
    setState((s) => ({
      ...s,
      sessions: [
        { ...data, id, status: "Draft", source: "demo", endTime: "" },
        ...s.sessions,
      ],
      attendance: [
        ...s.attendance,
        ...s.students
          .filter((st) => st.classId === data.classId)
          .map((st) => ({
            id: uid(),
            sessionId: id,
            studentId: st.id,
            status: "Unverified",
          })),
      ],
    }));
    toast("Demo session started. Attendance remains unverified.");
    return id;
  };
  const endSession = (id) => {
    update("sessions", (a) =>
      a.map((x) =>
        x.id === id
          ? {
              ...x,
              endTime: new Date().toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : x,
      ),
    );
    toast("Demo session ended");
  };
  const mergeAttendance = (s, sessionId, edits) => {
    const session = s.sessions.find((x) => x.id === sessionId),
      existing = new Set(
        s.attendance
          .filter((x) => x.sessionId === sessionId)
          .map((x) => x.studentId),
      );
    return [
      ...s.attendance.map((x) =>
        x.sessionId === sessionId && edits[x.studentId]
          ? { ...x, status: edits[x.studentId] }
          : x,
      ),
      ...s.students
        .filter((st) => st.classId === session?.classId && !existing.has(st.id))
        .map((st) => ({
          id: uid(),
          sessionId,
          studentId: st.id,
          status: edits[st.id] || "Unverified",
        })),
    ];
  };
  const saveAttendance = (sessionId, edits) => {
    setState((s) => ({
      ...s,
      attendance: mergeAttendance(s, sessionId, edits),
    }));
    toast("Attendance draft saved");
  };
  const finalizeSession = (sessionId, edits) => {
    setState((s) => ({
      ...s,
      attendance: mergeAttendance(s, sessionId, edits),
      sessions: s.sessions.map((x) =>
        x.id === sessionId
          ? {
              ...x,
              status: "Finalized",
              endTime:
                x.endTime ||
                new Date().toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            }
          : x,
      ),
    }));
    toast("Attendance finalized");
  };
  const updateSettings = (data) => {
    update("settings", (s) => ({ ...s, ...data }));
    toast("Demo preferences saved");
  };
  const clearRegistrations = () => {
    update("students", (a) => a.map((s) => ({ ...s, faceRegistered: false })));
    toast("Demo registration flags cleared");
  };
  const resetDemo = () => {
    setState(seed);
    toast("Demo data reset");
  };
  return (
    <AppContext.Provider
      value={{
        ...state,
        toasts,
        setToasts,
        toast,
        addStudent,
        editStudent,
        deleteStudent,
        addClass,
        editClass,
        deleteClass,
        addCourse,
        addSession,
        endSession,
        saveAttendance,
        finalizeSession,
        updateSettings,
        clearRegistrations,
        resetDemo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export const useApp = () => useContext(AppContext);
