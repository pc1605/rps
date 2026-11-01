import Link from "next/link";
import { PageHeader } from "@/components/rps/section";
import { FinishedGoods } from "@/features/stock/components/finished-goods";
import { SparesLink } from "@/features/stock/components/spares-link";

export default function StockPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description={
          <>
            Finished mats in the stockyard. Raw material (rolls, velcro, thread…) lives in{" "}
            <Link href="/materials" className="text-foreground underline-offset-2 hover:underline">
              Materials
            </Link>
            .
          </>
        }
      />
      <SparesLink />
      <FinishedGoods />
    </div>
  );
}
