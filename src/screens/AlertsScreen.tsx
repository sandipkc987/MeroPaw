import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, SectionList, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { usePets } from "@src/contexts/PetContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { useAuth } from "@src/contexts/AuthContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Button } from "@src/components/UI";
import { fetchNotifications, updateNotificationRead } from "@src/services/supabaseData";
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

// Category Pill Component
const CategoryPill = ({ kind }: { kind: NotificationKind }) => {
  const { colors } = useTheme();
  const getColor = (k: NotificationKind) => {
    switch (k) {
      case 'health': return colors.accent; // Using our theme accent for health
      case 'activity': return '#60A5FA'; // Blue
      case 'wellness': return '#10B981'; // Green
      case 'expense': return '#FDBA74'; // Orange
      case 'memories': return '#FACC15'; // Yellow
      case 'shop': return '#F471B5'; // Pink
      case 'reminder': return '#A78BFA'; // Purple
      default: return colors.textMuted;
    }
  };

  const getIcon = (k: NotificationKind) => {
    switch (k) {
      case 'health':
        return 'medkit-outline';
      case 'activity':
        return 'walk-outline';
      case 'wellness':
        return 'heart-outline';
      case 'expense':
        return 'card-outline';
      case 'memories':
        return 'images-outline';
      case 'shop':
        return 'bag-handle-outline';
      case 'reminder':
        return 'alarm-outline';
      default:
        return 'notifications-outline';
    }
  };

  const color = getColor(kind);
  const iconName = getIcon(kind);

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${color}22`,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginRight: 8
    }}>
      <Ionicons name={iconName} size={16} color={color} style={{ marginRight: 6 }} />
      <Text style={{
        ...TYPOGRAPHY.xs,
        color: color,
        fontWeight: '700'
      }}>
        {kind[0].toUpperCase() + kind.slice(1)}
      </Text>
    </View>
  );
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
  const accentColor = (() => {
    switch (item.kind) {
      case 'health': return colors.accent;
      case 'activity': return '#60A5FA';
      case 'wellness': return '#10B981';
      case 'expense': return '#FDBA74';
      case 'memories': return '#FACC15';
      case 'shop': return '#F471B5';
      case 'reminder': return '#A78BFA';
      default: return colors.textMuted;
    }
  })();

  return (
    <TouchableOpacity
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.95}
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...SHADOWS.sm,
        opacity: item.read ? 0.7 : 1
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        <View style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: `${accentColor}20`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: SPACING.md,
        }}>
          {item.thumbUrl ? (
            <Image
              source={{ uri: item.thumbUrl }}
              style={{ width: 52, height: 52, borderRadius: 16 }}
            />
          ) : (
            <Ionicons name="notifications-outline" size={24} color={accentColor} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Text style={{
              ...TYPOGRAPHY.lg,
              fontWeight: '800',
              color: colors.text
            }} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={{
              backgroundColor: colors.bgSecondary,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                {dateLabel} · {timeLabel}
              </Text>
            </View>
          </View>

          {!!item.message && (
            <Text style={{
              ...TYPOGRAPHY.base,
              color: colors.textMuted,
              marginTop: 4
            }} numberOfLines={2}>
              {item.message}
            </Text>
          )}

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10
          }}>
            <CategoryPill kind={item.kind} />
            {!item.read && (
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.accent
              }} />
            )}
          </View>
        </View>
      </View>
      
      {!!item.ctaLabel && (
        <View style={{
          marginTop: 10,
          alignItems: 'flex-start'
        }}>
          <View style={{
            backgroundColor: `${colors.accent}12`,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.borderLight
          }}>
            <Text style={{
              ...TYPOGRAPHY.sm,
              color: colors.accent,
              fontWeight: "600"
            }}>
              {item.ctaLabel}
            </Text>
          </View>
        </View>
      )}
      
      {onReadToggle && (
        <TouchableOpacity
          onPress={() => onReadToggle(item.id)}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12
          }}
        >
          <Text style={{
            ...TYPOGRAPHY.xs,
            color: colors.accent
          }}>
            {item.read ? 'Mark unread' : 'Mark read'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default function AlertsScreen() {
  const { colors } = useTheme();
  const { navigateTo, setNavHidden } = useNavigation();
  const { user } = useAuth();
  const { getActivePet } = usePets();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const petNamePossessive = petName === "your pet" ? "your pet's" : petName.endsWith("s") ? `${petName}'` : `${petName}'s`;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const lastScrollYRef = useRef(0);

  const visibleItems = useMemo(() => {
    if (filter === "unread") return items.filter(item => !item.read);
    return items;
  }, [items, filter]);

  const sections = useMemo(() => {
    const sectionKey = (d: Date) => {
      const diffDays = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays <= 0) return 'Today';
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
    setItems(prev => prev.map(n => {
      if (n.id !== id) return n;
      nextRead = !n.read;
      return { ...n, read: nextRead };
    }));
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
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
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
    } else if (delta > 12) {
      setNavHidden(true);
    } else if (delta < -12) {
      setNavHidden(false);
    }
    lastScrollYRef.current = y;
  };

  useEffect(() => {
    return () => setNavHidden(false);
  }, [setNavHidden]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) {
        setItems([]);
        return;
      }
      try {
        const data = await fetchNotifications(user.id, activePet?.id);
        if (!cancelled) setItems(data);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, activePet?.id]);

  const unreadCount = useMemo(() => items.filter(item => !item.read).length, [items]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Notifications" showBackButton={false} />
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingBottom: 120
        }}
        stickySectionHeadersEnabled={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={{ paddingTop: SPACING.sm, paddingBottom: SPACING.md }}>
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
              Keeping up with {petNamePossessive} world
            </Text>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: SPACING.sm,
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
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{
            ...TYPOGRAPHY.lg,
            fontWeight: '800',
            color: colors.text,
            marginTop: SPACING.lg,
            marginBottom: SPACING.sm
          }}>
            {title}
          </Text>
        )}
        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            onReadToggle={toggleRead}
            onPress={handlePress}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.accent + "15",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.md,
              }}
            >
              <Ionicons name="notifications-off-outline" size={28} color={colors.accent} />
            </View>
            <Text style={{
              ...TYPOGRAPHY.base,
              color: colors.text
            }}>
              You're all caught up
            </Text>
            <Text style={{
              ...TYPOGRAPHY.sm,
              color: colors.textMuted,
              marginTop: SPACING.xs,
              marginBottom: SPACING.lg,
              textAlign: "center",
            }}>
              Turn on alerts to stay updated on health and reminders.
            </Text>
            <Button
              title="Manage notifications"
              onPress={() => navigateTo("NotificationsSettings")}
              size="sm"
            />
          </View>
        }
      />
    </View>
  );
}