import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: set a customer's password through the Auth Admin API. */
export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; password: string }) => {
    if (!data?.userId || typeof data.userId !== "string") throw new Error("invalid_user");
    if (typeof data.password !== "string" || data.password.length < 6) throw new Error("weak_password");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
