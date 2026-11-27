import { Suspense } from "react";
import { BoardSkeleton } from "@/components/board/BoardSkeleton";
import { PlayScreen } from "@/components/play/PlayScreen";

// `?daily=1` is read on the client with useSearchParams, so this page stays static.
export default function PlayPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <PlayScreen />
    </Suspense>
  );
}
