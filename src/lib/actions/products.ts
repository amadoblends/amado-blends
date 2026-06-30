"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/appointments";

const productSchema = z.object({
  name: z.string().trim().min(1).max(150),
  price: z.coerce.number().min(0).max(100000),
  stock: z.coerce.number().int().min(0).max(100000),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  criticalStockThreshold: z.coerce.number().int().min(0).max(100000),
});

export async function upsertProduct(productId: string | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    criticalStockThreshold: formData.get("criticalStockThreshold"),
  });

  if (!parsed.success) return { ok: false, error: "Revisa los datos del producto." };

  const payload = {
    name: parsed.data.name,
    price: parsed.data.price,
    stock: parsed.data.stock,
    low_stock_threshold: parsed.data.lowStockThreshold,
    critical_stock_threshold: parsed.data.criticalStockThreshold,
  };

  const query = productId
    ? supabase.from("products").update(payload).eq("id", productId)
    : supabase.from("products").insert(payload);

  const { error } = await query;
  if (error) return { ok: false, error: "No se pudo guardar el producto." };

  revalidatePath("/productos");
  revalidatePath("/");
  return { ok: true };
}

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(150),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(100000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function upsertService(serviceId: string | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
    color: formData.get("color"),
  });

  if (!parsed.success) return { ok: false, error: "Revisa los datos del servicio." };

  const payload = {
    name: parsed.data.name,
    duration_minutes: parsed.data.durationMinutes,
    price: parsed.data.price,
    color: parsed.data.color,
  };

  const query = serviceId
    ? supabase.from("services").update(payload).eq("id", serviceId)
    : supabase.from("services").insert(payload);

  const { error } = await query;
  if (error) return { ok: false, error: "No se pudo guardar el servicio." };

  revalidatePath("/servicios");
  return { ok: true };
}
