
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

interface CustomCompleteRegistrationFormProps {
  onRegistrationComplete?: () => void;
}


const CustomCompleteRegistrationForm = ({}: CustomCompleteRegistrationFormProps) => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const navigate = useNavigate();

  

useEffect(() => {
  const verifyToken = async () => {
    if (!email || !token) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Parámetros de verificación faltantes.",
      });
      navigate("/error");
      return;
    }

    try {
      const response = await fetch(
        `https://pwi.es/api/auth/verify-token?email=${encodeURIComponent(email)}&token=${token}`
      );
      const data = await response.json();

      if (!response.ok || !data.valid) {
        toast({
          variant: "destructive",
          title: "Token inválido o expirado",
          description: "Este enlace ya no es válido. Intenta registrarte nuevamente.",
        });
        navigate("/expired"); // Redirige a una página de error amigable
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error de red",
        description: "No se pudo verificar el enlace.",
      });
      navigate("/error");
    }
  };

  verifyToken();
}, [email, token, toast, navigate]);


  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (password !== confirmPassword) {
    toast({
      variant: "destructive",
      title: "Error de validación",
      description: "Las contraseñas no coinciden. Por favor, inténtalo de nuevo.",
    });
    return;
  }

  setIsLoading(true);

  try {
    const response = await fetch("https://pwi.es/api/auth/register-complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        name,
        password,
        token,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Error desconocido");
    }

    toast({
      title: "Registro exitoso",
      description: "¡Tu cuenta ha sido creada correctamente!",
    });

    setTimeout(() => {
      navigate("/login");
    }, 1500);

    

  } catch (error: any) {
    toast({
      variant: "destructive",
      title: "Error de registro",
      description: error.message || "Hubo un error al completar el registro.",
    });
  } finally {
    setIsLoading(false);
  }
};

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Completa tu registro</CardTitle>
        <CardDescription>
          Solo necesitamos algunos datos adicionales para configurar tu cuenta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button 
              type="submit" 
              className="w-full bg-adops-600 hover:bg-adops-700"
              disabled={isLoading}
            >
              {isLoading ? "Registrando..." : "Completar registro"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CustomCompleteRegistrationForm;
