import { createClient } from "@/lib/supabase/server";
import { CarouselManager, type CarouselPost } from "@/components/carrusel/carousel-manager";

const MISSING_TABLE_HINT =
  "Falta crear la tabla del carrusel. Corre migration_16_carousel_status.sql en el SQL Editor de Supabase.";

export default async function CarruselPage() {
  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("carousel_posts")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  // Postgres reports a missing table as 42P01; PostgREST wraps it as PGRST205
  const tableMissing =
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /schema cache|does not exist/i.test(error?.message ?? "");

  const loadError = error ? (tableMissing ? MISSING_TABLE_HINT : error.message) : null;

  return <CarouselManager posts={(posts ?? []) as CarouselPost[]} loadError={loadError} />;
}
