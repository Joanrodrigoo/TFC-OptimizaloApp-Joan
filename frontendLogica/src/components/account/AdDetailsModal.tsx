import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Image, Video } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ✅ Interfaz consistente con el resto de la aplicación
interface Ad extends Record<string, unknown> {
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
  images?: string[]; // ✅ string[] para URLs simples
  videos?: string[]; // ✅ string[] para URLs simples
}

interface AdDetailsModalProps {
  ad: Ad | null;
  isOpen: boolean;
  onClose: () => void;
}

const AdDetailsModal = ({ ad, isOpen, onClose }: AdDetailsModalProps) => {
  if (!ad) return null;

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

  // Preparar datos con valores por defecto
  const headlinesData = ad.headlines && ad.headlines.length > 0 
    ? ad.headlines 
    : [ad.headline];

  const descriptionsData = ad.descriptions && ad.descriptions.length > 0 
    ? ad.descriptions 
    : [ad.description];

  const pathsData = ad.paths || [];
  const calloutsData = ad.callouts || [];
  const sitelinksData = ad.sitelinks || [];
  const imagesData = ad.images || [];
  const videosData = ad.videos || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalles del Anuncio</span>
            {getStatusBadge(ad.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información básica */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Información General</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">ID del Anuncio:</span>
                <p className="text-muted-foreground">{ad.adId}</p>
              </div>
              <div>
                <span className="font-medium">Grupo de Anuncios:</span>
                <p className="text-muted-foreground">{ad.adGroupName || 'No especificado'}</p>
              </div>
              {ad.finalUrl && (
                <div className="col-span-2">
                  <span className="font-medium">URL Final:</span>
                  <p className="text-muted-foreground">
                    <Button variant="link" size="sm" className="p-0 h-auto" asChild>
                      <a href={ad.finalUrl} target="_blank" rel="noopener noreferrer">
                        {ad.finalUrl}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Títulos */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Títulos</h3>
            <div className="grid gap-2">
              {headlinesData.map((headline, index) => (
                <div key={index} className="p-2 bg-blue-50 rounded border border-blue-200">
                  <span className="text-sm font-medium text-blue-800">
                    Título {index + 1}
                    {index === 0 && headlinesData.length === 1 && " (Principal)"}: 
                  </span>
                  <span className="text-blue-900 ml-1">{headline}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Descripciones */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Descripciones</h3>
            <div className="grid gap-2">
              {descriptionsData.map((description, index) => (
                <div key={index} className="p-2 bg-gray-50 rounded border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">
                    Descripción {index + 1}
                    {index === 0 && descriptionsData.length === 1 && " (Principal)"}: 
                  </span>
                  <span className="text-gray-900 ml-1">{description}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Extensiones */}
          {(pathsData.length > 0 || calloutsData.length > 0) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rutas de URL */}
                {pathsData.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Rutas de URL</h4>
                    <div className="space-y-1">
                      {pathsData.map((path, index) => (
                        <div key={index} className="text-sm bg-green-50 p-2 rounded border border-green-200">
                          {path}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extensiones de llamada */}
                {calloutsData.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Extensiones de Llamada</h4>
                    <div className="space-y-1">
                      {calloutsData.map((callout, index) => (
                        <div key={index} className="text-sm bg-purple-50 p-2 rounded border border-purple-200">
                          {callout}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Sitelinks */}
          {sitelinksData.length > 0 && (
            <>
              <div>
                <h4 className="font-semibold mb-2">Enlaces de Sitio</h4>
                <div className="grid gap-2">
                  {sitelinksData.map((sitelink, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-yellow-50 rounded border border-yellow-200">
                      <span className="font-medium text-yellow-800">{sitelink.title}</span>
                      {sitelink.url && (
                        <Button variant="link" size="sm" className="p-0 h-auto text-yellow-700" asChild>
                          <a href={sitelink.url} target="_blank" rel="noopener noreferrer">
                            {sitelink.url}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Assets (Imágenes y Videos) - ✅ ACTUALIZADO PARA string[] */}
          {(imagesData.length > 0 || videosData.length > 0) && (
            <>
              <div>
                <h4 className="font-semibold mb-2">Recursos (Assets)</h4>
                
                {/* Imágenes */}
                {imagesData.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-medium mb-2 text-gray-600">Imágenes</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {imagesData.map((imageUrl, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Image className="h-4 w-4" />
                            <span className="text-sm font-medium">Imagen {index + 1}</span>
                          </div>
                          <img 
                            src={imageUrl} 
                            alt={`Imagen ${index + 1}`}
                            className="w-full h-20 object-cover rounded"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder.svg";
                            }}
                          />
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="p-0 h-auto text-xs mt-1" 
                            asChild
                          >
                            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                              Ver original
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos */}
                {videosData.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium mb-2 text-gray-600">Videos</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {videosData.map((videoUrl, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Video className="h-4 w-4" />
                            <span className="text-sm font-medium">Video {index + 1}</span>
                          </div>
                          <Button variant="link" size="sm" className="p-0 h-auto" asChild>
                            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                              Ver Video
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Métricas */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Rendimiento</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-2xl font-bold">{(ad.impressions || 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Impresiones</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-2xl font-bold">{(ad.clicks || 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Clics</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-2xl font-bold">{(ad.ctr || 0).toFixed(2)}%</p>
                <p className="text-sm text-muted-foreground">CTR</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-2xl font-bold">{formatCurrency(ad.cpc || 0)}</p>
                <p className="text-sm text-muted-foreground">CPC</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <p className="text-2xl font-bold">{ad.conversions || 0}</p>
                <p className="text-sm text-muted-foreground">Conversiones</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdDetailsModal;