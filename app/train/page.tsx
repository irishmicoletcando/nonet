import { Suspense } from "react";
import { TrainScreen } from "@/components/train/TrainScreen";

export default function TrainPage() {
  return (
    <Suspense
      fallback={
        <div className="page-head">
          <h1>Technique trainer</h1>
        </div>
      }
    >
      <TrainScreen />
    </Suspense>
  );
}
