import { Suspense } from "react";
import { Viewer } from "@/app/Viewer";

export const metadata = { title: "Footprint · Build" };

export default function BuildPage() {
  // Viewer reads ?url= via useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <Viewer />
    </Suspense>
  );
}
