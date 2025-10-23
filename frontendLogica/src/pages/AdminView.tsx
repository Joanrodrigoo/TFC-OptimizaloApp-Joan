import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import AdminDashboard from '@/components/admin/AdminDashboard';
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import AdminSidebar from "@/components/admin/AdminSideBar";


const AdminView = () => {
  const { user } = useAuth();

  if (!user || user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const storedUser = localStorage.getItem("user");
  const userName = storedUser ? JSON.parse(storedUser).name : "Usuario";
  const userMail = storedUser ? JSON.parse(storedUser).email : "email@example.com";
  const initials = userName
  ?.split(' ')
  .map(word => word[0])
  .join('')
  .toUpperCase();
  
  return (
<div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <AdminSidebar userName={userName} userMail={userMail} initials={initials} />
      
      {/* Contingut principal */}
      <div className="flex flex-col flex-1 w-full">
        <DashboardHeader userName={userName} />
        <main className="flex-1 overflow-y-auto p-6">
          <AdminDashboard />
        </main>
      </div>
    </div>
  );
};

export default AdminView;
