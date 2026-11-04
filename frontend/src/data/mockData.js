export const today = () => new Date().toLocaleDateString("en-CA");
export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
};
export const monthsAgo = (n) => {
  const d = new Date();
  d.setDate(15);
  d.setMonth(d.getMonth() - n);
  return d.toLocaleDateString("en-CA");
};
export const uid = () =>
  crypto.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const initialClasses = [
  {
    id: "cls-1",
    name: "Computer Science 101",
    code: "CS-101",
    teacher: "Dr. Sarah Mitchell",
    room: "Room B-204",
    color: "#2563eb",
  },
  {
    id: "cls-2",
    name: "Mathematics 201",
    code: "MTH-201",
    teacher: "Prof. Daniel Carter",
    room: "Room A-112",
    color: "#7c3aed",
  },
  {
    id: "cls-3",
    name: "Physics 110",
    code: "PHY-110",
    teacher: "Dr. Olivia Chen",
    room: "Lab C-02",
    color: "#0891b2",
  },
  {
    id: "cls-4",
    name: "English Literature",
    code: "ENG-140",
    teacher: "Prof. James Wilson",
    room: "Room D-305",
    color: "#ea580c",
  },
];
export const initialCourses = [
  {
    id: "crs-1",
    classId: "cls-1",
    name: "Introduction to Programming",
    code: "CS101-A",
    schedule: "Mon · Wed · Fri, 09:00",
  },
  {
    id: "crs-2",
    classId: "cls-1",
    name: "Data Structures",
    code: "CS101-B",
    schedule: "Tue · Thu, 11:00",
  },
  {
    id: "crs-3",
    classId: "cls-2",
    name: "Calculus II",
    code: "MTH201-A",
    schedule: "Mon · Wed, 10:30",
  },
  {
    id: "crs-4",
    classId: "cls-3",
    name: "Mechanics",
    code: "PHY110-A",
    schedule: "Tue · Thu, 14:00",
  },
  {
    id: "crs-5",
    classId: "cls-4",
    name: "Modern Literature",
    code: "ENG140-A",
    schedule: "Fri, 13:00",
  },
];
const names = [
  ["Emma", "Johnson"],
  ["Liam", "Williams"],
  ["Sophia", "Brown"],
  ["Noah", "Davis"],
  ["Ava", "Miller"],
  ["Ethan", "Wilson"],
  ["Isabella", "Moore"],
  ["Mason", "Taylor"],
  ["Mia", "Anderson"],
  ["Lucas", "Thomas"],
  ["Charlotte", "Jackson"],
  ["Oliver", "White"],
  ["Amelia", "Harris"],
  ["Elijah", "Martin"],
  ["Harper", "Thompson"],
  ["James", "Garcia"],
  ["Evelyn", "Martinez"],
  ["Benjamin", "Robinson"],
  ["Abigail", "Clark"],
  ["Henry", "Rodriguez"],
];
export const initialStudents = names.map(([firstName, lastName], i) => ({
  id: `STU-${String(1001 + i)}`,
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@campus.edu`,
  phone: "",
  classId: initialClasses[i % initialClasses.length].id,
  faceRegistered: i % 5 !== 3,
  joined: daysAgo(45 + i * 2),
}));
export const initialSessions = [
  {
    id: "ses-1",
    classId: "cls-1",
    courseId: "crs-1",
    date: today(),
    startTime: "09:00",
    endTime: "09:50",
    status: "Finalized",
    source: "demo",
  },
  {
    id: "ses-2",
    classId: "cls-2",
    courseId: "crs-3",
    date: today(),
    startTime: "10:30",
    endTime: "11:20",
    status: "Draft",
    source: "demo",
  },
  {
    id: "ses-3",
    classId: "cls-3",
    courseId: "crs-4",
    date: daysAgo(1),
    startTime: "14:00",
    endTime: "14:50",
    status: "Finalized",
    source: "demo",
  },
  {
    id: "ses-4",
    classId: "cls-4",
    courseId: "crs-5",
    date: daysAgo(2),
    startTime: "13:00",
    endTime: "13:50",
    status: "Finalized",
    source: "demo",
  },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `ses-h${i + 1}`,
    classId: initialClasses[i % 4].id,
    courseId: initialCourses.find((c) => c.classId === initialClasses[i % 4].id)
      .id,
    date: monthsAgo(i + 1),
    startTime: "09:00",
    endTime: "09:50",
    status: "Finalized",
    source: "demo",
  })),
];
export const initialAttendance = initialSessions.flatMap((session, si) =>
  initialStudents
    .filter((s) => s.classId === session.classId)
    .map((student, i) => ({
      id: `${session.id}-${student.id}`,
      sessionId: session.id,
      studentId: student.id,
      status:
        session.status === "Draft"
          ? "Unverified"
          : (i + si) % 9 === 0
            ? "Late"
            : (i + si) % 7 === 0
              ? "Absent"
              : "Present",
    })),
);
export const demoCandidates = [
  {
    studentId: "STU-1001",
    name: "Emma Johnson",
    similarity: 0.91,
    status: "Candidate Match",
    time: "09:04:12",
  },
  {
    studentId: "STU-1005",
    name: "Ava Miller",
    similarity: 0.77,
    status: "Needs Verification",
    time: "09:07:35",
  },
  {
    studentId: "—",
    name: "Unknown face",
    similarity: null,
    status: "Unknown",
    time: "09:12:08",
  },
];
export const initialSettings = {
  appName: "EduVision",
  language: "English",
  dateFormat: "MMM d, yyyy",
  theme: "Light",
  cameraId: "",
  resolution: "1280 × 720",
  frameRate: "Balanced",
  confidence: 0.45,
  similarity: 0.5,
  retention: "30 days",
};
