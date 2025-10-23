
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Lightbulb, Target, TrendingDown, TrendingUp as TrendUp } from "lucide-react";

type Priority = "high" | "medium" | "low";
type EntityType = "campaign" | "adgroup" | "ad";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  impact: string;
  entityType: EntityType;
  entityName: string;
  details: {
    justification: string;
    targetKPI: string;
    currentValue: string;
    expectedValue: string;
  };
}

interface RecommendationDetailModalProps {
  recommendation: Recommendation | null;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
}

const RecommendationDetailModal = ({ 
  recommendation, 
  isOpen, 
  onClose, 
  onApply 
}: RecommendationDetailModalProps) => {
  if (!recommendation) return null;

  const getPriorityIcon = (priority: Priority) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "medium":
        return <TrendingUp className="h-5 w-5 text-yellow-500" />;
      case "low":
        return <Lightbulb className="h-5 w-5 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getEntityTypeLabel = (type: EntityType) => {
    switch (type) {
      case "campaign":
        return "Campaña";
      case "adgroup":
        return "Conjunto de anuncios";
      case "ad":
        return "Anuncio";
    }
  };

  const getPriorityText = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "Alta prioridad";
      case "medium":
        return "Media prioridad";
      case "low":
        return "Baja prioridad";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold mb-2">
                {recommendation.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-sm">
                  {getEntityTypeLabel(recommendation.entityType)}: {recommendation.entityName}
                </Badge>
                <div className="flex items-center gap-1">
                  {getPriorityIcon(recommendation.priority)}
                  <Badge variant="outline" className={`text-sm ${getPriorityColor(recommendation.priority)}`}>
                    {getPriorityText(recommendation.priority)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <DialogDescription className="text-left">
            {recommendation.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Justificación */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              ¿Por qué se recomienda?
            </h4>
            <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
              {recommendation.details.justification}
            </p>
          </div>

          {/* KPI Objetivo */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <TrendUp className="h-4 w-4" />
              KPI objetivo: {recommendation.details.targetKPI}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="text-sm font-medium text-red-800 mb-1">Valor actual</div>
                <div className="text-lg font-semibold text-red-900">
                  {recommendation.details.currentValue}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-sm font-medium text-green-800 mb-1">Valor esperado</div>
                <div className="text-lg font-semibold text-green-900">
                  {recommendation.details.expectedValue}
                </div>
              </div>
            </div>
          </div>

          {/* Impacto estimado */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendUp className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Impacto estimado</span>
            </div>
            <div className="text-xl font-bold text-blue-900">
              {recommendation.impact}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onApply}>
            Aplicar recomendación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecommendationDetailModal;