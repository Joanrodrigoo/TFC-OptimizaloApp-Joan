import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

const ProtectedRoute = () => {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch("https://pwi.es/api/auth/status", {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          console.log("🔍 ProtectedRoute - datos recibidos:", {
            loggedIn: data.loggedIn,
            role: data.user?.role,
            is_active: data.user?.is_active,
            currentPath: location.pathname,
          });

          setIsAuthenticated(data.loggedIn === true);
          setIsAdmin(data.user?.role === "admin");
          setIsActive(data.user?.is_active === 1);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("❌ Error en ProtectedRoute:", error);
        setIsAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };

    checkLogin();
  }, [location.pathname]);

  if (checking) return <p>Cargando...</p>;

  // 1. Si no está autenticado, al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 2. Si NO está activo y NO está en subscribe o success/canceled => redirigir a subscribe
  if (
    !isActive &&
    location.pathname !== "/subscribe" &&
    location.pathname !== "/subscription/success" &&
    location.pathname !== "/subscription/canceled"
  ) {
    return <Navigate to="/subscribe" replace />;
  }

  // 3. Si ya está activo pero sigue en /subscribe => redirigir al dashboard
  if (isActive && location.pathname === "/subscribe") {
    return <Navigate to="/dashboard" replace />;
  }

  // 5. Si todo está correcto, mostrar el contenido protegido
  return <Outlet />;
};

export default ProtectedRoute;
