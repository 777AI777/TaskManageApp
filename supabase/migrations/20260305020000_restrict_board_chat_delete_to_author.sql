begin;

drop policy if exists "board_chat_messages_all_board_member" on public.board_chat_messages;
drop policy if exists "board_chat_messages_select_board_member" on public.board_chat_messages;
drop policy if exists "board_chat_messages_insert_board_member" on public.board_chat_messages;
drop policy if exists "board_chat_messages_delete_owner" on public.board_chat_messages;

create policy "board_chat_messages_select_board_member"
on public.board_chat_messages
for select
to authenticated
using (public.has_board_access(board_id));

create policy "board_chat_messages_insert_board_member"
on public.board_chat_messages
for insert
to authenticated
with check (public.has_board_access(board_id) and user_id = auth.uid());

create policy "board_chat_messages_delete_owner"
on public.board_chat_messages
for delete
to authenticated
using (public.has_board_access(board_id) and user_id = auth.uid());

commit;
