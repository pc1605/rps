import { Suspense } from "react";
import { DataTableSkeleton } from "@/components/rps/data-table";
import { PageHeader } from "@/components/rps/section";
import { BatchList } from "@/features/batches/components/batch-list";
import { CreateBatchDialog } from "@/features/batches/components/create-batch-dialog";

export default function BatchesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Batches"
        description="Production orders across all phases."
        actions={<CreateBatchDialog />}
      />
      <Suspense fallback={<DataTableSkeleton />}>
        <BatchList />
      </Suspense>
    </div>
  );
}
