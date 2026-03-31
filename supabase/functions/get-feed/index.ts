// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MEMORY_BUCKET = "memories";

function sanitizeStoragePath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  let s = path.trim();
  if (!s) return null;
  if (s.includes("..")) return null;
  s = s.replace(/^\.+/, "").replace(/^\/+/, "");
  if (!s || s.startsWith(".")) return null;
  return s;
}

function isValidStoragePath(path: string): boolean {
  return !!path && path.length > 1 && !path.includes("..") && !path.startsWith(".");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(30, Math.max(5, Number(body?.limit) || 20));
    const offset = Math.max(0, Number(body?.offset) || 0);

    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

    const fetchMemories = async () => {
      const { data, error } = await serviceSupabase
        .from("memories")
        .select(`
          id,
          owner_id,
          pet_id,
          media_type,
          storage_path,
          title,
          note,
          uploaded_at,
          created_at
        `)
        .eq("is_archived", false)
        .not("pet_id", "is", null)
        .order("uploaded_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    };

    const fetchPrivatePets = async () => {
      const { data, error } = await serviceSupabase
        .from("pet_visibility_policies")
        .select("pet_id")
        .eq("visibility", "private");
      if (error) throw error;
      return new Set((data || []).map((p: any) => p.pet_id));
    };

    const fetchStatusPosts = async () => {
      const { data, error } = await serviceSupabase
        .from("pet_status_posts")
        .select("id, owner_id, pet_id, status_text, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    };

    const [memoriesRaw, privatePetIds, statusPostsRaw] = await Promise.all([
      fetchMemories(),
      fetchPrivatePets(),
      fetchStatusPosts(),
    ]);

    const hasInvalidStoragePath = (path: string | null | undefined) => {
      if (!path || typeof path !== "string") return true;
      const t = path.trim();
      return !t || t.startsWith(".") || t.includes("..");
    };

    const petIdsToFetch = new Set<string>();
    const memoryItems = memoriesRaw
      .filter((m: any) => {
        if (m.owner_id === userId || privatePetIds.has(m.pet_id)) return false;
        if (hasInvalidStoragePath(m.storage_path)) return false;
        const san = sanitizeStoragePath(m.storage_path);
        if (!san || !isValidStoragePath(san)) return false;
        return true;
      })
      .map((m: any) => {
        petIdsToFetch.add(m.pet_id);
        return {
          id: m.id,
          type: "memory" as const,
          pet_id: m.pet_id,
          owner_id: m.owner_id,
          media_type: m.media_type || "photo",
          storage_path: m.storage_path,
          title: m.title || "",
          note: m.note || null,
          uploaded_at: m.uploaded_at || m.created_at,
          created_at: m.created_at,
        };
      });

    const statusItems = statusPostsRaw
      .filter((s: any) => s.owner_id !== userId && !privatePetIds.has(s.pet_id))
      .map((s: any) => {
        petIdsToFetch.add(s.pet_id);
        return {
          id: s.id,
          type: "status" as const,
          pet_id: s.pet_id,
          owner_id: s.owner_id,
          media_type: "text" as const,
          storage_path: null,
          title: s.status_text || "",
          note: null,
          uploaded_at: s.created_at,
          created_at: s.created_at,
        };
      });

    const allItems = [...memoryItems, ...statusItems].sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    );
    const paginated = allItems.slice(offset, offset + limit);

    if (paginated.length === 0) {
      return new Response(
        JSON.stringify({ items: [], has_more: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const petIds = Array.from(new Set(paginated.map((i: any) => i.pet_id)));
    const { data: petsData } = await serviceSupabase
      .from("pets")
      .select("id, name, photos, breed, age")
      .in("id", petIds);
    const petsMap = new Map((petsData || []).map((p: any) => [p.id, p]));

    const itemIdsByType = { memory: [] as string[], status: [] as string[] };
    paginated.forEach((i: any) => {
      itemIdsByType[i.type].push(i.id);
    });

    const memoryIds = paginated.filter((i: any) => i.type === "memory").map((i: any) => i.id);
    const statusIds = paginated.filter((i: any) => i.type === "status").map((i: any) => i.id);

    const likesMem = memoryIds.length > 0
      ? serviceSupabase.from("feed_likes").select("item_type, item_id").eq("item_type", "memory").in("item_id", memoryIds)
      : { data: [] };
    const likesStatus = statusIds.length > 0
      ? serviceSupabase.from("feed_likes").select("item_type, item_id").eq("item_type", "status").in("item_id", statusIds)
      : { data: [] };
    const commentsMem = memoryIds.length > 0
      ? serviceSupabase.from("feed_comments").select("item_type, item_id").eq("item_type", "memory").in("item_id", memoryIds)
      : { data: [] };
    const commentsStatus = statusIds.length > 0
      ? serviceSupabase.from("feed_comments").select("item_type, item_id").eq("item_type", "status").in("item_id", statusIds)
      : { data: [] };

    const userLikesMem =
      memoryIds.length > 0
        ? serviceSupabase
            .from("feed_likes")
            .select("item_type, item_id")
            .eq("user_id", userId)
            .eq("item_type", "memory")
            .in("item_id", memoryIds)
        : Promise.resolve({ data: [] as any[] });
    const userLikesStatus =
      statusIds.length > 0
        ? serviceSupabase
            .from("feed_likes")
            .select("item_type, item_id")
            .eq("user_id", userId)
            .eq("item_type", "status")
            .in("item_id", statusIds)
        : Promise.resolve({ data: [] as any[] });

    const [likesMemRes, likesStatusRes, commentsMemRes, commentsStatusRes, userLikesMemRes, userLikesStatusRes] =
      await Promise.all([likesMem, likesStatus, commentsMem, commentsStatus, userLikesMem, userLikesStatus]);

    const likesData = {
      data: [
        ...((likesMemRes as any).data || []),
        ...((likesStatusRes as any).data || []),
      ],
    };
    const commentsData = {
      data: [
        ...((commentsMemRes as any).data || []),
        ...((commentsStatusRes as any).data || []),
      ],
    };

    const likeCountMap: Record<string, number> = {};
    (likesData.data || []).forEach((r: any) => {
      const key = `${r.item_type}:${r.item_id}`;
      likeCountMap[key] = (likeCountMap[key] || 0) + 1;
    });

    const commentCountMap: Record<string, number> = {};
    (commentsData.data || []).forEach((r: any) => {
      const key = `${r.item_type}:${r.item_id}`;
      commentCountMap[key] = (commentCountMap[key] || 0) + 1;
    });

    const userLikedSet = new Set(
      [...((userLikesMemRes as any).data || []), ...((userLikesStatusRes as any).data || [])].map(
        (r: any) => `${r.item_type}:${r.item_id}`
      )
    );

    const uniquePaths = [
      ...new Set(
        paginated
          .filter((i: any) => i.storage_path)
          .map((i: any) => sanitizeStoragePath(i.storage_path))
          .filter((p: string | null): p is string => !!p && isValidStoragePath(p))
      ),
    ];
    const signedUrls: Record<string, string> = {};
    if (uniquePaths.length > 0) {
      await Promise.all(
        uniquePaths.map(async (path: string) => {
          try {
            const { data: signed } = await serviceSupabase.storage
              .from(MEMORY_BUCKET)
              .createSignedUrl(path, 60 * 60);
            if (signed?.signedUrl) signedUrls[path] = signed.signedUrl;
          } catch {
            try {
              const { data } = serviceSupabase.storage.from(MEMORY_BUCKET).getPublicUrl(path);
              if (data?.publicUrl) signedUrls[path] = data.publicUrl;
            } catch {
              /* skip invalid path */
            }
          }
        })
      );
    }

    const items = paginated.map((i: any) => {
      const pet = petsMap.get(i.pet_id);
      const petPhotos = pet?.photos;
      let petPhotoUrl: string | null = null;
      if (Array.isArray(petPhotos) && petPhotos[0]) {
        const raw = String(petPhotos[0]).trim();
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
          petPhotoUrl = raw;
        } else {
          const safePath = sanitizeStoragePath(raw);
          if (safePath && isValidStoragePath(safePath)) {
            try {
              const { data } = serviceSupabase.storage.from("memories").getPublicUrl(safePath);
              petPhotoUrl = data?.publicUrl || null;
            } catch {
              petPhotoUrl = null;
            }
          }
        }
      }

      return {
        id: i.id,
        type: i.type,
        pet_id: i.pet_id,
        pet_name: pet?.name || "Pet",
        pet_photo_url: petPhotoUrl,
        pet_breed: pet?.breed || null,
        pet_age: pet?.age || null,
        media_type: i.media_type,
        media_url: (() => {
          const san = sanitizeStoragePath(i.storage_path);
          return san && isValidStoragePath(san) ? signedUrls[san] || null : null;
        })(),
        title: i.title,
        note: i.note,
        created_at: i.created_at,
        like_count: likeCountMap[`${i.type}:${i.id}`] || 0,
        comment_count: commentCountMap[`${i.type}:${i.id}`] || 0,
        liked_by_me: userLikedSet.has(`${i.type}:${i.id}`),
      };
    });

    return new Response(
      JSON.stringify({
        items,
        has_more: allItems.length > offset + limit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("get-feed error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
