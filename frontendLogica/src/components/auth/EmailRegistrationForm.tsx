import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate, Link } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel";
import { TrendingUp, Zap, Shield, Star, CreditCard, X } from "lucide-react";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";

const EmailRegistrationForm = () => {
  const [email, setEmail] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!carouselApi) return;

    const intervalId = setInterval(() => {
      if (carouselApi.canScrollNext()) {
        carouselApi.scrollNext();
      } else {
        carouselApi.scrollTo(0);
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [carouselApi]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedPrivacy) {
      toast({
        variant: "destructive",
        title: "Política de privacidad",
        description: "Debes aceptar la política de privacidad para continuar.",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      console.log("Enviando solicitud con email:", email);
      
      const res = await fetch("https://optimizalo.app/api/auth/register-start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      console.log("Respuesta del servidor:", res);
      
      const data = await res.json();
      console.log("Datos recibidos:", data);

      if (!res.ok) {
        throw new Error(data.error || data.message || "Error al iniciar el registro");
      }

      // Capturar el token de la respuesta del servidor
      if (data.token) {
        setVerificationToken(data.token);
      }

      setShowVerificationDialog(true);

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
    
    const registerUrl = `/register?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;
    console.log("Navegando a:", registerUrl);
    navigate(registerUrl);
    setShowVerificationDialog(false);
  };

  const benefits = [
    {
      icon: TrendingUp,
      title: "Optimización automática",
      description: "IA que analiza y mejora tus campañas 24/7"
    },
    {
      icon: Zap,
      title: "Análisis rápido",
      description: "Tus primeras optimizaciones en menos de 2 horas"
    },
    {
      icon: Shield,
      title: "Mejores retornos de la inversión",
      description: "Maximiza el ROAS de tus campañas"
    }
  ];

  const testimonials = [
    {
      name: "Carlos M.",
      role: "Director de Marketing Digital",
      text: "Reduje el CPA un 35% en el primer mes. La IA detectó problemas que llevaba meses sin ver en mis campañas."
    },
    {
      name: "Laura F.",
      role: "Responsable de Performance",
      text: "Ahorro más de 15 horas semanales en análisis manual. Las recomendaciones son muy concretas y fáciles de aplicar."
    },
    {
      name: "Javier R.",
      role: "Consultor de Google Ads",
      text: "Escalé de gestionar 5 a 20 cuentas sin aumentar el equipo. La herramienta hace el trabajo pesado por mí."
    }
  ];

  return (
    <>
      <div className="min-h-screen flex items-center py-6 sm:py-8 md:py-12">
        <div className="w-full px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6 sm:gap-8 lg:gap-12 items-start max-w-7xl mx-auto">
            {/* Left Column - Form */}
            <div className="order-1 lg:order-1 w-full min-w-0">
            {/* Logo */}
            <div className="mb-6 sm:mb-8 text-center lg:text-left">
              <Link to="/">
                <img 
                  src={logoDark}
                  alt="optimizalo.app" 
                  className="h-6 sm:h-7 lg:h-9 mx-auto lg:mx-0 mb-4 sm:mb-6 dark:hidden"
                />
                <img 
                  src={logoLight}
                  alt="optimizalo.app" 
                  className="h-6 sm:h-7 lg:h-9 mx-auto lg:mx-0 mb-4 sm:mb-6 hidden dark:block"
                />
              </Link>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 leading-tight">
                Solo un paso más para que la IA empiece a analizar tus campañas.
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-3 sm:mb-4">
                Crea tu cuenta y recibe las primeras optimizaciones en menos de 30 minutos
              </p>
              <div className="flex flex-row flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground justify-center lg:justify-start">
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
                  </div>
                  <span className="whitespace-nowrap">Sin tarjeta</span>
                </span>
                <span className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
                  </div>
                  <span className="whitespace-nowrap">Cancela cuando quieras</span>
                </span>
              </div>
            </div>

            <Card className="w-full shadow-xl sm:shadow-2xl bg-card">
              <CardHeader className="space-y-0.5 p-4 sm:p-6 pb-2 sm:pb-2">
                <CardTitle className="text-xl sm:text-2xl">Crea tu cuenta</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Introduce tu email y deja que la IA empiece a analizar tus campañas hoy.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 pb-3 sm:pb-4">
                <form onSubmit={handleSubmit}>
                  <div className="grid w-full items-center gap-3 sm:gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-10 sm:h-11 text-sm sm:text-base border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="privacy" 
                        checked={acceptedPrivacy}
                        onCheckedChange={(checked) => setAcceptedPrivacy(checked as boolean)}
                        required
                        className="mt-0.5 flex-shrink-0"
                      />
                      <label
                        htmlFor="privacy"
                        className="text-xs sm:text-sm text-muted-foreground leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        He leído y acepto la{" "}
                        <Link to="/politica-privacidad" className="text-primary hover:underline" target="_blank">
                          política de privacidad
                        </Link>
                      </label>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6">
                    <Button 
                      type="submit" 
                      className="w-full bg-adops-600 hover:bg-adops-700 text-sm sm:text-base md:text-lg py-3 sm:py-4 h-auto"
                      disabled={isLoading}
                    >
                      {isLoading ? "Enviando verificación..." : "Iniciar mi prueba gratuita →"}
                    </Button>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex justify-center p-4 sm:p-6 pt-2 sm:pt-3">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ¿Ya tienes una cuenta?{" "}
                  <a href="/login" className="text-adops-600 hover:underline">
                    Acceder a mi panel
                  </a>
                </p>
              </CardFooter>
            </Card>

            {/* Free trial badge */}
            <div className="mt-3 sm:mt-4 w-full">
              <div className="bg-gradient-to-r from-yellow-50/50 to-amber-50/50 dark:from-yellow-900/10 dark:to-amber-900/10 border border-yellow-200/50 dark:border-yellow-800/30 rounded-md px-3 py-2 text-center">
                <p className="text-xs sm:text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  💡 Prueba gratuita de 30 días
                </p>
              </div>
            </div>
            </div>

            {/* Right Column - Benefits & Testimonials */}
          <div className="order-2 lg:order-2 space-y-4 sm:space-y-5 lg:space-y-6 w-full min-w-0">
            {/* Spacer to align with left column title */}
            <div className="hidden lg:block h-[88px]"></div>
            
            {/* Benefits */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">¿Qué vas a conseguir?</h2>
              <div className="space-y-2.5 sm:space-y-3">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <Card key={index} className="border hover:shadow-md transition-shadow">
                      <CardContent className="flex gap-2.5 sm:gap-3 p-3 sm:p-4">
                        <div className="flex-shrink-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base mb-0.5">{benefit.title}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Testimonials Carousel */}
            <div className="w-full min-w-0 overflow-hidden">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Ellos ya están mejorando sus campañas</h2>
              <Carousel 
                setApi={setCarouselApi}
                className="w-full"
                opts={{ 
                  loop: true,
                  align: "start",
                }}
              >
                <CarouselContent className="-ml-2 md:-ml-4">
                  {testimonials.map((testimonial, index) => (
                    <CarouselItem key={index} className="pl-2 md:pl-4 basis-full">
                      <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
                        <CardContent className="p-4 sm:p-5 md:p-6 min-h-[180px] sm:min-h-[200px] md:min-h-[220px] flex flex-col justify-between">
                            <div>
                              <div className="flex gap-0.5 mb-2 sm:mb-3">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                                ))}
                              </div>
                              <p className="text-sm sm:text-base mb-3 sm:mb-4 italic leading-relaxed">"{testimonial.text}"</p>
                            </div>
                            <div>
                              <p className="font-semibold text-sm sm:text-base">{testimonial.name}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">{testimonial.role}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
            </div>
          </div>
          </div>
        </div>
      </div>

      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Verificación de email</DialogTitle>
            <DialogDescription>
              Se ha enviado un correo a {email}
            </DialogDescription>
          </DialogHeader>
          <div className="mb-3 sm:mb-4 mt-2 text-sm sm:text-base">
            Comprueba tu correo electrónico.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailRegistrationForm;