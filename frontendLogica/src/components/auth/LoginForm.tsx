import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('🔐 Intentando login...');

      const result = await login(email, password);

      if (result.success) {
        console.log('✅ Login exitoso desde LoginForm:', result.user);
        console.log("🔐 Rol del usuario:", result.user.role);
        console.log("📊 Estado de suscripción:", result.user.is_active);

        localStorage.setItem("user", JSON.stringify(result.user));
        
        toast({
          title: "Inicio de sesión correcto",
          description: "¡Bienvenido de nuevo a AdOps AI!",
        });

        // Verificar primero si la cuenta está activa
        if (result.user.is_active === 0 || result.user.is_active === false) {
          console.log("⚠️ Usuario inactivo, redirigiendo a suscripción");
          navigate("/subscribe");
          return;
        }

        // Redirección según rol (solo si está activo)
        if (result.user.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }

      } else {
        throw new Error(result.error || "Credenciales inválidas");
      }

    } catch (error: any) {
      console.error('❌ Error en login:', error);

      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: error.message || "Error inesperado.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
        <CardDescription>
          Accede a tu cuenta
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
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end mt-2">
            <Link 
              to="/forgot-password" 
              className="text-sm text-adops-600 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          
          <div className="mt-6">
            <Button 
              type="submit" 
              className="w-full bg-adops-600 hover:bg-adops-700"
              disabled={isLoading}
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          ¿No tienes una cuenta?{" "}
          <Link to="/register" className="text-adops-600 hover:underline">
            Crea una
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};

export default LoginForm;