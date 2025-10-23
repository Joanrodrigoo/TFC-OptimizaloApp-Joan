import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Recomendacion } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterPopover } from "@/components/ui/filter-popover";
import { fetchRecomendaciones } from "@/services/api";
import { applyRecommendation } from '@/services/api';
import { fetchAppliedRecommendations } from "@/services/api";

import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { AlertTriangle, TrendingUp, Lightbulb, Eye, CheckCircle, Loader2, RefreshCw } from "lucide-react";

interface RecommendationsProps {
  accountId: string;
  navigation: {
    level: 'campaigns' | 'adgroups' | 'ads';
    selectedCampaign?: string;
    selectedAdGroup?: string;
  };
  specificFilter?: {
    type: 'campaign' | 'adgroup' | 'ad';
    id: string;
    name: string;
  } | null;
}

type Priority = "alta" | "media" | "baja";
type Category = "pujas" | "anuncios" | "keywords" | "landing_pages" | "segmentacion" | "presupuesto" | "search_terms";

interface AppliedRecommendation extends Recomendacion {
  appliedDate: string;
  result: {
    status: "improved" | "no_change" | "worsened";
    actualImprovement: string;
    comparisonPeriod: string;
    kpiVariation: number;
  };
}

const RecommendationsPanel = ({ accountId, navigation, specificFilter }: RecommendationsProps) => {
  const [mainTab, setMainTab] = useState<string>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [appliedRecommendations, setAppliedRecommendations] = useState<AppliedRecommendation[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recomendacion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [applyingIds, setApplyingIds] = useState<Set<number>>(new Set());
  
  const [allRecommendations, setAllRecommendations] = useState<Recomendacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const [isLoadingApplied, setIsLoadingApplied] = React.useState(false);
  const [errorApplied, setErrorApplied] = React.useState<string | null>(null);

  const itemsPerPage = 5;

const fetchRecommendations = useCallback(async () => {
  try {
    setIsLoading(true);
    setError(null);

    const data = await fetchRecomendaciones(Number(accountId));

    setAllRecommendations(data);
    setLastFetch(new Date());
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error al cargar recomendaciones';
    setError(errorMessage);
    console.error('Error fetching recommendations:', err);
  } finally {
    setIsLoading(false);
  }
}, [accountId]);

 const fetchApplied = useCallback(async () => {
  try {
    setIsLoadingApplied(true);
    setErrorApplied(null);
    const data = await fetchAppliedRecommendations(Number(accountId));
    const appliedData: AppliedRecommendation[] = data.map(rec => ({
      ...rec,
      appliedDate: rec.fecha_aplicacion ?? new Date().toISOString(),
      result: {
        actualImprovement: 'N/A', 
        status: 'no_change',      
        comparisonPeriod: 'last_30_days', 
        kpiVariation: 0,
      }
    }));
    setAppliedRecommendations(appliedData);
  } catch (err) {
    setErrorApplied(err instanceof Error ? err.message : 'Error al cargar recomendaciones aplicadas');
  } finally {
    setIsLoadingApplied(false);
  }
}, [accountId]); 

  useEffect(() => {
    if (accountId) {
      fetchRecommendations();
    }
  }, [accountId, fetchRecommendations]);

  useEffect(() => {
    if (accountId) {
      fetchApplied();
    }
  }, [accountId, fetchApplied]);

  const handleRefresh = () => {
    fetchRecommendations();
  };

const getFilteredRecommendations = useMemo(() => {
  console.log("Navigation state:", navigation);
  console.log("Specific filter:", specificFilter);
  console.log("All recommendations:", allRecommendations.length);
  
  return allRecommendations.filter(rec => {
    // Si hay un filtro específico, aplicarlo primero
    if (specificFilter) {
      const matchesType = rec.tipo_objeto === specificFilter.type || 
                         (specificFilter.type === 'adgroup' && rec.tipo_objeto === 'ad_group');
      const matchesId = rec.objeto_id?.toString() === specificFilter.id;
      
      return matchesType && matchesId;
    }
    
    // Si no hay filtro específico, usar la navegación normal
    if (navigation.level === 'campaigns') {
      return true;
    }
    
    if (navigation.level === 'adgroups' && navigation.selectedCampaign) {
      const isCampaignRec = rec.tipo_objeto === 'campaign' && 
                           rec.objeto_id?.toString() === navigation.selectedCampaign;
      
      const isAdGroupRec = rec.tipo_objeto === 'ad_group';
      
      return isCampaignRec || isAdGroupRec;
    }
    
    if (navigation.level === 'ads' && navigation.selectedAdGroup) {
      const isAdGroupRec = rec.tipo_objeto === 'ad_group' && 
                          rec.objeto_id?.toString() === navigation.selectedAdGroup;
      
      const isAdRec = rec.tipo_objeto === 'ad';
      
      return isAdGroupRec || isAdRec;
    }
    
    return true;
  });
}, [allRecommendations, navigation, specificFilter]);

const getFilteredAppliedRecommendations = useMemo(() => {
  return appliedRecommendations.filter(rec => {
    if (navigation.level === 'campaigns') {
      return true;
    }
    
    if (navigation.level === 'adgroups' && navigation.selectedCampaign) {
      const isCampaignRec = rec.tipo_objeto === 'campaign' && 
                           rec.objeto_id?.toString() === navigation.selectedCampaign;
      const isAdGroupRec = rec.tipo_objeto === 'ad_group';
      return isCampaignRec || isAdGroupRec;
    }
    
    if (navigation.level === 'ads' && navigation.selectedAdGroup) {
      const isAdGroupRec = rec.tipo_objeto === 'ad_group' && 
                          rec.objeto_id?.toString() === navigation.selectedAdGroup;
      const isAdRec = rec.tipo_objeto === 'ad';
      return isAdGroupRec || isAdRec;
    }
    
    return true;
  });
}, [appliedRecommendations, navigation]);

  const availableCategories = useMemo(() => {
    const categories = new Set(getFilteredRecommendations.map(rec => rec.categoria));
    return Array.from(categories).sort();
  }, [getFilteredRecommendations]);

  const availablePriorities = useMemo(() => {
    const priorities = new Set(getFilteredRecommendations.map(rec => rec.prioridad));
    return Array.from(priorities).sort((a, b) => {
      const order: Record<string, number> = { alta: 1, media: 2, baja: 3 };
      return (order[a] || 99) - (order[b] || 99);
    });
  }, [getFilteredRecommendations]);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "alta":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "media":
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case "baja":
        return <Lightbulb className="h-4 w-4" style={{ color: '#12BAA9' }} />;
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
        return "text-white border-[#12BAA9]" + " bg-[#12BAA9]";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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

  const filterRecommendations = () => {
    let filtered = getFilteredRecommendations;
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter(rec => rec.categoria === categoryFilter);
    }
    
    if (priorityFilter !== "all") {
      filtered = filtered.filter(rec => rec.prioridad === priorityFilter);
    }
    
    return filtered.sort((a, b) => {
      const priorityOrder: Record<string, number> = { alta: 3, media: 2, baja: 1 };
      return (priorityOrder[b.prioridad] || 0) - (priorityOrder[a.prioridad] || 0);
    });
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

      const appliedRec: AppliedRecommendation = {
        ...recommendation,
        appliedDate: new Date().toISOString(),
        result: {
          status: "improved",
          actualImprovement: recommendation.impacto_estimado,
          comparisonPeriod: "7 días",
          kpiVariation: 12.3
        }
      };

      setAppliedRecommendations(prev => [appliedRec, ...prev]);
      
      setAllRecommendations(prev => 
        prev.filter(r => r.id !== recommendationId)
      );

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
    <div className="text-center py-8">
      <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-400" />
      <p className="text-red-600 font-medium mb-2">Error al cargar recomendaciones</p>
      <p className="text-gray-600 text-sm mb-4">{error}</p>
      <Button onClick={handleRefresh} variant="outline" size="sm">
        <RefreshCw className="h-4 w-4 mr-2" />
        Reintentar
      </Button>
    </div>
  );

  const renderLoading = () => (
    <div className="text-center py-8">
      <Loader2 className="h-12 w-12 mx-auto mb-3 animate-spin" style={{ color: '#12BAA9' }} />
      <p className="text-gray-600">Cargando recomendaciones...</p>
      <p className="text-sm text-gray-400 mt-1">Analizando tu cuenta con IA</p>
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
                <p className="text-gray-600">{selectedRecommendation.tipo_objeto}</p>
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
              style={{ backgroundColor: '#12BAA9', borderColor: '#12BAA9' }}
              className="text-white hover:opacity-90"
            >
              {selectedRecommendation.estado === 'aplicada' ? 'Ya aplicada' : 'Aplicar recomendación'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const AppliedRecommendationsHistory = ({ recommendations }: { recommendations: AppliedRecommendation[] }) => {
    if (isLoadingApplied) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" style={{ color: '#12BAA9' }} />
          <p className="text-gray-600">Cargando historial...</p>
        </div>
      );
    }

    if (errorApplied) {
      return (
        <div className="text-center py-8">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-red-400" />
          <p className="text-red-600 font-medium mb-2">Error al cargar historial</p>
          <p className="text-gray-600 text-sm">{errorApplied}</p>
        </div>
      );
    }

    if (recommendations.length === 0) {
      return (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600">No hay recomendaciones aplicadas</p>
          <p className="text-sm text-gray-400">Las recomendaciones aplicadas aparecerán aquí</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {recommendations.map((rec) => (
          <div key={rec.id} className="bg-gray-50 border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-gray-900">{rec.titulo}</h4>
              <Badge variant="outline" className="text-xs">
                {rec.fecha_aplicacion ? 
                  new Date(rec.fecha_aplicacion).toLocaleDateString() : 
                  new Date(rec.appliedDate).toLocaleDateString()
                }
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">{rec.descripcion}</p>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                {rec.result.actualImprovement}
              </Badge>
              <span className="text-xs text-gray-500">
                Estado: {rec.result.status === 'improved' ? 'Mejorado' : 
                        rec.result.status === 'no_change' ? 'Sin cambios' : 'Empeorado'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRecommendationsList = () => {
    if (isLoading) return renderLoading();
    if (error) return renderError();

    const recommendations = filterRecommendations();
    const totalPages = Math.ceil(recommendations.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = recommendations.slice(startIndex, startIndex + itemsPerPage);

    if (recommendations.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="text-muted-foreground mb-4">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No hay recomendaciones para mostrar</p>
            <p className="text-sm">Las recomendaciones aparecerán según los filtros seleccionados</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {currentItems.map((rec) => {
            const recommendationId = rec.id;
            const isApplying = applyingIds.has(recommendationId);
            const isApplied = rec.estado === 'aplicada' || appliedRecommendations.some(applied => 
              applied.id === recommendationId
            );
            
            return (
              <div key={rec.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-all duration-200">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{rec.titulo}</h4>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getCategoryLabel(rec.categoria)}
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs hover:bg-emerald-100">
                        {rec.impacto_estimado}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {getPriorityIcon(rec.prioridad)}
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(rec.prioridad)}`}>
                          {rec.prioridad.charAt(0).toUpperCase() + rec.prioridad.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{rec.descripcion}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full lg:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDetail(rec)}
                      className="text-xs w-full sm:w-auto"
                      disabled={isApplying}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Ver detalle
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleApplyRecommendation(rec)}
                      className="text-xs w-full sm:w-auto text-white hover:opacity-90"
                      style={{ backgroundColor: '#12BAA9', borderColor: '#12BAA9' }}
                      disabled={isApplying || isApplied}
                    >
                      {isApplying ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Aplicando...
                        </>
                      ) : isApplied ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aplicado
                        </>
                      ) : (
                        "Aplicar"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <Pagination className="justify-center">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink 
                    onClick={() => setCurrentPage(i + 1)}
                    isActive={currentPage === i + 1}
                    className="cursor-pointer"
                    style={currentPage === i + 1 ? { backgroundColor: '#12BAA9', borderColor: '#12BAA9', color: 'white' } : {}}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-0">
      <div className="text-primary-foreground px-6 py-4 rounded-t-lg" style={{ backgroundColor: '#12BAA9' }}>
        <h2 className="text-xl font-semibold text-white">
          Recomendaciones de IA ({isLoading ? '...' : getFilteredRecommendations.length})
          <span className="text-sm font-normal opacity-90 ml-2">
            • {getFilteredAppliedRecommendations.length} aplicadas
            {lastFetch && (
              <span className="ml-2 text-xs">
                (Actualizado: {lastFetch.toLocaleTimeString()})
              </span>
            )}
          </span>
        </h2>
        {specificFilter && (
          <p className="text-sm text-white/90 mt-1">
            Filtrando por: {specificFilter.name}
          </p>
        )}
      </div>
      
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-0">
          <div className="border-b bg-gray-50">
            <div className="flex">
              <button
                onClick={() => setMainTab("pending")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  mainTab === "pending"
                    ? "bg-white text-white"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                style={mainTab === "pending" ? { 
                  borderBottomColor: '#12BAA9', 
                  color: '#12BAA9',
                  backgroundColor: 'white'
                } : {}}
              >
                Recomendaciones pendientes
              </button>
              <button
                onClick={() => setMainTab("applied")}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  mainTab === "applied"
                    ? "bg-white text-white"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                style={mainTab === "applied" ? { 
                  borderBottomColor: '#12BAA9', 
                  color: '#12BAA9',
                  backgroundColor: 'white'
                } : {}}
              >
                Historial de aplicadas
              </button>
            </div>
          </div>

          <div className="p-6">
            {mainTab === "pending" && (
              <div className="space-y-6">
                {!isLoading && !error && allRecommendations.length > 0 && (
                  <div className="flex flex-row gap-3 justify-between items-center mb-6">
                    <FilterPopover
                      filters={[
                        {
                          key: 'category',
                          label: 'Categoría',
                          value: categoryFilter,
                          onChange: setCategoryFilter,
                          options: [
                            { value: 'all', label: 'Todas las categorías' },
                            ...availableCategories.map(cat => ({
                              value: cat,
                              label: getCategoryLabel(cat)
                            }))
                          ]
                        },
                        {
                          key: 'priority',
                          label: 'Prioridad',
                          value: priorityFilter,
                          onChange: setPriorityFilter,
                          options: [
                            { value: 'all', label: 'Todas las prioridades' },
                            ...availablePriorities.map(priority => ({
                              value: priority,
                              label: priority.charAt(0).toUpperCase() + priority.slice(1) + ' prioridad'
                            }))
                          ]
                        }
                      ]}
                      onClearAll={() => {
                        setCategoryFilter('all');
                        setPriorityFilter('all');
                      }}
                    />
                  </div>
                )}

                {renderRecommendationsList()}
              </div>
            )}
            
            {mainTab === "applied" && (
              <AppliedRecommendationsHistory recommendations={getFilteredAppliedRecommendations} />
            )}
          </div>
        </CardContent>
      </Card>

      <RecommendationDetailModal />
    </div>
  );
};

export default RecommendationsPanel;