import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useAuth } from "@src/contexts/AuthContext";
import { fetchDiscoverFeed, type DiscoverFeedItem } from "@src/services/feedService";

interface DiscoverFeedContextType {
  items: DiscoverFeedItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  loadFeed: (forceRefresh?: boolean) => Promise<void>;
  updateItem: (id: string, type: "memory" | "status", updater: (item: DiscoverFeedItem) => DiscoverFeedItem) => void;
}

const DiscoverFeedContext = createContext<DiscoverFeedContextType | undefined>(undefined);

export function DiscoverFeedProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<DiscoverFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef<DiscoverFeedItem[]>([]);
  itemsRef.current = items;

  const loadFeed = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) {
        setItems([]);
        setLoading(false);
        return;
      }

      const hasCache = itemsRef.current.length > 0;

      if (forceRefresh) {
        setRefreshing(true);
      } else if (!hasCache) {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await fetchDiscoverFeed(20, 0);
        setItems(res.items);
      } catch (e) {
        setError((e as Error).message || "Failed to load feed");
        if (!hasCache) setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  const updateItem = useCallback(
    (id: string, type: "memory" | "status", updater: (item: DiscoverFeedItem) => DiscoverFeedItem) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id && it.type === type ? updater(it) : it))
      );
    },
    []
  );

  return (
    <DiscoverFeedContext.Provider
      value={{ items, loading, refreshing, error, loadFeed, updateItem }}
    >
      {children}
    </DiscoverFeedContext.Provider>
  );
}

export function useDiscoverFeed() {
  const ctx = useContext(DiscoverFeedContext);
  if (!ctx) throw new Error("useDiscoverFeed must be used within DiscoverFeedProvider");
  return ctx;
}
