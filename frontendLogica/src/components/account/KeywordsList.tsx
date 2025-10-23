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
import { Search, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency, formatDateForAPI } from "@/lib/utils";
import { fetchKeywords, fetchKeywordsByAdGroup } from "@/services/api";
import { Keyword } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";

interface KeywordsListProps {
  customerId: string;
  dateRange: { from: Date; to: Date };
  navigation: {
    level: "campaigns" | "adgroups" | "ads" | null;
    selectedCampaign?: string;
    selectedAdGroup?: string;
    campaignName?: string;
    adGroupName?: string;
  };
}

const KeywordStatusMap: Record<string, string> = {
  "0": "UNSPECIFIED",
  "1": "UNKNOWN",
  "2": "ENABLED",
  "3": "PAUSED",
  "4": "REMOVED"
};

const MatchTypeMap: Record<string, string> = {
  "0": "UNSPECIFIED",
  "1": "UNKNOWN", 
  "2": "EXACT",
  "3": "PHRASE",
  "4": "BROAD"
};

type SortField = keyof Keyword | null;
type SortOrder = "asc" | "desc";

const KeywordsList = ({
  customerId,
  dateRange,
  navigation,
}: KeywordsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [allKeywords, setAllKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [matchTypeFilter, setMatchTypeFilter] = useState<string>("all");
  const itemsPerPage = 10;
  const isMobile = useIsMobile();

  // Obtener estados y tipos únicos disponibles
  const availableStatuses = useMemo(() => {
    const statuses = new Set(allKeywords.map(kw => KeywordStatusMap[kw.status] || "UNKNOWN"));
    return Array.from(statuses).sort();
  }, [allKeywords]);

  const availableMatchTypes = useMemo(() => {
    const types = new Set(allKeywords.map(kw => MatchTypeMap[kw.matchType] || "UNKNOWN"));
    return Array.from(types).sort();
  }, [allKeywords]);

  const handleSort = (field: SortField) => {
    if (!field) return;
    setSortOrder((prev) =>
      sortField === field ? (prev === "asc" ? "desc" : "asc") : "desc"
    );
    setSortField(field);
  };

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return null;
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
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

  const getMatchTypeBadge = (matchType: string | number) => {
    const matchTypeStr = String(matchType);
    const mappedType = MatchTypeMap[matchTypeStr] || "UNKNOWN";
    
    const matchTypeStyles = {
      EXACT: { className: "bg-purple-100 text-purple-800", label: "Exacta" },
      PHRASE: { className: "bg-green-100 text-green-800", label: "Frase" },
      BROAD: { className: "bg-blue-100 text-blue-800", label: "Amplia" },
      UNKNOWN: { className: "bg-gray-100 text-gray-800", label: "Desconocida" }
    };

    const style = matchTypeStyles[mappedType as keyof typeof matchTypeStyles] || matchTypeStyles.UNKNOWN;

    return (
      <Badge variant="outline" className={style.className}>
        {style.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string | number) => {
    const statusStr = String(status);
    const mappedStatus = KeywordStatusMap[statusStr] || "UNKNOWN";
    
    switch (mappedStatus) {
      case "ENABLED":
        return <Badge className="bg-green-500 text-white">Activa</Badge>;
      case "PAUSED":
        return <Badge variant="outline">Pausada</Badge>;
      case "REMOVED":
        return <Badge variant="destructive">Eliminada</Badge>;
      default:
        return <Badge variant="secondary">Desconocida</Badge>;
    }
  };

  // Filtrar y ordenar keywords
  const processedKeywords = useMemo(() => {
    // Filtrar keywords
    const filtered = allKeywords.filter((keyword) => {
      if (keyword.isNegative) return false;
      
      if (!keyword.adGroupId && navigation?.selectedAdGroup) {
        return false;
      }
      
      if (searchTerm && !keyword.keywordText?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      if (statusFilter !== "all") {
        const mappedStatus = KeywordStatusMap[keyword.status] || "UNKNOWN";
        if (mappedStatus !== statusFilter) return false;
      }

      if (matchTypeFilter !== "all") {
        const mappedType = MatchTypeMap[keyword.matchType] || "UNKNOWN";
        if (mappedType !== matchTypeFilter) return false;
      }
      
      return true;
    });

    // Ordenar keywords
    return [...filtered].sort((a, b) => {
      // Si el usuario ha seleccionado un campo específico para ordenar
      if (sortField) {
        let aVal = a[sortField as keyof Keyword];
        let bVal = b[sortField as keyof Keyword];
        
        if (aVal == null && bVal != null) return 1;
        if (aVal != null && bVal == null) return -1;
        if (aVal == null && bVal == null) return 0;
        
        if (typeof aVal === "string" && typeof bVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }
        
        return sortOrder === "asc"
          ? aVal > bVal ? 1 : -1
          : aVal < bVal ? 1 : -1;
      }
      
      // Ordenamiento por defecto: Estado ENABLED primero, luego impresiones descendentes
      const statusPriority: Record<string, number> = {
        "2": 0,  // ENABLED
        "3": 1,  // PAUSED
        "4": 2,  // REMOVED
        "0": 3,  // UNSPECIFIED
        "1": 3,  // UNKNOWN
      };
      
      const aStatusPriority = statusPriority[a.status] ?? 4;
      const bStatusPriority = statusPriority[b.status] ?? 4;
      
      if (aStatusPriority !== bStatusPriority) {
        return aStatusPriority - bStatusPriority;
      }
      
      return (b.impressions ?? 0) - (a.impressions ?? 0);
    });
  }, [allKeywords, searchTerm, statusFilter, matchTypeFilter, sortField, sortOrder, navigation?.selectedAdGroup]);

  useEffect(() => {
    if (!formatDateForAPI(dateRange.from) || !formatDateForAPI(dateRange.to)) return;

    if (!navigation?.selectedCampaign && !navigation?.selectedAdGroup) {
      setAllKeywords([]);
      setCurrentPage(1);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        let rawData: any[] = [];

        if (navigation.selectedAdGroup) {
          rawData = await fetchKeywordsByAdGroup(navigation.selectedAdGroup, dateRange);
          console.log("📊 Keywords del Ad Group recibidas:", rawData?.length || 0);
        } else if (navigation.selectedCampaign) {
          rawData = await fetchKeywords(navigation.selectedCampaign, dateRange);
          console.log("📊 Keywords de Campaign recibidas:", rawData?.length || 0);
        }

        const mappedKeywords: Keyword[] = rawData.map((item) => ({
          customerId: item.customerId || customerId,
          keywordId: item.keywordId || `kw_${Date.now()}_${Math.random()}`,
          keywordText: item.keywordText || "",
          campaignId: String(item.campaignId || ""),
          campaignName: item.campaignName || navigation.campaignName || "Desconocido",
          adGroupId: item.adGroupId ? String(item.adGroupId) : "0",
          adGroupName: item.adGroupName || navigation.adGroupName || "Desconocido",
          matchType: String(item.matchType || "0"),
          status: String(item.status || "0"),
          isNegative: Boolean(item.isNegative),
          impressions: Number(item.impressions) || 0,
          clicks: Number(item.clicks) || 0,
          costEuros: Number(item.costEuros) || 0,
          costMicros: Number(item.costMicros) || 0,
          conversions: Number(item.conversions) || 0,
          ctr: item.ctr != null ? Number(item.ctr) : 0,
          averageCpcEuros: item.averageCpcEuros != null ? Number(item.averageCpcEuros) : 0,
          averageCpcMicros: item.averageCpcMicros != null ? Number(item.averageCpcMicros) : 0,
          qualityScore: item.qualityScore != null ? Number(item.qualityScore) : null,
        }));

        setAllKeywords(mappedKeywords);
        setCurrentPage(1);
      } catch (error) {
        console.error("❌ Error cargando keywords:", error);
        setError((error as Error).message || "Error al cargar las keywords");
        setAllKeywords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    dateRange,
    navigation?.selectedCampaign,
    navigation?.selectedAdGroup,
    customerId,
    navigation?.campaignName,
    navigation?.adGroupName
  ]);

  const totalPages = Math.ceil(processedKeywords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentKeywords = processedKeywords.slice(startIndex, startIndex + itemsPerPage);

  const getContextTitle = () => {
    if (navigation?.selectedAdGroup) {
      return `Keywords del Grupo de Anuncios`;
    } else if (navigation?.selectedCampaign) {
      return `Keywords de la Campaña`;
    }
    return `Palabras Clave`;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Preparar filtros dinámicos
  const filterOptions = [];
  
  if (availableStatuses.length > 0) {
    filterOptions.push({
      key: 'status',
      label: 'Estado',
      value: statusFilter,
      onChange: setStatusFilter,
      options: [
        { value: 'all', label: 'Todos los estados' },
        ...availableStatuses.map(status => ({
          value: status,
          label: status === 'ENABLED' ? 'Activas' : 
                 status === 'PAUSED' ? 'Pausadas' : 
                 status === 'REMOVED' ? 'Eliminadas' : status
        }))
      ]
    });
  }

  if (availableMatchTypes.length > 0) {
    filterOptions.push({
      key: 'matchType',
      label: 'Concordancia',
      value: matchTypeFilter,
      onChange: setMatchTypeFilter,
      options: [
        { value: 'all', label: 'Todas las concordancias' },
        ...availableMatchTypes.map(type => ({
          value: type,
          label: type === 'BROAD' ? 'Amplia' : 
                 type === 'PHRASE' ? 'Frase' : 
                 type === 'EXACT' ? 'Exacta' : type
        }))
      ]
    });
  }

  return (
    <div className="space-y-0">
      <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold">{getContextTitle()}</h2>
      </div>
      
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-6">
          {!navigation?.selectedCampaign && !navigation?.selectedAdGroup ? (
            <div className="text-center py-8 text-muted-foreground">
              Selecciona una campaña para ver las keywords.
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando keywords...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-4">{error}</div>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              {allKeywords.length > 0 && filterOptions.length > 0 && (
                <div className="flex flex-row gap-3 justify-between items-center mb-6">
                  <FilterPopover
                    filters={filterOptions}
                    onClearAll={() => {
                      setStatusFilter('all');
                      setMatchTypeFilter('all');
                    }}
                  />
                  
                  <div className="relative flex-1 max-w-[200px] sm:max-w-[280px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar keywords..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {processedKeywords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {navigation?.selectedAdGroup
                    ? "No se encontraron keywords en este grupo de anuncios"
                    : navigation?.selectedCampaign
                    ? "No se encontraron keywords en esta campaña"
                    : "No se encontraron keywords"}
                </div>
              ) : isMobile ? (
                <div className="space-y-3">
                  {currentKeywords.map((keyword, index) => (
                    <Card
                      key={`${keyword.customerId}-${keyword.keywordId}-${index}`}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-medium text-sm">
                            {keyword.keywordText || "Keyword sin texto"}
                          </h3>
                        </div>

                        <div className="flex gap-2 mb-3">
                          {getMatchTypeBadge(keyword.matchType)}
                          {getStatusBadge(keyword.status)}
                        </div>

                        {!navigation?.selectedAdGroup && (
                          <>
                            <div className="mb-3 text-xs">
                              <span className="text-muted-foreground">Campaña:</span>
                              <div className="font-medium">{keyword.campaignName}</div>
                            </div>
                            {keyword.adGroupId && (
                              <div className="mb-3 text-xs">
                                <span className="text-muted-foreground">Grupo de Anuncios:</span>
                                <div className="font-medium">{keyword.adGroupName}</div>
                              </div>
                            )}
                          </>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">CPC Promedio:</span>
                            <div className="font-medium">
                              {keyword.averageCpcEuros > 0
                                ? formatCurrency(keyword.averageCpcEuros)
                                : "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Coste:</span>
                            <div className="font-medium">
                              {keyword.costEuros > 0
                                ? formatCurrency(keyword.costEuros)
                                : "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Impresiones:</span>
                            <div className="font-medium">
                              {keyword.impressions > 0 ? keyword.impressions.toLocaleString() : "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Clics:</span>
                            <div className="font-medium">
                              {keyword.clicks > 0 ? keyword.clicks.toLocaleString() : "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">CTR:</span>
                            <div className="font-medium">
                              {keyword.ctr > 0 ? keyword.ctr.toFixed(2) + "%" : "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Conversiones:</span>
                            <div className="font-medium">
                              {keyword.conversions > 0 ? keyword.conversions.toLocaleString() : "-"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[1200px]">
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="keywordText">Keywords</SortableHeader>
                        <SortableHeader field="matchType">Concordancia</SortableHeader>
                        <SortableHeader field="status">Estado</SortableHeader>
                        {!navigation?.selectedAdGroup && (
                          <>
                            <SortableHeader field="campaignName">Campaña</SortableHeader>
                            <SortableHeader field="adGroupName">Grupo de Anuncios</SortableHeader>
                          </>
                        )}
                        <SortableHeader field="impressions">Impresiones</SortableHeader>
                        <SortableHeader field="clicks">Clics</SortableHeader>
                        <SortableHeader field="ctr">CTR</SortableHeader>
                        <SortableHeader field="averageCpcEuros">CPC</SortableHeader>
                        <SortableHeader field="costEuros">Coste</SortableHeader>
                        <SortableHeader field="conversions">Conversiones</SortableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentKeywords.map((keyword, index) => (
                        <TableRow
                          key={`${keyword.customerId}-${keyword.keywordId}-${index}`}
                          className="hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            {keyword.keywordText || "Sin texto"}
                          </TableCell>
                          <TableCell>
                            {getMatchTypeBadge(keyword.matchType)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(keyword.status)}
                          </TableCell>
                          {!navigation?.selectedAdGroup && (
                            <>
                              <TableCell className="text-sm">
                                {keyword.campaignName}
                              </TableCell>
                              <TableCell className="text-sm">
                                {keyword.adGroupName}
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            {keyword.impressions > 0 ? keyword.impressions.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            {keyword.clicks > 0 ? keyword.clicks.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            {keyword.ctr > 0 ? keyword.ctr.toFixed(2) + "%" : "-"}
                          </TableCell>
                          <TableCell>
                            {keyword.averageCpcEuros > 0
                              ? formatCurrency(keyword.averageCpcEuros)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {keyword.costEuros > 0
                              ? formatCurrency(keyword.costEuros)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {keyword.conversions > 0 ? keyword.conversions.toLocaleString() : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={processedKeywords.length}
                itemsPerPage={itemsPerPage}
                itemName="keywords"
                onPageChange={handlePageChange}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KeywordsList;