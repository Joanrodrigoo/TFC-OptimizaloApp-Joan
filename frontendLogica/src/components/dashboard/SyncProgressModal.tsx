
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";


interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountName: string;
  progress: number;
  status: 'syncing' | 'completed' | 'error';
  currentStep: string;
}

const SyncProgressModal = ({ 
  isOpen, 
  onClose, 
  accountName, 
  progress, 
  status, 
  currentStep 
}: SyncProgressModalProps) => {
  const syncSteps = [
    "Conectando con Google Ads API",
    "Obteniendo información de la cuenta",
    "Sincronizando campañas",
    "Actualizando métricas",
    "Finalizando sincronización"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'syncing' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            Sincronización de cuenta
          </DialogTitle>
          <DialogDescription>
            {status === 'syncing' && `Sincronizando ${accountName}...`}
            {status === 'completed' && `${accountName} sincronizada correctamente`}
            {status === 'error' && `Error al sincronizar ${accountName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progress} className="w-full" />
          
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {status === 'syncing' && `Paso actual: ${currentStep}`}
              {status === 'completed' && "Sincronización completada"}
              {status === 'error' && "Se produjo un error durante la sincronización"}
            </p>
            
            {status === 'syncing' && (
              <div className="space-y-1">
                {syncSteps.map((step, index) => {
                  const stepProgress = (index + 1) * 20;
                  const isCurrentStep = step === currentStep;
                  const isCompleted = progress > stepProgress;
                  
                  return (
                    <div 
                      key={step} 
                      className={`text-xs flex items-center gap-2 ${
                        isCurrentStep ? 'text-blue-600 font-medium' : 
                        isCompleted ? 'text-green-600' : 'text-muted-foreground'
                      }`}
                    >
                      {isCompleted && <CheckCircle className="h-3 w-3" />}
                      {isCurrentStep && <Loader2 className="h-3 w-3 animate-spin" />}
                      {!isCompleted && !isCurrentStep && <div className="h-3 w-3" />}
                      {step}
                    </div>
                  );
                })}
              </div>
            )}
            
            {status === 'error' && (
              <p className="text-sm text-red-600">
                Por favor, verifica tu conexión e inténtalo de nuevo.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SyncProgressModal;