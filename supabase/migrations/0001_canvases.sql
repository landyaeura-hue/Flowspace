-- FlowSpace stage 2: cloud canvases + thumbnails.
-- Run once in Supabase → SQL Editor (safe to run again: every statement is idempotent).

-- ---------- canvases ----------
create table if not exists public.canvases (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default 'Untitled canvas' check (char_length(name) <= 200),
  doc         jsonb not null,
  view        jsonb,
  node_count  integer not null default 0,
  thumb_path  text,
  -- bumped by the server whenever name or doc changes; clients save with "where version = <what I loaded>"
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint canvases_doc_size check (octet_length(doc::text) <= 20000000)
);

create index if not exists canvases_owner_updated on public.canvases (owner_id, updated_at desc);

create or replace function public.canvases_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
    if new.doc is distinct from old.doc or new.name is distinct from old.name then
      new.version := old.version + 1;
      new.updated_at := now();
    else
      new.version := old.version;
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists canvases_before_write on public.canvases;
create trigger canvases_before_write before insert or update on public.canvases
  for each row execute function public.canvases_before_write();

alter table public.canvases enable row level security;

drop policy if exists "canvases: owner reads"   on public.canvases;
drop policy if exists "canvases: owner inserts" on public.canvases;
drop policy if exists "canvases: owner updates" on public.canvases;
drop policy if exists "canvases: owner deletes" on public.canvases;
create policy "canvases: owner reads"   on public.canvases for select to authenticated using (owner_id = (select auth.uid()));
create policy "canvases: owner inserts" on public.canvases for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "canvases: owner updates" on public.canvases for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "canvases: owner deletes" on public.canvases for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.canvases from anon;
grant select, insert, update, delete on public.canvases to authenticated;

-- ---------- thumbnails (Storage) ----------
-- Private bucket; each user writes only under "<their user id>/…".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnails', 'thumbnails', false, 524288, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "thumbnails: owner reads"   on storage.objects;
drop policy if exists "thumbnails: owner inserts" on storage.objects;
drop policy if exists "thumbnails: owner updates" on storage.objects;
drop policy if exists "thumbnails: owner deletes" on storage.objects;
create policy "thumbnails: owner reads"   on storage.objects for select to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "thumbnails: owner inserts" on storage.objects for insert to authenticated
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "thumbnails: owner updates" on storage.objects for update to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "thumbnails: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = (select auth.uid())::text);
