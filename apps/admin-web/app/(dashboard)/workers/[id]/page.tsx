"use client";

import { STATION_LABEL } from "@rps/shared";
import { QrCode } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Chip } from "@/components/rps/chip";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EnrollmentQrDialog } from "@/features/workers/components/enrollment-qr-dialog";
import { HandOverDialog } from "@/features/workers/components/hand-over-dialog";
import { ActiveToggle, EditWorkerDialog, ResetPinDialog } from "@/features/workers/components/worker-actions";
import { WorkerHistory, WorkerNow, WorkerOutput } from "@/features/workers/components/worker-sections";
import { useWorker } from "@/features/workers/hooks";
import { fmtAgo } from "@/lib/format";
import { stationTone } from "@/lib/tokens";

export default function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: w, isPending, isError } = useWorker(id);

  if (isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (isError || !w)
    return (
      <EmptyState
        title="Worker not found"
        body="The link may be wrong."
        action={
          <Button asChild variant="outline">
            <Link href="/workers">Back to workers</Link>
          </Button>
        }
      />
    );

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[{ label: "Workers", href: "/workers" }]}
        title={w.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={stationTone[w.station]} dot>
              {STATION_LABEL[w.station]}
            </Chip>
            <Chip
              tone={
                w.is_active
                  ? { text: "text-working", border: "border-working/30", dot: "bg-working" }
                  : { text: "text-muted-foreground", border: "border-border" }
              }
              dot={w.is_active}
            >
              {w.is_active ? "Active" : "Inactive"}
            </Chip>
            {w.phone && (
              <a href={`tel:${w.phone}`} className="text-small hover:text-foreground">
                {w.phone}
              </a>
            )}
            <span className="text-small">
              {w.last_login_at ? `Phone set up ${fmtAgo(w.last_login_at)}` : "Phone not enrolled yet"}
            </span>
          </span>
        }
        actions={
          <>
            <EnrollmentQrDialog
              workerId={w.id}
              workerName={w.name}
              trigger={
                <Button type="button" variant="outline">
                  <QrCode className="h-4 w-4" aria-hidden /> Enrollment QR
                </Button>
              }
            />
            <HandOverDialog worker={w} />
            <ResetPinDialog worker={w} />
            <EditWorkerDialog worker={w} />
            <ActiveToggle worker={w} />
          </>
        }
      />
      <WorkerNow worker={w} />
      <WorkerOutput worker={w} />
      <WorkerHistory worker={w} />
    </div>
  );
}
