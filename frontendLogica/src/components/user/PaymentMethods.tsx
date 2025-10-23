
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Plus } from "lucide-react";

const PaymentMethods = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: "1",
      type: "visa",
      last4: "4242",
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true
    },
    {
      id: "2",
      type: "mastercard",
      last4: "5555",
      expiryMonth: 8,
      expiryYear: 2026,
      isDefault: false
    }
  ]);

  const handleAddPaymentMethod = async () => {
    setIsLoading(true);
    try {
      // Aquí iría la integración con Stripe para agregar método de pago
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación
      
      toast({
        title: "Redirigiendo...",
        description: "Te estamos redirigiendo para agregar un nuevo método de pago.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo acceder al formulario de pago.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      setPaymentMethods(prev => 
        prev.map(method => ({
          ...method,
          isDefault: method.id === methodId
        }))
      );
      
      toast({
        title: "Método por defecto actualizado",
        description: "El método de pago seleccionado ahora es el predeterminado.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el método predeterminado.",
        variant: "destructive",
      });
    }
  };

  const handleRemovePaymentMethod = async (methodId: string) => {
    try {
      setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
      
      toast({
        title: "Método eliminado",
        description: "El método de pago ha sido eliminado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el método de pago.",
        variant: "destructive",
      });
    }
  };

  const getCardIcon = (type: string) => {
    return <CreditCard className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Métodos de pago</CardTitle>
            <Button onClick={handleAddPaymentMethod} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              {isLoading ? "Cargando..." : "Agregar método"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getCardIcon(method.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {method.type.charAt(0).toUpperCase() + method.type.slice(1)} 
                        •••• {method.last4}
                      </span>
                      {method.isDefault && (
                        <Badge variant="secondary">Por defecto</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Expira {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {!method.isDefault && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      Hacer predeterminado
                    </Button>
                  )}
                  {paymentMethods.length > 1 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRemovePaymentMethod(method.id)}
                    >
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de facturación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { date: "15 Dic 2023", amount: "€29.00", status: "Pagado", invoice: "INV-001" },
              { date: "15 Nov 2023", amount: "€29.00", status: "Pagado", invoice: "INV-002" },
              { date: "15 Oct 2023", amount: "€29.00", status: "Pagado", invoice: "INV-003" },
            ].map((invoice, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{invoice.invoice}</p>
                  <p className="text-sm text-muted-foreground">{invoice.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{invoice.amount}</p>
                  <Badge variant="secondary">{invoice.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentMethods;