import { PageHeader } from "@/components/rps/section";
import { SpareStock } from "@/features/stock/components/spare-stock";

export default function SparesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Stock", href: "/stock" }]}
        title="Spare mats"
        description="Cut and stitched mats from cancelled batches. They're offered on New batch for the same item."
      />
      <SpareStock />
    </div>
  );
}
