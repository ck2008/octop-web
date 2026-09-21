-- Octop Web MVP - initial schema
--
-- Creates the five core tables (profiles, projects, agents, conversations,
-- messages) together with indexes, updated_at triggers, table grants and Row
-- Level Security policies. The file is written so that a completely empty
-- database can be rebuilt from it in one pass.

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

-- `set search_path = ''` forces every identifier below to be schema qualified,
-- which stops a hostile search_path from resolving our calls somewhere else.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

comment on function public.set_updated_at() is
    'Trigger helper that stamps updated_at on every UPDATE.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
            split_part(coalesce(new.email, ''), '@', 1)
        )
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Creates the public.profiles row that mirrors a new auth.users row.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- auth.users INSERT -> public.profiles INSERT
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

create table public.projects (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint projects_name_not_blank check (length(trim(name)) > 0)
);

create trigger projects_set_updated_at
    before update on public.projects
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------

create table public.agents (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,

    name text not null,
    description text,
    system_prompt text not null default '',
    model text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint agents_name_not_blank check (length(trim(name)) > 0)
);

-- Lets conversations prove agent_id and project_id belong together with a
-- single composite foreign key instead of a trigger.
create unique index agents_id_project_id_key
    on public.agents(id, project_id);

create trigger agents_set_updated_at
    before update on public.agents
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

create table public.conversations (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    agent_id uuid not null references public.agents(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,

    title text not null default 'New Chat',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Database-level guarantee that conversation.project_id always matches
    -- agent.project_id, so the pair can never drift apart.
    constraint conversations_agent_matches_project
        foreign key (agent_id, project_id)
        references public.agents(id, project_id)
        on delete cascade
);

create trigger conversations_set_updated_at
    before update on public.conversations
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    owner_id uuid not null references auth.users(id) on delete cascade,

    role text not null,
    content text not null,

    created_at timestamptz not null default now(),

    constraint messages_role_check
        check (role in ('user', 'assistant'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_projects_owner_id
    on public.projects(owner_id);

create index idx_agents_project_id
    on public.agents(project_id);

create index idx_agents_owner_id
    on public.agents(owner_id);

create index idx_conversations_agent_id
    on public.conversations(agent_id);

create index idx_conversations_owner_id
    on public.conversations(owner_id);

create index idx_conversations_project_id
    on public.conversations(project_id);

create index idx_messages_conversation_created
    on public.messages(conversation_id, created_at);

create index idx_messages_owner_id
    on public.messages(owner_id);

-- ---------------------------------------------------------------------------
-- Grants
--
-- RLS decides which rows are visible; grants decide whether a role may touch
-- the table at all. Both matter, so anon is revoked explicitly rather than
-- left to rely on policies alone.
-- ---------------------------------------------------------------------------

revoke all on public.profiles      from anon;
revoke all on public.projects      from anon;
revoke all on public.agents        from anon;
revoke all on public.conversations from anon;
revoke all on public.messages      from anon;

revoke all on public.profiles      from authenticated;
revoke all on public.projects      from authenticated;
revoke all on public.agents        from authenticated;
revoke all on public.conversations from authenticated;
revoke all on public.messages      from authenticated;

-- profiles are created by the auth trigger, never by the browser.
grant select, update                 on public.profiles      to authenticated;
grant select, insert, update, delete on public.projects      to authenticated;
grant select, insert, update, delete on public.agents        to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
-- chat history is append-only for the client.
grant select, insert                 on public.messages      to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.agents        enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- profiles ------------------------------------------------------------------

create policy "profiles_select_own"
    on public.profiles for select
    to authenticated
    using ((select auth.uid()) = id);

create policy "profiles_update_own"
    on public.profiles for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

-- No INSERT policy: rows arrive via the on_auth_user_created trigger.

-- projects ------------------------------------------------------------------

create policy "projects_select_own"
    on public.projects for select
    to authenticated
    using ((select auth.uid()) = owner_id);

create policy "projects_insert_own"
    on public.projects for insert
    to authenticated
    with check ((select auth.uid()) = owner_id);

create policy "projects_update_own"
    on public.projects for update
    to authenticated
    using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);

create policy "projects_delete_own"
    on public.projects for delete
    to authenticated
    using ((select auth.uid()) = owner_id);

-- agents --------------------------------------------------------------------
--
-- Owning the agent row is not enough: the referenced project must belong to
-- the caller too, otherwise a client could attach an agent to somebody elses
-- project just by passing a foreign project_id.

create policy "agents_select_own"
    on public.agents for select
    to authenticated
    using ((select auth.uid()) = owner_id);

create policy "agents_insert_own"
    on public.agents for insert
    to authenticated
    with check (
        (select auth.uid()) = owner_id
        and exists (
            select 1
            from public.projects p
            where p.id = project_id
              and p.owner_id = (select auth.uid())
        )
    );

create policy "agents_update_own"
    on public.agents for update
    to authenticated
    using ((select auth.uid()) = owner_id)
    with check (
        (select auth.uid()) = owner_id
        and exists (
            select 1
            from public.projects p
            where p.id = project_id
              and p.owner_id = (select auth.uid())
        )
    );

create policy "agents_delete_own"
    on public.agents for delete
    to authenticated
    using ((select auth.uid()) = owner_id);

-- conversations -------------------------------------------------------------
--
-- Checks owner, project ownership, agent ownership and that the agent really
-- lives in that project. The composite FK enforces the last point as well; the
-- policy states it explicitly so the intent survives future schema edits.

create policy "conversations_select_own"
    on public.conversations for select
    to authenticated
    using ((select auth.uid()) = owner_id);

create policy "conversations_insert_own"
    on public.conversations for insert
    to authenticated
    with check (
        (select auth.uid()) = owner_id
        and exists (
            select 1
            from public.projects p
            where p.id = project_id
              and p.owner_id = (select auth.uid())
        )
        and exists (
            select 1
            from public.agents a
            where a.id = agent_id
              and a.owner_id = (select auth.uid())
              and a.project_id = project_id
        )
    );

create policy "conversations_update_own"
    on public.conversations for update
    to authenticated
    using ((select auth.uid()) = owner_id)
    with check (
        (select auth.uid()) = owner_id
        and exists (
            select 1
            from public.agents a
            where a.id = agent_id
              and a.owner_id = (select auth.uid())
              and a.project_id = project_id
        )
    );

create policy "conversations_delete_own"
    on public.conversations for delete
    to authenticated
    using ((select auth.uid()) = owner_id);

-- messages ------------------------------------------------------------------
--
-- Owning the message row is not sufficient - the conversation it is written
-- into has to belong to the caller too, so a message can never be injected
-- into somebody elses chat.

create policy "messages_select_own"
    on public.messages for select
    to authenticated
    using (
        (select auth.uid()) = owner_id
        and exists (
            select 1
            from public.conversations c
            where c.id = conversation_id
              and c.owner_id = (select auth.uid())
        )
    );

create policy "messages_insert_own"
    on public.messages for insert
    to authenticated
    with check (
        (select auth.uid()) = owner_id
        and exists (
            select 1
            from public.conversations c
            where c.id = conversation_id
              and c.owner_id = (select auth.uid())
        )
    );

-- No UPDATE or DELETE policy: deleting a conversation or project removes its
-- messages by cascade instead.
