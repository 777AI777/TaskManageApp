import { redirect } from "next/navigation";

import { getServerAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user } = await getServerAuth();
  if (user) {
    redirect("/app/workspaces");
  }
  redirect("/login");
}
