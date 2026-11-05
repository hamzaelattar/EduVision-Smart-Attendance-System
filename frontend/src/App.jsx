import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import WebRTCCamera from "./pages/WebRTCCamera";

import { AppProvider } from "./context/AppContext";
import MainLayout from "./components/layout/MainLayout";
const Dashboard = lazy(() => import("./pages/RealDashboard"));
const DemoDashboard = lazy(() => import("./pages/Dashboard"));
const Students = lazy(() => import("./pages/Students"));
const Classes = lazy(() => import("./pages/Classes"));
const ClassDetails = lazy(() =>
  import("./pages/Classes").then((m) => ({ default: m.ClassDetails })),
);
const LiveCamera = lazy(() => import("./pages/LiveCamera"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const IoTConsole = lazy(() => import("./pages/IoTConsole"));
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="demo" element={<DemoDashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="classes" element={<Classes />} />
            <Route path="classes/:id" element={<ClassDetails />} />
            <Route path="camera" element={<LiveCamera />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="iot" element={<IoTConsole />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="/iot-camera" element={<WebRTCCamera />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
