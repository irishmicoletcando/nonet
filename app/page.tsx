import { USER_NAME } from "@/lib/constants";

// M1 placeholder: headline only. The full Home screen arrives in M6.
export default function HomePage() {
  return (
    <div className="page-head">
      <h1>Good morning, {USER_NAME}</h1>
    </div>
  );
}
