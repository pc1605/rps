import { WorkerList } from "@/features/workers/components/worker-list";
import { CreateWorkerDialog } from "@/features/workers/components/create-worker-dialog";

export default function WorkersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workers</h1>
          <p className="text-muted-foreground mt-1">
            Floor staff across all stations.
          </p>
        </div>
        <CreateWorkerDialog />
      </div>
      <WorkerList />
    </div>
  );
}
