import { Suspense } from "react";
import { NoteView } from "./NoteView";

export const metadata = { title: "Minders" };

// A query string keeps this working as plain static files: /note?id=...
export default function NotePage() {
  return (
    <Suspense fallback={<div className="screen" />}>
      <NoteView />
    </Suspense>
  );
}
