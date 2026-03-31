import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@src/contexts/ThemeContext";
import { useAuth } from "@src/contexts/AuthContext";
import { usePets } from "@src/contexts/PetContext";
import ScreenHeader from "@src/components/ScreenHeader";
import { Input } from "@src/components/UI";
import { SPACING, TYPOGRAPHY, RADIUS, SHADOWS } from "@src/theme";
import { fetchHealthRecords } from "@src/services/supabaseData";

type VaccinationEntry = {
  name: string;
  date?: string;
  dueDate?: string;
  source: "manual" | "pdf";
  recordId?: string;
};

const toValidDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortDate = (value?: string) => {
  const date = toValidDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export default function VaccinationStatusScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { activePetId } = usePets();
  const [healthRecords, setHealthRecords] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [vaccinationTab, setVaccinationTab] = useState<"status" | "history" | "due">("status");
  const [vaccinationSearch, setVaccinationSearch] = useState("");

  const loadHealthRecords = async () => {
    if (!user?.id || !activePetId) {
      setHealthRecords([]);
      return;
    }
    try {
      const remote = await fetchHealthRecords(user.id, activePetId);
      setHealthRecords(remote);
    } catch (error) {
      console.error("VaccinationStatusScreen: Failed to load health records:", error);
      setHealthRecords([]);
    }
  };

  useEffect(() => {
    loadHealthRecords();
  }, [user?.id, activePetId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadHealthRecords();
    } finally {
      setIsRefreshing(false);
    }
  };

  const vaccinationEntries = useMemo(() => {
    const entries: VaccinationEntry[] = [];
    healthRecords.forEach((record) => {
      if (record.type === "vaccination") {
        const name = (record.title || "").trim();
        if (name.length >= 3) {
          entries.push({
            name: record.title || "Vaccination",
            date: record.date,
            source: "manual",
            recordId: record.id,
          });
        }
      }
      (record.pdfs || []).forEach((pdf: any) => {
        (pdf.extracted?.vaccinations || []).forEach((vax: any) => {
          if (!vax?.name || vax.name.trim().length < 3) return;
          entries.push({
            name: vax.name,
            date: vax.date,
            dueDate: vax.dueDate,
            source: "pdf",
            recordId: record.id,
          });
        });
      });
    });
    const deduped = new Map<string, VaccinationEntry>();
    entries.forEach((entry) => {
      const key = `${entry.name}|${entry.date || ""}|${entry.dueDate || ""}|${entry.source}`;
      if (!deduped.has(key)) deduped.set(key, entry);
    });
    return Array.from(deduped.values()).sort((a, b) => {
      const aTs = new Date(a.date || a.dueDate || 0).getTime();
      const bTs = new Date(b.date || b.dueDate || 0).getTime();
      return bTs - aTs;
    });
  }, [healthRecords]);

  const filteredVaccinations = useMemo(() => {
    const query = vaccinationSearch.trim().toLowerCase();
    const today = new Date().getTime();
    return vaccinationEntries.filter((entry) => {
      const matches = !query || entry.name.toLowerCase().includes(query);
      const dueTs = entry.dueDate ? new Date(entry.dueDate).getTime() : NaN;
      const isDue = Number.isFinite(dueTs) && dueTs < today;
      if (vaccinationTab === "due") return matches && isDue;
      return matches;
    });
  }, [vaccinationEntries, vaccinationSearch, vaccinationTab]);

  const statusEntries = useMemo(() => {
    const today = new Date().getTime();
    const map = new Map<string, VaccinationEntry>();
    filteredVaccinations.forEach((entry) => {
      const key = entry.name.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, entry);
        return;
      }
      const existingDate = new Date(existing.date || existing.dueDate || 0).getTime();
      const nextDate = new Date(entry.date || entry.dueDate || 0).getTime();
      if (nextDate > existingDate) map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aDue = new Date(a.dueDate || a.date || 0).getTime();
      const bDue = new Date(b.dueDate || b.date || 0).getTime();
      const aDuePast = Number.isFinite(aDue) && aDue < today;
      const bDuePast = Number.isFinite(bDue) && bDue < today;
      if (aDuePast !== bDuePast) return aDuePast ? 1 : -1;
      return aDue - bDue;
    });
  }, [filteredVaccinations]);

  const { dueCount, upToDateCount } = useMemo(() => {
    const today = new Date().getTime();
    let due = 0;
    let upToDate = 0;
    statusEntries.forEach((entry) => {
      const dueTs = entry.dueDate ? new Date(entry.dueDate).getTime() : NaN;
      if (Number.isFinite(dueTs) && dueTs < today) due++;
      else if (entry.dueDate || entry.date) upToDate++;
    });
    return { dueCount: due, upToDateCount: upToDate };
  }, [statusEntries]);

  const dueEntries = useMemo(
    () => statusEntries.filter((e) => e.dueDate && new Date(e.dueDate).getTime() < Date.now()),
    [statusEntries]
  );
  const upToDateEntries = useMemo(
    () => statusEntries.filter((e) => !e.dueDate || new Date(e.dueDate).getTime() >= Date.now()),
    [statusEntries]
  );

  const historyGroups = useMemo(() => {
    const map = new Map<string, VaccinationEntry[]>();
    filteredVaccinations.forEach((entry) => {
      const dateLabel = formatShortDate(entry.date || entry.dueDate || "") || "Unknown date";
      if (!map.has(dateLabel)) map.set(dateLabel, []);
      map.get(dateLabel)?.push(entry);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const aTs = a[0] === "Unknown date" ? 0 : new Date(a[0]).getTime();
      const bTs = b[0] === "Unknown date" ? 0 : new Date(b[0]).getTime();
      return bTs - aTs;
    });
  }, [filteredVaccinations]);

  const overdueForDueTab = useMemo(
    () => filteredVaccinations.filter((e) => e.dueDate && new Date(e.dueDate).getTime() < Date.now()),
    [filteredVaccinations]
  );

  const renderVaccineRow = (entry: VaccinationEntry, index: number, showStatus = true) => {
    const dueDate = toValidDate(entry.dueDate);
    const isDue = dueDate ? dueDate.getTime() < Date.now() : false;
    return (
      <View
        key={`${entry.name}-${index}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderRadius: RADIUS.lg,
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.md,
          marginBottom: SPACING.sm,
          borderWidth: 1,
          borderColor: colors.borderLight,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: RADIUS.md,
            backgroundColor: isDue ? colors.danger + "18" : colors.success + "18",
            alignItems: "center",
            justifyContent: "center",
            marginRight: SPACING.md,
          }}
        >
          <Ionicons
            name="medical-outline"
            size={20}
            color={isDue ? colors.danger : colors.success}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}
            numberOfLines={2}
          >
            {entry.name}
          </Text>
          {entry.date ? (
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
              Given {formatShortDate(entry.date)}
            </Text>
          ) : null}
          {entry.dueDate ? (
            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
              {isDue ? `Overdue since ${formatShortDate(entry.dueDate)}` : `Due ${formatShortDate(entry.dueDate)}`}
            </Text>
          ) : null}
        </View>
        {showStatus && entry.dueDate && (
          <View
            style={{
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: RADIUS.pill,
              backgroundColor: isDue ? colors.danger + "20" : colors.success + "20",
            }}
          >
            <Text
              style={{
                ...TYPOGRAPHY.xs,
                fontWeight: "600",
                color: isDue ? colors.danger : colors.success,
              }}
            >
              {isDue ? "Due" : "Up to date"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Vaccination Status"
        showBackButton
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "600", letterSpacing: -0.2 }}
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.sm}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* Summary hero */}
        <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.lg, marginBottom: SPACING.lg }}>
          <LinearGradient
            colors={[colors.accent + "14", colors.accent + "06", "transparent"]}
            style={{
              borderRadius: RADIUS.xl,
              paddingVertical: SPACING.lg,
              paddingHorizontal: SPACING.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                ...TYPOGRAPHY.xs,
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: SPACING.sm,
              }}
            >
              Protection overview
            </Text>
            <View style={{ flexDirection: "row", gap: SPACING.xl }}>
              <View>
                <Text style={{ ...TYPOGRAPHY["2xl"], fontWeight: "700", color: colors.success }}>
                  {upToDateCount}
                </Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Up to date</Text>
              </View>
              <View>
                <Text style={{ ...TYPOGRAPHY["2xl"], fontWeight: "700", color: dueCount > 0 ? colors.danger : colors.text }}>
                  {dueCount}
                </Text>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Due</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Tabs – swipeable */}
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.sm }}
          >
            {(["status", "history", "due"] as const).map((tab) => {
              const isActive = vaccinationTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setVaccinationTab(tab)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: SPACING.lg,
                    borderRadius: RADIUS.pill,
                    backgroundColor: isActive ? colors.accent : colors.surface,
                    ...(isActive ? SHADOWS.xs : {}),
                  }}
                >
                  <Text
                    style={{
                      ...TYPOGRAPHY.sm,
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? colors.white : colors.textMuted,
                    }}
                  >
                    {tab === "status" ? "Status" : tab === "history" ? "History" : "Due"}
                    {tab === "due" && dueCount > 0 ? ` (${dueCount})` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <Input
            placeholder="Search vaccinations"
            value={vaccinationSearch}
            onChangeText={setVaccinationSearch}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: SPACING.lg }}>
          {vaccinationTab === "status" && (
            <>
              {statusEntries.length === 0 ? (
                <View
                  style={{
                    paddingVertical: SPACING.xxl,
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="medical-outline" size={48} color={colors.textMuted} />
                  <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginTop: SPACING.md }}>
                    No vaccinations recorded yet
                  </Text>
                </View>
              ) : (
                <>
                  {dueEntries.length > 0 && (
                    <View style={{ marginBottom: SPACING.lg }}>
                      <Text
                        style={{
                          ...TYPOGRAPHY.xs,
                          color: colors.danger,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          marginBottom: SPACING.sm,
                          fontWeight: "600",
                        }}
                      >
                        Due / overdue
                      </Text>
                      {dueEntries.map((entry, i) => renderVaccineRow(entry, i, true))}
                    </View>
                  )}
                  {upToDateEntries.length > 0 && (
                    <View>
                      <Text
                        style={{
                          ...TYPOGRAPHY.xs,
                          color: colors.textMuted,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          marginBottom: SPACING.sm,
                          fontWeight: "600",
                        }}
                      >
                        Up to date
                      </Text>
                      {upToDateEntries.map((entry, i) => renderVaccineRow(entry, i, true))}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {vaccinationTab === "history" && (
            <>
              {historyGroups.length === 0 ? (
                <View style={{ paddingVertical: SPACING.xxl, alignItems: "center" }}>
                  <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted }}>No history yet</Text>
                </View>
              ) : (
                historyGroups.map(([label, entries]) => (
                  <View key={label} style={{ marginBottom: SPACING.lg }}>
                    <Text
                      style={{
                        ...TYPOGRAPHY.xs,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: SPACING.sm,
                        fontWeight: "600",
                      }}
                    >
                      {label}
                    </Text>
                    {entries.map((entry, index) => renderVaccineRow(entry, index, false))}
                  </View>
                ))
              )}
            </>
          )}

          {vaccinationTab === "due" && (
            <>
              {overdueForDueTab.length === 0 ? (
                <View
                  style={{
                    paddingVertical: SPACING.xxl,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: colors.success + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: SPACING.md,
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={32} color={colors.success} />
                  </View>
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>
                    All caught up
                  </Text>
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 4 }}>
                    No vaccinations due right now
                  </Text>
                </View>
              ) : (
                overdueForDueTab.map((entry, index) => renderVaccineRow(entry, index, true))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
