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
  imageUrl: z.string().url().max(2000).optional().or(z.literal("")),
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
    imageUrl: formData.get("imageUrl") || "",
  });

  if (!parsed.success) return { ok: false, error: "Revisa los datos del producto." };

  const payload = {
    name: parsed.data.name,
    price: parsed.data.price,
    stock: parsed.data.stock,
    low_stock_threshold: parsed.data.lowStockThreshold,
    critical_stock_threshold: parsed.data.criticalStockThreshold,
    image_url: parsed.data.imageUrl || null,
  };

  const query = productId
    ? supabase.from("products").update(payload).eq("id", productId)
    : supabase.from("products").insert(payload);

  const { error } = await query;
  if (error) return { ok: false, error: `No se pudo guardar el producto: ${error.message}` };

  revalidatePath("/productos");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(productId);
  if (!idCheck.success) return { ok: false, error: "Producto inválido." };

  const { error } = await supabase.from("products").delete().eq("id", idCheck.data);
  if (error) return { ok: false, error: "No se pudo eliminar el producto." };

  revalidatePath("/productos");
  revalidatePath("/");
  return { ok: true };
}

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(150),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(100000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(["single", "package"]),
  imageUrl: z.string().url().max(2000).optional().or(z.literal("")),
  isPublic: z.enum(["true", "false"]).default("true"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
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
    kind: formData.get("kind") || "single",
    imageUrl: formData.get("imageUrl") || "",
    isPublic: formData.get("isPublic") || "true",
    description: formData.get("description") || "",
  });

  if (!parsed.success) return { ok: false, error: "Revisa los datos del servicio." };

  const packageItemIds = formData
    .getAll("packageItems")
    .map(String)
    .filter((id) => z.string().uuid().safeParse(id).success);

  if (parsed.data.kind === "package" && packageItemIds.length === 0) {
    return { ok: false, error: "Selecciona al menos un servicio para el paquete." };
  }

  const payload = {
    name: parsed.data.name,
    duration_minutes: parsed.data.durationMinutes,
    price: parsed.data.price,
    color: parsed.data.color,
    kind: parsed.data.kind,
    image_url: parsed.data.imageUrl || null,
    is_public: parsed.data.isPublic === "true",
    description: parsed.data.description || null,
  };

  let id = serviceId;
  if (id) {
    const { error } = await supabase.from("services").update(payload).eq("id", id);
    if (error) return { ok: false, error: `No se pudo guardar el servicio: ${error.message}` };
  } else {
    const { data, error } = await supabase.from("services").insert(payload).select("id").single();
    if (error || !data) return { ok: false, error: `No se pudo guardar el servicio: ${error?.message}` };
    id = data.id;
  }

  await supabase.from("service_package_items").delete().eq("package_id", id);
  if (parsed.data.kind === "package" && packageItemIds.length > 0) {
    const rows = packageItemIds.map((itemId) => ({ package_id: id, item_service_id: itemId }));
    const { error: itemsError } = await supabase.from("service_package_items").insert(rows);
    if (itemsError) return { ok: false, error: "No se pudieron guardar los servicios del paquete." };
  }

  revalidatePath("/servicios");
  return { ok: true };
}

export async function deleteService(serviceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "No autenticado." };

  const idCheck = z.string().uuid().safeParse(serviceId);
  if (!idCheck.success) return { ok: false, error: "Servicio inválido." };

  const { error } = await supabase.from("services").delete().eq("id", idCheck.data);
  if (error) return { ok: false, error: "No se pudo eliminar. Puede estar en uso por citas existentes." };

  revalidatePath("/servicios");
  return { ok: true };
}
