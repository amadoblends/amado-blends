"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, Plus } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { ProductModal, type ProductData } from "@/components/productos/product-modal";

export function ProductsManager({ products }: { products: ProductData[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductData | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: ProductData) {
    setEditing(p);
    setModalOpen(true);
  }

  return (
    <div className="px-4 pt-[max(16px,var(--safe-top))] pb-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mas" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Productos</h1>
        </div>
        <button
          onClick={openCreate}
          className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center"
          aria-label="Nuevo producto"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center">
              <Plus size={24} className="text-brand" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Aún no tienes productos</p>
              <p className="text-xs text-muted mt-0.5">Agrega tu primer producto para empezar a llevar tu inventario.</p>
            </div>
            <button onClick={openCreate} className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl">
              Agregar producto
            </button>
          </div>
        ) : (
          products.map((p) => {
            const critical = p.stock <= p.critical_stock_threshold;
            const low = !critical && p.stock <= p.low_stock_threshold;
            return (
              <button
                key={p.id}
                onClick={() => openEdit(p)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-background text-left"
              >
                <div className="w-11 h-11 rounded-lg bg-background border border-border shrink-0 relative overflow-hidden">
                  {p.image_url && <Image src={p.image_url} alt="" fill className="object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.stock} en stock</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatCurrency(Number(p.price))}</p>
                  {(critical || low) && (
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", critical ? "text-danger" : "text-warning")}>
                      <AlertTriangle size={10} /> {critical ? "Crítico" : "Bajo"}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      <ProductModal open={modalOpen} onClose={() => setModalOpen(false)} product={editing} />
    </div>
  );
}
