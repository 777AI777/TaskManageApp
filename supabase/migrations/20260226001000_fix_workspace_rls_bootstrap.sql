drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
on public.workspaces for select
to authenticated
using (
  public.has_workspace_access(id)
  or created_by = auth.uid()
);

drop policy if exists "workspace_members_insert_admin" on public.workspace_members;
create policy "workspace_members_insert_admin"
on public.workspace_members for insert
to authenticated
with check (
  public.has_workspace_admin_access(workspace_id)
  or (
    user_id = auth.uid()
    and role = 'workspace_admin'
    and exists (
      select 1
      from public.workspaces w
      where w.id = workspace_id
        and w.created_by = auth.uid()
    )
  )
);
