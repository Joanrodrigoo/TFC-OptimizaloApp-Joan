import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SubscriptionSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const refreshSession = async () => {
      try {
        const res = await fetch('https://optimizalo.app/api/auth/refresh-session', {
          method: 'GET',
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          console.log("✅ Sesión refrescada:", data.user);
         
          setTimeout(() => {
            // Ahora redirigimos al dashboard
         
             navigate('/dashboard');
          },5000)
          
        } else {
          console.error("❌ No se pudo refrescar la sesión");
        }
      } catch (err) {
        console.error("❌ Error al refrescar sesión:", err);
      }
    };

    refreshSession();
  }, );

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-600">¡Suscripción completada!</h1>
        <p className="text-gray-700 mt-2">Redirigiéndote a tu panel...</p>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
