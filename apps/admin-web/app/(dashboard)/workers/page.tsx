import { PageHeader } from "@/components/rps/section";
import { CreateWorkerDialog } from "@/features/workers/components/create-worker-dialog";
import { WorkerList } from "@/features/workers/components/worker-list";

export default function WorkersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Everyone on the floor, their station, and phone enrollment."
        actions={<CreateWorkerDialog />}
      />
      <WorkerList />
    </div>
  );
}
