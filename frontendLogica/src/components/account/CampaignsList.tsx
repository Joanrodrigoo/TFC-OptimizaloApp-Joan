import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { formatCurrency, formatDateForAPI } from "@/lib/utils";
import { getCampaignMetricsByCustomer } from "@/services/api";
import { CampaignStatusMap, AdvertisingChannelTypeMap } from "@/types/index";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@radix-ui/react-select";

interface CampaignWithMetrics extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
  type: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
}

interface ApiCampaignData {
  campaign_id: string;
  campaign_name?: string;
  campaign_status: string;
  campaign_type: string;
  budget_micros?: string;
  cost_micros?: string;
  impressions?: string;
  clicks?: string;
  conversions?: string;
  ctr?: string;
  cost_per_conversion_micros?: string;
  average_cpc_micros?: string;
}

interface ApiError extends Error {
  status?: number;
}

interface CampaignsListProps {
  accountId: string;
  dateRange: { from: Date; to: Date };
  onCampaignSelect: (campaignId: string, campaignName: string) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

type SortField = keyof CampaignWithMetrics;
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 10;
const TIMEOUT_MS = 30000;

const CampaignsList = ({
  accountId,
  dateRange,
  onCampaignSelect,
  searchTerm = "",
  onSearchChange,
}: CampaignsListProps) => {
  const [internalSearchTerm, setInternalSearchTerm] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
const [statusFilter, setStatusFilter] = useState<string>("all");
const [typeFilter, setTypeFilter] = useState<string>("all");
  const isMobile = useIsMobile();

  const activeSearchTerm = onSearchChange ? searchTerm : internalSearchTerm;

  const convertMicrosToEuros = useCallback(
    (micros: string | number | null | undefined): number => {
      if (micros === null || micros === undefined || isNaN(Number(micros)))
        return 0;
      return Number(micros) / 1_000_000;
    },
    []
  );

  const createTimeoutController = (timeoutMs: number = TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeoutId };
  };

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

  const loadCampaignMetrics = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    setError(null);

    const { controller, timeoutId } = createTimeoutController();

    try {
      const fromDate = formatDateForAPI(dateRange.from);
      const toDate = formatDateForAPI(dateRange.to);

      console.log(`📊 Cargando métricas de campañas para: ${fromDate} a ${toDate}`);

      const data = await getCampaignMetricsByCustomer(
        accountId,
        fromDate,
        toDate
      );

      console.log("📊 Datos de campañas recibidos:", data?.length || 0);

      if (!data || !Array.isArray(data)) {
        throw new Error("No se recibieron datos válidos de campañas");
      }

      const mappedCampaigns: CampaignWithMetrics[] = data.map(
        (campaign: ApiCampaignData) => ({
          id: campaign.campaign_id,
          name: campaign.campaign_name || "Campaña sin nombre",
          status: CampaignStatusMap[campaign.campaign_status] ?? "UNKNOWN",
          type:
            AdvertisingChannelTypeMap[campaign.campaign_type] ?? "UNSPECIFIED",
          budget: convertMicrosToEuros(campaign.budget_micros || "0"),
          spend: parseFloat(campaign.cost_micros || "0"),
          impressions: parseInt(campaign.impressions || "0"),
          clicks: parseInt(campaign.clicks || "0"),
          conversions: parseFloat(campaign.conversions || "0"),
          ctr: parseFloat(campaign.ctr || "0"),
          cpc: parseFloat(campaign.cost_per_conversion_micros || "0"),
        })
      );

      setCampaigns(mappedCampaigns);
      console.log("✅ Campañas cargadas exitosamente:", mappedCampaigns.length);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const errorMessage = handleApiError(apiError, "cargar campañas");
      setError(errorMessage);
      setCampaigns([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [accountId, dateRange, convertMicrosToEuros]);

  useEffect(() => {
    if (accountId && dateRange.from && dateRange.to) {
      loadCampaignMetrics();
    }
  }, [accountId, dateRange.from, dateRange.to, loadCampaignMetrics]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  const sortCampaigns = useCallback(
    (
      campaigns: CampaignWithMetrics[],
      sortField?: keyof CampaignWithMetrics,
      sortDirection: "asc" | "desc" = "asc"
    ): CampaignWithMetrics[] => {
      return [...campaigns].sort((a, b) => {
        if (sortField) {
          const aValue = a[sortField];
          const bValue = b[sortField];
          if (aValue == null && bValue != null) return 1;
          if (aValue != null && bValue == null) return -1;
          if (aValue == null && bValue == null) return 0;
          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
          }
          return sortDirection === "asc"
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue));
        }

        // Orden por defecto: estado
        const statusPriority: Record<string, number> = {
          ENABLED: 0,
          PAUSED: 1,
          REMOVED: 2,
        };
        const aStatusPriority =
          statusPriority[a.status as keyof typeof statusPriority] ?? 3;
        const bStatusPriority =
          statusPriority[b.status as keyof typeof statusPriority] ?? 3;
        if (aStatusPriority !== bStatusPriority) {
          return aStatusPriority - bStatusPriority;
        }

        if ((b.impressions ?? 0) !== (a.impressions ?? 0)) {
          return (b.impressions ?? 0) - (a.impressions ?? 0);
        }

        return (b.ctr ?? 0) - (a.ctr ?? 0);
      });
    },
    []
  );

