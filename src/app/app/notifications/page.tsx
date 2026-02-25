import { NotificationCenter } from "@/components/notifications/notification-center";
import { requireServerUser } from "@/lib/auth";

export default async function NotificationsPage() {
  const { supabase, user } = await requireServerUser();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return <NotificationCenter initialNotifications={notifications ?? []} />;
}
