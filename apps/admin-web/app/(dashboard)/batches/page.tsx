import { Suspense } from "react";
import { BatchList } from "@/features/batches/components/batch-list";
import { CreateBatchDialog } from "@/features/batches/components/create-batch-dialog";

export default function BatchesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batches</h1>
          <p className="text-muted-foreground mt-1">
            Production orders across all phases.
          </p>
        </div>
        <CreateBatchDialog />
      </div>
      <Suspense
        fallback={
          <p className="font-mono text-sm text-muted-foreground">Loading…</p>
        }
      >
        <BatchList />
      </Suspense>
    </div>
  );
}
