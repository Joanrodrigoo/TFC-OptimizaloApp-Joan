
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PlanSelectionProps {
  currentPlan: string;
  onPlanChange: (plan: string) => void;
}

const PlanSelection = ({ currentPlan, onPlanChange }: PlanSelectionProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const plans = [
    {
      id: "basic",
      name: "Básico",
      price: "€9",
      description: "Perfecto para empezar",
      features: [
        "Hasta 5 cuentas de Google Ads",
        "Análisis básico de campañas",
        "Soporte por email",
        "Exportación de reportes"
      ]
    },
    {
      id: "premium",
      name: "Premium",
      price: "€29",
      description: "Ideal para equipos en crecimiento",
      features: [
        "Hasta 20 cuentas de Google Ads",
        "Análisis avanzado con IA",
        "Soporte prioritario",
        "Automatización de reportes",
        "Integraciones avanzadas"
      ],
      popular: true
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "€99",
      description: "Para grandes organizaciones",
      features: [
        "Cuentas ilimitadas",
        "IA avanzada y personalizada",
        "Soporte 24/7",
        "Manager de cuenta dedicado",
        "API personalizada",
        "Onboarding completo"
      ]
    }
  ];

  const handlePlanSelect = async (planId: string) => {
    if (planId === currentPlan) return;
    
    setIsLoading(planId);
    try {
      // Aquí iría la integración con Stripe para cambiar el plan
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulación
      
      onPlanChange(planId);
      toast({
        title: "Plan actualizado",
        description: `Has cambiado al plan ${plans.find(p => p.id === planId)?.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el plan. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`relative border rounded-lg p-4 ${
                plan.id === currentPlan ? 'border-primary bg-primary/5' : 'border-border'
              } ${plan.popular ? 'border-orange-500' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-orange-500">
                  Más popular
                </Badge>
              )}
              
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="text-2xl font-bold text-primary">{plan.price}<span className="text-sm text-muted-foreground">/mes</span></div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-2 mb-4">
                {plan.features.map((feature, index) => (
                  <li key={index} className="text-sm flex items-center">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.id === currentPlan ? "secondary" : "default"}
                onClick={() => handlePlanSelect(plan.id)}
                disabled={isLoading === plan.id}
              >
                {isLoading === plan.id ? "Procesando..." : 
                 plan.id === currentPlan ? "Plan actual" : "Seleccionar"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlanSelection;