import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

const AdminProtectedRoute = () => {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "https://optimizalo.app"}/api/auth/status`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          console.log("🔍 AdminProtectedRoute - datos recibidos:", {
            loggedIn: data.loggedIn,
            role: data.user?.role,
            is_active: data.user?.is_active
          });
          
          setIsAuthenticated(data.loggedIn === true);
          setIsAdmin(data.user?.role === "admin");
          setIsActive(data.user?.is_active === 1);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("❌ Error en AdminProtectedRoute:", error);
        setIsAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };

    checkLogin();
  }, []);

  if (checking) return <p>Cargando...</p>;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isActive) return <Navigate to="/subscribe" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

export default AdminProtectedRoute;