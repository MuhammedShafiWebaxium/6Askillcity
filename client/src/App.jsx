import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AdmissionRegistration from "./pages/AdmissionRegistration";
import StudentRegistration from "./pages/StudentRegistration";
import Login from "./pages/Auth/Login";
import ScrollToTop from "./components/global/ScrollToTop";
import { ThemeProvider } from "./components/global/ThemeProvider";
import Dashboard from "./pages/Dashboards/Dashboard";
import NotFound from "./pages/Errors/NotFound";
import ServerError from "./pages/Errors/ServerError";
import AddStudent from "./pages/Students/AddStudent";
import ApplicationsPage from "./pages/Students/ApplicationsPage";
import ApplicationDetailPage from "./pages/Students/ApplicationDetailPage";
import EligibilityQueuePage from "./pages/Students/EligibilityQueuePage";
import UniversityManagement from "./pages/UniversityManagement/UniversityManagement";
import PartnerList from "./pages/PartnerManagement/PartnerList";
import PartnerProfile from "./pages/PartnerManagement/PartnerProfile";
import MyProfile from "./pages/Dashboards/MyProfile";
import PartnerCourses from "./pages/Dashboards/PartnerCourses";
import StudentList from "./pages/StudentManagement/StudentList";
import StudentPaymentDetail from "./pages/StudentManagement/StudentPaymentDetail";
import PaymentManagement from "./pages/StudentManagement/PaymentManagement";
import PublicRoute from "./routes/PublicRoute";
import ProtectedRoute from "./routes/ProtectedRoute";
import { SocketProvider } from "./context/SocketContext";
import TicketsPage from "./pages/Tickets/TicketsPage";
import AlertManager from "./components/global/AlertManager";
// Reports are temporarily disabled.
// import Reports from "./pages/Reports/Reports";
// import ReportDetail from "./pages/Reports/ReportDetail";
import NotificationsPage from "./pages/Notifications/NotificationsPage";
import AdminOverview from "./pages/Dashboards/AdminOverview";
import DocumentsServices from "./pages/Dashboards/DocumentsServices";
import PrivacyPolicy from "./pages/Information/PrivacyPolicy";
import RefundPolicy from "./pages/Information/RefundPolicy";
import Terms from "./pages/Information/Terms";
import SpecializationDetails from "./pages/SpecializationDetails";
import AIReporting from "./pages/AIReporting/AIReporting";

function App() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* 🔓 Public-only — logged-in users are redirected to /dashboard */}
            <Route element={<PublicRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/register-admission-point"
                element={<AdmissionRegistration />}
              />
            </Route>

            {/* 🔐 Protected — any authenticated user */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/register-student"
                element={<StudentRegistration />}
              />
              <Route path="/dashboard/tickets" element={<TicketsPage />} />
              <Route element={<ProtectedRoute allowedRoles={["admin", "manager", "partner"]} />}>
                <Route path="/dashboard/overview" element={<AdminOverview />} />
                <Route path="/dashboard/documents-services" element={<DocumentsServices />} />
              </Route>
              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/dashboard/ai-reporting" element={<AIReporting />} />
              </Route>
              {/* Reports are temporarily disabled.
              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/dashboard/reports" element={<Reports />} />
                <Route
                  path="/dashboard/reports/:reportId"
                  element={<ReportDetail />}
                />
              </Route>
              */}
              <Route path="/dashboard/profile" element={<MyProfile />} />
              <Route path="/dashboard/courses" element={<PartnerCourses />} />
              <Route path="/dashboard/notifications" element={<NotificationsPage />} />
              <Route
                element={<ProtectedRoute allowedRoles={["partner", "admin", "manager"]} />}
              >
                <Route
                  path="/dashboard/student-management"
                  element={<StudentList />}
                />
                <Route
                  path="/dashboard/student-management/:id"
                  element={<StudentPaymentDetail />}
                />
              </Route>
              <Route
                element={<ProtectedRoute allowedRoles={["partner", "admin"]} />}
              >
                <Route
                  path="/dashboard/payment-management"
                  element={<PaymentManagement />}
                />
              </Route>

              {/* Partner: Application lifecycle */}
              <Route path="/dashboard/student/add" element={<AddStudent />} />
              <Route path="/dashboard/student/edit/:id" element={<AddStudent />} />
              <Route
                path="/dashboard/applications"
                element={<ApplicationsPage />}
              />
              <Route
                path="/dashboard/applications/:id"
                element={<ApplicationDetailPage />}
              />

              {/* Admin: Eligibility review queue */}
              <Route
                path="/dashboard/eligibility-queue"
                element={<EligibilityQueuePage />}
              />
              <Route
                path="/dashboard/university-management"
                element={<UniversityManagement />}
              />
              <Route
                path="/dashboard/partner-management"
                element={<PartnerList />}
              />
              <Route
                path="/dashboard/partner-management/:id"
                element={<PartnerProfile />}
              />
            </Route>

            {/* Informational Pages */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/specialization/:programId" element={<SpecializationDetails />} />

            {/* Error Pages */}
            <Route path="/server-error" element={<ServerError />} />
            <Route path="/unauthorized" element={<NotFound />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AlertManager />
        </BrowserRouter>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;
