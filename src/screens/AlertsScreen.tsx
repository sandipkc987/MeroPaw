import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, SectionList, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, TYPOGRAPHY, SHADOWS, RADIUS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { usePets } from "@src/contexts/PetContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Button } from "@src/components/UI";
import { fetchNotifications, markAllNotificationsRead, updateNotificationRead } from "@src/services/supabaseData";
import storage from "@src/utils/storage";

// Types
type NotificationKind = 'health' | 'activity' | 'wellness' | 'expense' | 'memories' | 'shop' | 'system' | 'reminder';

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  timeISO: string;
  read?: boolean;
  ctaLabel?: string;
  thumbUrl?: string;
  metadata?: Record<string, any>;
}

const getKindStyle = (kind: NotificationKind) => {
  switch (kind) {
    case 'health': return { icon: 'medkit-outline' as const, tint: '#8B5CF6' };
    case 'activity': return { icon: 'walk-outline' as const, tint: '#60A5FA' };
    case 'wellness': return { icon: 'heart-outline' as const, tint: '#10B981' };
    case 'expense': return { icon: 'card-outline' as const, tint: '#F59E0B' };
    case 'memories': return { icon: 'images-outline' as const, tint: '#FACC15' };
    case 'shop': return { icon: 'bag-handle-outline' as const, tint: '#F471B5' };
    case 'reminder': return { icon: 'alarm-outline' as const, tint: '#A78BFA' };
    default: return { icon: 'notifications-outline' as const, tint: '#94A3B8' };
  }
};

// Notification Card Component
const NotificationCard = ({
  item,
  onPress,
  onReadToggle
}: {
  item: NotificationItem;
  onPress?: (item: NotificationItem) => void;
  onReadToggle?: (id: string) => void;
}) => {
  const { colors } = useTheme();
  const t = new Date(item.timeISO);
  const timeLabel = t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dateLabel = t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const kindStyle = getKindStyle(item.kind);

  const tint = kindStyle.tint;
  const topGradientColors = [tint + "20", tint + "0A", "transparent"] as const;
  const leftBarColors = [tint, tint + "00"] as const;

  return (
    <TouchableOpacity
      onPress={() => onPress?.(item)}
      activeOpacity={0.95}
      style={{
        flexDirection: "column",
        backgroundColor: colors.card,
        borderRadius: RADIUS.lg,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: colors.borderLight,
        overflow: "hidden",
        opacity: item.read ? 0.75 : 1,
        ...SHADOWS.sm,
      }}
    >
      <LinearGradient
        colors={topGradientColors}
        style={{ height: 24, width: "100%" }}
      />
      <View style={{ flexDirection: "row", flex: 1 }}>
      <View style={{ width: 4, overflow: "hidden" }}>
        <LinearGradient
          colors={leftBarColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4 }}
        />
      </View>
      <View style={{ flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: RADIUS.md,
            backgroundColor: `${kindStyle.tint}18`,
            alignItems: "center",
            justifyContent: "center",
            marginRight: SPACING.sm,
          }}>
            {item.thumbUrl ? (
              <Image source={{ uri: item.thumbUrl }} style={{ width: 36, height: 36, borderRadius: RADIUS.md }} />
            ) : (
              <Ionicons name={kindStyle.icon} size={18} color={kindStyle.tint} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "700", color: colors.text }} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 1 }}>
              {dateLabel} · {timeLabel}
            </Text>
          </View>
        </View>

        {!!item.message && (
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 4 }} numberOfLines={2}>
            {item.message}
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 6, gap: 6 }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: RADIUS.pill,
            backgroundColor: `${kindStyle.tint}18`,
          }}>
            <Ionicons name={kindStyle.icon} size={10} color={kindStyle.tint} style={{ marginRight: 3 }} />
            <Text style={{ fontSize: 10, fontWeight: "600", color: kindStyle.tint }}>
              {item.kind[0].toUpperCase() + item.kind.slice(1)}
            </Text>
          </View>
          {!item.read && (
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent }} />
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          {item.ctaLabel ? (
            <TouchableOpacity
              onPress={() => onPress?.(item)}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: RADIUS.sm,
                backgroundColor: `${tint}18`,
                borderWidth: 1,
                borderColor: tint + "40",
              }}
            >
              <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: tint }}>{item.ctaLabel}</Text>
            </TouchableOpacity>
          ) : <View />}
          {onReadToggle && (
            <TouchableOpacity onPress={() => onReadToggle(item.id)}>
              <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: tint }}>
                {item.read ? "Mark unread" : "Mark read"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      </View>
    </TouchableOpacity>
  );
};

