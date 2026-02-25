import Link from "next/link";

import { RuleManager } from "@/components/automation/rule-manager";
import { requireServerUser } from "@/lib/auth";
import { assertBoardRole } from "@/lib/permissions";

export default async function BoardAutomationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const { supabase, user } = await requireServerUser();
  await assertBoardRole(supabase, boardId, user.id, ["board_admin"]);

  const { data: rules } = await supabase
    .from("automation_rules")
    .select("id, name, trigger, is_active")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <Link className="btn btn-secondary" href={`/app/workspaces/${workspaceId}/boards/${boardId}`}>
          ボードへ戻る
        </Link>
      </div>
      <RuleManager workspaceId={workspaceId} boardId={boardId} initialRules={rules ?? []} />
    </div>
  );
}
