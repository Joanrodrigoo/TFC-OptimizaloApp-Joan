import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch("https://pwi.es/api/auth/status", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(data.loggedIn === true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };

    checkLogin();
  }, []);

  if (checking) {
    // Aquí puedes mostrar un spinner o algo mientras se verifica
    return <p>Cargando...</p>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
