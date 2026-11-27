// M1 placeholder: headline only. The Play screen arrives in M3.
export default async function PlayPage({ searchParams }: PageProps<"/play">) {
  const { daily } = await searchParams;
  return (
    <div className="page-head">
      <h1>{daily === "1" ? "Daily puzzle" : "Quick game"}</h1>
    </div>
  );
}
