
import React from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserProfileForm from "@/components/user/UserProfileForm";
import SubscriptionManagement from "@/components/user/SubscriptionManagement";
import PaymentMethods from "@/components/user/PaymentMethods";

const UserSettingsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración de cuenta</h1>
          <p className="text-muted-foreground">
            Gestiona tu información personal, suscripción y métodos de pago
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="subscription">Suscripción</TabsTrigger>
            <TabsTrigger value="payment">Métodos de pago</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <UserProfileForm />
          </TabsContent>

          <TabsContent value="subscription" className="space-y-4">
            <SubscriptionManagement />
          </TabsContent>

          <TabsContent value="payment" className="space-y-4">
            <PaymentMethods />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default UserSettingsPage;