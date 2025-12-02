import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Slider } from "@/components/ui/slider";

const PricingPage = () => {
  const [customAccounts, setCustomAccounts] = useState([20]);

  const calculateCustomPrice = (accounts: number) => {
    // Base: 199€ para 15 cuentas
    // Cada cuenta adicional: aproximadamente 10€
    const additionalAccounts = accounts - 15;
    return 199 + (additionalAccounts * 10);
  };

  const plans = [
    {
      name: "Starter",
      accounts: 1,
      price: 39,
      priceDaily: "1,30",
      timeSaved: 5,
      description: "Ideal si gestionas tu propia cuenta de Google Ads",
      features: [
        "1 cuenta de Google Ads",
        "Recomendaciones AI ilimitadas",
        "Historial de optimizaciones",
        "Soporte por email"
      ],
      popular: false
    },
    {
      name: "Pro",
      accounts: 5,
      price: 99,
      priceDaily: "6,60",
      timeSaved: 25,
      description: "Perfecto para pequeñas empresas o gestores",
      features: [
        "Hasta 5 cuentas de Google Ads",
        "Todo lo del plan Starter",
        "Análisis comparativo de cuentas",
        "Dashboard unificado",
        "Soporte prioritario",
        "Exportación de datos"
      ],
      popular: true
    },
    {
      name: "Business",
      accounts: 15,
      price: 199,
      priceDaily: "21,67",
      timeSaved: 75,
      description: "Ideal si gestionas un gran número de cuentas",
      features: [
        "Hasta 15 cuentas de Google Ads",
        "Todo lo del plan Pro",
        "Manager de cuenta dedicado",
        "Formación personalizada",
        "Acceso anticipado a nuevas funciones",
        "Soporte premium 24/7"
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/20 to-background">
      {/* Navigation */}
      <Header />

      {/* Hero Section */}
      <section className="pt-20 sm:pt-24 pb-4 px-2 sm:px-4 lg:px-8">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight pt-8 pb-2">
            Planes que escalan con tu negocio
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
            Desde solo <span className="font-bold text-primary">{plans[0].priceDaily}€/día</span> por cliente.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pt-12 pb-16 px-2 sm:px-4 lg:px-8">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${
                  plan.popular
                    ? "border-primary shadow-lg shadow-primary/20 scale-105"
                    : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Más popular
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                  <div className="py-4 border-y border-border/50">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{plan.price}€</span>
                      <span className="text-muted-foreground text-sm">/mes</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(plan.price / plan.accounts).toFixed(2)}€ por cuenta
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-2">
                  <Link to="/register" className="w-full">
                    <Button className="w-full bg-primary hover:bg-primary/90">
                      Empezar ahora
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Custom Plan Section */}
      <section className="pb-24 px-2 sm:px-4 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-2">¿Tienes más de 15 cuentas?</CardTitle>
              <CardDescription className="text-base">
                Configura tu plan personalizado y obtén descuentos automáticos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Número de cuentas</label>
                  <span className="text-2xl font-bold text-primary">{customAccounts[0]}</span>
                </div>
                <Slider
                  value={customAccounts}
                  onValueChange={setCustomAccounts}
                  min={16}
                  max={100}
                  step={1}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>16 cuentas</span>
                  <span>100 cuentas</span>
                </div>
              </div>

              <div className="bg-background/50 rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ahorro de tiempo estimado</span>
                  <span className="text-lg font-semibold">{customAccounts[0] * 5}h/semana</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Coste por cuenta</span>
                  <span className="text-lg font-semibold">
                    {(calculateCustomPrice(customAccounts[0]) / customAccounts[0]).toFixed(2)}€/mes
                  </span>
                </div>
                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Precio total</div>
                      <div className="text-xs text-primary">Descuento automático aplicado</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary">
                        {calculateCustomPrice(customAccounts[0])}€
                      </div>
                      <div className="text-sm text-muted-foreground">/mes</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link to="/register" className="w-full">
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90">
                  Solicitar plan personalizado
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/" className="hover:text-primary transition-colors">
                    Características
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="hover:text-primary transition-colors">
                    Precios
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/aviso-legal" className="hover:text-primary transition-colors">
                    Aviso Legal
                  </Link>
                </li>
                <li>
                  <Link to="/politica-privacidad" className="hover:text-primary transition-colors">
                    Política de Privacidad
                  </Link>
                </li>
                <li>
                  <Link to="/politica-cookies" className="hover:text-primary transition-colors">
                    Política de Cookies
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Recursos</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Documentación
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Soporte</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Centro de ayuda
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-left text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} AdOps AI. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;