  const getPaginatedData = <T,>(
    data: T[],
    currentPage: number
  ): {
    paginatedData: T[];
    totalPages: number;
    startIndex: number;
    endIndex: number;
  } => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      paginatedData,
      totalPages,
      startIndex,
      endIndex: Math.min(endIndex, totalItems),
    };
  };

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

  const getTypeBadge = (type: string) => {
    const typeStyles = {
      SEARCH: "bg-blue-100 text-blue-800",
      DISPLAY: "bg-purple-100 text-purple-800",
      SHOPPING: "bg-green-100 text-green-800",
      VIDEO: "bg-red-100 text-red-800",
      PERFORMANCE_MAX: "bg-cyan-100 text-cyan-800",
    };

    const style = typeStyles[type as keyof typeof typeStyles];

    return (
      <Badge className={style || "bg-gray-100 text-gray-800"}>
        {type.replace(/_/g, " ")}
      </Badge>
    );
  };

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setInternalSearchTerm(value);
    }
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
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

  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage = ITEMS_PER_PAGE,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage?: number;
  }) => {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
        <div className="text-sm text-muted-foreground">
          Mostrando {startItem} - {endItem} de {totalItems} elementos
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
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
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Siguiente <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const ErrorDisplay = ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando campañas...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadCampaignMetrics} />;
  }

