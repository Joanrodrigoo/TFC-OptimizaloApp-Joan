import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Recomendacion } from "@/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchRecomendaciones, applyRecommendation } from "@/services/api";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { 
  AlertTriangle, 
  TrendingUp, 
  Lightbulb, 
  Eye, 
  CheckCircle, 
  Loader2,
  Megaphone,
  Users,
  Layers,
  FileText,
  Image,
  Key,
  PieChart,
  Search
} from "lucide-react";
import { NavigationState } from "@/pages/AccountDetailPage";
import AppliedRecommendationsHistory from "./AppliedRecommendationsHistory";

interface RecommendationsProps {
  accountId: string;
  navigation: NavigationState;
  onNavigationChange?: (navigation: NavigationState) => void;
  specificFilter?: {
    type: 'campaign' | 'adgroup' | 'ad';
    id: string;
    name: string;
  } | null;
}

type FunctionalGroup = "campaigns" | "adgroups" | "assetGroups" | "ads" | "assets" | "keywords" | "segments" | "searchTerms";

const ITEMS_PER_PAGE = 5;

const RecommendationsPanel = ({ accountId, navigation, onNavigationChange, specificFilter }: RecommendationsProps) => {
  const [mainTab, setMainTab] = useState<string>("pending");
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recomendacion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [applyingIds, setApplyingIds] = useState<Set<number>>(new Set());
  
  const [allRecommendations, setAllRecommendations] = useState<Recomendacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de paginación para cada grupo funcional
  const [paginationState, setPaginationState] = useState<Record<FunctionalGroup, number>>({
    campaigns: 1,
    adgroups: 1,
    assetGroups: 1,
    ads: 1,
    assets: 1,
    keywords: 1,
    segments: 1,
    searchTerms: 1,
  });

  // Función para actualizar la página de un grupo específico
  const setPageForGroup = (group: FunctionalGroup, page: number) => {
    setPaginationState(prev => ({
      ...prev,
      [group]: page
    }));
  };

  // Fetch recommendations from API
  const fetchRecommendations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await fetchRecomendaciones(Number(accountId));

      setAllRecommendations(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar recomendaciones';
      setError(errorMessage);
      console.error('Error fetching recommendations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      fetchRecommendations();
    }
  }, [accountId, fetchRecommendations]);

  const getFilteredRecommendations = useMemo(() => {
    let filtered = allRecommendations;

    if (specificFilter) {
      filtered = filtered.filter(rec => {
        const recType = rec.tipo_objeto === 'ad_group' ? 'adgroup' : rec.tipo_objeto;
        const filterType = specificFilter.type;
        
        const typeMatches = recType === filterType;
        const idMatches = rec.objeto_id?.toString() === specificFilter.id;
        
        return typeMatches && idMatches;
      });
      return filtered;
    }

    if (navigation.level === 'campaigns') {
      return filtered;
    }
    
    if (navigation.level === 'adgroups' && navigation.selectedCampaign) {
      filtered = filtered.filter(rec => {
        if (rec.tipo_objeto === 'campaign' && 
            rec.objeto_id?.toString() === navigation.selectedCampaign) {
          return true;
        }
        
        if (rec.tipo_objeto === 'ad_group') {
          return true;
        }
        
        if (rec.tipo_objeto === 'asset_group') {
          return true;
        }
        
        return false;
      });
      
      return filtered;
    }
    
    if (navigation.level === 'ads' && navigation.selectedAdGroup) {
      filtered = filtered.filter(rec => {
        if (rec.tipo_objeto === 'ad_group' && 
            rec.objeto_id?.toString() === navigation.selectedAdGroup) {
          return true;
        }
        
        if (rec.tipo_objeto === 'asset_group' && 
            rec.objeto_id?.toString() === navigation.selectedAdGroup) {
          return true;
        }
        
        if (rec.tipo_objeto === 'ad') {
          return true;
        }
        
        if (rec.tipo_objeto === 'asset') {
          return true;
        }
        
        return false;
      });
      
      return filtered;
    }
    
    return filtered;
  }, [allRecommendations, navigation, specificFilter]);

  const getCategoryToFunctionalGroup = (category: string): FunctionalGroup => {
    const mapping: Record<string, FunctionalGroup> = {
      'pujas': 'campaigns',
      'anuncios': 'ads',
      'keywords': 'keywords',
      'landing_pages': 'campaigns',
      'segmentacion': 'segments',
      'presupuesto': 'campaigns',
      'search_terms': 'searchTerms',
      'estrategia': 'campaigns',
      'estructura': 'assetGroups',
      'testing': 'assets',
    };
    return mapping[category] || 'campaigns';
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "alta":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "media":
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case "baja":
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
      default:
        return <Lightbulb className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta":
        return "bg-red-100 text-red-800 border-red-200";
      case "media":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "baja":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case "campaign":
        return "Campaña";
      case "ad_group":
      case "adgroup":
        return "Conjunto";
      case "asset_group":
        return "Grupo de recursos";
      case "ad":
        return "Anuncio";
      case "asset":
        return "Recurso";
      case "keyword":
        return "Palabra clave";
      default:
        return type;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "pujas":
        return "Pujas";
      case "anuncios":
        return "Anuncios";
      case "keywords":
        return "Palabras clave";
      case "landing_pages":
        return "Páginas de destino";
      case "segmentacion":
        return "Segmentación";
      case "presupuesto":
        return "Presupuesto";
      case "search_terms":
        return "Términos de búsqueda";
      default:
        return category;
    }
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

  const handleApplyRecommendation = async (recommendation: Recomendacion) => {
    const recommendationId = recommendation.id;

    setApplyingIds(prev => new Set([...prev, recommendationId]));

    try {
      await applyRecommendation(recommendationId, {
        estado: "improved",
        mejora_real: recommendation.impacto_estimado,
        periodo_comparacion: "7 días",
        variacion_kpi: 12.3
      });

      setAllRecommendations(prev => 
        prev.filter(r => r.id !== recommendationId)
      );

      alert('Recomendación aplicada con éxito');

    } catch (err) {
      console.error('Error applying recommendation:', err);
      alert('Error al aplicar la recomendación. Por favor, inténtalo de nuevo.');
    } finally {
      setApplyingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(recommendationId);
        return newSet;
      });
    }
  };

  const handleViewDetail = (recommendation: Recomendacion) => {
    setSelectedRecommendation(recommendation);
    setIsModalOpen(true);
  };

  const renderError = () => (
    <div className="text-center py-12">
      <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-400" />
      <p className="text-red-600 font-medium mb-2">Error al cargar recomendaciones</p>
      <p className="text-muted-foreground text-sm mb-4">{error}</p>
    </div>
  );

  const renderLoading = () => (
    <div className="text-center py-12">
      <Loader2 className="h-16 w-16 mx-auto mb-4 text-primary animate-spin" />
      <p className="text-muted-foreground font-medium">Cargando recomendaciones...</p>
      <p className="text-sm text-muted-foreground/70 mt-1">Analizando tu cuenta con IA</p>
    </div>
  );

  const RecommendationDetailModal = () => {
    if (!isModalOpen || !selectedRecommendation) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">{selectedRecommendation.titulo}</h2>
            <button 
              onClick={() => setIsModalOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Descripción</h3>
              <p className="text-gray-600">{selectedRecommendation.descripcion}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-1">Categoría</h3>
                <Badge variant="outline">{getCategoryLabel(selectedRecommendation.categoria)}</Badge>
              </div>
              <div>
                <h3 className="font-medium mb-1">Prioridad</h3>
                <Badge className={getPriorityColor(selectedRecommendation.prioridad)}>
                  {selectedRecommendation.prioridad}
                </Badge>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-1">Impacto estimado</h3>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {selectedRecommendation.impacto_estimado}
              </Badge>
            </div>
            
            {selectedRecommendation.tipo_objeto && (
              <div>
                <h3 className="font-medium mb-1">Tipo de objeto</h3>
                <p className="text-gray-600">{getEntityTypeLabel(selectedRecommendation.tipo_objeto)}</p>
              </div>
            )}

            <div>
              <h3 className="font-medium mb-1">Estado</h3>
              <Badge variant="outline">{selectedRecommendation.estado}</Badge>
            </div>

            <div>
              <h3 className="font-medium mb-1">Fecha de creación</h3>
              <p className="text-gray-600">
                {new Date(selectedRecommendation.fecha_creacion).toLocaleDateString()}
              </p>
            </div>

            {selectedRecommendation.fecha_aplicacion && (
              <div>
                <h3 className="font-medium mb-1">Fecha de aplicación</h3>
                <p className="text-gray-600">
                  {new Date(selectedRecommendation.fecha_aplicacion).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button 
              onClick={() => setIsModalOpen(false)}
              variant="outline"
            >
              Cerrar
            </Button>
            <Button 
              onClick={() => {
                handleApplyRecommendation(selectedRecommendation);
                setIsModalOpen(false);
              }}
              disabled={selectedRecommendation.estado === 'aplicada'}
            >
              {selectedRecommendation.estado === 'aplicada' ? 'Ya aplicada' : 'Aplicar recomendación'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendationsList = () => {
    if (isLoading) return renderLoading();
    if (error) return renderError();

    const recommendations = getFilteredRecommendations;

    if (recommendations.length === 0) {
      return (
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">No hay recomendaciones para mostrar</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Prueba a ajustar los filtros</p>
        </div>
      );
    }

    // Agrupar por grupo funcional
    const groupedRecommendations = recommendations.reduce((acc, rec) => {
      const functionalGroup = getCategoryToFunctionalGroup(rec.categoria);
      if (!acc[functionalGroup]) {
        acc[functionalGroup] = [];
      }
      acc[functionalGroup].push(rec);
      return acc;
    }, {} as Record<FunctionalGroup, Recomendacion[]>);

    const renderRecommendationCard = (rec: Recomendacion) => {
      const isApplying = applyingIds.has(rec.id);
      const isApplied = rec.estado === 'aplicada';
      
      return (
        <div key={rec.id} className="flex flex-col sm:flex-row items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
          <div className="flex-1 w-full min-w-0">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              <div className="flex-1 w-full min-w-0">
                <h4 className="font-semibold text-sm mb-1 break-words">{rec.titulo}</h4>
                <p className="text-xs text-muted-foreground mb-2 break-words line-clamp-3">{rec.descripcion}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getEntityTypeLabel(rec.tipo_objeto)}
                  </Badge>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs break-all">
                    {rec.impacto_estimado}
                  </Badge>
                </div>
              </div>
              
              <div className="flex gap-2 shrink-0 self-end sm:self-start mt-3 sm:mt-0">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleViewDetail(rec)}
                  disabled={isApplying}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleApplyRecommendation(rec)}
                  disabled={isApplying || isApplied}
                  className="text-xs"
                >
                  {isApplying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isApplied ? (
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    "Aplicar"
                  )}
                  {isApplied && "Aplicada"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    };

    const renderFunctionalGroupBlock = (
      group: FunctionalGroup,
      recs: Recomendacion[]
    ) => {
      if (recs.length === 0) return null;

      const currentPage = paginationState[group];
      const totalPages = Math.ceil(recs.length / ITEMS_PER_PAGE);
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedRecs = recs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
      
      return (
        <AccordionItem value={group} className="border rounded-lg">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center justify-between w-full pr-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  {getFunctionalGroupIcon(group)}
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-base">{getFunctionalGroupLabel(group)}</h3>
                  <p className="text-xs text-muted-foreground">
                    {recs.length} recomendación{recs.length !== 1 ? 'es' : ''}
                  </p>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary mr-2">
                {recs.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3 mb-4">
              {paginatedRecs.map(renderRecommendationCard)}
            </div>
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={recs.length}
                itemsPerPage={ITEMS_PER_PAGE}
                itemName="recomendaciones"
                onPageChange={(page) => setPageForGroup(group, page)}
              />
            )}
          </AccordionContent>
        </AccordionItem>
      );
    };

    const functionalGroupOrder: FunctionalGroup[] = ['campaigns', 'adgroups', 'ads', 'keywords', 'searchTerms', 'segments', 'assetGroups', 'assets'];

    return (
      <div className="space-y-6">
        <Accordion type="multiple" defaultValue={[]} className="space-y-3">
          {functionalGroupOrder.map(group => 
            renderFunctionalGroupBlock(group, groupedRecommendations[group] || [])
          )}
        </Accordion>
      </div>
    );
  };

  return (
    <div className="space-y-0">
      <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold">
          Recomendaciones de IA ({isLoading ? '...' : getFilteredRecommendations.length})
          {specificFilter && (
            <span className="text-sm font-normal opacity-90 ml-2">
              • Filtrado por {specificFilter.type === 'campaign' ? 'Campaña' : specificFilter.type === 'adgroup' ? 'Grupo de Anuncios' : 'Anuncio'}: {specificFilter.name}
            </span>
          )}
        </h2>
      </div>
      
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-0">
          <div className="border-b bg-gray-50 overflow-x-auto">
            <div className="flex min-w-max">
              <button
                onClick={() => setMainTab("pending")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  mainTab === "pending"
                    ? "border-blue-500 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                📋 Recomendaciones pendientes
              </button>
              <button
                onClick={() => setMainTab("applied")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  mainTab === "applied"
                    ? "border-blue-500 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                ✅ Historial de aplicadas
              </button>
            </div>
          </div>

          <div className="p-6">
            {mainTab === "pending" && (
              <div className="space-y-6">
                {renderRecommendationsList()}
              </div>
            )}
            
            {mainTab === "applied" && (
              <AppliedRecommendationsHistory customerId={Number(accountId)} />
            )}
          </div>
        </CardContent>

        <RecommendationDetailModal />
      </Card>
    </div>
  );
};

export default RecommendationsPanel;
