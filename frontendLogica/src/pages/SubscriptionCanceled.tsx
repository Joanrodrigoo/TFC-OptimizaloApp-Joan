import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const SubscriptionCanceled = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/subscribe");
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="h-screen flex flex-col items-center justify-center text-center px-4">
      <XCircle className="w-10 h-10 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-1">Suscripción cancelada</h2>
      <p className="text-sm text-muted-foreground mb-4">
        El proceso fue cancelado. Puedes intentarlo de nuevo cuando quieras.
      </p>
      <Button variant="secondary" onClick={() => navigate("/subscribe")}>
        Volver al panel
      </Button>
    </div>
  );
};

export default SubscriptionCanceled;
