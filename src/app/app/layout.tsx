import { AppShell } from "@/components/app/app-shell";
import { requireServerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { supabase, user } = await requireServerUser();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id);

  const workspaceIds = (memberships ?? []).map((membership) => membership.workspace_id);
  const { data: workspaces } = workspaceIds.length
    ? await supabase.from("workspaces").select("id, name").in("id", workspaceIds).order("name")
    : { data: [] as Array<{ id: string; name: string }> };

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <AppShell
      userEmail={user.email ?? "unknown"}
      unreadNotifications={count ?? 0}
      workspaces={workspaces ?? []}
    >
      {children}
    </AppShell>
  );
}
