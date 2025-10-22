import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

const EmailRegistrationForm = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Enviando solicitud con email:", email);
      
      const res = await fetch("https://pwi.es/api/auth/register-start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
        credentials: "include", // Para manejar cookies si es necesario
      });

      // Para debug: ver respuesta completa
      console.log("Respuesta del servidor:", res);
      
      const data = await res.json();
      console.log("Datos recibidos:", data);

      if (!res.ok) {
        throw new Error(data.error || data.message || "Error al iniciar el registro");
      }

      // Capturar el token de la respuesta del servidor (ajustar según tu API)
      if (data.token) {
        setVerificationToken(data.token);
      } else {
        // Si no hay token en la respuesta real, usar uno simulado para propósitos de desarrollo
        //setVerificationToken("TOKEN-DEMO-" + Math.random().toString(36).substring(2, 10));

        
      }

      setShowVerificationDialog(true); // Muestra diálogo tras éxito

      toast({
        title: "Correo enviado",
        description: "Revisa tu email para completar el registro.",
      });

    } catch (error: any) {
      console.error("Error durante el registro:", error);
      
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: error.message || "Ha ocurrido un error inesperado",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteRegistration = () => {
    if (!verificationToken) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No hay token de verificación disponible",
      });
      return;
    }
    
    // Navegar a la página de registro completo con el token y email
    const registerUrl = `/register?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;
    console.log("Navegando a:", registerUrl);
    navigate(registerUrl);
    setShowVerificationDialog(false); // Cerrar el diálogo después de la navegación
  };

  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Crea tu cuenta</CardTitle>
          <CardDescription>
            Introduce tu email para comenzar con AdOps AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mt-6">
              <Button 
                type="submit" 
                className="w-full bg-adops-600 hover:bg-adops-700"
                disabled={isLoading}
              >
                {isLoading ? "Enviando verificación..." : "Continuar con email"}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <a href="/login" className="text-adops-600 hover:underline">
              Iniciar sesión
            </a>
          </p>
        </CardFooter>
      </Card>

      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verificación de email</DialogTitle>
            <DialogDescription>
              Se ha enviado un correo a {email}
            </DialogDescription>
          </DialogHeader>
          <div className="mb-4 mt-2">
            Comprueba tu correo eléctronico.
          </div>
          {verificationToken ? (
            <div className="p-3 bg-muted rounded-md mb-4 text-center font-mono overflow-auto">
              {verificationToken}
            </div>
          ) : (
            <div className="p-3 bg-red-100 rounded-md mb-4 text-center">
              No se ha generado un token válido
            </div>
          )}
          <Button 
            className="w-full bg-adops-600 hover:bg-adops-700" 
            onClick={handleCompleteRegistration}
            disabled={!verificationToken}
          >
            Completar registro
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailRegistrationForm;