
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CancelSubscriptionModal = ({ isOpen, onClose }: CancelSubscriptionModalProps) => {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      // Aquí iría la lógica para procesar la cancelación
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulación
      
      toast({
        title: "Solicitud de cancelación enviada",
        description: "Hemos recibido tu solicitud. Te contactaremos pronto para confirmar la cancelación.",
      });
      
      onClose();
      setReason("");
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo procesar tu solicitud. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cancelar suscripción</DialogTitle>
          <DialogDescription>
            Lamentamos que quieras cancelar tu suscripción. Por favor, cuéntanos el motivo para ayudarnos a mejorar.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo de cancelación (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Cuéntanos por qué quieres cancelar..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">Antes de cancelar:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Tu suscripción seguirá activa hasta el final del período actual</li>
              <li>• Perderás acceso a todas las funciones premium</li>
              <li>• Tus datos se conservarán por 30 días por si cambias de opinión</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Mantener suscripción
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={isLoading}>
            {isLoading ? "Procesando..." : "Solicitar cancelación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelSubscriptionModal;