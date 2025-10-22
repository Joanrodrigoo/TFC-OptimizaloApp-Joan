
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OnboardingGuideProps {
  onSkip: () => void;
}

const OnboardingGuide = ({ onSkip }: OnboardingGuideProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  
  const steps = [
    {
      title: "¡Bienvenido a AdOps AI!",
      description: "Ahora que has creado tu cuenta, vamos a conectar Google Ads para comenzar a optimizar tus campañas.",
      content: (
        <div className="space-y-4 my-4">
          <div className="bg-adops-50 p-4 rounded-lg border border-adops-200">
            <p className="font-medium text-adops-700 mb-2">¿Por qué conectar Google Ads?</p>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Automatiza la gestión de tus campañas</li>
              <li>Obtén recomendaciones basadas en IA</li>
              <li>Monitorea el rendimiento en tiempo real</li>
              <li>Optimiza el ROI de tu publicidad</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: "Conecta tu cuenta de Google Ads",
      description: "Sigue estos pasos para conectar tu cuenta de Google Ads con AdOps AI:",
      content: (
        <div className="space-y-6 my-4">
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-adops-600 text-white rounded-full h-6 w-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">1</div>
              <p>Haz clic en el botón "Conectar Google Ads" para iniciar el proceso de autorización</p>
            </div>
            <div className="flex items-start">
              <div className="bg-adops-600 text-white rounded-full h-6 w-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">2</div>
              <p>Inicia sesión en tu cuenta de Google Ads si no lo has hecho</p>
            </div>
            <div className="flex items-start">
              <div className="bg-adops-600 text-white rounded-full h-6 w-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">3</div>
              <p>Autoriza a AdOps AI para acceder a los datos de tu cuenta</p>
            </div>
            <div className="flex items-start">
              <div className="bg-adops-600 text-white rounded-full h-6 w-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">4</div>
              <p>Selecciona las cuentas específicas que deseas conectar</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "¡Listo para comenzar!",
      description: "Tu cuenta está configurada y lista para usar AdOps AI.",
      content: (
        <div className="space-y-6 my-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-center">
              Al conectar tu cuenta de Google Ads, comenzarás a ver datos y recomendaciones en tu dashboard inmediatamente.
            </p>
          </div>
        </div>
      ),
    },
  ];
  
  const handleConnectGoogleAds = () => {
    // En una implementación real, esto iniciaría el flujo de OAuth de Google Ads
    console.log("Conectando con Google Ads...");
    
    // Para propósitos de demostración, avanzamos al paso final
    setCurrentStep(steps.length - 1);
  };
  
  const handleFinish = () => {
    navigate("/dashboard/accounts");
  };

  const currentStepData = steps[currentStep];
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">{currentStepData.title}</CardTitle>
        <CardDescription>
          {currentStepData.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {currentStepData.content}
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-4">
        {currentStep === 0 && (
          <>
            <Button 
              onClick={() => setCurrentStep(1)}
              className="w-full bg-adops-600 hover:bg-adops-700"
            >
              Comenzar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={onSkip}
              className="w-full"
            >
              Saltar por ahora
            </Button>
          </>
        )}
        
        {currentStep === 1 && (
          <>
            <Button 
              onClick={handleConnectGoogleAds} 
              className="w-full bg-adops-600 hover:bg-adops-700"
            >
              Conectar Google Ads <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={onSkip}
              className="w-full"
            >
              Configurar más tarde
            </Button>
          </>
        )}
        
        {currentStep === 2 && (
          <Button 
            onClick={handleFinish} 
            className="w-full bg-adops-600 hover:bg-adops-700"
          >
            Ir al dashboard
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default OnboardingGuide;
