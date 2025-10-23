import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext"; // ✅ Importar el AuthProvider

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth(); // ✅ Usar el método login del AuthProvider

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('🔐 Intentando login...');
      
      // ✅ Usar el método login del AuthProvider
      const result = await login(email, password);

      if (result.success) {
        console.log('✅ Login exitoso desde LoginForm:', result.user);
        
        // ✅ También guardar en localStorage como backup (opcional)
        localStorage.setItem("user", JSON.stringify(result.user));
        
        toast({
          title: "Inicio de sesión correcto",
          description: "¡Bienvenido de nuevo a AdOps AI!",
        });

        navigate("/dashboard");
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
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to your AdOps AI account
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
              <Label htmlFor="password">Password</Label>
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
            <a href="/forgot-password" className="text-sm text-adops-600 hover:underline">
              Forgot password?
            </a>
          </div>
          
          <div className="mt-6">
            <Button 
              type="submit" 
              className="w-full bg-adops-600 hover:bg-adops-700"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <a href="/register" className="text-adops-600 hover:underline">
            Sign up
          </a>
        </p>
      </CardFooter>
    </Card>
  );
};

export default LoginForm;