const filteredCampaigns = campaigns.filter((campaign) => {
  const matchesSearch = campaign.name.toLowerCase().includes(activeSearchTerm.toLowerCase());
  const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
  const matchesType = typeFilter === "all" || campaign.type === typeFilter;
  
  return matchesSearch && matchesStatus && matchesType;
});

  const sortedCampaigns = sortCampaigns(filteredCampaigns, sortField, sortOrder);
  const { paginatedData: paginatedCampaigns, totalPages } = getPaginatedData(
    sortedCampaigns,
    currentPage
  );

  return (
    <div className="space-y-0">
      {/* Título en color corporativo */}
      <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold">Campañas</h2>
      </div>
      
      {/* Filtros y tabla integrados */}
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-6">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Cargando campañas...</span>
            </div>
          )}

          {error && (
            <ErrorDisplay message={error} onRetry={loadCampaignMetrics} />
          )}

          {!loading && !error && (
            <>
              {/* Filtros y búsqueda */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex gap-2 flex-wrap">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="ENABLED">Activa</SelectItem>
                      <SelectItem value="PAUSED">Pausada</SelectItem>
                      <SelectItem value="REMOVED">Eliminada</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      <SelectItem value="SEARCH">Search</SelectItem>
                      <SelectItem value="DISPLAY">Display</SelectItem>
                      <SelectItem value="SHOPPING">Shopping</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="PERFORMANCE_MAX">Performance Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar campañas..."
                    value={activeSearchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {isMobile ? (
                <div className="space-y-3">
                  {paginatedCampaigns.map((campaign) => (
                    <Card
                      key={campaign.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onCampaignSelect(campaign.id, campaign.name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-medium text-sm">{campaign.name}</h3>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex gap-2 mb-3">
                          {getStatusBadge(campaign.status)}
                          {getTypeBadge(campaign.type)}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Presupuesto:</span>
                            <div className="font-medium">
                              {formatCurrency(campaign.budget)}/día
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Gasto:</span>
                            <div className="font-medium">
                              {formatCurrency(campaign.spend)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Impresiones:</span>
                            <div className="font-medium">
                              {campaign.impressions.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Clics:</span>
                            <div className="font-medium">
                              {campaign.clicks.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">CTR:</span>
                            <div className="font-medium">{campaign.ctr.toFixed(2)}%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">CPC:</span>
                            <div className="font-medium">{formatCurrency(campaign.cpc)}</div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground">Conversiones</div>
                          <div className="font-medium">{campaign.conversions}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <SortableHeader field="name">Campaña</SortableHeader>
                        <SortableHeader field="status">Estado</SortableHeader>
                        <SortableHeader field="type">Tipo</SortableHeader>
                        <SortableHeader field="budget">Presupuesto</SortableHeader>
                        <SortableHeader field="spend">Gasto</SortableHeader>
                        <SortableHeader field="impressions">Impresiones</SortableHeader>
                        <SortableHeader field="clicks">Clics</SortableHeader>
                        <SortableHeader field="ctr">CTR</SortableHeader>
                        <SortableHeader field="cpc">CPC</SortableHeader>
                        <SortableHeader field="conversions">Conversiones</SortableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCampaigns.map((campaign) => (
                        <React.Fragment key={campaign.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCampaign(
                                    expandedCampaign === campaign.id ? null : campaign.id
                                  );
                                }}
                              >
                                {expandedCampaign === campaign.id ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell 
                              className="font-medium cursor-pointer"
                              onClick={() => onCampaignSelect(campaign.id, campaign.name)}
                            >
                              {campaign.name}
                            </TableCell>
                            <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                            <TableCell>{getTypeBadge(campaign.type)}</TableCell>
                            <TableCell>{formatCurrency(campaign.budget)}/día</TableCell>
                            <TableCell>{formatCurrency(campaign.spend)}</TableCell>
                            <TableCell>{campaign.impressions.toLocaleString()}</TableCell>
                            <TableCell>{campaign.clicks.toLocaleString()}</TableCell>
                            <TableCell>{campaign.ctr.toFixed(2)}%</TableCell>
                            <TableCell>{formatCurrency(campaign.cpc)}</TableCell>
                            <TableCell>{campaign.conversions}</TableCell>
                          </TableRow>
                          
                          {expandedCampaign === campaign.id && (
                            <TableRow>
                              <TableCell colSpan={11} className="bg-muted/30">
                                <div className="p-4">
                                  <h4 className="font-medium mb-2">Detalles de la campaña</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium">Tasa de conversión:</span>
                                      <p>{campaign.clicks > 0 ? ((campaign.conversions / campaign.clicks) * 100).toFixed(2) : 0}%</p>
                                    </div>
                                    <div>
                                      <span className="font-medium">Coste por conversión:</span>
                                      <p>{campaign.conversions > 0 ? formatCurrency(campaign.spend / campaign.conversions) : "N/A"}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium">Presupuesto utilizado:</span>
                                      <p>{campaign.budget > 0 ? Math.round((campaign.spend / campaign.budget) * 100) : 0}%</p>
                                    </div>
                                    <div>
                                      <span className="font-medium">Estado optimización:</span>
                                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                        Revisión requerida
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={sortedCampaigns.length}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignsList;