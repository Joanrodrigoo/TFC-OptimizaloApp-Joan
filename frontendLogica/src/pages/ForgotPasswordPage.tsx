import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Mail, Lock } from "lucide-react";

const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailFromParams = searchParams.get('email') || "";
  const isResetMode = !!token;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  // Cuando es reset, usamos el email de los params
  // Cuando es forgot, usamos el estado email editable
  const effectiveEmail = isResetMode ? emailFromParams : email;

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("https://pwi.es/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: "Email enviado",
          description: data.message || "Hemos enviado un enlace de recuperación a tu correo electrónico.",
        });
        setEmail("");
      } else {
        throw new Error(data.error || "No se pudo enviar el email de recuperación.");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message || "No se pudo enviar el email de recuperación. Inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Las contraseñas no coinciden.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("https://pwi.es/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: effectiveEmail, token, newPassword: password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: "Contraseña actualizada",
          description: data.message || "Tu contraseña ha sido actualizada correctamente.",
        });
        navigate("/login");
      } else {
        throw new Error(data.error || "No se pudo actualizar la contraseña. El enlace puede haber expirado.");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message || "No se pudo actualizar la contraseña. El enlace puede haber expirado.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gradient mb-2">AdOps AI</h1>
        <p className="text-muted-foreground">
          {isResetMode ? "Establece tu nueva contraseña" : "Recupera tu contraseña"}
        </p>
      </div>
      
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            {isResetMode ? (
              <>
                <Lock className="h-5 w-5" />
                Nueva contraseña
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                Recuperar contraseña
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isResetMode 
              ? "Introduce tu nueva contraseña para completar la recuperación"
              : "Introduce tu email y te enviaremos un enlace para recuperar tu contraseña"
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isResetMode ? (
            <form onSubmit={handleResetPassword}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="confirmPassword">Repetir contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {isLoading ? "Actualizando..." : "Actualizar contraseña"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendResetEmail}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
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
                  {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/login")}
            className="text-adops-600 hover:text-adops-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
