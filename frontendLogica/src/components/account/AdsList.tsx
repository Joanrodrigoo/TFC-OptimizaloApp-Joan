import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ExternalLink, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { formatCurrency, formatDateForAPI } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdsListProps {
  accountId: string;
  adGroupId: string;
  adGroupName?: string;
  campaignName?: string;
  dateRange: { from: Date; to: Date };
  onAdSelect?: (ad: Ad) => void;
}

interface Ad {
  id: string;
  adId: string;
  name?: string;
  headline1: string;
  headline2: string;
  headline: string;
  headlines?: string[];
  description: string;
  descriptions?: string[];
  adGroupId: string;
  adGroupName: string;
  status: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cost?: number;
  finalUrl: string;
  adType?: string;
  paths?: string[];
  callouts?: string[];
  sitelinks?: Array<{
    title: string;
    url: string;
  }>;
  images?: Array<{
    type: string;
    url: string;
  }>;
  videos?: Array<{
    type: string;
    url: string;
  }>;
}

interface ApiAdData {
  id?: string;
  ad_id?: string;
  name?: string;
  ad_name?: string;
  ad_headline?: string;
  description: string;
  headline_2?: string;
  ad_group_id: string;
  adGroupName?: string;
  ad_group_name?: string;
  status?: string;
  impressions?: string;
  clicks?: string;
  conversions?: string;
  ctr?: string;
  average_cpc?: number;
  cost?: number;
  finalUrl?: string;
  final_url?: string;
  ad_type?: string;
  paths?: string[];
  callouts?: string[];
  sitelinks?: Array<{
    title: string;
    url: string;
  }>;
  images?: Array<{
    type: string;
    url: string;
  }>;
  videos?: Array<{
    type: string;
    url: string;
  }>;
  headlines?: string[];
  descriptions?: string[];
}

interface ApiError extends Error {
  status?: number;
}

type SortField = keyof Ad;
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 10;
const TIMEOUT_MS = 30000;

