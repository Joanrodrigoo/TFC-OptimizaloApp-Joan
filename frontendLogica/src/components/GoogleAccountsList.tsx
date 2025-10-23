import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface GoogleAccount {
  customer_id: string;
  name: string;
  is_mcc: number;
}

export default function GoogleAccountsList() {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch("https://pwi.es/api/google-accounts", {
          credentials: "include",
        });

        const data = await response.json();
        console.log("✅ Datos recibidos:", data);

        if (!response.ok) {
          throw new Error(data.error || "Error al obtener cuentas");
        }

        // Validación fuerte del tipo de datos
        if (!Array.isArray(data.accounts)) {
          throw new Error("La respuesta del servidor no es válida.");
        }

        setAccounts(data.accounts);
      } catch (err: any) {
        console.error("❌ Error al obtener cuentas:", err);
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (accounts.length === 0) {
    return (
      <p className="text-center text-muted-foreground">
        No hay cuentas conectadas aún.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <Card key={account.customer_id}>
          <CardHeader>
            <CardTitle>{account.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              ID: {account.customer_id}
            </span>
            {account.is_mcc ? (
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                MCC
              </Badge>
            ) : (
              <Badge variant="outline">Estándar</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
