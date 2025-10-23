import React, { useState } from "react";
import { AuthContext } from "./AuthContext";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const userData = localStorage.getItem("user");
    return userData ? JSON.parse(userData) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);

  const login = async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: 'include', 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        return { success: false, error: errorData.message || "Login failed" };
      }

      const data = await res.json();

      setUser(data.user);
  

      localStorage.setItem("user", JSON.stringify(data.user));
      

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

const logout = async () => {
  try {
    await fetch("https://pwi.es/api/auth/logout", {
      method: "POST",
      credentials: "include", // Muy importante para que envíe la cookie de sesión
    });
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }

  // Limpiar estado del frontend
  setUser(null);
  localStorage.removeItem("user");
};


  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
