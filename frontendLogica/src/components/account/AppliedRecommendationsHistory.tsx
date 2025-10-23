import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  ArrowRight,
} from "lucide-react";
import { fetchAppliedRecommendations } from "@/services/api";
import PaginationControlled from "@/components/ui/PaginationControlled"; // ajusta ruta si hace falta
import { Recomendacion } from "@/types";

type Priority = "high" | "medium" | "low";
type EntityType = "campaign" | "adgroup" | "ad";

interface AppliedRecommendation {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  impact: string;
  entityType: EntityType;
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

interface Props {
  customerId: number;
}

const AppliedRecommendationsHistory: React.FC<Props> = ({ customerId }) => {
  const [recommendations, setRecommendations] = useState<AppliedRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        setLoading(true);
        const data = await fetchAppliedRecommendations(customerId);
        const mapped = data.map((rec: Recomendacion) => ({
          id: rec.id.toString(),
          title: rec.titulo,
          description: rec.descripcion,
          priority: rec.prioridad as "high" | "medium" | "low",
          impact: rec.impacto_estimado,
          entityType: rec.tipo_objeto as "campaign" | "adgroup" | "ad",
          entityName: rec.nombre_objeto || "Entidad",
          appliedDate: rec.fecha_aplicacion || rec.fecha_creacion,
          result: {
            status: rec.resultado?.estado || "no_change",
            actualImprovement: rec.resultado?.mejora_real || "-",
            comparisonPeriod: rec.resultado?.periodo_comparacion || "-",
            kpiVariation: rec.resultado?.variacion_kpi ?? 0,
          },
          details: {
            justification: rec.detalle?.justificacion || "-",
            targetKPI: rec.detalle?.kpi_objetivo || "-",
            currentValue: rec.detalle?.valor_actual || "-",
            expectedValue: rec.detalle?.valor_esperado || "-",
          },
        }));

        setRecommendations(mapped);
        setError(null);
        setCurrentPage(1); // reset pagina al cargar nuevas recomendaciones
      } catch (error) {
        setError(error.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, [customerId]);

  const getStatusIcon = (status: "improved" | "no_change" | "worsened") => {
    switch (status) {
      case "improved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "no_change":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "worsened":
        return <X className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: "improved" | "no_change" | "worsened") => {
    switch (status) {
      case "improved":
        return "Mejoró";
      case "no_change":
        return "Sin cambio";
      case "worsened":
        return "Empeoró";
    }
  };

  const getStatusColor = (status: "improved" | "no_change" | "worsened") => {
    switch (status) {
      case "improved":
        return "bg-green-50 text-green-700 border-green-200";
      case "no_change":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "worsened":
        return "bg-red-50 text-red-700 border-red-200";
    }
  };

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
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const totalPages = Math.ceil(recommendations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = recommendations.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return <p className="text-center py-10 text-muted-foreground">Cargando recomendaciones aplicadas...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500 py-10">Error: {error}</p>;
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {currentItems.map((rec) => (
          <div
            key={rec.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all duration-200"
          >
            {/* Header con título y badges */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-gray-900 text-base">{rec.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {getEntityTypeLabel(rec.entityType)}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(rec.result.status)}
                    <Badge variant="outline" className={`text-xs ${getStatusColor(rec.result.status)}`}>
                      {getStatusText(rec.result.status)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <Calendar className="h-3 w-3" />
                  <span>Aplicada el {formatDate(rec.appliedDate)}</span>
                  <span className="text-gray-300">•</span>
                  <span>Entidad: {rec.entityName}</span>
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex items-center justify-between bg-blue-50 rounded-md px-3 py-2 border border-blue-100">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900 text-sm">{rec.details.targetKPI}</div>
                    <div className="text-xs text-blue-700 flex items-center gap-1">
                      {rec.details.currentValue}
                      <ArrowRight className="h-3 w-3" />
                      {rec.details.expectedValue}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`flex items-center justify-between rounded-md px-3 py-2 border ${
                  rec.result.kpiVariation > 0
                    ? "bg-green-50 border-green-100"
                    : "bg-red-50 border-red-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  {rec.result.kpiVariation > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <div>
                    <div
                      className={`font-semibold text-sm ${
                        rec.result.kpiVariation > 0 ? "text-green-900" : "text-red-900"
                      }`}
                    >
                      {rec.result.kpiVariation > 0 ? "+" : ""}
                      {rec.result.kpiVariation}%
                    </div>
                    <div className={`text-xs ${rec.result.kpiVariation > 0 ? "text-green-700" : "text-red-700"}`}>
                      en {rec.result.comparisonPeriod}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
                <div>
                  <div className="text-xs text-gray-600">Justificación</div>
                  <div className="text-sm font-medium text-gray-900">{rec.details.justification}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Paginación */}
      <PaginationControlled
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        totalPages={totalPages}
      />
    </div>
  );
};

export default AppliedRecommendationsHistory;