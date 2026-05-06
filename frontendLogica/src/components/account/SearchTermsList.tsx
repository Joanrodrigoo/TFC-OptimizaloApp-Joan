import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterPopover } from "@/components/ui/filter-popover";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDateForAPI } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Plus,
  Minus,
  Loader2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface SearchTerm {
  search_term: string;
  keyword_text: string;
  match_type: string;
  campaign_id: number;
  impressions: number;
  clicks: number;
  ctr: number;
  average_cpc: number;
  cost: number;
  conversions: number;
}

interface Props {
  accountId: string;
  dateRange: { from: Date; to: Date };
  navigation: {
    level: "campaigns" | "adgroups" | "ads";
    selectedCampaign?: string;
    selectedAdGroup?: string;
    campaignName?: string;
    adGroupName?: string;
  };
}

type SortField =
  | "search_term"
  | "keyword_text"
  | "match_type"
  | "impressions"
  | "clicks"
  | "ctr"
  | "average_cpc"
  | "cost"
  | "conversions";
type SortOrder = "asc" | "desc";

const SearchTermsList: React.FC<Props> = ({
  accountId,
  dateRange,
  navigation,
}) => {
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [matchTypeFilter, setMatchTypeFilter] = useState<string>("all");
  const itemsPerPage = 10;
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchSearchTerms = async () => {
      if (!navigation?.selectedCampaign) return;

      setLoading(true);

      const params = new URLSearchParams({
        from: formatDateForAPI(dateRange.from),
        to: formatDateForAPI(dateRange.to),
      });

      if (navigation?.selectedAdGroup) {
        params.append("ad_group_id", navigation.selectedAdGroup);
      }

      try {
        const res = await fetch(
          `/api/campaigns/${navigation.selectedCampaign}/search-terms?${params.toString()}`
        );
        const data = await res.json();
        setSearchTerms(data);
      } catch (err) {
        console.error("Error cargando search terms:", err);
        setSearchTerms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchTerms();
    setCurrentPage(1);
  }, [dateRange, navigation]);

  const availableMatchTypes = useMemo(() => {
    const types = new Set(searchTerms.map(term => term.match_type));
    return Array.from(types).sort();
  }, [searchTerms]);

  const getMatchTypeBadge = (matchType: string) => {
    const colors = {
      BROAD: "bg-blue-100 text-blue-800",
      PHRASE: "bg-green-100 text-green-800", 
      EXACT: "bg-purple-100 text-purple-800"
    };
    
    const labels = {
      BROAD: "Amplia",
      PHRASE: "Frase",
      EXACT: "Exacta"
    };
    
    return (
      <Badge variant="outline" className={colors[matchType as keyof typeof colors]}>
        {labels[matchType as keyof typeof labels] || matchType}
      </Badge>
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4" />;
    }
    return sortOrder === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const sortData = (data: SearchTerm[]) => {
    return [...data].sort((a, b) => {
      if (sortField) {
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

        if (typeof aValue === "string") {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sortOrder === "asc") {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      }
      
      return b.impressions - a.impressions;
    });
  };

  const filteredData = searchTerms.filter((term) => {
    const matchesSearch =
      (term.search_term || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (term.keyword_text || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = matchTypeFilter === "all" || term.match_type === matchTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const sortedData = sortData(filteredData);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  const handleAddAsKeyword = (term: SearchTerm) => {
    console.log("Añadir como palabra clave:", term);
  };

  const handleAddAsNegative = (term: SearchTerm) => {
    console.log("Añadir como palabra negativa:", term);
  };

  const calculateConversionRate = (conversions: number, clicks: number) => {
    return clicks > 0 ? (conversions / clicks) * 100 : 0;
  };

  const calculateCostPerConversion = (cost: number, conversions: number) => {
    return conversions > 0 ? cost / conversions : 0;
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

  return (
    <div className="space-y-0">
      <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold">
          Términos de Búsqueda ({filteredData.length})
        </h2>
      </div>
      
      <Card className="rounded-t-none border-t-0">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando términos de búsqueda...</span>
            </div>
          ) : filteredData.length === 0 && !loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerms.length === 0
                ? "No hay datos disponibles para el período seleccionado"
                : "No se encontraron términos que coincidan con tu búsqueda."}
            </div>
          ) : (
            <>
              {searchTerms.length > 0 && availableMatchTypes.length > 0 && (
                <div className="flex flex-row gap-3 justify-between items-center mb-6">
                  <FilterPopover
                    filters={[
                      {
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
                      }
                    ]}
                    onClearAll={() => setMatchTypeFilter('all')}
                  />
                  
                  <div className="relative flex-1 max-w-[200px] sm:max-w-[280px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar términos..."  
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {isMobile ? (
                <div className="space-y-3">
                  {paginatedData.map((term, idx) => (
                    <Card key={`${term.campaign_id}-${idx}`} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-medium text-sm">{term.search_term}</h3>
                          {getMatchTypeBadge(term.match_type)}
                        </div>
                        <div className="mb-3 text-xs">
                          <span className="text-muted-foreground">Palabra Clave:</span>
                          <div className="font-medium">{term.keyword_text}</div>
                        </div>
                        {navigation.level === 'campaigns' && (
                          <div className="grid grid-cols-1 gap-2 mb-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Campaña:</span>
                              <div className="font-medium">{navigation.campaignName}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Grupo Anuncios:</span>
                              <div className="font-medium">{navigation.adGroupName}</div>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                          <div>
                            <span className="text-muted-foreground">Impresiones:</span>
                            <div className="font-medium">{term.impressions.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Clics:</span>
                            <div className="font-medium">{term.clicks.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">CTR:</span>
                            <div className="font-medium">{(term.ctr * 100).toFixed(2)}%</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">CPC Medio:</span>
                            <div className="font-medium">€{term.average_cpc.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Coste:</span>
                            <div className="font-medium">€{term.cost.toFixed(2)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tasa Conv.:</span>
                            <div className="font-medium">
                              {calculateConversionRate(term.conversions, term.clicks).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-muted-foreground">Conversiones</div>
                          <div className="font-medium">{term.conversions}</div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddAsKeyword(term)}
                            className="h-7 px-2"
                            title="Añadir como palabra clave"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddAsNegative(term)}
                            className="h-7 px-2"
                            title="Añadir como palabra negativa"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[1500px]">
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="search_term">Término</SortableHeader>
                        <SortableHeader field="keyword_text">Palabra Clave</SortableHeader>
                        <SortableHeader field="match_type">Concordancia</SortableHeader>
                        {navigation.level === "campaigns" && (
                          <>
                            <TableHead>Campaña</TableHead>
                            <TableHead>Grupo de anuncios</TableHead>
                          </>
                        )}
                        <SortableHeader field="impressions">Impresiones</SortableHeader>
                        <SortableHeader field="clicks">Clicks</SortableHeader>
                        <SortableHeader field="ctr">CTR</SortableHeader>
                        <SortableHeader field="average_cpc">CPC Medio</SortableHeader>
                        <SortableHeader field="cost">Coste</SortableHeader>
                        <TableHead>Tasa de conversión</TableHead>
                        <SortableHeader field="conversions">Conversiones</SortableHeader>
                        <TableHead>Coste / Conversión</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((term, idx) => (
                        <TableRow key={`${term.campaign_id}-${idx}`} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{term.search_term}</TableCell>
                          <TableCell>{term.keyword_text}</TableCell>
                          <TableCell>{getMatchTypeBadge(term.match_type)}</TableCell>
                          {navigation.level === "campaigns" && (
                            <>
                              <TableCell className="text-sm">{navigation.campaignName}</TableCell>
                              <TableCell className="text-sm">{navigation.adGroupName}</TableCell>
                            </>
                          )}
                          <TableCell>{term.impressions.toLocaleString()}</TableCell>
                          <TableCell>{term.clicks.toLocaleString()}</TableCell>
                          <TableCell>{(term.ctr * 100).toFixed(2)}%</TableCell>
                          <TableCell>€{term.average_cpc.toFixed(2)}</TableCell>
                          <TableCell>€{term.cost.toFixed(2)}</TableCell>
                          <TableCell>
                            {calculateConversionRate(term.conversions, term.clicks).toFixed(1)}%
                          </TableCell>
                          <TableCell>{term.conversions}</TableCell>
                          <TableCell>
                            €{calculateCostPerConversion(term.cost, term.conversions).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddAsKeyword(term)}
                                className="h-7 px-2"
                                title="Añadir como palabra clave"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddAsNegative(term)}
                                className="h-7 px-2"
                                title="Añadir como palabra negativa"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            </div>
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
                totalItems={sortedData.length}
                itemsPerPage={itemsPerPage}
                itemName="términos"
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SearchTermsList;