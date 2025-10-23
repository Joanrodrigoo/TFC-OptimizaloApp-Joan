
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, Lightbulb, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface RecommendationsSidebarProps {
  accountId: string;
}

type Priority = "high" | "medium" | "low";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  impact: string;
  category: string;
}

const RecommendationsSidebar = ({ accountId }: RecommendationsSidebarProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const recommendations: Recommendation[] = [
    {
      id: "1",
      title: "Optimizar pujas en campañas de búsqueda",
      description: "Detectamos campañas con pujas muy altas que están perdiendo impresiones por presupuesto limitado.",
      priority: "high",
      impact: "+25% impresiones",
      category: "Pujas"
    },
    {
      id: "2", 
      title: "Añadir extensiones de anuncio",
      description: "Tus anuncios principales no tienen extensiones de enlace, lo que reduce el CTR potencial.",
      priority: "medium",
      impact: "+15% CTR",
      category: "Extensiones"
    },
    {
      id: "3",
      title: "Revisar palabras clave negativas",
      description: "Hay términos de búsqueda irrelevantes que están generando clics sin conversión.",
      priority: "high",
      impact: "-20% coste",
      category: "Keywords"
    },
    {
      id: "4",
      title: "Optimizar landing pages",
      description: "Algunas páginas de destino tienen velocidades de carga lentas afectando el Quality Score.",
      priority: "medium",
      impact: "+10% Quality Score",
      category: "Landing Pages"
    }
  ];

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium":
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const groupedRecommendations = {
    high: recommendations.filter(r => r.priority === "high"),
    medium: recommendations.filter(r => r.priority === "medium"),
    low: recommendations.filter(r => r.priority === "low")
  };

  return (
    <Card className="h-fit sticky top-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-lg">Recomendaciones de IA</CardTitle>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-800">Alta</span>
                </div>
                <span className="text-sm font-bold text-red-900">{groupedRecommendations.high.length}</span>
              </div>
              
              <div className="flex items-center justify-between p-2 rounded bg-yellow-50 border border-yellow-200">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-800">Media</span>
                </div>
                <span className="text-sm font-bold text-yellow-900">{groupedRecommendations.medium.length}</span>
              </div>
              
              <div className="flex items-center justify-between p-2 rounded bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-800">Baja</span>
                </div>
                <span className="text-sm font-bold text-blue-900">{groupedRecommendations.low.length}</span>
              </div>
            </div>

            {/* Lista de recomendaciones */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recommendations.map((rec) => (
                <div key={rec.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-2 mb-2">
                    {getPriorityIcon(rec.priority)}
                    <div className="flex-1">
                      <h4 className="text-sm font-medium line-clamp-2">{rec.title}</h4>
                      <Badge variant="outline" className={`mt-1 text-xs ${getPriorityColor(rec.priority)}`}>
                        {rec.priority === "high" ? "Alta" : rec.priority === "medium" ? "Media" : "Baja"}
                      </Badge>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{rec.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                      {rec.impact}
                    </Badge>
                    <Button className="h-6 text-xs px-2">
                      Aplicar
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default RecommendationsSidebar;