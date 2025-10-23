import React, { useEffect, useState } from "react";
import AddUserForm from "@/components/admin/AddUserForm";
import { useToast } from "@/components/ui/use-toast";

const AdminDashboard = () => {
  interface UserData {
    id: number;
    name: string;
    email: string;
    role: "admin" | "user";
    is_active: boolean;
    created_at: string;
  }

    const { toast } = useToast();


  const [users, setUsers] = useState<UserData[]>([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  

  const loadAdminData = async () => {
    try {
      const [usersRes, metricsRes] = await Promise.all([
        fetch("/api/admin/users", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/admin/metrics", {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!usersRes.ok || !metricsRes.ok) {
        throw new Error("Error en alguna de las peticiones");
      }

      const usersData = await usersRes.json();
      const metricsData = await metricsRes.json();

      setUsers(usersData);
      setMetrics(metricsData);
    } catch (error) {
      console.error("Error cargando datos de administración:", error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadAdminData();
  }, []);

  const handleAddUserSuccess = () => {
    loadAdminData(); // recarga tanto usuarios como métricas
    setShowAddUserForm(false); // cierra el modal
  };

  const handleResetPassword = async (email: string) => {
    if (
      !window.confirm(
        `¿Seguro que quieres resetear la contraseña para ${email}?`
      )
    )
      return;

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const result = await res.json();
      if (res.ok) {
        alert(
          "Contraseña reseteada correctamente. El usuario recibirá un correo."
        );
      } else {
        alert(
          `Error: ${result.message || "No se pudo resetear la contraseña"}`
        );
      }
    } catch (error) {
      console.error(error);
      alert("Error al contactar con el servidor.");
    }
  };

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = !currentStatus; // invierte el booleano

  try {
    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }), // status será true o false
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error actualizando estado');
    }
  
    await loadAdminData(); // vuelve a cargar la lista de usuarios
    const data = await response.json();
    console.log('Estado actualizado:', data.message);
    return data;
 
  } catch (error) {
    console.error('Error en toggleUserStatus:', error.message);
    throw error;
  }
}


  const handleDeleteUser = async (id: number, name: string) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar a ${name}, con id ${id}? Esta acción es irreversible.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });

      const result = await res.json();
      if (res.ok) {
            toast({
        title: "Usuario Eliminado !",
        description: `El usuario ${name}, con id ${id} ha sido eliminado.`,
      });
        loadAdminData(); // refrescar usuarios
      } else {
        alert(`Error: ${result.message || "No se pudo eliminar el usuario"}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error al contactar con el servidor.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-adops-200 rounded-full animate-spin border-t-adops-600"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-pulse border-t-adops-400"></div>
          </div>
          <p className="mt-4 text-slate-600 font-medium">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent mb-2">
                Panel de Administración
              </h1>
              <p className="text-slate-600 text-lg">
                Gestiona los usuarios y supervisa las métricas del sistema
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 shadow-sm">
                <span className="text-sm font-medium text-slate-700">
                  {new Date().toLocaleDateString("es-ES", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Métriques generals */}
        <section className="mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Métricas Generales
              </h2>
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
              <div className="group">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    Total de usuarios
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics?.totalUsers}
                  </p>
                </div>
              </div>

              <div className="group">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    Usuarios activos
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics?.activeUsers}
                  </p>
                </div>
              </div>

              <div className="group">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    Nuevos este mes
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics?.newUsersThisMonth}
                  </p>
                </div>
              </div>

              <div className="group">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200 hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    Sesiones totales
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics?.totalSessions}
                  </p>
                </div>
              </div>

              <div className="group">
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-xl border border-teal-200 hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-teal-500 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    Media de sesión
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics?.avgSessionTime}
                  </p>
                </div>
              </div>

              <div className="group">
                <div className="bg-gradient-to-br from-adops-50 to-adops-100 p-6 rounded-xl border border-adops-200 hover:shadow-lg transition-all duration-300 group-hover:scale-105">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-adops-500 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    Activos diáriamente
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics?.dailyActiveUsers}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gestió d'usuaris */}
        <section className="mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Usuarios</h2>
              <button
                onClick={() => setShowAddUserForm(true)}
                className="px-4 py-2 bg-adops-500 text-white rounded-xl shadow hover:bg-adops-600 transition"
              >
                Añadir usuario
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="text-left py-3 text-sm text-slate-600">Nombre</th>
                    <th className="text-left py-3 text-sm text-slate-600">Email</th>
                    <th className="text-left py-3 text-sm text-slate-600">Rol</th>
                    <th className="text-left py-3 text-sm text-slate-600">Estado</th>
                    <th className="text-left py-3 text-sm text-slate-600">Fecha</th>
                    <th className="text-left py-3 text-sm text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="py-3 text-slate-800 font-medium">{user.name}</td>
                      <td className="py-3 text-slate-600">{user.email}</td>
                      <td className="py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          user.role === "admin"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-sm font-medium ${
                          user.is_active ? "text-green-600" : "text-slate-400"
                        }`}>
                          {user.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-slate-500">
                        {new Date(user.created_at).toLocaleDateString("es-ES")}
                      </td>
                      <td className="py-3 space-x-2">
                        <button
                          onClick={() => handleResetPassword(user.email)}
                          className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition"
                        >
                          Resetear
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id,user.is_active)}
                          className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                            user.is_active
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {user.is_active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id,user.name)}
                          className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Modal del formulario */}
      {showAddUserForm && (
        <AddUserForm
          onClose={() => setShowAddUserForm(false)}
          onSuccess={handleAddUserSuccess}
        />
      )}
    </div>
  );
};

export default AdminDashboard;