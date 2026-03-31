-- Per-pet visibility policy
create table if not exists pet_visibility_policies (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references pets(id) on delete cascade,
  owner_id uuid not null,
  visibility text not null default 'global' check (visibility in ('private', 'global', 'local')),
  share_memories boolean default true,
  share_status boolean default true,
  local_radius_miles integer default 25,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (pet_id)
);

create index if not exists idx_pet_visibility_policies_visibility
  on pet_visibility_policies(visibility) where visibility != 'private';
create index if not exists idx_pet_visibility_policies_owner on pet_visibility_policies(owner_id);

alter table pet_visibility_policies enable row level security;

create policy "Users manage their pet visibility policies"
  on pet_visibility_policies for all
  using (auth.uid()::text = owner_id::text)
  with check (auth.uid()::text = owner_id::text);

-- Status posts (light text updates)
create table if not exists pet_status_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid not null references pets(id) on delete cascade,
  status_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pet_status_posts_pet on pet_status_posts(pet_id);
create index if not exists idx_pet_status_posts_created on pet_status_posts(created_at desc);

alter table pet_status_posts enable row level security;

create policy "Users manage their pet status posts"
  on pet_status_posts for all
  using (auth.uid()::text = owner_id::text)
  with check (auth.uid()::text = owner_id::text);

-- Likes (polymorphic: memory or status post)
create table if not exists feed_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_type text not null check (item_type in ('memory', 'status')),
  item_id uuid not null,
  created_at timestamptz default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists idx_feed_likes_item on feed_likes(item_type, item_id);
create index if not exists idx_feed_likes_user on feed_likes(user_id);

alter table feed_likes enable row level security;

create policy "Users manage their own likes"
  on feed_likes for all
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

create policy "Authenticated can read likes"
  on feed_likes for select
  using (auth.role() = 'authenticated');

-- Comments (polymorphic: memory or status post)
create table if not exists feed_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_type text not null check (item_type in ('memory', 'status')),
  item_id uuid not null,
  comment_text text not null,
  parent_id uuid references feed_comments(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_feed_comments_item on feed_comments(item_type, item_id);
create index if not exists idx_feed_comments_created on feed_comments(created_at);

alter table feed_comments enable row level security;

create policy "Users manage their own comments"
  on feed_comments for all
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

create policy "Authenticated can read comments"
  on feed_comments for select
  using (auth.role() = 'authenticated');
