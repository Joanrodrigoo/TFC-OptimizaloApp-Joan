import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,

  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Building,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { GoogleAdsAccount } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AccountsOverview = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [expandedMccAccounts, setExpandedMccAccounts] = useState<{
    [key: string]: boolean;
  }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [showConnectedMessage, setShowConnectedMessage] = useState(false);

  const handleViewDetails = (accountId: string) => {
    navigate(`/dashboard/accounts/${accountId}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("connected") === "true") {
      setShowConnectedMessage(true);
      setTimeout(() => setShowConnectedMessage(false), 5000);
    }
  }, [location.search]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("https://optimizalo.app/api/google-accounts", {
        credentials: "include",
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
    window.location.href = "https://optimizalo.app/auth";
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
    return (
      <p className="text-center py-10">Cargando cuentas de Google Ads...</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Cuentas de Google Ads</h2>
        <Button
          onClick={handleConnectAccount}
          className="bg-adops-600 hover:bg-adops-700 w-full sm:w-auto"
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
              onViewDetails={handleViewDetails}
            />
          )}
          {mccAccounts.length > 0 && (
            <MccGroup
            
              mccAccounts={mccAccounts}
              expandedMccAccounts={expandedMccAccounts}
              onToggleExpand={toggleMccExpand}
              onSync={handleSyncAccount}
              getSubAccounts={getSubAccounts}
              onViewDetails={handleViewDetails}
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
            onViewDetails={handleViewDetails}
          />
        </TabsContent>

        <TabsContent value="mcc">
          <MccGroup
            mccAccounts={mccAccounts}
            expandedMccAccounts={expandedMccAccounts}
            onToggleExpand={toggleMccExpand}
            onSync={handleSyncAccount}
            getSubAccounts={getSubAccounts}
            onViewDetails={handleViewDetails}
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
  onViewDetails,
}: {
  title: string;
  icon?: React.ReactNode;
  accounts: GoogleAdsAccount[];
  onSync: (accountId: string) => void;
  onViewDetails: (accountId: string) => void;
}) => (
  <div className="space-y-4">
    <h3 className="text-lg font-medium flex items-center">
      {icon}
      {title}
    </h3>
    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onSync={onSync}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  </div>
);

const MccGroup = ({
  mccAccounts,
  expandedMccAccounts,
  onToggleExpand,
  onSync,
  getSubAccounts,
  onViewDetails,
}: {
  mccAccounts: GoogleAdsAccount[];
  expandedMccAccounts: { [key: string]: boolean };
  onToggleExpand: (accountId: string) => void;
  onSync: (accountId: string) => void;
  getSubAccounts: (mccId: string) => GoogleAdsAccount[];
  onViewDetails: (accountId: string) => void;
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
            <div className="flex items-center space-x-2"></div>
          </div>

          {expanded && (
            <div className="p-4 bg-background">
              <h5 className="text-sm font-semibold mb-4 text-muted-foreground">
                Subcuentas ({subs.length})
              </h5>
              {subs.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {subs.map((sub) => (
                    <AccountCard
                      key={sub.id}
                      account={sub}
                      onSync={onSync}
                      onViewDetails={onViewDetails}
                    />
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
  onViewDetails,
}: {
  account: GoogleAdsAccount;
  onSync: (accountId: string) => void;
  onViewDetails: (accountId: string) => void;
}) => (
  <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
    <CardHeader
      className={account.accountType === "MCC" ? "bg-blue-50" : "bg-muted/50"}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <CardTitle className="text-lg font-semibold">
            {account.accountName}
          </CardTitle>
          <CardDescription className="mt-1">
            ID: {account.accountId}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {account.accountType === "MCC" && (
            <Badge variant="outline" className="bg-blue-100 border-blue-200">
              MCC
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="bg-adops-600 hover:bg-adops-700 text-white"
            onClick={() => onViewDetails(account.id)}
          >
            Ver Detalles
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent className="pt-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Estado:
          </span>
          <Badge
            variant={account.connected ? "default" : "outline"}
            className={
              account.connected
                ? "bg-green-500 hover:bg-green-600"
                : "border-gray-300 text-gray-600"
            }
          >
            <div
              className={`w-2 h-2 rounded-full mr-1.5 ${
                account.connected ? "bg-white" : "bg-gray-400"
              }`}
            />
            {account.connected ? "Conectada" : "Desconectada"}
          </Badge>
        </div>
      </div>
    </CardContent>
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