const AdsList = ({ 
  accountId, 
  adGroupId, 
  adGroupName = "",
  campaignName = "",
  dateRange, 
  onAdSelect 
}: AdsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("headline1");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [ads, setAds] = useState<Ad[]>([]);
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

  // Función para cargar anuncios
  const loadAds = useCallback(async () => {
    if (!adGroupId) return;

    setLoading(true);
    setError(null);

    const { controller, timeoutId } = createTimeoutController();

    try {
      const fromDate = formatDateForAPI(dateRange.from);
      const toDate = formatDateForAPI(dateRange.to);
      
      const url = `/api/ad-groups/${adGroupId}/ads?from=${fromDate}&to=${toDate}`;
      console.log("🔄 Cargando anuncios:", url);

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
      console.log("✅ Anuncios recibidos:", rawData?.length || 0);

      if (!Array.isArray(rawData)) {
        throw new Error("Formato de datos inválido para anuncios");
      }

      const mappedAds: Ad[] = rawData.map((ad: ApiAdData) => {
        let headlines = [];
        let descriptions = [];
        
        try {
          if (ad.ad_headline) {
            const parsed = JSON.parse(ad.ad_headline);
            if (Array.isArray(parsed)) headlines = parsed;
          }
        } catch (e) {
          console.warn("No se pudo parsear ad_headline:", ad.ad_headline);
        }

        try {
          if (ad.description) {
            const parsed = JSON.parse(ad.description);
            if (Array.isArray(parsed)) descriptions = parsed;
          }
        } catch (e) {
          console.warn("No se pudo parsear ad_description:", ad.description);
        }

        return {
          id: ad.id || ad.ad_id || "",
          adId: ad.id || ad.ad_id || "",
          name: ad.name || ad.ad_name || "",
          headline: headlines[0] || "",
          headline1: headlines[0] || "",
          headline2: headlines[1] || "",
          headlines: headlines,
          description: descriptions[0] || "",
          descriptions: descriptions,
          adGroupId: ad.ad_group_id,
          adGroupName: ad.adGroupName || ad.ad_group_name || adGroupName,
          status: ad.status || "UNKNOWN",
          impressions: parseInt(ad.impressions || "0"),
          clicks: parseInt(ad.clicks || "0"),
          conversions: parseFloat(ad.conversions || "0"),
          ctr: parseFloat(ad.ctr || "0"),
          cpc: ad.average_cpc || 0,
          cost: ad.cost || 0,
          finalUrl: ad.finalUrl || ad.final_url || "",
          adType: ad.ad_type || "",
          paths: ad.paths || [],
          callouts: ad.callouts || [],
          sitelinks: ad.sitelinks || [],
          images: ad.images || [],
          videos: ad.videos || [],
        };
      });

      setAds(mappedAds);
      console.log("✅ Anuncios procesados:", mappedAds.length);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const errorMessage = handleApiError(apiError, "cargar anuncios");
      setError(errorMessage);
      setAds([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [adGroupId, adGroupName, dateRange]);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (adGroupId && dateRange.from && dateRange.to) {
      loadAds();
    }
  }, [adGroupId, dateRange, loadAds]);

  // Función de ordenamiento
  const sortData = (data: Ad[]): Ad[] => {
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
  const getPaginatedData = (data: Ad[]) => {
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

  const handleAdClick = (ad: Ad) => {
    if (onAdSelect) {
      onAdSelect(ad);
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
    const { totalPages } = getPaginatedData(filteredAndSortedAds);
    
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedAds.length);

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {startItem} - {endItem} de {filteredAndSortedAds.length} elementos
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
  const filteredAds = ads.filter(ad => {
    const matchesSearch = (ad.headline1 || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ad.headline2 || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ad.name && ad.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ad.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || ad.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAndSortedAds = sortData(filteredAds);
  const { paginatedData: paginatedAds } = getPaginatedData(filteredAndSortedAds);

  // Estados de loading y error
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando anuncios...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadAds} />;
  }

  if (ads.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            No se encontraron anuncios para este grupo de anuncios
          </p>
          <Button onClick={loadAds} variant="outline">
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
          Anuncios ({filteredAndSortedAds.length})
          {adGroupName && <span className="text-sm font-normal ml-2">- {adGroupName}</span>}
          {campaignName && <span className="text-xs font-normal block mt-1">{campaignName}</span>}
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
                placeholder="Buscar anuncios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredAndSortedAds.length === 0 ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground text-sm">
                No se encontraron anuncios con los filtros aplicados
              </p>
            </div>
          ) : isMobile ? (
            // Cards para mobile
            <div className="space-y-3">
              {paginatedAds.map((ad) => (
                <Card
                  key={ad.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleAdClick(ad)}
                >
                  <CardContent className="p-4">
                    <div className="mb-3">
                      <div className="font-medium text-blue-600 text-sm mb-1">
                        {ad.headline1}
                      </div>
                      <div className="font-medium text-blue-600 text-sm mb-2">
                        {ad.headline2}
                      </div>
                      {ad.description && (
                        <div className="text-xs text-muted-foreground">
                          {ad.description}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mb-3">
                      {getStatusBadge(ad.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Impresiones:</span>
                        <div className="font-medium">{ad.impressions.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clics:</span>
                        <div className="font-medium">{ad.clicks.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CTR:</span>
                        <div className="font-medium">{(ad.ctr || 0).toFixed(1)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CPC:</span>
                        <div className="font-medium">{formatCurrency(ad.cpc || 0)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Conversiones:</span>
                        <div className="font-medium">{ad.conversions || 0}</div>
                      </div>
                      {ad.finalUrl && (
                        <div>
                          <span className="text-muted-foreground">URL:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-auto p-0 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={ad.finalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      )}
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
                    <TableHead className="w-[300px]">Anuncio</TableHead>
                    <SortableHeader field="status">Estado</SortableHeader>
                    <SortableHeader field="impressions">Impresiones</SortableHeader>
                    <SortableHeader field="clicks">Clics</SortableHeader>
                    <SortableHeader field="ctr">CTR</SortableHeader>
                    <SortableHeader field="cpc">CPC</SortableHeader>
                    <SortableHeader field="conversions">Conversiones</SortableHeader>
                    <TableHead>URL Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAds.map((ad) => (
                    <TableRow
                      key={ad.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleAdClick(ad)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          {ad.name && (
                            <div className="font-medium text-blue-600">
                              {ad.name}
                            </div>
                          )}
                          <div className="font-medium text-blue-600">
                            {ad.headline1}
                          </div>
                          {ad.headline2 && (
                            <div className="font-medium text-blue-600">
                              {ad.headline2}
                            </div>
                          )}
                          {ad.description && (
                            <div className="text-sm text-muted-foreground">
                              {ad.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(ad.status)}</TableCell>
                      <TableCell>{ad.impressions.toLocaleString()}</TableCell>
                      <TableCell>{ad.clicks.toLocaleString()}</TableCell>
                      <TableCell>{(ad.ctr || 0).toFixed(1)}%</TableCell>
                      <TableCell>{formatCurrency(ad.cpc || 0)}</TableCell>
                      <TableCell>{ad.conversions || 0}</TableCell>
                      <TableCell>
                        {ad.finalUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={ad.finalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
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

export default AdsList;