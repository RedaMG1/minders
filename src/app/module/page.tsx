import { Suspense } from "react";
import { ModuleView } from "./ModuleView";

export const metadata = { title: "Minders" };

// A query string keeps this working as plain static files: /module?id=...
export default function ModulePage() {
  return (
    <Suspense fallback={<div className="screen" />}>
      <ModuleView />
    </Suspense>
  );
}
