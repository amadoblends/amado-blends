import { createClient } from "@/lib/supabase/server";
import { CarouselManager, type CarouselPost } from "@/components/carrusel/carousel-manager";

export default async function CarruselPage() {
  const supabase = await createClient();
  const { data: posts, error } = await supabase
    .from("carousel_posts")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  // 42P01 = table missing, i.e. the migration hasn't been run yet
  const loadError = error
    ? error.code === "42P01"
      ? "Falta crear la tabla del carrusel. Corre migration_16_carousel_status.sql en el SQL Editor de Supabase."
      : error.message
    : null;

  return (
    <CarouselManager posts={(posts ?? []) as CarouselPost[]} loadError={loadError} />
  );
}
