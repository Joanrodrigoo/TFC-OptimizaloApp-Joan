import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // ✅ Estado de carga

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔍 Verificando autenticación...');
      
      const response = await fetch("https://pwi.es/api/auth/me", {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Usuario autenticado vía cookies:', data.user);
        setUser(data.user);
        
        // Sincronizar con localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
      } else {
        console.log('❌ No autenticado vía cookies');
        
        // ✅ Fallback: verificar localStorage
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            console.log('🔄 Usuario encontrado en localStorage:', parsedUser);
            setUser(parsedUser);
          } catch (e) {
            console.error('Error parseando usuario de localStorage:', e);
            localStorage.removeItem("user");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error verificando auth:', error);
      
      // Fallback a localStorage en caso de error de red
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('🔄 Fallback a localStorage por error de red:', parsedUser);
          setUser(parsedUser);
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch("https://pwi.es/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // ✅ Importante para cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Login exitoso:', data.user);
        console.log('🍪 Headers Set-Cookie:', response.headers.get('Set-Cookie'));
        setUser(data.user);
        
        // ✅ Verificar inmediatamente después del login
        setTimeout(() => checkAuth(), 100);
        
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const logout = async () => {
    try {
      await fetch("https://pwi.es/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      // ✅ Limpiar tanto sesión como localStorage
      localStorage.removeItem("user");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser, 
      loading, 
      login, 
      logout,
      checkAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);