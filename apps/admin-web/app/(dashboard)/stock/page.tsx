import { RollList } from "@/features/stock/components/roll-list";
import { AddRollDialog } from "@/features/stock/components/add-roll-dialog";

export default function StockPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock</h1>
          <p className="text-muted-foreground mt-1">
            Rexine rolls — inventory and remaining stock.
          </p>
        </div>
        <AddRollDialog />
      </div>
      <RollList />
    </div>
  );
}
