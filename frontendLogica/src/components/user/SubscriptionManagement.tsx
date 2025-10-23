
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import PlanSelection from "./PlanSelection";
import CancelSubscriptionModal from "./CancelSubscriptionModal";

const SubscriptionManagement = () => {
  const { toast } = useToast();
  const [currentPlan, setCurrentPlan] = useState("premium");
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const planDetails = {
    basic: { name: "Básico", price: "€9", features: ["Hasta 5 cuentas", "Análisis básico", "Soporte por email"] },
    premium: { name: "Premium", price: "€29", features: ["Hasta 20 cuentas", "Análisis avanzado", "Soporte prioritario", "AI insights"] },
    enterprise: { name: "Enterprise", price: "€99", features: ["Cuentas ilimitadas", "Análisis completo", "Soporte 24/7", "AI avanzado", "Manager dedicado"] }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      // Aquí iría la integración con Stripe Customer Portal
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación
      
      toast({
        title: "Redirigiendo...",
        description: "Te estamos redirigiendo al portal de Stripe para gestionar tu suscripción.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo acceder al portal de gestión.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Suscripción actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold">Plan {planDetails[currentPlan].name}</h3>
                <Badge variant="secondary">{planDetails[currentPlan].price}/mes</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Próxima facturación: 15 de enero, 2024
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                {planDetails[currentPlan].features.map((feature, index) => (
                  <li key={index}>• {feature}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleManageSubscription} disabled={isLoading}>
                {isLoading ? "Cargando..." : "Gestionar facturación"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCancelModal(true)}
              >
                Solicitar cancelación
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PlanSelection currentPlan={currentPlan} onPlanChange={setCurrentPlan} />

      <CancelSubscriptionModal 
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
      />
    </div>
  );
};

export default SubscriptionManagement;