import { Suspense } from "react";

/** The reports tabs read ?from&to with useSearchParams — keep them inside a Suspense boundary. */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
