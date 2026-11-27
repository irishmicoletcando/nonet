import { Suspense } from "react";
import { ReviewScreen } from "@/components/review/ReviewScreen";

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="page-head">
          <h1>Puzzle review</h1>
        </div>
      }
    >
      <ReviewScreen />
    </Suspense>
  );
}
