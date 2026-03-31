import { getSupabaseClient, supabaseUrl, supabaseAnonKey } from "@src/services/supabaseClient";

export interface DiscoverFeedItem {
  id: string;
  type: "memory" | "status";
  pet_id: string;
  pet_name: string;
  pet_photo_url: string | null;
  pet_breed: string | null;
  pet_age: string | null;
  media_type: "photo" | "video" | "text";
  media_url: string | null;
  title: string;
  note: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface DiscoverFeedResponse {
  items: DiscoverFeedItem[];
  has_more: boolean;
}

export interface FeedComment {
  id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  commenter_name?: string;
}

async function getSession() {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

function isInvalidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return true;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return true;
  if (/\.\./.test(url)) return true;
  if (/\/\./.test(url)) return true;
  if (/\/memories\/\./.test(url)) return true;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (/\/\.\./.test(path) || /\/\.(?:\/|$)/.test(path)) return true;
    return false;
  } catch {
    return true;
  }
}

export async function fetchDiscoverFeed(
  limit = 20,
  offset = 0
): Promise<DiscoverFeedResponse> {
  const session = await getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/get-feed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ limit, offset, filter: "global" }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `get-feed failed with status ${res.status}`);
  }
  const data = JSON.parse(text || "{}");
  const rawItems: DiscoverFeedItem[] = data.items || [];

  const sanitizedItems = rawItems.map((item) => ({
    ...item,
    media_url: isInvalidImageUrl(item.media_url) ? null : item.media_url,
    pet_photo_url: isInvalidImageUrl(item.pet_photo_url) ? null : item.pet_photo_url,
  }));

  return { items: sanitizedItems, has_more: !!data.has_more };
}

export async function likeFeedItem(
  userId: string,
  itemType: "memory" | "status",
  itemId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("feed_likes").insert({
    user_id: userId,
    item_type: itemType,
    item_id: itemId,
  });
  if (error) throw error;
}

export async function unlikeFeedItem(
  userId: string,
  itemType: "memory" | "status",
  itemId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("feed_likes")
    .delete()
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .eq("item_id", itemId);
  if (error) throw error;
}

export async function addFeedComment(
  userId: string,
  itemType: "memory" | "status",
  itemId: string,
  commentText: string
): Promise<FeedComment> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("feed_comments")
    .insert({
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      comment_text: commentText.slice(0, 500),
    })
    .select("id, user_id, comment_text, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    user_id: data.user_id,
    comment_text: data.comment_text,
    created_at: data.created_at,
  };
}

export async function fetchFeedComments(
  itemType: "memory" | "status",
  itemId: string
): Promise<FeedComment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("feed_comments")
    .select("id, user_id, comment_text, created_at")
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const comments = (data || []) as FeedComment[];
  const userIds = [...new Set(comments.map((c) => c.user_id))];
  if (userIds.length === 0) return comments;

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("owner_id, owner_preferred_first_name, owner_name")
    .in("owner_id", userIds);

  const nameMap = new Map<string, string>();
  (profiles || []).forEach((p: any) => {
    const name = p.owner_preferred_first_name || p.owner_name || "Pet parent";
    nameMap.set(p.owner_id, name);
  });

  return comments.map((c) => ({
    ...c,
    commenter_name: nameMap.get(c.user_id) || "Pet parent",
  }));
}

export async function upsertPetVisibilityPolicy(
  userId: string,
  petId: string,
  visibility: "private" | "global",
  shareMemories = true,
  shareStatus = true
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("pet_visibility_policies").upsert(
    {
      pet_id: petId,
      owner_id: userId,
      visibility,
      share_memories: shareMemories,
      share_status: shareStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "pet_id" }
  );
  if (error) throw error;
}

export async function fetchPetVisibilityPolicy(
  petId: string
): Promise<{ visibility: string; share_memories: boolean; share_status: boolean } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("pet_visibility_policies")
    .select("visibility, share_memories, share_status")
    .eq("pet_id", petId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function addStatusPost(
  userId: string,
  petId: string,
  statusText: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("pet_status_posts").insert({
    owner_id: userId,
    pet_id: petId,
    status_text: statusText.slice(0, 500),
  });
  if (error) throw error;
}
