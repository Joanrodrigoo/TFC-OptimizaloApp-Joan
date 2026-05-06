import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { formatCurrency, formatDateForAPI } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdGroupsListProps {
  accountId: string;
  campaignId: string;
  campaignName?: string;
  dateRange: { from: Date; to: Date };
  onAdGroupSelect?: (adGroupId: string, adGroupName: string) => void;
}

interface AdGroup {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  bid?: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  qualityScore: number | null;
}

interface ApiAdGroupData {
  id?: string;
  ad_group_id?: string;
  ad_group_name: string;
  name?: string;
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
  bid?: string | number;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  conversions?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  average_cpc?: string | number;
  average_cpc_micros?: string | number;
  cost?: string | number;
  qualityScore?: string | number;
}

interface ApiError extends Error {
  status?: number;
}

type SortField = keyof AdGroup;
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 10;
const TIMEOUT_MS = 30000;

// Mapeo de estados de grupos de anuncios
const AdGroupStatusMap: Record<string, string> = {
  "0": "UNSPECIFIED",
  "1": "UNKNOWN", 
  "2": "ENABLED",
  "3": "PAUSED",
  "4": "REMOVED"
};

const AdGroupsList = ({ 
  accountId, 
  campaignId, 
  campaignName = "",
  dateRange, 
  onAdGroupSelect 
}: AdGroupsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isMobile = useIsMobile();

  // Reset página cuando cambia el término de búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Función para crear AbortController con timeout
  const createTimeoutController = (timeoutMs: number = TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeoutId };
  };

  // Función para manejar errores
  const handleApiError = (error: ApiError, context: string) => {
    console.error(`Error en ${context}:`, error);

    if (error.name === "AbortError") {
      return `Timeout: ${context} tardó demasiado en responder`;
    }
    if (error.status === 504) {
      return `Gateway timeout: ${context} no disponible temporalmente`;
    }
    if (error.status === 500) {
      return `Error del servidor en ${context}`;
    }
    return error.message || `Error desconocido en ${context}`;
  };

  // Función para cargar grupos de anuncios
  const loadAdGroups = useCallback(async () => {
    if (!campaignId) return;

    setLoading(true);
    setError(null);

    const { controller, timeoutId } = createTimeoutController();

    try {
      const fromDate = formatDateForAPI(dateRange.from);
      const toDate = formatDateForAPI(dateRange.to);
      
      const url = `/api/campaigns/${campaignId}/ad-groups?from=${fromDate}&to=${toDate}`;
      console.log("🔄 Cargando grupos de anuncios:", url);

      const res = await fetch(url, {
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const rawData = await res.json();
      console.log("✅ Grupos de anuncios recibidos:", rawData?.length || 0);

      if (!Array.isArray(rawData)) {
        throw new Error("Formato de datos inválido para grupos de anuncios");
      }

      const mappedAdGroups: AdGroup[] = rawData.map((adGroup: ApiAdGroupData) => ({
        id: adGroup.id || adGroup.ad_group_id || "",
        name: adGroup.ad_group_name || adGroup.name || "Grupo sin nombre",
        campaignId: adGroup.campaign_id || campaignId,
        campaignName: adGroup.campaign_name || campaignName,
        status: AdGroupStatusMap[String(adGroup.status)] || "UNKNOWN",
        bid: adGroup.bid ? parseFloat(String(adGroup.bid)) : null, 
        spend: parseFloat(String(adGroup.cost || adGroup.spend || "0")), 
        impressions: parseInt(String(adGroup.impressions || "0")),
        clicks: parseInt(String(adGroup.clicks || "0")),
        conversions: parseFloat(String(adGroup.conversions || "0")),
        ctr: parseFloat(String(adGroup.ctr || "0")),
        cpc: parseFloat(String(adGroup.average_cpc || adGroup.cpc || "0")),
        qualityScore: adGroup.qualityScore ? parseInt(String(adGroup.qualityScore)) : null,
      }));

      setAdGroups(mappedAdGroups);
      console.log("✅ Grupos de anuncios procesados:", mappedAdGroups.length);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const errorMessage = handleApiError(apiError, "cargar grupos de anuncios");
      setError(errorMessage);
      setAdGroups([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [campaignId, campaignName, dateRange]);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (campaignId && dateRange.from && dateRange.to) {
      loadAdGroups();
    }
  }, [campaignId, dateRange, loadAdGroups]);

  // Función de ordenamiento
  const sortData = (data: AdGroup[]): AdGroup[] => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Manejar valores null/undefined
      if (aVal == null && bVal != null) return 1;
      if (aVal != null && bVal == null) return -1;
      if (aVal == null && bVal == null) return 0;

      // Comparación numérica
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Comparación de strings
      if (typeof aVal === "string" && typeof bVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Función de paginación
  const getPaginatedData = (data: AdGroup[]) => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      paginatedData,
      totalPages,
      startIndex,
      endIndex: Math.min(endIndex, totalItems)
    };
  };

  // Funciones de utilidad
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ENABLED":
        return <Badge className="bg-green-500">Activo</Badge>;
      case "PAUSED":
        return <Badge variant="outline">Pausado</Badge>;
      case "REMOVED":
        return <Badge variant="destructive">Eliminado</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  const getQualityScoreBadge = (score: number | null) => {
    if (score === null) return <Badge variant="secondary">N/A</Badge>;
    if (score >= 8) return <Badge className="bg-green-500">{score}</Badge>;
    if (score >= 6) return <Badge className="bg-yellow-500">{score}</Badge>;
    return <Badge className="bg-red-500">{score}</Badge>;
  };

  const handleAdGroupClick = (adGroup: AdGroup) => {
    if (onAdGroupSelect) {
      onAdGroupSelect(adGroup.id, adGroup.name);
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  const PaginationControls = () => {
    const { totalPages } = getPaginatedData(filteredAndSortedAdGroups);
    
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedAdGroups.length);

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {startItem} - {endItem} de {filteredAndSortedAdGroups.length} elementos
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
          </Button>
          <span className="px-4 py-2 text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Siguiente <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const ErrorDisplay = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-red-600 mb-4">
          <p className="font-semibold">Ha ocurrido un error</p>
          <p className="text-sm mt-2">{message}</p>
        </div>
        <div className="space-x-2">
          <Button onClick={onRetry} variant="outline">
            Reintentar
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="ghost"
            size="sm"
          >
            Recargar página
          </Button>
        </div>
      </div>
    </div>
  );

  // Filtrar y ordenar datos
  const filteredAdGroups = adGroups.filter(adGroup => {
    const matchesSearch = (adGroup.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || adGroup.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAndSortedAdGroups = sortData(filteredAdGroups);
  const { paginatedData: paginatedAdGroups } = getPaginatedData(filteredAndSortedAdGroups);

  // Estados de loading y error
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando grupos de anuncios...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadAdGroups} />;
  }

  if (adGroups.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            No se encontraron grupos de anuncios para esta campaña
          </p>
          <Button onClick={loadAdGroups} variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Título en color corporativo */}
      <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold">
          Grupos de Anuncios ({filteredAndSortedAdGroups.length})
          {campaignName && <span className="text-sm font-normal ml-2">- {campaignName}</span>}
        </h2>
      </div>
      
      {/* Filtros y tabla integrados */}
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-6">
          {/* Filtros y búsqueda */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="ENABLED">Activo</SelectItem>
                  <SelectItem value="PAUSED">Pausado</SelectItem>
                  <SelectItem value="REMOVED">Eliminado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar grupos de anuncios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredAndSortedAdGroups.length === 0 ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground text-sm">
                No se encontraron grupos de anuncios con los filtros aplicados
              </p>
            </div>
          ) : isMobile ? (
            // Cards para mobile
            <div className="space-y-3">
              {paginatedAdGroups.map((adGroup) => (
                <Card
                  key={adGroup.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleAdGroupClick(adGroup)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-sm">{adGroup.name}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex gap-2 mb-3">
                      {getStatusBadge(adGroup.status)}
                      {getQualityScoreBadge(adGroup.qualityScore)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Puja:</span>
                        <div className="font-medium">{formatCurrency(adGroup.bid ?? 0)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gasto:</span>
                        <div className="font-medium">{formatCurrency(adGroup.spend)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Impresiones:</span>
                        <div className="font-medium">{adGroup.impressions.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clics:</span>
                        <div className="font-medium">{adGroup.clicks.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CTR:</span>
                        <div className="font-medium">{(adGroup.ctr || 0).toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CPC:</span>
                        <div className="font-medium">{formatCurrency(adGroup.cpc || 0)}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground">Conversiones</div>
                      <div className="font-medium">{adGroup.conversions || 0}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // Tabla para desktop
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="name">Grupo de Anuncios</SortableHeader>
                    <SortableHeader field="status">Estado</SortableHeader>
                    <SortableHeader field="bid">Puja</SortableHeader>
                    <SortableHeader field="spend">Gasto</SortableHeader>
                    <SortableHeader field="impressions">Impresiones</SortableHeader>
                    <SortableHeader field="clicks">Clics</SortableHeader>
                    <SortableHeader field="ctr">CTR</SortableHeader>
                    <SortableHeader field="cpc">CPC</SortableHeader>
                    <SortableHeader field="conversions">Conversiones</SortableHeader>
                    <SortableHeader field="qualityScore">Quality Score</SortableHeader>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAdGroups.map((adGroup) => (
                    <TableRow
                      key={adGroup.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleAdGroupClick(adGroup)}
                    >
                      <TableCell className="font-medium">{adGroup.name}</TableCell>
                      <TableCell>{getStatusBadge(adGroup.status)}</TableCell>
                      <TableCell>{formatCurrency(adGroup.bid ?? 0)}</TableCell>
                      <TableCell>{formatCurrency(adGroup.spend)}</TableCell>
                      <TableCell>{adGroup.impressions.toLocaleString()}</TableCell>
                      <TableCell>{adGroup.clicks.toLocaleString()}</TableCell>
                      <TableCell>{(adGroup.ctr || 0).toFixed(1)}%</TableCell>
                      <TableCell>{formatCurrency(adGroup.cpc || 0)}</TableCell>
                      <TableCell>{adGroup.conversions || 0}</TableCell>
                      <TableCell>{getQualityScoreBadge(adGroup.qualityScore)}</TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Controles de paginación */}
          <PaginationControls />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdGroupsList;