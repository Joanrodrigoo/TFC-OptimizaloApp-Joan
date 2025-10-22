import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Building,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { GoogleAdsAccount } from "@/types";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const AccountsOverview = () => {
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [expandedMccAccounts, setExpandedMccAccounts] = useState<{
    [key: string]: boolean;
  }>({});
  const [loading, setLoading] = useState<boolean>(true);

  const location = useLocation();
  const [showConnectedMessage, setShowConnectedMessage] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("connected") === "true") {
      setShowConnectedMessage(true);
      // Opción: ocultar el mensaje tras 5s
      setTimeout(() => setShowConnectedMessage(false), 5000);
    }
  }, [location.search]);


  const fetchAccounts = async () => {
    try {
      const response = await fetch("https://pwi.es/api/google-accounts", {
        credentials: "include", // si usas cookies para autenticación
      });
      if (!response.ok) throw new Error("Error al obtener cuentas");
      const data = await response.json();
      setAccounts(data.accounts || []);

    } catch (error) {
      console.error("Error cargando cuentas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleConnectAccount = () => {
    window.location.href = "https://pwi.es/auth";
  };

  const handleSyncAccount = (accountId: string) => {
    console.log(`Sincronizando cuenta ${accountId}...`);
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId
          ? { ...a, lastSyncedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const toggleMccExpand = (accountId: string) => {
    setExpandedMccAccounts((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const mainAccounts = accounts.filter(
    (a) => a.accountType === "STANDARD" && !a.parentAccountId
  );
  const mccAccounts = accounts.filter((a) => a.accountType === "MCC");
  const getSubAccounts = (mccId: string) =>
    accounts.filter((a) => a.parentAccountId === mccId);

  if (loading) {
    return <p className="text-center py-10">Cargando cuentas de Google Ads...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cuentas de Google Ads</h2>
        <Button
          onClick={handleConnectAccount}
          className="bg-adops-600 hover:bg-adops-700"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Conectar Cuenta
        </Button>
      </div>
      {showConnectedMessage && (
        <div className="bg-green-100 text-green-800 border border-green-300 p-3 rounded">
          ✅ Cuenta de Google Ads conectada correctamente.
        </div>
      )}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">Todas las Cuentas</TabsTrigger>
          <TabsTrigger value="standard">Cuentas Estándar</TabsTrigger>
          <TabsTrigger value="mcc">Cuentas MCC</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-8">
          {mainAccounts.length > 0 && (
            <AccountGroup
              title="Cuentas Estándar"
              icon={<Building className="h-5 w-5 mr-2" />}
              accounts={mainAccounts}
              onSync={handleSyncAccount}
            />
          )}
          {mccAccounts.length > 0 && (
            <MccGroup
              mccAccounts={mccAccounts}
              subAccounts={accounts}
              expandedMccAccounts={expandedMccAccounts}
              onToggleExpand={toggleMccExpand}
              onSync={handleSyncAccount}
              getSubAccounts={getSubAccounts}
            />
          )}
          {accounts.length === 0 && (
            <EmptyAccountsPlaceholder onConnect={handleConnectAccount} />
          )}
        </TabsContent>

        <TabsContent value="standard">
          <AccountGroup
            title="Cuentas Estándar"
            accounts={mainAccounts}
            onSync={handleSyncAccount}
          />
        </TabsContent>

        <TabsContent value="mcc">
          <MccGroup
            mccAccounts={mccAccounts}
            subAccounts={accounts}
            expandedMccAccounts={expandedMccAccounts}
            onToggleExpand={toggleMccExpand}
            onSync={handleSyncAccount}
            getSubAccounts={getSubAccounts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const AccountGroup = ({
  title,
  icon,
  accounts,
  onSync,
}: {
  title: string;
  icon?: React.ReactNode;
  accounts: GoogleAdsAccount[];
  onSync: (accountId: string) => void;
}) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium flex items-center">
      {icon}
      {title}
    </h3>
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} onSync={onSync} />
      ))}
    </div>
  </div>
);

const MccGroup = ({
  mccAccounts,
  subAccounts,
  expandedMccAccounts,
  onToggleExpand,
  onSync,
  getSubAccounts,
}: {
  mccAccounts: GoogleAdsAccount[];
  subAccounts: GoogleAdsAccount[];
  expandedMccAccounts: { [key: string]: boolean };
  onToggleExpand: (accountId: string) => void;
  onSync: (accountId: string) => void;
  getSubAccounts: (mccId: string) => GoogleAdsAccount[];
}) => (
  <div className="space-y-6">
    {mccAccounts.map((mcc) => {
      const subs = getSubAccounts(mcc.accountId);
      const expanded = expandedMccAccounts[mcc.id];

      return (
        <div key={mcc.id} className="border rounded-lg overflow-hidden">
          <div
            className="bg-muted/30 p-4 flex justify-between items-center cursor-pointer"
            onClick={() => onToggleExpand(mcc.id)}
          >
            <div className="flex items-center">
              {expanded ? (
                <ChevronDown className="h-5 w-5 mr-2" />
              ) : (
                <ChevronRight className="h-5 w-5 mr-2" />
              )}
              <div>
                <h4 className="text-lg font-medium">{mcc.accountName}</h4>
                <p className="text-sm text-muted-foreground">
                  ID: {mcc.accountId}
                  <Badge variant="outline" className="ml-2 bg-blue-100">
                    MCC
                  </Badge>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSync(mcc.id);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Sincronizar
              </Button>
            </div>
          </div>

          {expanded && (
            <div className="p-4 bg-background">
              <h5 className="text-sm font-semibold mb-4 text-muted-foreground">
                Subcuentas ({subs.length})
              </h5>
              {subs.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {subs.map((sub) => (
                    <AccountCard key={sub.id} account={sub} onSync={onSync} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No hay subcuentas asociadas a esta cuenta MCC.
                </p>
              )}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const AccountCard = ({
  account,
  onSync,
}: {
  account: GoogleAdsAccount;
  onSync: (accountId: string) => void;
}) => (
  <Card className="overflow-hidden">
    <CardHeader
      className={account.accountType === "MCC" ? "bg-blue-50" : "bg-muted/50"}
    >
      <CardTitle>{account.accountName}</CardTitle>
      <CardDescription className="flex justify-between">
        <span>ID: {account.accountId}</span>
        {account.accountType === "MCC" && (
          <Badge variant="outline" className="bg-blue-100">
            MCC
          </Badge>
        )}
      </CardDescription>
    </CardHeader>
    <CardContent className="pt-6">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Estado:</span>
          <Badge
            variant={account.connected ? "default" : "outline"}
            className={account.connected ? "bg-green-500" : ""}
          >
            {account.connected ? "Conectada" : "Desconectada"}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Última sincronización:</span>
          <span className="text-sm">
            {account.lastSyncedAt
              ? new Date(account.lastSyncedAt).toLocaleString()
              : "Nunca"}
          </span>
        </div>
      </div>
    </CardContent>
    <CardFooter className="flex justify-between">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSync(account.id)}
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        Sincronizar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-adops-600 hover:text-adops-700 hover:bg-adops-50"
      >
        Ver Detalles
      </Button>
    </CardFooter>
  </Card>
);

const EmptyAccountsPlaceholder = ({ onConnect }: { onConnect: () => void }) => (
  <Card className="p-6 flex flex-col items-center justify-center text-center">
    <CardTitle className="mb-2">No hay cuentas conectadas</CardTitle>
    <CardDescription className="mb-6">
      Conecta tu cuenta de Google Ads para comenzar
    </CardDescription>
    <Button onClick={onConnect} className="bg-adops-600 hover:bg-adops-700">
      <PlusCircle className="mr-2 h-4 w-4" />
      Conectar Cuenta
    </Button>
  </Card>
);

export default AccountsOverview;
