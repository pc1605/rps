import { redirect } from "next/navigation";

// Lots moved under Materials in C2; keep old links working.
export default async function OldLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/materials/lots/${id}`);
}
