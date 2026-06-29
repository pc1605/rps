import { BatchList } from "@/features/batches/components/batch-list";
import { CreateBatchDialog } from "@/features/batches/components/create-batch-dialog";

export default function BatchesPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-extrabold">Batches</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Production orders across all phases.
          </p>
        </div>
        <CreateBatchDialog />
      </div>
      <BatchList />
    </>
  );
}
