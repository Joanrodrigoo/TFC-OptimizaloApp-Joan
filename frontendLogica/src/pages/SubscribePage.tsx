import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const SubscribePage = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const query = new URLSearchParams(location.search);

    if (query.get("success")) {
      toast({
        title: "¡Pago exitoso!",
        description: "Gracias por suscribirte.",
        variant: "success",
      });

      fetch("https://pwi.es/api/auth/activate-subscription", {
        method: "POST",
        credentials: "include",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Error activando suscripción");

          console.log("✅ Suscripción activada correctamente");

          // Forzar recarga del estado de usuario o sesión
          // Puedes llamar a un endpoint como /me si tienes uno
          await fetch("https://pwi.es/api/auth/me", {
            credentials: "include",
          }).catch(() => {});

          navigate("/dashboard");
          // ⚠️ Esto es opcional, solo si tu app no actualiza bien tras la navegación
          setTimeout(() => window.location.reload(), 500);
        })
        .catch((err) => {
          console.error("❌ Error activando suscripción:", err);
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          });
        });
    } else if (query.get("canceled")) {
      toast({
        title: "Pago cancelado",
        description: "Puedes suscribirte cuando quieras.",
        variant: "warning",
      });
    }
  }, [location.search, toast, navigate]);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://pwi.es/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "No se pudo iniciar el proceso de pago",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Suscríbete para continuar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Plan Premium</h3>
            <Badge className="mt-1 mb-2">€29/mes</Badge>
            <ul className="text-sm text-muted-foreground space-y-1 mt-2">
              <li>• Hasta 20 cuentas conectadas</li>
              <li>• Análisis avanzado de campañas</li>
              <li>• Soporte prioritario</li>
              <li>• Inteligencia Artificial aplicada</li>
            </ul>
          </div>
          <Button onClick={handleSubscribe} disabled={loading} className="w-full">
            {loading ? "Redirigiendo a Stripe..." : "Suscribirme ahora"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscribePage;
