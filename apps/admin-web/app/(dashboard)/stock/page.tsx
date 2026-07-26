import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RollList } from "@/features/stock/components/roll-list";
import { AddRollDialog } from "@/features/stock/components/add-roll-dialog";
import { FinishedGoods } from "@/features/stock/components/finished-goods";

export default function StockPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock</h1>
          <p className="text-muted-foreground mt-1">
            Raw material in, finished mats out.
          </p>
        </div>
      </div>

      <Tabs defaultValue="raw">
        <TabsList>
          <TabsTrigger value="raw">Raw Material</TabsTrigger>
          <TabsTrigger value="finished">Finished Goods</TabsTrigger>
        </TabsList>

        <TabsContent value="raw" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <AddRollDialog />
          </div>
          <RollList />
        </TabsContent>

        <TabsContent value="finished" className="pt-4">
          <FinishedGoods />
        </TabsContent>
      </Tabs>
    </div>
  );
}
