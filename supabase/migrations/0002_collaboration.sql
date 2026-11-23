-- FlowSpace stage 3: sharing and real-time collaboration.
-- Run once in Supabase → SQL Editor after 0001 (safe to run again).

-- ---------- who can open a canvas ----------
create table if not exists public.canvas_members (
  canvas_id  uuid not null references public.canvases (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('editor', 'viewer')),
  added_at   timestamptz not null default now(),
  primary key (canvas_id, user_id)
);
create index if not exists canvas_members_user on public.canvas_members (user_id);

-- one link per canvas and role; turning a link off deletes it, so an old link stops working
create table if not exists public.canvas_links (
  token       text primary key check (char_length(token) between 16 and 64),
  canvas_id   uuid not null references public.canvases (id) on delete cascade,
  role        text not null check (role in ('editor', 'viewer')),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create unique index if not exists canvas_links_one_per_role on public.canvas_links (canvas_id, role);

-- shared document state (Yjs, base64) next to the JSON snapshot
alter table public.canvases add column if not exists ydoc text;

-- 'owner' | 'editor' | 'viewer' | null for the signed-in user
create or replace function public.canvas_role(cid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.canvases c where c.id = cid and c.owner_id = auth.uid()) then 'owner'
    else (select m.role from public.canvas_members m where m.canvas_id = cid and m.user_id = auth.uid())
  end
$$;
revoke all on function public.canvas_role(uuid) from public, anon;
grant execute on function public.canvas_role(uuid) to authenticated;

-- ---------- canvases: members can read, editors can save ----------
drop policy if exists "canvases: owner reads"   on public.canvases;
drop policy if exists "canvases: owner updates" on public.canvases;
drop policy if exists "canvases: members read"  on public.canvases;
drop policy if exists "canvases: editors update" on public.canvases;
create policy "canvases: members read" on public.canvases for select to authenticated
  using (public.canvas_role(id) is not null);
create policy "canvases: editors update" on public.canvases for update to authenticated
  using (public.canvas_role(id) in ('owner', 'editor'))
  with check (public.canvas_role(id) in ('owner', 'editor'));
-- insert (owner only) and delete (owner only) policies from 0001 stay as they are

-- ---------- members ----------
alter table public.canvas_members enable row level security;
drop policy if exists "members: visible to members"   on public.canvas_members;
drop policy if exists "members: owner changes roles"  on public.canvas_members;
drop policy if exists "members: owner removes, or leave" on public.canvas_members;
create policy "members: visible to members" on public.canvas_members for select to authenticated
  using (public.canvas_role(canvas_id) is not null);
create policy "members: owner changes roles" on public.canvas_members for update to authenticated
  using (public.canvas_role(canvas_id) = 'owner') with check (public.canvas_role(canvas_id) = 'owner');
create policy "members: owner removes, or leave" on public.canvas_members for delete to authenticated
  using (public.canvas_role(canvas_id) = 'owner' or user_id = (select auth.uid()));
revoke all on public.canvas_members from anon;
grant select, update, delete on public.canvas_members to authenticated;  -- joining goes through join_canvas()

-- ---------- share links (owner only) ----------
alter table public.canvas_links enable row level security;
drop policy if exists "links: owner reads"   on public.canvas_links;
drop policy if exists "links: owner creates" on public.canvas_links;
drop policy if exists "links: owner deletes" on public.canvas_links;
create policy "links: owner reads"   on public.canvas_links for select to authenticated using (public.canvas_role(canvas_id) = 'owner');
create policy "links: owner creates" on public.canvas_links for insert to authenticated with check (public.canvas_role(canvas_id) = 'owner' and created_by = (select auth.uid()));
create policy "links: owner deletes" on public.canvas_links for delete to authenticated using (public.canvas_role(canvas_id) = 'owner');
revoke all on public.canvas_links from anon;
grant select, insert, delete on public.canvas_links to authenticated;

-- open a share link: become a member with the link's role (never downgrades an editor)
create or replace function public.join_canvas(p_token text) returns table (canvas_id uuid, role text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  l public.canvas_links;
  cur text;
begin
  if auth.uid() is null then raise exception 'Sign in to open this canvas' using errcode = '28000'; end if;
  select * into l from public.canvas_links k where k.token = p_token;
  if not found then raise exception 'This share link has been turned off' using errcode = 'P0002'; end if;
  cur := public.canvas_role(l.canvas_id);
  if cur in ('owner', 'editor') or cur = l.role then
    return query select l.canvas_id, cur;
    return;
  end if;
  insert into public.canvas_members (canvas_id, user_id, role) values (l.canvas_id, auth.uid(), l.role)
    on conflict (canvas_id, user_id) do update set role = excluded.role;
  return query select l.canvas_id, l.role;
end $$;
revoke all on function public.join_canvas(text) from public, anon;
grant execute on function public.join_canvas(text) to authenticated;

-- people on a canvas (owner first), for the share dialog and avatars; only for people who can open it
create or replace function public.canvas_people(cid uuid) returns table (user_id uuid, email text, role text)
language sql stable security definer set search_path = '' as $$
  select c.owner_id, u.email::text, 'owner'::text
    from public.canvases c join auth.users u on u.id = c.owner_id
   where c.id = cid and public.canvas_role(cid) is not null
  union all
  select m.user_id, u.email::text, m.role
    from public.canvas_members m join auth.users u on u.id = m.user_id
   where m.canvas_id = cid and public.canvas_role(cid) is not null
$$;
revoke all on function public.canvas_people(uuid) from public, anon;
grant execute on function public.canvas_people(uuid) to authenticated;

-- ---------- thumbnails: members can see the owner's thumbnail ----------
create or replace function public.thumb_readable(path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare cid uuid;
begin
  begin
    cid := substring(path from '([0-9a-fA-F-]{36})\.png$')::uuid;
  exception when others then return false;
  end;
  return cid is not null and public.canvas_role(cid) is not null;
end $$;
revoke all on function public.thumb_readable(text) from public, anon;
grant execute on function public.thumb_readable(text) to authenticated;

drop policy if exists "thumbnails: members read" on storage.objects;
create policy "thumbnails: members read" on storage.objects for select to authenticated
  using (bucket_id = 'thumbnails' and public.thumb_readable(name));

-- ---------- real-time channels ----------
-- topics: 'fs:<canvas id>:doc' (document changes; editors send) and 'fs:<canvas id>:aw' (cursors and presence; everyone)
create or replace function public.topic_role(topic text) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if topic is null or topic !~ '^fs:[0-9a-fA-F-]{36}:(doc|aw)$' then return null; end if;
  return public.canvas_role(substring(topic from 4 for 36)::uuid);
end $$;
revoke all on function public.topic_role(text) from public, anon;
grant execute on function public.topic_role(text) to authenticated;

drop policy if exists "flowspace: members receive" on realtime.messages;
drop policy if exists "flowspace: members send"    on realtime.messages;
create policy "flowspace: members receive" on realtime.messages for select to authenticated
  using (public.topic_role((select realtime.topic())) is not null);
create policy "flowspace: members send" on realtime.messages for insert to authenticated
  with check (
    case when (select realtime.topic()) like '%:doc'
      then public.topic_role((select realtime.topic())) in ('owner', 'editor')
      else public.topic_role((select realtime.topic())) is not null
    end
  );
