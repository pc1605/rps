import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddRollDialog } from "@/features/stock/components/add-roll-dialog";
import { FinishedGoods } from "@/features/stock/components/finished-goods";
import { RollList } from "@/features/stock/components/roll-list";

export default function StockPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stock" description="Raw material in, finished mats out." />

      <Tabs defaultValue="raw">
        <TabsList>
          <TabsTrigger value="raw">Raw material</TabsTrigger>
          <TabsTrigger value="finished">Finished goods</TabsTrigger>
        </TabsList>

        <TabsContent value="raw" className="space-y-4 pt-4">
          <SectionTitle aside={<AddRollDialog />}>Rolls</SectionTitle>
          <RollList />
        </TabsContent>

        <TabsContent value="finished" className="pt-4">
          <FinishedGoods />
        </TabsContent>
      </Tabs>
    </div>
  );
}