export default function AlertsScreen() {
  const { colors } = useTheme();
  const { navigateTo, setNavHidden, goBack, canGoBack, setActiveScreen, setActiveTab, setUnreadNotificationCount } = useNavigation();
  const { user } = useAuth();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const petNamePossessive = petName === "your pet" ? "your pet's" : petName.endsWith("s") ? `${petName}'` : `${petName}'s`;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const lastScrollYRef = useRef(0);
  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const SCROLL_DOWN_THRESHOLD = 50;  // switch to compact (center) when scrolled past this
  const SCROLL_UP_THRESHOLD = 35;     // switch back to expanded (left) when above this

  const visibleItems = useMemo(() => {
    if (filter === "unread") return items.filter(item => !item.read);
    return items;
  }, [items, filter]);

  const sections = useMemo(() => {
    const sectionKey = (d: Date) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / (24 * 60 * 60 * 1000));
      
      if (diffDays === 0) return 'Today';
      if (diffDays <= 6) return 'Earlier this Week';
      return 'This Month';
    };

    const map: any = {};
    visibleItems.forEach(n => {
      const key = sectionKey(new Date(n.timeISO));
      (map[key] ||= []).push(n);
    });
    
    const order = ['Today', 'Earlier this Week', 'This Month'];
    return order.filter(k => map[k]?.length).map(k => ({ title: k, data: map[k] }));
  }, [visibleItems]);

  const toggleRead = (id: string) => {
    let nextRead = false;
    setItems(prev => {
      const updated = prev.map(n => {
        if (n.id !== id) return n;
        nextRead = !n.read;
        return { ...n, read: nextRead };
      });
      const newUnreadCount = updated.filter(n => !n.read).length;
      setUnreadNotificationCount(newUnreadCount);
      return updated;
    });
    if (user?.id) {
      updateNotificationRead(user.id, id, nextRead).catch(error => {
        console.error("Failed to update notification read state:", error);
      });
    }
  };

  const persistNotificationTarget = async (type: string, id?: string) => {
    if (!id) return;
    await storage.setItem("@kasper_notification_target", JSON.stringify({ type, id, ts: Date.now() }));
  };

  const handlePress = (item: NotificationItem) => {
    if (user?.id && !item.read) {
      updateNotificationRead(user.id, item.id, true).catch(error => {
        console.error("Failed to update notification read state:", error);
      });
      setItems(prev => {
        const updated = prev.map(n => n.id === item.id ? { ...n, read: true } : n);
        const newUnreadCount = updated.filter(n => !n.read).length;
        setUnreadNotificationCount(newUnreadCount);
        return updated;
      });
    }
    const metaType = item.metadata?.type;
    if (item.kind === "reminder") {
      persistNotificationTarget("reminder", item.metadata?.reminderId).catch(() => {});
      return navigateTo("Reminders");
    }
    if (item.kind === "health") {
      persistNotificationTarget("health", item.metadata?.recordId).catch(() => {});
      return navigateTo("Health");
    }
    if (item.kind === "memories") return navigateTo("Memories");
    if (item.kind === "expense") {
      if (metaType === "receipt_processed") return navigateTo("Receipts");
      persistNotificationTarget("expense", item.metadata?.expenseId).catch(() => {});
      return navigateTo("Expenses");
    }
    if (item.kind === "system") {
      if (metaType === "new_device") return navigateTo("LoginSecurity");
    }
  };

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset?.y ?? 0;
    const delta = y - lastScrollYRef.current;
    if (y <= 0) {
      setNavHidden(false);
      if (headerCompactRef.current) {
        headerCompactRef.current = false;
        setHeaderCompact(false);
      }
    } else {
      if (delta > 12) setNavHidden(true);
      else if (delta < -12) setNavHidden(false);
      const nextCompact = y >= SCROLL_DOWN_THRESHOLD ? true : y <= SCROLL_UP_THRESHOLD ? false : headerCompactRef.current;
      if (nextCompact !== headerCompactRef.current) {
        headerCompactRef.current = nextCompact;
        setHeaderCompact(nextCompact);
      }
    }
    lastScrollYRef.current = y;
  };

  useEffect(() => {
    return () => setNavHidden(false);
  }, [setNavHidden]);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setUnreadNotificationCount(0);
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchNotifications(user.id, activePet?.id);
      setItems(data);
      const newUnreadCount = data.filter((n: NotificationItem) => !n.read).length;
      setUnreadNotificationCount(newUnreadCount);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      setErrorMessage("Couldn't load notifications. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, activePet?.id, setUnreadNotificationCount]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user?.id) return;
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadNotificationCount(0);
    try {
      await markAllNotificationsRead(user.id, activePet?.id);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      await loadNotifications();
    }
  }, [user?.id, activePet?.id, loadNotifications, setUnreadNotificationCount]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await loadNotifications();
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loadNotifications]);

  const unreadCount = useMemo(() => items.filter(item => !item.read).length, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Notifications"
        showBackButton
        centerTitle={headerCompact}
        titleStyle={headerCompact ? { ...TYPOGRAPHY.sm, fontWeight: "400" } : { ...TYPOGRAPHY.base, fontWeight: "400" }}
        paddingTop={SPACING.lg}
        paddingBottom={headerCompact ? SPACING.sm : SPACING.lg}
        insetSeparator
        onBackPress={() => {
          if (canGoBack) {
            goBack();
            return;
          }
          setActiveScreen(null);
          setActiveTab("home");
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingBottom: 120
        }}
        stickySectionHeadersEnabled={false}
        onScroll={handleScroll}
        scrollEventThrottle={0}
        ListHeaderComponent={
          <View style={{ paddingTop: SPACING.sm, paddingBottom: SPACING.md }}>
            {errorMessage ? (
              <View style={{
                backgroundColor: colors.dangerLight,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.danger,
                padding: SPACING.sm,
                marginBottom: SPACING.md
              }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.danger, fontWeight: "600" }}>
                  {errorMessage}
                </Text>
                <TouchableOpacity onPress={loadNotifications} style={{ marginTop: SPACING.xs }}>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, fontWeight: "600" }}>
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.sm }}>
              Keeping up with {petNamePossessive} world
            </Text>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACING.sm,
            }}>
              <View style={{
                backgroundColor: colors.bgSecondary,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.borderLight,
              }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
                  {unreadCount} unread
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={handleMarkAllRead}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.accent, fontWeight: "700" }}>
                      Mark all read
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={{
                  flexDirection: "row",
                  backgroundColor: colors.bgSecondary,
                  borderRadius: 999,
                  padding: 4,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                }}>
                  {(["all", "unread"] as const).map(key => {
                    const active = filter === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setFilter(key)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          backgroundColor: active ? colors.card : "transparent",
                          borderWidth: active ? 1 : 0,
                          borderColor: active ? colors.borderLight : "transparent",
                        }}
                      >
                        <Text style={{ ...TYPOGRAPHY.sm, color: active ? colors.accent : colors.textMuted, fontWeight: "600" }}>
                          {key === "all" ? "All" : "Unread"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        }
        renderSectionHeader={({ section: { title, data } }) => (
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
              {title}
            </Text>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: 6 }}>
              {data.length}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            onReadToggle={toggleRead}
            onPress={handlePress}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 64, paddingHorizontal: SPACING.xl }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.accent + "18",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.lg,
              }}
            >
              <Ionicons
                name={isLoading ? "hourglass-outline" : "notifications-off-outline"}
                size={32}
                color={colors.accent}
              />
            </View>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, textAlign: "center" }}>
              {isLoading ? "Loading…" : "You're all caught up"}
            </Text>
            <Text style={{
              ...TYPOGRAPHY.sm,
              color: colors.textMuted,
              marginTop: SPACING.sm,
              marginBottom: SPACING.lg,
              textAlign: "center",
            }}>
              {errorMessage
                ? "We couldn't load your notifications."
                : "Turn on alerts to stay updated on health and reminders."}
            </Text>
            {errorMessage ? (
              <Button title="Retry" onPress={loadNotifications} size="sm" />
            ) : (
              <Button
                title="Manage notifications"
                onPress={() => navigateTo("NotificationsSettings")}
                size="sm"
              />
            )}
          </View>
        }
      />
    </View>
  );
}