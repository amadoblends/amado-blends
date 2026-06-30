import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/productos/product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).single();

  if (!product) notFound();

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/productos" className="w-9 h-9 rounded-full border border-border flex items-center justify-center">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-foreground">Editar producto</h1>
      </header>
      <ProductForm
        productId={product.id}
        defaults={{
          name: product.name,
          price: Number(product.price),
          stock: product.stock,
          lowStockThreshold: product.low_stock_threshold,
          criticalStockThreshold: product.critical_stock_threshold,
        }}
      />
    </div>
  );
}
