import { createClient } from "@/lib/supabase/server";
import { CarouselManager, type CarouselPost } from "@/components/carrusel/carousel-manager";

export default async function CarruselPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("carousel_posts")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  return <CarouselManager posts={(posts ?? []) as CarouselPost[]} />;
}
