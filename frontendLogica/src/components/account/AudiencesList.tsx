import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { FilterPopover } from "@/components/ui/filter-popover";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Search,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDateForAPI } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface AudiencesListProps {
  accountId: string;
  campaignId?: string;
  adGroupId?: string;
  dateRange: { from: Date; to: Date };
}

interface AudienceSegment {
  id: string;
  customer_id: string;
  campaign_id: string;
  ad_group_id: string;
  segment_type: string;
  segment_value: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cost: number;
  bid_modifier: number;
  date: string;
  created_at: string;
  conversions_value: number;
  value_per_conversion: number;
  conversions_value_per_cost: number;
  all_conversions_value: number;
  all_conversions_value_per_cost: number;
  cost_per_all_conversions: number;
}

const AudiencesList = ({
  accountId,
  campaignId,
  adGroupId,
  dateRange,
}: AudiencesListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const itemsPerPage = 10;
  const isMobile = useIsMobile();

  // Obtener tipos únicos disponibles
  const availableTypes = useMemo(() => {
    const types = new Set(segments.map(s => s.segment_type));
    return Array.from(types).sort();
  }, [segments]);

  // Obtener campañas únicas disponibles
  const availableCampaigns = useMemo(() => {
    const campaigns = new Set(segments.map(s => s.campaign_id));
    return Array.from(campaigns).sort();
  }, [segments]);
    
  const fetchData = async () => {
    if (!campaignId && !adGroupId) return;

    setLoading(true);
    setError(null);

    try {
      let url = "";
      const params = new URLSearchParams();

      if (dateRange.from) {
        params.append("from", formatDateForAPI(dateRange.from));
      }
      if (dateRange.to) {
        params.append("to", formatDateForAPI(dateRange.to));
      }

      if (adGroupId) {
        url = `/api/ad-groups/${adGroupId}/audience-segments?${params.toString()}`;
      } else if (campaignId) {
        url = `/api/campaigns/${campaignId}/audience-segments?${params.toString()}`;
      }

      console.log("Fetching from URL:", url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setSegments(data);
      } else {
        throw new Error("Formato de respuesta inesperado");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setCurrentPage(1);
  }, [accountId, campaignId, adGroupId, dateRange]);

  // Filtrar y ordenar segmentos
  const filteredAndSortedSegments = useMemo(() => {
    const filtered = segments.filter((segment) => {
      const matchesSearch =
        segment.segment_value?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        segment.segment_type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "all" || segment.segment_type === typeFilter;
      const matchesCampaign = campaignFilter === "all" || segment.campaign_id === campaignFilter;
      
      return matchesSearch && matchesType && matchesCampaign;
    });

    // Ordenar por impresiones descendente
    return filtered.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
  }, [segments, searchTerm, typeFilter, campaignFilter]);

  const totalPages = Math.ceil(filteredAndSortedSegments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSegments = filteredAndSortedSegments.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      USER_LIST: "bg-purple-100 text-purple-800",
      USER_INTEREST: "bg-blue-100 text-blue-800",
      AFFINITY: "bg-green-100 text-green-800",
      DEMOGRAPHIC: "bg-orange-100 text-orange-800",
      REMARKETING: "bg-purple-100 text-purple-800",
      SIMILAR: "bg-blue-100 text-blue-800",
      CUSTOM: "bg-gray-100 text-gray-800",
    };

    const labels = {
      USER_LIST: "Remarketing",
      USER_INTEREST: "Intereses",
      AFFINITY: "Afinidad",
      DEMOGRAPHIC: "Demográfico",
      REMARKETING: "Remarketing",
      SIMILAR: "Similar",
      CUSTOM: "Personalizada",
    };

    return (
      <Badge
        variant="outline"
        className={colors[type as keyof typeof colors] || colors.CUSTOM}
      >
        {labels[type as keyof typeof labels] || type}
      </Badge>
    );
  };

  const getTargetingBadge = (targeting: string) => {
    switch (targeting) {
      case "TARGETING":
        return <Badge className="bg-green-500">Segmentación</Badge>;
      case "OBSERVATION":
        return <Badge variant="outline">Observación</Badge>;
      default:
        return <Badge className="bg-green-500">Segmentación</Badge>;
    }
  };

  const getBidAdjustmentBadge = (modifier: number) => {
    const percent = Math.round((modifier - 1) * 100);

    if (percent > 0) {
      return <Badge className="bg-green-500">+{percent}%</Badge>;
    } else if (percent < 0) {
      return <Badge className="bg-red-500">{percent}%</Badge>;
    } else {
      return <Badge variant="outline">0%</Badge>;
    }
  };

  const calculateCPC = (cost: number, clicks: number) => {
    return clicks > 0 ? cost / clicks : 0;
  };

  const getAudienceSize = (impressions: number) => {
    if (impressions > 100000) return "1M - 5M";
    if (impressions > 50000) return "500K - 1M";
    if (impressions > 10000) return "100K - 500K";
    if (impressions > 1000) return "10K - 50K";
    return "< 10K";
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      USER_LIST: "Remarketing",
      USER_INTEREST: "Intereses",
      AFFINITY: "Afinidad",
      DEMOGRAPHIC: "Demográfico",
      REMARKETING: "Remarketing",
      SIMILAR: "Similar",
      CUSTOM: "Personalizada"
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="space-y-0">
        <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">Segmentación de Audiencias</h2>
        </div>
        <Card className="rounded-t-none border-t-0">
          <CardContent className="flex items-center justify-center h-64">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Cargando datos de audiencias...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-0">
        <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">Segmentación de Audiencias</h2>
        </div>
        <Card className="rounded-t-none border-t-0">
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-2">Error al cargar datos</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchData} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!campaignId && !adGroupId) {
    return (
      <div className="space-y-0">
        <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">Segmentación de Audiencias</h2>
        </div>
        <Card className="rounded-t-none border-t-0">
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Selecciona una campaña o grupo de anuncios para ver los datos de audiencias
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (segments.length === 0 && !loading) {
    return (
      <div className="space-y-0">
        <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">Segmentación de Audiencias</h2>
        </div>
        <Card className="rounded-t-none border-t-0">
          <CardContent>
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No se encontraron segmentos de audiencia para el período seleccionado
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Preparar opciones de filtros solo si hay datos
  const filterOptions = [];
  
  if (availableCampaigns.length > 0) {
    filterOptions.push({
      key: 'campaign',
      label: 'Campaña',
      value: campaignFilter,
      onChange: setCampaignFilter,
      options: [
        { value: 'all', label: 'Todas las campañas' },
        ...availableCampaigns.map(id => ({
          value: id,
          label: `Campaña ${id}`
        }))
      ]
    });
  }

  if (availableTypes.length > 0) {
    filterOptions.push({
      key: 'type',
      label: 'Tipo',
      value: typeFilter,
      onChange: setTypeFilter,
      options: [
        { value: 'all', label: 'Todos los tipos' },
        ...availableTypes.map(type => ({
          value: type,
          label: getTypeLabel(type)
        }))
      ]
    });
  }

  return (
    <div className="space-y-0">
      <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold">Segmentación de Audiencias</h2>
      </div>
      
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-6">
          {/* Solo mostrar filtros si hay datos y opciones disponibles */}
          {segments.length > 0 && filterOptions.length > 0 && (
            <div className="flex flex-row gap-3 justify-between items-center mb-6">
              <FilterPopover
                filters={filterOptions}
                onClearAll={() => {
                  setCampaignFilter('all');
                  setTypeFilter('all');
                }}
              />
              
              <div className="relative flex-1 max-w-[200px] sm:max-w-[280px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar audiencias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {isMobile ? (
            <div className="space-y-3">
              {paginatedSegments.map((segment) => (
                <Card key={segment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-sm">{segment.segment_value}</h3>
                      {getBidAdjustmentBadge(segment.bid_modifier || 1)}
                    </div>
                    <div className="flex gap-2 mb-3">
                      {getTypeBadge(segment.segment_type)}
                      {getTargetingBadge("TARGETING")}
                    </div>
                    <div className="mb-3 text-xs">
                      <span className="text-muted-foreground">Tamaño:</span>
                      <div className="font-medium">{getAudienceSize(segment.impressions || 0)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Impresiones:</span>
                        <div className="font-medium">{(segment.impressions || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clics:</span>
                        <div className="font-medium">{(segment.clicks || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CTR:</span>
                        <div className="font-medium">{(segment.ctr || 0).toFixed(2)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CPC:</span>
                        <div className="font-medium">
                          {formatCurrency(calculateCPC(segment.cost || 0, segment.clicks || 0))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground">Conversiones</div>
                      <div className="font-medium">{(segment.conversions || 0).toFixed(0)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Segmentación</TableHead>
                  <TableHead>Ajuste Puja</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Impresiones</TableHead>
                  <TableHead>Clics</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>CPC</TableHead>
                  <TableHead>Conversiones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSegments.map((segment) => (
                  <TableRow key={segment.id} className="hover:bg-muted/50">
                    <TableCell>{getTypeBadge(segment.segment_type)}</TableCell>
                    <TableCell>{getTargetingBadge("TARGETING")}</TableCell>
                    <TableCell>{getBidAdjustmentBadge(segment.bid_modifier || 1)}</TableCell>
                    <TableCell>{getAudienceSize(segment.impressions || 0)}</TableCell>
                    <TableCell>{(segment.impressions || 0).toLocaleString()}</TableCell>
                    <TableCell>{(segment.clicks || 0).toLocaleString()}</TableCell>
                    <TableCell>{(segment.ctr || 0).toFixed(1)}%</TableCell>
                    <TableCell>{formatCurrency(calculateCPC(segment.cost || 0, segment.clicks || 0))}</TableCell>
                    <TableCell>{(segment.conversions || 0).toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredAndSortedSegments.length}
            itemsPerPage={itemsPerPage}
            itemName="audiencias"
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AudiencesList;