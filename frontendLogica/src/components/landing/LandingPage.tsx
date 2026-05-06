import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Zap, Target, BarChart3, Brain, Sparkles, LineChart, Shield, Bell, Eye, DollarSign, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoDark from "@/assets/logo-dark.png";
import { Header } from "@/components/layout/Header";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const LandingPage = () => {
  const navigate = useNavigate();
  const [animatedData, setAnimatedData] = useState({
    clicks: 12400,
    impressions: 847000,
    ctr: 3.2,
    cpc: 1.24
  });

  const allRecommendations = [
    { icon: TrendingUp, label: "Oportunidad", text: "Aumenta puja 15%", color: "green" },
    { icon: TrendingUp, label: "Oportunidad", text: "Duplica esta keyword", color: "green" },
    { icon: Zap, label: "Alerta", text: "CPC subiendo +12%", color: "yellow" },
    { icon: Zap, label: "Alerta", text: "Pérdida impresiones", color: "yellow" },
    { icon: Target, label: "Acción", text: "Añadir negativas", color: "blue" },
    { icon: Target, label: "Acción", text: "Reduce presupuesto X", color: "blue" },
    { icon: Sparkles, label: "Insight", text: "ROAS +23% en móvil", color: "purple" },
    { icon: Bell, label: "Alerta", text: "Tracking desactivado", color: "red" },
    { icon: TrendingUp, label: "Oportunidad", text: "Mejora anuncio Y", color: "green" },
  ];

  const [currentRecommendations, setCurrentRecommendations] = useState([0, 1, 2]);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "https://optimizalo.app"}/api/auth/status`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.loggedIn) {
            navigate("/dashboard");
          }
        }
      } catch (error) {
        console.error("Error verificando sesión:", error);
      }
    };

    checkLogin();
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedData(prev => ({
        clicks: prev.clicks + Math.floor(Math.random() * 500) + 100,
        impressions: prev.impressions + Math.floor(Math.random() * 5000) + 1000,
        ctr: +(prev.ctr + (Math.random() * 0.2 - 0.1)).toFixed(2),
        cpc: +(prev.cpc + (Math.random() * 0.1 - 0.05)).toFixed(2)
      }));

      // Change recommendations
      setCurrentRecommendations(() => {
        const availableIndices = Array.from({ length: allRecommendations.length }, (_, i) => i);
        const shuffled = availableIndices.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3);
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const getColorClasses = (color: string) => {
    switch(color) {
      case 'green':
        return {
          bg: 'from-green-500/10 to-emerald-500/10',
          border: 'border-green-500/20',
          iconBg: 'bg-green-500/20',
          text: 'text-green-600'
        };
      case 'yellow':
        return {
          bg: 'from-yellow-500/10 to-orange-500/10',
          border: 'border-yellow-500/20',
          iconBg: 'bg-yellow-500/20',
          text: 'text-yellow-600'
        };
      case 'blue':
        return {
          bg: 'from-blue-500/10 to-cyan-500/10',
          border: 'border-blue-500/20',
          iconBg: 'bg-blue-500/20',
          text: 'text-blue-600'
        };
      case 'purple':
        return {
          bg: 'from-purple-500/10 to-violet-500/10',
          border: 'border-purple-500/20',
          iconBg: 'bg-purple-500/20',
          text: 'text-purple-600'
        };
      case 'red':
        return {
          bg: 'from-red-500/10 to-rose-500/10',
          border: 'border-red-500/20',
          iconBg: 'bg-red-500/20',
          text: 'text-red-600'
        };
      default:
        return {
          bg: 'from-gray-500/10 to-slate-500/10',
          border: 'border-gray-500/20',
          iconBg: 'bg-gray-500/20',
          text: 'text-gray-600'
        };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      
      <main className="flex-1 pt-14 sm:pt-16">
        {/* Hero Section - Centered */}
        <section className="relative overflow-hidden py-8 sm:py-12 lg:py-16 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8 bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
          
          <div className="container mx-auto relative lg:py-8">
            <div className="text-center space-y-5 sm:space-y-6 lg:space-y-6 animate-fade-in">
              {/* Question */}
              <p className="text-xl sm:text-2xl md:text-3xl font-normal text-foreground">
                ¿Y si tus campañas de Google Ads se optimizaran solas?
              </p>
              
              {/* Main Headline */}
              <h1 className="text-3xl sm:text-3xl md:text-4xl lg:text-4xl xl:text-5xl font-bold leading-[1.15] sm:leading-tight max-w-4xl mx-auto">
                La IA analiza las métricas y te da{" "}
                <span className="text-gradient">acciones directas</span>{" "}
                para mejorar el rendimiento
              </h1>
              
              {/* Description */}
              <p className="text-xl sm:text-xl md:text-2xl font-normal text-foreground max-w-3xl mx-auto leading-relaxed pt-2 sm:pt-4">
                Aumenta tu ROAS automáticamente. Sin informes, sin comisiones, sin perder tiempo.
              </p>
              
              {/* CTA */}
              <div className="pt-4 sm:pt-6 md:pt-8">
                <Link to="/register">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-6 sm:px-8 md:px-12 py-5 sm:py-6 md:py-7 text-base sm:text-base md:text-lg font-semibold shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-105 w-full sm:w-auto"
                  >
                    Prueba gratuita 30 días
                  </Button>
                </Link>
                <p className="text-sm sm:text-sm text-muted-foreground mt-3 sm:mt-4">
                  Sin tarjeta de crédito • Cancela cuando quieras
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="py-8 sm:py-12 md:py-16 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8 bg-muted/30 relative">
          <div className="container mx-auto">
            <div className="text-center mb-8 sm:mb-10 md:mb-12">
              <h2 className="text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
                De datos abrumadores a acciones claras
              </h2>
              <p className="text-base sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                La IA convierte miles de métricas en oportunidades claras para mejorar tus resultados
              </p>
            </div>

            {/* Desktop Comparison */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-[360px_160px_360px] gap-8 justify-center items-center">
                {/* LEFT SIDE - Sin optimizalo.app (Overwhelming data) */}
                <div className="border-2 border-red-500/30 rounded-xl p-5 bg-red-500/5">
                  <div className="text-center mb-4">
                    <span className="text-sm font-semibold px-4 py-2 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 inline-block">
                      ❌ Sin optimizalo.app
                    </span>
                  </div>
                  
                  <div className="space-y-2 opacity-70 max-h-[500px] overflow-hidden relative">
                    {/* Muchos datos confusos y pequeños */}
                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <BarChart3 className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Clicks campaña 1</div>
                        <div className="font-semibold text-xs">{animatedData.clicks.toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <TrendingUp className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Impresiones totales</div>
                        <div className="font-semibold text-xs">{animatedData.impressions.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <DollarSign className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Coste grupo A</div>
                        <div className="font-semibold text-xs">$2,847.32</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <Target className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">CTR promedio ponderado</div>
                        <div className="font-semibold text-xs">{animatedData.ctr}%</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <LineChart className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">CPC medio ajustado</div>
                        <div className="font-semibold text-xs">${animatedData.cpc}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <BarChart3 className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Conversiones desktop</div>
                        <div className="font-semibold text-xs">124</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <TrendingUp className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Ratio búsqueda vs display</div>
                        <div className="font-semibold text-xs">2.4:1</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <Eye className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Share impresiones superior</div>
                        <div className="font-semibold text-xs">47.8%</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <DollarSign className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Coste/conv. móvil ajustado</div>
                        <div className="font-semibold text-xs">$18.42</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <Target className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Quality Score promedio</div>
                        <div className="font-semibold text-xs">6.8/10</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <LineChart className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Tasa abandono landing</div>
                        <div className="font-semibold text-xs">68.2%</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-2 text-xs shadow-md">
                      <BarChart3 className="h-3 w-3 text-gray-500" />
                      <div className="flex-1">
                        <div className="text-[10px] text-muted-foreground">Interacciones totales netas</div>
                        <div className="font-semibold text-xs">8,942</div>
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-red-500/10 to-transparent pointer-events-none flex items-end justify-center pb-4">
                      <span className="text-sm text-foreground font-medium select-none bg-background/95 px-4 py-2 rounded-full border shadow-sm">47 métricas más sin analizar</span>
                    </div>
                  </div>
                </div>

                {/* CENTER - AI Brain processing */}
                <div className="flex items-center justify-center">
                  <div className="relative z-10 animate-scale-in">
                    <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl relative">
                      <Brain className="h-16 w-16 text-white animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                      <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" style={{ animationDelay: '0.5s' }} />
                    </div>
                    
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="text-xs font-semibold text-primary bg-card px-3 py-1 rounded-full border shadow-sm">
                        IA analizando...
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE - Con optimizalo.app (Clear actions) */}
                <div className="border-2 border-green-500/30 rounded-xl p-5 bg-green-500/5">
                  <div className="text-center mb-4">
                    <span className="text-sm font-semibold px-4 py-2 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 inline-block">
                      ✓ Con optimizalo.app
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {currentRecommendations.map((index, i) => {
                      const rec = allRecommendations[index];
                      const colors = getColorClasses(rec.color);
                      return (
                        <div 
                          key={`${index}-${Date.now()}`}
                          className={`flex items-center gap-3 bg-white border-2 ${colors.border} rounded-lg p-4 shadow-xl animate-slide-in-left opacity-0`}
                          style={{ 
                            animation: 'slideInLeft 0.6s ease-out forwards',
                            animationDelay: `${i * 0.15}s`
                          }}
                        >
                          <div className={`h-10 w-10 rounded-lg ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
                            <rec.icon className={`h-5 w-5 ${colors.text}`} />
                          </div>
                          <div>
                            <div className={`text-xs font-medium ${colors.text}`}>{rec.label}</div>
                            <div className="font-semibold text-sm">{rec.text}</div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Summary card */}
                    <div className="mt-6 p-4 bg-white border-2 border-primary/30 rounded-lg shadow-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <div className="text-xs font-semibold text-primary">Resumen del día</div>
                      </div>
                      <div className="text-sm font-medium">3 acciones prioritarias</div>
                      <div className="text-xs text-muted-foreground mt-1">Impacto estimado: +€420/día</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile/Tablet Comparison */}
            <div className="lg:hidden space-y-12">
              {/* Sin optimizalo.app */}
              <div className="border-2 border-red-500/30 rounded-xl p-4 bg-red-500/5">
                <div className="text-center mb-4">
                  <span className="text-sm font-semibold px-4 py-2 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 inline-block">
                    ❌ Sin optimizalo.app
                  </span>
                </div>
                
                <div className="space-y-2 opacity-70 max-h-96 overflow-hidden relative">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Clicks campaña 1", value: animatedData.clicks.toLocaleString() },
                      { label: "Impresiones", value: animatedData.impressions.toLocaleString() },
                      { label: "CTR promedio", value: `${animatedData.ctr}%` },
                      { label: "CPC medio", value: `$${animatedData.cpc}` },
                      { label: "Conv. desktop", value: "124" },
                      { label: "Share impres.", value: "47.8%" },
                      { label: "Quality Score", value: "6.8/10" },
                      { label: "Tasa abandono", value: "68.2%" },
                    ].map((item, i) => (
                      <div key={i} className="bg-white border-2 border-gray-300 rounded-lg p-3 shadow-md">
                        <div className="text-sm text-muted-foreground truncate mb-1">{item.label}</div>
                        <div className="font-semibold text-lg">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-red-500/10 to-transparent flex items-end justify-center pb-4 pointer-events-none">
                    <span className="text-sm text-foreground font-medium select-none bg-background/95 px-4 py-2 rounded-full border shadow-sm">47 métricas más sin analizar</span>
                  </div>
                </div>
              </div>

              {/* AI Processing */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl relative">
                    <Brain className="h-12 w-12 text-white animate-pulse" />
                  </div>
                  <div className="text-sm font-semibold text-primary text-center mt-3">
                    IA procesando
                  </div>
                </div>
              </div>

              {/* Con optimizalo.app */}
              <div className="border-2 border-green-500/30 rounded-xl p-4 bg-green-500/5">
                <div className="text-center mb-4">
                  <span className="text-sm font-semibold px-4 py-2 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 inline-block">
                    ✓ Con optimizalo.app
                  </span>
                </div>
                
                <div className="space-y-3">
                  {currentRecommendations.slice(0, 3).map((index) => {
                    const rec = allRecommendations[index];
                    const colors = getColorClasses(rec.color);
                    return (
                      <div 
                        key={index}
                        className={`flex items-center gap-3 bg-white border-2 ${colors.border} rounded-lg p-4 shadow-xl`}
                      >
                        <div className={`h-10 w-10 rounded-lg ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
                          <rec.icon className={`h-5 w-5 ${colors.text}`} />
                        </div>
                        <div className="text-left">
                          <div className={`text-sm font-medium ${colors.text}`}>{rec.label}</div>
                          <div className="font-semibold text-base">{rec.text}</div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="mt-6 p-5 bg-white border-2 border-primary/30 rounded-lg shadow-xl">
                    <div className="flex items-center gap-2 mb-2 justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div className="text-sm font-semibold text-primary">Resumen del día</div>
                    </div>
                    <div className="text-base font-medium">3 acciones prioritarias</div>
                    <div className="text-sm text-muted-foreground mt-1">Impacto estimado: +€420/día</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="container mx-auto text-center mt-8 sm:mt-10 md:mt-12">
            <Link to="/register">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-6 sm:px-8 md:px-12 py-5 sm:py-6 md:py-7 text-base sm:text-base md:text-lg font-semibold shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              >
                Prueba gratuita 30 días
              </Button>
            </Link>
            <p className="text-sm sm:text-sm text-muted-foreground mt-3 sm:mt-4">
              Sin tarjeta de crédito • Cancela cuando quieras
            </p>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-8 sm:py-12 md:py-16 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8 bg-background relative">
          <div className="container mx-auto">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-3 leading-tight px-2">
                Valorado 4,9/5 por más de 100 usuarios
              </h2>
            </div>

            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              className="w-full max-w-6xl mx-auto"
            >
              <CarouselContent>
                {[
                  {
                    name: "Carlos M.",
                    role: "Director de Marketing Digital",
                    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop&crop=faces",
                    text: "Desde que uso esta herramienta, mi ROAS ha mejorado un 47%. Las recomendaciones son muy precisas y fáciles de aplicar. Ya no pierdo horas analizando datos."
                  },
                  {
                    name: "Laura S.",
                    role: "Responsable de E-commerce",
                    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces",
                    text: "La IA detecta oportunidades que yo nunca habría visto. En 3 meses he reducido el CPA un 32% siguiendo las recomendaciones diarias. Muy recomendable."
                  },
                  {
                    name: "David R.",
                    role: "Especialista en Growth",
                    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces",
                    text: "Ahorro más de 10 horas semanales en análisis manual. Las alertas me avisan de problemas antes de que afecten al presupuesto. Vale cada euro."
                  },
                  {
                    name: "Ana T.",
                    role: "Consultora PPC",
                    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=faces",
                    text: "Gestiono 8 cuentas y antes era un caos. Ahora cada mañana tengo un resumen claro de cada cuenta con acciones concretas. Un cambio total."
                  },
                  {
                    name: "Miguel Á.",
                    role: "Fundador de Startup",
                    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=faces",
                    text: "Como fundador sin conocimientos técnicos de Ads, esta herramienta me ha permitido competir con empresas que tienen equipos enteros de marketing."
                  },
                  {
                    name: "Patricia G.",
                    role: "Responsable de Marketing Digital",
                    avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&h=100&fit=crop&crop=faces",
                    text: "Las recomendaciones están basadas en datos reales, no en suposiciones. He conseguido duplicar las conversiones optimizando campañas que creía que iban bien."
                  }
                ].map((testimonial, index) => (
                  <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/2 pl-4">
                    <div className="p-4 sm:p-5 md:p-6 bg-card border rounded-xl sm:rounded-2xl shadow-sm h-full flex flex-col">
                      <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <img 
                          src={testimonial.avatar} 
                          alt={testimonial.name}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ring-primary/20 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base sm:text-base truncate">{testimonial.name}</h4>
                          <p className="text-sm sm:text-sm text-muted-foreground truncate">{testimonial.role}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-0.5 sm:gap-1 mb-3 sm:mb-4">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 sm:h-4 sm:w-4 fill-primary text-primary" />
                        ))}
                      </div>
                      
                      <p className="text-lg sm:text-sm text-muted-foreground leading-relaxed flex-1">
                        "{testimonial.text}"
                      </p>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-4 sm:-left-8 md:-left-12 h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12" />
              <CarouselNext className="-right-4 sm:-right-8 md:-right-12 h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12" />
            </Carousel>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-8 sm:py-12 md:py-16 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8 bg-muted/30 relative">
          <div className="container mx-auto">
            <div className="text-center mb-8 sm:mb-12 md:mb-16 animate-fade-in">
              <h2 className="text-2xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 sm:mb-4 leading-tight">
                Lo que otros hacen en horas, tú en segundos
              </h2>
              <p className="text-base sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                La IA revisa tus métricas en tiempo real, prioriza lo que más impacto tiene y te sugiere las acciones clave.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8">
              {[
                {
                  icon: Brain,
                  title: "Gestión automática de campañas",
                  description: "La IA analiza tus campañas cada día y te muestra qué optimizar para mejorar el rendimiento.",
                  stat: "Análisis diario automático",
                  gradient: "from-purple-500/10 to-violet-500/10"
                },
                {
                  icon: Target,
                  title: "Ahorra tiempo cada semana",
                  description: "Evita revisar manualmente tus métricas. La IA detecta lo importante y te dice dónde actuar.",
                  stat: "5 horas ahorradas/semana",
                  gradient: "from-blue-500/10 to-cyan-500/10"
                },
                {
                  icon: DollarSign,
                  title: "Aumenta la rentabilidad",
                  description: "Convierte tus datos en decisiones que mejoran tu ROAS y reducen el coste por conversión.",
                  stat: "Genera más con menos",
                  gradient: "from-green-500/10 to-emerald-500/10"
                }
              ].map((benefit, i) => (
                <div 
                  key={i}
                  className="group relative bg-card rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 animate-fade-in"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${benefit.gradient} rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                  
                  <div className="relative">
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <benefit.icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                      </div>
                      <h3 className="text-xl sm:text-lg md:text-xl font-bold leading-tight">{benefit.title}</h3>
                    </div>
                    
                    <p className="text-lg sm:text-lg text-muted-foreground mb-4 sm:mb-5 md:mb-6 leading-relaxed">
                      {benefit.description}
                    </p>
                    
                    <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary font-semibold text-base sm:text-sm">
                      {benefit.stat}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <div className="container mx-auto text-center mt-8 sm:mt-10 md:mt-12">
            <Link to="/register">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-6 sm:px-8 md:px-12 py-5 sm:py-6 md:py-7 text-base sm:text-base md:text-lg font-semibold shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-105 w-full sm:w-auto"
              >
                Prueba gratuita 30 días
              </Button>
            </Link>
            <p className="text-sm sm:text-sm text-muted-foreground mt-3 sm:mt-4">
              Sin tarjeta de crédito • Cancela cuando quieras
            </p>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="py-8 sm:py-12 md:py-16 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8 bg-background relative">
          <div className="container mx-auto">
            <div className="text-center mb-8 sm:mb-10 md:mb-12">
              <h2 className="text-2xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-3 sm:mb-4 leading-tight">
                Así te ayuda la IA a optimizar cada día
              </h2>
              <p className="text-base sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Conecta tu cuenta, deja que analice tus datos y recibe acciones listas para aplicar.
              </p>
            </div>

            {/* Steps */}
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 mb-8 sm:mb-12 md:mb-16">
              {[
                {
                  number: "1",
                  title: "Conecta tu cuenta de Google Ads",
                  description: "Tu MCC o tus cuentas individuales. Sin configuración, sin código. Solo iniciando sesión.",
                  icon: Shield
                },
                {
                  number: "2",
                  title: "La IA descarga automáticamente las métricas",
                  description: "Analiza los últimos 30 días y, a partir de ahí, revisa tus métricas cada día.",
                  icon: Brain
                },
                {
                  number: "3",
                  title: "Recibe acciones listas para aplicar",
                  description: "Recibe sugerencias concretas para mejorar tu ROAS, reducir costes y escalar resultados.",
                  icon: Target
                }
              ].map((step) => (
                <div key={step.number} className="bg-card border rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 shadow-sm hover:shadow-md transition-shadow">
                  {/* Mobile layout */}
                  <div className="flex flex-col gap-3 md:hidden">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-bold text-primary">{step.number}</span>
                      </div>
                      <h3 className="text-xl font-bold leading-tight flex-1">{step.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Desktop layout */}
                  <div className="hidden md:flex gap-4 lg:gap-6 items-start">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">{step.number}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg lg:text-2xl font-bold leading-tight mb-3">{step.title}</h3>
                      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Results Title */}
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold px-2 leading-tight">
                Resultados medios de los usuarios de optimizalo.app
              </h3>
            </div>

            {/* Persuasive Stats */}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-8 sm:mb-10 md:mb-12 max-w-5xl mx-auto">
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-1.5 sm:mb-2">+47%</div>
                <div className="text-lg sm:text-base font-semibold mb-1.5 sm:mb-2">ROAS medio</div>
                <p className="text-lg sm:text-base text-muted-foreground leading-relaxed">
                  Los usuarios mejoran su retorno sin cambiar su estructura de campañas.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-center">
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1.5 sm:mb-2">-32%</div>
                <div className="text-lg sm:text-base font-semibold mb-1.5 sm:mb-2">Coste por conversión</div>
                <p className="text-lg sm:text-base text-muted-foreground leading-relaxed">
                  Detecta ineficiencias y redirige presupuesto a lo que realmente convierte.
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-center sm:col-span-2 md:col-span-1">
                <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-1.5 sm:mb-2">5h</div>
                <div className="text-lg sm:text-base font-semibold mb-1.5 sm:mb-2">Semanales ahorradas</div>
                <p className="text-lg sm:text-base text-muted-foreground leading-relaxed">
                  Menos análisis, más tiempo para pensar estrategia o atender clientes.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center bg-gradient-to-r from-primary/5 to-accent/5 border-2 border-primary/20 rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 max-w-3xl mx-auto">
              <p className="text-xl sm:text-2xl md:text-3xl font-semibold mb-4 sm:mb-5 md:mb-6 px-2">
                Tu primer análisis llega en menos de 2 horas
              </p>
              <Link to="/register">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white px-6 sm:px-8 md:px-12 py-5 sm:py-6 md:py-7 text-sm sm:text-base md:text-lg font-semibold shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-105 w-full sm:w-auto"
                >
                  Empieza ahora
                </Button>
              </Link>
              <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4">
                Sin tarjeta de crédito • Cancela cuando quieras
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-10 sm:py-12 md:py-16 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2djhhNCA0IDAgMDAtOCAwdi04YTQgNCAwIDEwOCAwem0wIDI4djhhNCA0IDAgMDAtOCAwdi04YTQgNCAwIDEwOCAwek0xNiAzNmg4YTQgNCAwIDAwMC04aC04YTQgNCAwIDEwMCA4em0yOCAwaDhhNCA0IDAgMDAwLThoLThhNCA0IDAgMTAwIDh6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-10" />
          
          <div className="container mx-auto text-center relative z-10">
            <h2 className="text-3xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-5 md:mb-6 text-white leading-tight">
              ¿Aún no estás seguro? Prueba lo fácil que es.
            </h2>
            <p className="text-base sm:text-base md:text-lg lg:text-xl text-white/90 mb-6 sm:mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
              Conecta tu cuenta y deja que la IA te diga exactamente dónde estás perdiendo dinero.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link to="/register" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-base shadow-xl hover:shadow-2xl transition-shadow group w-full sm:w-auto">
                  Haz tu primer análisis gratis
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
            </div>

            <p className="text-sm sm:text-sm text-white/70 mt-4 sm:mt-5 md:mt-6">
              Sin tarjeta · Sin configuración · Resultados en menos de 2h
            </p>
          </div>
        </section>
      </main>
      
      <footer className="border-t py-8 sm:py-10 md:py-12 bg-muted/30">
        <div className="container mx-auto pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-5 sm:gap-6">
            <div className="flex flex-col items-start">
              <Link to="/">
                <img src={logoDark} alt="optimizalo.app" className="h-6 sm:h-8 mb-2" />
              </Link>
              <p className="text-xs sm:text-sm text-muted-foreground">
                © 2025 optimizalo.app. Todos los derechos reservados.
              </p>
            </div>
            <nav className="flex flex-wrap gap-4 sm:gap-6 justify-start md:justify-center">
              <Link to="/aviso-legal" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
                Aviso legal
              </Link>
              <Link to="/politica-privacidad" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacidad
              </Link>
              <Link to="/politica-cookies" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cookies
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;