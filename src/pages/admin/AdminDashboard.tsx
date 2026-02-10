import { Routes, Route } from "react-router-dom";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminOverview from "@/pages/admin/AdminOverview";
import ProjectManagement from "@/pages/admin/ProjectManagement";
import ClientManagement from "@/pages/admin/ClientManagement";
import JiraSettings from "@/pages/admin/JiraSettings";

const AdminDashboard = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="projects" element={<ProjectManagement />} />
          <Route path="clients" element={<ClientManagement />} />
          <Route path="jira-settings" element={<JiraSettings />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
