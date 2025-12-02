import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  Megaphone, 
  Users, 
  Layers, 
  FileText, 
  Image, 
  Key, 
  PieChart, 
  Search,
  Loader2
} from "lucide-react";
import { fetchAppliedRecommendations } from "@/services/api";
import { Recomendacion } from "@/types";

type Priority = "high" | "medium" | "low";
type EntityType = "campaign" | "adgroup" | "ad";
type FunctionalGroup = "campaigns" | "adgroups" | "assetGroups" | "ads" | "assets" | "keywords" | "segments" | "searchTerms";

interface AppliedRecommendation {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  impact: string;
  entityType: EntityType;
  functionalGroup: FunctionalGroup;
  entityName: string;
  appliedDate: string;
  result: {
    status: "improved" | "no_change" | "worsened";
    actualImprovement: string;
    comparisonPeriod: string;
    kpiVariation: number;
  };
  details: {
    justification: string;
    targetKPI: string;
    currentValue: string;
    expectedValue: string;
  };
}

interface AppliedRecommendationsHistoryProps {
  customerId: number;
}

const AppliedRecommendationsHistory = ({ customerId }: AppliedRecommendationsHistoryProps) => {
  const [recommendations, setRecommendations] = useState<AppliedRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [groupPages, setGroupPages] = useState<Record<FunctionalGroup, number>>({
    campaigns: 1,
    adgroups: 1,
    assetGroups: 1,
    ads: 1,
    assets: 1,
    keywords: 1,
    segments: 1,
    searchTerms: 1
  });

  // Mapear tipo de objeto a grupo funcional
  const mapEntityTypeToFunctionalGroup = (entityType: string): FunctionalGroup => {
    const mapping: Record<string, FunctionalGroup> = {
      'campaign': 'campaigns',
      'ad_group': 'adgroups',
      'asset_group': 'assetGroups',
      'ad': 'ads',
      'asset': 'assets',
      'keyword': 'keywords',
      'segment': 'segments',
      'search_term': 'searchTerms'
    };
    return mapping[entityType] || 'campaigns';
  };

  // Mapear prioridad de API a formato del componente
  const mapPriority = (priority: string): Priority => {
    const mapping: Record<string, Priority> = {
      'alta': 'high',
      'media': 'medium',
      'baja': 'low'
    };
    return mapping[priority] || 'medium';
  };

  // Mapear tipo de entidad de API a formato del componente
  const mapEntityType = (entityType: string): EntityType => {
    const mapping: Record<string, EntityType> = {
      'campaign': 'campaign',
      'ad_group': 'adgroup',
      'ad': 'ad'
    };
    return mapping[entityType] || 'campaign';
  };

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAppliedRecommendations(customerId);
        
        const mapped: AppliedRecommendation[] = data.map((rec: Recomendacion) => ({
          id: rec.id.toString(),
          title: rec.titulo,
          description: rec.descripcion,
          priority: mapPriority(rec.prioridad),
          impact: rec.impacto_estimado,
          entityType: mapEntityType(rec.tipo_objeto),
          functionalGroup: mapEntityTypeToFunctionalGroup(rec.tipo_objeto),
          entityName: rec.nombre_objeto || "Entidad",
          appliedDate: rec.fecha_aplicacion || rec.fecha_creacion,
          result: {
            status: (rec.resultado?.estado as "improved" | "no_change" | "worsened") || "no_change",
            actualImprovement: rec.resultado?.mejora_real || rec.impacto_estimado || "-",
            comparisonPeriod: rec.resultado?.periodo_comparacion || "7 días",
            kpiVariation: rec.resultado?.variacion_kpi ?? 0,
          },
          details: {
            justification: rec.detalle?.justificacion || rec.descripcion || "-",
            targetKPI: rec.detalle?.kpi_objetivo || "KPI",
            currentValue: rec.detalle?.valor_actual || "-",
            expectedValue: rec.detalle?.valor_esperado || "-",
          },
        }));

        setRecommendations(mapped);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error desconocido";
        setError(errorMessage);
        console.error("Error loading applied recommendations:", err);
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      loadRecommendations();
    }
  }, [customerId]);

  const getEntityTypeLabel = (type: EntityType) => {
    switch (type) {
      case "campaign":
        return "Campaña";
      case "adgroup":
        return "Conjunto";
      case "ad":
        return "Anuncio";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getFunctionalGroupLabel = (group: FunctionalGroup) => {
    const labels: Record<FunctionalGroup, string> = {
      campaigns: "Campañas",
      adgroups: "Grupos de anuncios",
      assetGroups: "Grupos de recursos",
      ads: "Anuncios",
      assets: "Recursos",
      keywords: "Keywords",
      segments: "Segmentos",
      searchTerms: "Términos de búsqueda"
    };
    return labels[group];
  };

  const getFunctionalGroupIcon = (group: FunctionalGroup) => {
    const icons: Record<FunctionalGroup, React.ReactNode> = {
      campaigns: <Megaphone className="h-5 w-5" />,
      adgroups: <Users className="h-5 w-5" />,
      assetGroups: <Layers className="h-5 w-5" />,
      ads: <FileText className="h-5 w-5" />,
      assets: <Image className="h-5 w-5" />,
      keywords: <Key className="h-5 w-5" />,
      segments: <PieChart className="h-5 w-5" />,
      searchTerms: <Search className="h-5 w-5" />
    };
    return icons[group];
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-16 w-16 mx-auto mb-4 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Cargando historial...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
        <p className="text-red-600 font-medium mb-2">Error al cargar historial</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aún no hay recomendaciones aplicadas</h3>
          <p className="text-gray-600">Cuando apliques recomendaciones aparecerán aquí con sus resultados</p>
        </div>
      </div>
    );
  }

  // Agrupar por grupo funcional
  const groupedRecommendations = recommendations.reduce((acc, rec) => {
    if (!acc[rec.functionalGroup]) {
      acc[rec.functionalGroup] = [];
    }
    acc[rec.functionalGroup].push(rec);
    return acc;
  }, {} as Record<FunctionalGroup, AppliedRecommendation[]>);

  const renderRecommendationCard = (rec: AppliedRecommendation) => (
    <div key={rec.id} className="bg-card border rounded-lg p-4 hover:shadow-sm transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-foreground text-base mb-2">{rec.title}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Aplicada el {formatDate(rec.appliedDate)}</span>
            <span className="text-gray-300">•</span>
            <span>Entidad: {rec.entityName}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFunctionalGroupBlock = (
    group: FunctionalGroup,
    recs: AppliedRecommendation[]
  ) => {
    if (recs.length === 0) return null;
    
    const itemsPerGroupPage = 5;
    const currentPage = groupPages[group];
    const totalPages = Math.ceil(recs.length / itemsPerGroupPage);
    const startIndex = (currentPage - 1) * itemsPerGroupPage;
    const visibleRecs = recs.slice(startIndex, startIndex + itemsPerGroupPage);

    return (
      <AccordionItem key={group} value={group} className="border rounded-lg">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center justify-between w-full pr-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                {getFunctionalGroupIcon(group)}
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-base">{getFunctionalGroupLabel(group)}</h3>
                <p className="text-xs text-muted-foreground">
                  {recs.length} recomendación{recs.length !== 1 ? 'es' : ''} aplicada{recs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10 mr-2">
              {recs.length}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3">
            {visibleRecs.map(renderRecommendationCard)}
            
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGroupPages({
                    ...groupPages,
                    [group]: Math.max(1, currentPage - 1)
                  })}
                  disabled={currentPage === 1}
                  className="h-8 px-3"
                >
                  Anterior
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setGroupPages({
                        ...groupPages,
                        [group]: page
                      })}
                      className="h-8 w-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGroupPages({
                    ...groupPages,
                    [group]: Math.min(totalPages, currentPage + 1)
                  })}
                  disabled={currentPage === totalPages}
                  className="h-8 px-3"
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  const functionalGroupOrder: FunctionalGroup[] = ['campaigns', 'adgroups', 'ads', 'keywords', 'searchTerms', 'segments', 'assetGroups', 'assets'];

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={[]} className="space-y-3">
        {functionalGroupOrder.map(group => 
          renderFunctionalGroupBlock(group, groupedRecommendations[group] || [])
        )}
      </Accordion>
    </div>
  );
};

export default AppliedRecommendationsHistory;
