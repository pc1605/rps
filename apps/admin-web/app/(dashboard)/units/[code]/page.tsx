"use client";

import type { ReworkEntry, ReworkPhoto } from "@rps/shared";
import { CircleDot, Package, Scissors, Shirt, Wrench } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { Chip } from "@/components/rps/chip";
import { EmptyState } from "@/components/rps/empty-state";
import { BatchLink, CarLink, LotLink, WorkerLink } from "@/components/rps/entity-link";
import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoLightbox } from "@/features/rework/components/photo-lightbox";
import { ReasonChip } from "@/features/rework/components/reason-chip";
import { RemoteImage } from "@/features/rework/components/remote-image";
import { useUnit } from "@/features/units/hooks";
import { fmtStamp } from "@/lib/format";
import { batchTone, sizeLabel, unitTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const decisionLabel = { to_stitcher: "Sent to stitcher", recut: "Re-cut", write_off: "Written off" } as const;

type Step = {
  key: string;
  icon: React.ElementType;
  tone: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  at?: string;
};

function ReworkBody({ r, onPhoto }: { r: ReworkEntry; onPhoto: (photos: ReworkPhoto[], i: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {r.reasons.map((x) => (
          <ReasonChip key={x} reason={x} />
        ))}
      </div>
      {r.note && <p className="text-small italic text-muted-foreground">&ldquo;{r.note}&rdquo;</p>}
      {r.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPhoto(r.photos, i)}
              className="h-16 w-16 overflow-hidden rounded-md border focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={`Open photo ${i + 1} of round ${r.round}`}
            >
              <RemoteImage
                src={p.url}
                alt={`Round ${r.round} photo ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      <div className="text-caption text-muted-foreground">
        Flagged by <WorkerLink id={r.flagged_by} name={r.flagged_by_name} className="text-foreground" />
        {r.decision && (
          <>
            {" "}
            · decision: <span className="text-foreground">{decisionLabel[r.decision]}</span>{" "}
            {fmtStamp(r.decided_at)}
          </>
        )}
        {r.new_batch_id && r.new_batch_code && (
          <>
            {" "}
            → <BatchLink id={r.new_batch_id} code={r.new_batch_code} />
          </>
        )}
        {r.fixed_at && (
          <>
            {" "}
            · fixed by{" "}
            <WorkerLink
              id={r.fixed_by}
              name={r.fixed_by_name ?? "stitcher"}
              className="text-foreground"
            />{" "}
            {fmtStamp(r.fixed_at)}
          </>
        )}
      </div>
    </div>
  );
}

export default function UnitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = use(params);
  const code = decodeURIComponent(raw);
  const { data, isPending, isError } = useUnit(code);
  const [lightbox, setLightbox] = useState<{ photos: ReworkPhoto[]; i: number } | null>(null);

  if (isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (isError || !data)
    return (
      <EmptyState
        title="Mat not found"
        body={`No mat with code ${code}.`}
        action={
          <Button asChild variant="outline">
            <Link href="/batches">Back to batches</Link>
          </Button>
        }
      />
    );

  const { unit: u, batch: b, cutting } = data;
  const state = u.status === "pending" && u.stitched_at ? "stitched" : u.status;
  const tone = unitTone[state as keyof typeof unitTone];
  const bTone = batchTone(b.current_phase, b.status);

  const steps: Step[] = [
    {
      key: "created",
      icon: CircleDot,
      tone: "text-muted-foreground",
      title: "Batch created",
      at: b.created_at,
    },
    ...cutting.map<Step>((c) => ({
      key: `cut-${c.id}`,
      icon: Scissors,
      tone: "text-phase-cutting",
      title: (
        <>
          Cut by <WorkerLink id={c.worker_id} name={c.worker_name} />
        </>
      ),
      body: c.completed_at
        ? `${c.quantity_completed ?? 0} pieces for the batch${b.roll_code ? ` · roll ${b.roll_code}` : ""}`
        : "cutting in progress",
      at: c.completed_at ?? c.started_at,
    })),
    ...(u.stitched_at
      ? [
          {
            key: "stitched",
            icon: Shirt,
            tone: "text-phase-stitching",
            title: (
              <>
                Stitched by <WorkerLink id={u.stitched_by} name={u.stitched_by_name} />
              </>
            ),
            at: u.stitched_at,
          },
        ]
      : []),
    ...(u.rework ?? []).map<Step>((r) => ({
      key: `rw-${r.id}`,
      icon: Wrench,
      tone: "text-danger",
      title: `Rework round ${r.round}${!r.fixed_at && (!r.decision || r.decision === "to_stitcher") ? " · open" : ""}`,
      body: <ReworkBody r={r} onPhoto={(photos, i) => setLightbox({ photos, i })} />,
      at: r.flagged_at,
    })),
    ...(u.packed_at
      ? [
          {
            key: "packed",
            icon: Package,
            tone: "text-phase-completed",
            title: (
              <>
                Packed by <WorkerLink id={u.packed_by} name={u.packed_by_name} />
              </>
            ),
            at: u.packed_at,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        mono
        crumbs={[
          { label: "Batches", href: "/batches" },
          { label: <span className="font-mono">{b.batch_code}</span>, href: `/batches/${b.id}` },
        ]}
        title={u.unit_code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CarLink id={b.car_model_id} className="text-foreground">
              {b.brand_name} {b.model_name}
            </CarLink>
            <span>
              · {sizeLabel[b.size_class] ?? b.size_class}
              {b.line_name ? ` · ${b.line_name}` : ""}
            </span>
            {b.roll_id && (
              <span className="text-small">
                · roll <LotLink id={b.roll_id} code={b.roll_code} />
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Chip tone={tone}>{tone.label}</Chip>
            <Chip tone={bTone} dot>
              Batch: {bTone.label}
            </Chip>
          </>
        }
      />

      <section>
        <SectionTitle>Journey</SectionTitle>
        <ol className="relative space-y-3 pl-6">
          <div className="absolute bottom-2 left-[9px] top-2 w-px bg-border" aria-hidden />
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.key} className="relative">
                <div
                  className={cn(
                    "absolute -left-6 top-3 grid h-5 w-5 place-items-center rounded-full border-2 bg-background",
                    s.tone,
                  )}
                  aria-hidden
                >
                  <Icon className="h-2.5 w-2.5" />
                </div>
                <Card className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-body font-medium">{s.title}</div>
                    {s.at && (
                      <time dateTime={s.at} className="tabular shrink-0 text-caption text-muted-foreground">
                        {fmtStamp(s.at)}
                      </time>
                    )}
                  </div>
                  {s.body && <div className="mt-1.5 text-small text-muted-foreground">{s.body}</div>}
                </Card>
              </li>
            );
          })}
          {!u.stitched_at && <li className="text-small text-muted-foreground">Not stitched yet.</li>}
        </ol>
      </section>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.i}
          open
          onOpenChange={(o) => !o && setLightbox(null)}
          title={`Rework photos — ${u.unit_code}`}
        />
      )}
    </div>
  );
}
