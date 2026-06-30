export type AppointmentStatus = "confirmada" | "pendiente" | "completada" | "cancelada";
export type ClientSegment = "frecuente" | "nuevo" | "inactivo" | "regular";
export type NoteType = "preferencias" | "productos" | "estilo" | "otros";
export type StockLevel = "ok" | "bajo" | "critico";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: "admin";
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      services: {
        Row: {
          id: string;
          name: string;
          duration_minutes: number;
          price: number;
          color: string;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["services"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["services"]["Row"]>;
      };
      clients: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string | null;
          avatar_url: string | null;
          birth_date: string | null;
          quick_notes: string | null;
          segment: ClientSegment;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
      };
      appointments: {
        Row: {
          id: string;
          client_id: string;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status: AppointmentStatus;
          price: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
      };
      products: {
        Row: {
          id: string;
          name: string;
          price: number;
          stock: number;
          low_stock_threshold: number;
          critical_stock_threshold: number;
          units_sold: number;
          image_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
      };
      client_notes: {
        Row: {
          id: string;
          client_id: string;
          type: NoteType;
          content: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_notes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["client_notes"]["Row"]>;
      };
      client_preferences: {
        Row: {
          id: string;
          client_id: string;
          preferred_style: string | null;
          payment_method: string | null;
          products_used: string[] | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_preferences"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["client_preferences"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          title: string;
          body: string;
          read: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
      dashboard_layout: {
        Row: {
          id: string;
          admin_id: string;
          card_order: string[];
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["dashboard_layout"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["dashboard_layout"]["Row"]>;
      };
    };
  };
}
