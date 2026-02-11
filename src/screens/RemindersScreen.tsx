import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, SectionList, TouchableOpacity, Modal, Alert, Platform, ScrollView, Linking } from "react-native";

// Conditionally import DateTimePicker only for native platforms
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  } catch (e) {
    console.warn("DateTimePicker not available");
  }
}
import { SPACING, TYPOGRAPHY, SHADOWS, RADIUS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { useNavigation } from "@src/contexts/NavigationContext";
import { usePets } from "@src/contexts/PetContext";
import { useAuth } from "@src/contexts/AuthContext";
import { Input, Button, Card } from "@src/components/UI";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import EmptyState from "@src/components/EmptyState";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import { fetchReminders, insertReminder, updateReminder, deleteReminder, insertNotification, hasReminderNotification } from "@src/services/supabaseData";
import storage from "@src/utils/storage";

// Types
type ReminderCategory = "walk" | "meal" | "medication" | "grooming" | "other";
type Filter = "all" | "today" | "upcoming" | "completed";

interface ReminderItem {
  id: string;
  title: string;
  note?: string;
  scheduledDate?: string; // ISO date string (YYYY-MM-DD), optional
  scheduledTime?: string; // HH:mm format, optional
  dateKey: string; // For grouping (Today, Tomorrow, etc.)
  active: boolean;
  repeating?: string;
  category: ReminderCategory;
  timeZone?: string;
  hasNotification?: boolean;
  completed?: boolean;
}

// Add Reminder Modal Component
const AddReminderModal = ({ visible, onClose, onSave, onDelete, initialReminder }: {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<ReminderItem, 'id'>) => Promise<void>;
  onDelete?: () => void;
  initialReminder?: ReminderItem | null;
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [dateEnabled, setDateEnabled] = useState(true);
  const [timeEnabled, setTimeEnabled] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeZone, setTimeZone] = useState("America/Chicago");
  const [category, setCategory] = useState<ReminderCategory>("other");
  const [repeating, setRepeating] = useState("");
  const [hasNotification, setHasNotification] = useState(true);
  const [showTimeZonePicker, setShowTimeZonePicker] = useState(false);
  const isEdit = !!initialReminder;

  const categories: { value: ReminderCategory; label: string; iconName: string }[] = [
    { value: "walk", label: "Walk", iconName: "walk-outline" },
    { value: "meal", label: "Meal", iconName: "restaurant-outline" },
    { value: "medication", label: "Medication", iconName: "medical-outline" },
    { value: "grooming", label: "Grooming", iconName: "cut-outline" },
    { value: "other", label: "Other", iconName: "pricetag-outline" },
  ];

  const repeatingOptions = ["", "Every day", "Weekly", "Monthly"];
  const timeZones = [
    { value: "America/New_York", label: "New York" },
    { value: "America/Chicago", label: "Chicago" },
    { value: "America/Denver", label: "Denver" },
    { value: "America/Los_Angeles", label: "Los Angeles" },
    { value: "America/Phoenix", label: "Phoenix" },
    { value: "America/Anchorage", label: "Anchorage" },
    { value: "America/Honolulu", label: "Honolulu" },
  ];

  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);

    if (selected.getTime() === today.getTime()) {
      return "Today";
    } else if (selected.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    } else {
      return selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  useEffect(() => {
    if (!visible) return;
    if (initialReminder) {
      setTitle(initialReminder.title || "");
      setNote(initialReminder.note || "");
      if (initialReminder.scheduledDate) {
        const parsed = new Date(initialReminder.scheduledDate);
        if (!Number.isNaN(parsed.getTime())) {
          setSelectedDate(parsed);
          setDateEnabled(true);
        }
      } else {
        setDateEnabled(false);
      }
      if (initialReminder.scheduledTime) {
        const [h, m] = initialReminder.scheduledTime.split(":").map(Number);
        const time = new Date();
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          time.setHours(h, m, 0, 0);
          setSelectedTime(time);
          setTimeEnabled(true);
        }
      } else {
        setTimeEnabled(false);
      }
      setTimeZone(initialReminder.timeZone || "America/Chicago");
      setCategory(initialReminder.category || "other");
      setRepeating(initialReminder.repeating || "");
      setHasNotification(initialReminder.hasNotification ?? true);
      return;
    }
    setTitle("");
    setNote("");
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setDateEnabled(true);
    setTimeEnabled(true);
    setTimeZone("America/Chicago");
    setCategory("other");
    setRepeating("");
    setHasNotification(true);
  }, [visible, initialReminder]);

  // Web-compatible date picker component
  const WebDatePicker = ({ value, onChange, onClose }: { value: Date; onChange: (date: Date) => void; onClose: () => void }) => {
    const [localDate, setLocalDate] = useState(value);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const year = localDate.getFullYear();
    const month = localDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push(i);
    }
    
    const changeMonth = (delta: number) => {
      const newDate = new Date(localDate);
      newDate.setMonth(month + delta);
      setLocalDate(newDate);
    };
    
    const selectDate = (day: number) => {
      const newDate = new Date(year, month, day);
      onChange(newDate);
    };
    
    return (
      <View style={{ padding: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md }}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>
            {months[month]} {year}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: SPACING.sm }}>
          {days.map(day => (
            <View key={day} style={{ width: '14.28%', alignItems: "center", paddingVertical: SPACING.xs }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600" }}>{day}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <View key={`empty-${idx}`} style={{ width: '14.28%', paddingVertical: SPACING.sm }} />;
            }
            const dayDate = new Date(year, month, day);
            dayDate.setHours(0, 0, 0, 0);
            const valueDate = new Date(value);
            valueDate.setHours(0, 0, 0, 0);
            const isSelected = dayDate.getTime() === valueDate.getTime();
            const isToday = dayDate.getTime() === today.getTime();
            const isPast = dayDate < today;
            
            return (
              <TouchableOpacity
                key={day}
                onPress={() => !isPast && selectDate(day)}
                disabled={isPast}
                style={{
                  width: '14.28%',
                  alignItems: "center",
                  paddingVertical: SPACING.sm,
                }}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isSelected ? colors.accent : isToday ? colors.accent + "20" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isPast ? 0.3 : 1,
                }}>
                  <Text style={{
                    ...TYPOGRAPHY.sm,
                    color: isSelected ? colors.white : isToday ? colors.accent : colors.text,
                    fontWeight: isSelected || isToday ? "700" : "500",
                  }}>
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={{
            marginTop: SPACING.md,
            paddingVertical: SPACING.sm,
            alignItems: "center",
            backgroundColor: colors.accent,
            borderRadius: RADIUS.md,
          }}
        >
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.white, fontWeight: "600" }}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Web-compatible time picker component (iPhone-style)
  const WebTimePicker = ({ value, onChange, onClose, timeZone, onTimeZoneChange }: { 
    value: Date; 
    onChange: (date: Date) => void; 
    onClose: () => void;
    timeZone: string;
    onTimeZoneChange: (tz: string) => void;
  }) => {
    const [localTime, setLocalTime] = useState(value);
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const ampmOptions = ["AM", "PM"];
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();
    const isAM = currentHour < 12;
    const displayHour = currentHour % 12 || 12;
    
    const updateTime = (hour: number, minute: number, am: boolean) => {
      const newTime = new Date(localTime);
      newTime.setHours(am ? hour : hour + 12, minute);
      setLocalTime(newTime);
      onChange(newTime);
    };

    return (
      <View style={{ padding: SPACING.md, backgroundColor: colors.bgSecondary, borderRadius: RADIUS.lg }}>
        {/* Time Picker with highlighted selection area */}
        <View style={{ 
          position: "relative",
          height: 200,
          marginBottom: SPACING.md,
          backgroundColor: colors.card,
          borderRadius: RADIUS.lg,
          overflow: "hidden",
        }}>
          {/* Selection highlight overlay */}
          <View style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 40,
            marginTop: -20,
            backgroundColor: colors.accent + "15",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.accent + "40",
          }} />
          
          <View style={{ flexDirection: "row", height: "100%", position: "relative" }}>
            {/* Hours Column */}
            <ScrollView 
              style={{ flex: 1 }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 80 }}
              snapToInterval={40}
              decelerationRate="fast"
            >
              {hours.map(hour => (
                <TouchableOpacity
                  key={hour}
                  onPress={() => updateTime(hour, currentMinute, isAM)}
                  style={{
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{
                    ...TYPOGRAPHY.lg,
                    color: displayHour === hour ? colors.accent : colors.textMuted,
                    fontWeight: displayHour === hour ? "700" : "500",
                  }}>
                    {hour}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Minutes Column */}
            <ScrollView 
              style={{ flex: 1 }} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 80 }}
              snapToInterval={40}
              decelerationRate="fast"
            >
              {minutes.map(minute => (
                <TouchableOpacity
                  key={minute}
                  onPress={() => updateTime(displayHour, minute, isAM)}
                  style={{
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{
                    ...TYPOGRAPHY.lg,
                    color: currentMinute === minute ? colors.accent : colors.textMuted,
                    fontWeight: currentMinute === minute ? "700" : "500",
                  }}>
                    {minute.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* AM/PM Column */}
            <ScrollView
              style={{ flex: 0.8 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 80 }}
              snapToInterval={40}
              decelerationRate="fast"
            >
              {ampmOptions.map((period) => {
                const active = (period === "AM") === isAM;
                return (
                  <TouchableOpacity
                    key={period}
                    onPress={() => updateTime(displayHour, currentMinute, period === "AM")}
                    style={{
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{
                      ...TYPOGRAPHY.lg,
                      color: active ? colors.accent : colors.textMuted,
                      fontWeight: active ? "700" : "500",
                    }}>
                      {period}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Time Zone Selection */}
        <TouchableOpacity
          onPress={() => {
                    setShowTimeZonePicker(true);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.md,
            backgroundColor: colors.card,
            borderRadius: RADIUS.md,
            marginBottom: SPACING.md,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="globe-outline" size={20} color={colors.textMuted} style={{ marginRight: SPACING.sm }} />
            <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
              Time Zone
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginRight: SPACING.xs }}>
              {timeZones.find(tz => tz.value === timeZone)?.label || "Chicago"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onClose}
          style={{
            paddingVertical: SPACING.sm,
            alignItems: "center",
            backgroundColor: colors.accent,
            borderRadius: RADIUS.md,
          }}
        >
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.white, fontWeight: "600" }}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Reset pickers when modal closes
  useEffect(() => {
    if (!visible) {
      setShowDatePicker(false);
      setShowTimePicker(false);
      setDateEnabled(true);
      setTimeEnabled(true);
      setTimeZone("America/Chicago");
    }
  }, [visible]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title for the reminder");
      return;
    }

    const scheduledDate = dateEnabled ? selectedDate.toISOString().split('T')[0] : undefined;
    const scheduledTime = timeEnabled ? `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}` : undefined;

    // Determine dateKey for grouping
    let dateKey = "Later";
    if (dateEnabled) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const selected = new Date(selectedDate);
      selected.setHours(0, 0, 0, 0);

      if (selected.getTime() === today.getTime()) {
        dateKey = "Today";
      } else if (selected.getTime() === tomorrow.getTime()) {
        dateKey = "Tomorrow";
      } else {
        const diffDays = Math.floor((selected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          dateKey = "This week";
        } else if (diffDays <= 14) {
          dateKey = "Next week";
        }
      }
    }

    await onSave({
      title: title.trim(),
      note: note.trim() || undefined,
      scheduledDate,
      scheduledTime,
      dateKey,
      active: true,
      category,
      repeating: repeating || undefined,
      timeZone: timeZone || undefined,
      hasNotification,
    });

    // Reset form
    setTitle("");
    setNote("");
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setDateEnabled(true);
    setTimeEnabled(true);
    setTimeZone("America/Chicago");
    setCategory("other");
    setRepeating("");
    setHasNotification(true);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowTimeZonePicker(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ 
        flex: 1, 
        backgroundColor: colors.black + "80", 
        justifyContent: "center",
        alignItems: "center",
        padding: SPACING.lg
      }}>
        <View style={{ 
          width: "100%",
          maxWidth: 420,
          backgroundColor: colors.card, 
          borderRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "85%"
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg }}>
            <TouchableOpacity onPress={onClose} style={{ marginRight: SPACING.md }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, flex: 1 }}>
              {isEdit ? "Edit Reminder" : "Add Reminder"}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.accent }}>
                {isEdit ? "Update" : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: SPACING.md, paddingBottom: SPACING.md }}
          >
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Morning Walk"
            />
            
            <Input
              label="Note (Optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Additional details..."
              multiline
              numberOfLines={2}
            />
            
            {/* Date & Time Section */}
            <View>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text, paddingHorizontal: SPACING.xs }}>
                Date & Time
              </Text>
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: colors.borderLight,
                overflow: "hidden",
              }}>
                {/* Date Row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.md, paddingHorizontal: SPACING.md }}>
                  <TouchableOpacity
                    onPress={() => dateEnabled && setShowDatePicker(true)}
                    style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    disabled={!dateEnabled}
                  >
                    <Ionicons name="calendar-outline" size={20} color={dateEnabled ? colors.accent : colors.textMuted} style={{ marginRight: SPACING.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: 2 }}>
                        Date
                      </Text>
                      {dateEnabled && (
                        <Text style={{ ...TYPOGRAPHY.base, color: colors.accent, fontWeight: "600" }}>
                          {formatDate(selectedDate)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const newValue = !dateEnabled;
                      setDateEnabled(newValue);
                      if (newValue) {
                        setTimeout(() => setShowDatePicker(true), 100);
                      } else {
                        setShowDatePicker(false);
                      }
                    }}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: dateEnabled ? colors.accent : colors.borderLight,
                      alignItems: dateEnabled ? "flex-end" : "flex-start",
                      justifyContent: "center",
                      padding: 2,
                    }}
                  >
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colors.card,
                    }} />
                  </TouchableOpacity>
                </View>
                <View style={{ height: 1, backgroundColor: colors.borderLight }} />

                {/* Time Row */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.md, paddingHorizontal: SPACING.md }}>
                  <TouchableOpacity
                    onPress={() => timeEnabled && setShowTimePicker(true)}
                    style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    disabled={!timeEnabled}
                  >
                    <Ionicons name="time-outline" size={20} color={timeEnabled ? colors.accent : colors.textMuted} style={{ marginRight: SPACING.sm }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: 2 }}>
                        Time
                      </Text>
                      {timeEnabled && (
                        <Text style={{ ...TYPOGRAPHY.base, color: colors.accent, fontWeight: "600" }}>
                          {formatTime(selectedTime)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const newValue = !timeEnabled;
                      setTimeEnabled(newValue);
                      if (newValue) {
                        setTimeout(() => setShowTimePicker(true), 100);
                      } else {
                        setShowTimePicker(false);
                      }
                    }}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: timeEnabled ? colors.accent : colors.borderLight,
                      alignItems: timeEnabled ? "flex-end" : "flex-start",
                      justifyContent: "center",
                      padding: 2,
                    }}
                  >
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colors.card,
                    }} />
                  </TouchableOpacity>
                </View>
                <View style={{ height: 1, backgroundColor: colors.borderLight }} />

                {/* Time Zone Row */}
                <TouchableOpacity
                  onPress={() => {
                    setShowTimeZonePicker(true);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACING.md, paddingHorizontal: SPACING.md }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <Ionicons name="globe-outline" size={20} color={colors.textMuted} style={{ marginRight: SPACING.sm }} />
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }}>
                      Time Zone
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ ...TYPOGRAPHY.base, color: colors.textMuted, marginRight: SPACING.xs }}>
                      {timeZones.find(tz => tz.value === timeZone)?.label || "Chicago"}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>

              {dateEnabled && showDatePicker && (
                <View style={{ marginTop: SPACING.sm, marginBottom: SPACING.md }}>
                  {Platform.OS === 'web' ? (
                    <WebDatePicker
                      value={selectedDate}
                      onChange={setSelectedDate}
                      onClose={() => setShowDatePicker(false)}
                    />
                  ) : DateTimePicker ? (
                    <>
                      <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={(event: any, date?: Date) => {
                          if (Platform.OS === "android") {
                            setShowDatePicker(false);
                          }
                          if (date) {
                            setSelectedDate(date);
                            if (Platform.OS === "ios") {
                              // keep picker open
                            } else {
                              setShowDatePicker(false);
                            }
                          }
                        }}
                        minimumDate={new Date()}
                      />
                      {Platform.OS === "ios" && (
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(false)}
                          style={{
                            marginTop: SPACING.sm,
                            paddingVertical: SPACING.sm,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
                            Done
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : null}
                </View>
              )}

              {timeEnabled && showTimePicker && (
                <View style={{ marginTop: SPACING.sm }}>
                  {Platform.OS === 'web' ? (
                    <WebTimePicker
                      value={selectedTime}
                      onChange={setSelectedTime}
                      onClose={() => setShowTimePicker(false)}
                      timeZone={timeZone}
                      onTimeZoneChange={setTimeZone}
                    />
                  ) : DateTimePicker ? (
                    <>
                      <DateTimePicker
                        value={selectedTime}
                        mode="time"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        is24Hour={false}
                        onChange={(event: any, date?: Date) => {
                          if (Platform.OS === "android") {
                            setShowTimePicker(false);
                          }
                          if (date) {
                            setSelectedTime(date);
                            if (Platform.OS === "ios") {
                              // keep picker open
                            } else {
                              setShowTimePicker(false);
                            }
                          }
                        }}
                      />
                      {Platform.OS === "ios" && (
                        <TouchableOpacity
                          onPress={() => setShowTimePicker(false)}
                          style={{
                            marginTop: SPACING.sm,
                            paddingVertical: SPACING.sm,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
                            Done
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : null}
                </View>
              )}
            </View>

            {/* Category Selection */}
            <View>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                Category
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.md,
                      backgroundColor: category === cat.value ? colors.accent : colors.surface,
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      borderColor: category === cat.value ? colors.accent : colors.borderLight,
                    }}
                  >
                    <Ionicons 
                      name={cat.iconName as any} 
                      size={16} 
                      color={category === cat.value ? colors.white : colors.textMuted} 
                      style={{ marginRight: SPACING.xs }} 
                    />
                    <Text style={{ 
                      ...TYPOGRAPHY.sm, 
                      color: category === cat.value ? colors.white : colors.textMuted,
                      fontWeight: "600"
                    }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Repeating Selection */}
            <View>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.sm, color: colors.text }}>
                Repeat
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
                {repeatingOptions.map((repeat) => (
                  <TouchableOpacity
                    key={repeat}
                    onPress={() => setRepeating(repeat)}
                    style={{
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.md,
                      backgroundColor: repeating === repeat ? colors.accent : colors.surface,
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      borderColor: repeating === repeat ? colors.accent : colors.borderLight,
                    }}
                  >
                    <Text style={{ 
                      ...TYPOGRAPHY.sm, 
                      color: repeating === repeat ? colors.white : colors.textMuted,
                      fontWeight: "600"
                    }}>
                      {repeat || "Never"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notification Toggle */}
            <TouchableOpacity
              onPress={() => setHasNotification(!hasNotification)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.md,
                paddingHorizontal: SPACING.md,
                backgroundColor: colors.surface,
                borderRadius: RADIUS.lg,
              }}
            >
              <Ionicons 
                name={hasNotification ? "notifications" : "notifications-off"} 
                size={20} 
                color={hasNotification ? colors.accent : colors.textMuted} 
                style={{ marginRight: SPACING.sm }}
              />
              <Text style={{ 
                ...TYPOGRAPHY.sm, 
                color: colors.text,
                fontWeight: "600",
                flex: 1
              }}>
                Push Notification
              </Text>
              <View style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: hasNotification ? colors.accent : colors.borderLight,
                alignItems: hasNotification ? "flex-end" : "flex-start",
                justifyContent: "center",
                padding: 2,
              }}>
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.card,
                }} />
              </View>
            </TouchableOpacity>
          </ScrollView>
          {isEdit && onDelete && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Delete reminder?",
                  "This will remove the reminder permanently.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: onDelete },
                  ]
                );
              }}
              style={{ alignSelf: "flex-start", marginTop: SPACING.md }}
            >
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.danger, fontWeight: "600" }}>
                Delete reminder
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Modal visible={showTimeZonePicker} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowTimeZonePicker(false)}
          style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "center", alignItems: "center", padding: SPACING.lg }}
        >
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, marginBottom: SPACING.md }}>
              Select Time Zone
            </Text>
            <View style={{ gap: SPACING.sm }}>
              {timeZones.map(tz => (
                <TouchableOpacity
                  key={tz.value}
                  onPress={() => {
                    setTimeZone(tz.value);
                    setShowTimeZonePicker(false);
                  }}
                  style={{
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    borderRadius: RADIUS.md,
                    backgroundColor: timeZone === tz.value ? colors.accent + "15" : colors.bgSecondary,
                    borderWidth: 1,
                    borderColor: timeZone === tz.value ? colors.accent : colors.borderLight,
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.base, color: timeZone === tz.value ? colors.accent : colors.text, fontWeight: "600" }}>
                    {tz.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => setShowTimeZonePicker(false)}
              style={{ marginTop: SPACING.md, alignItems: "center" }}
            >
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, fontWeight: "600" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

// Category styling function
const getCategoryStyle = (c: ReminderCategory) => {
  switch (c) {
    case "walk": return { iconName: "walk-outline", tint: "#6E8BFF" };
    case "meal": return { iconName: "restaurant-outline", tint: "#FF8A5B" };
    case "medication": return { iconName: "medical-outline", tint: "#F25DA2" };
    case "grooming": return { iconName: "cut-outline", tint: "#8F6CF3" };
    default: return { iconName: "pricetag-outline", tint: "#A1A8B3" };
  }
};

// Reminder Card Component
const ReminderCard = ({
  item,
  onToggle,
  onPress,
  onDelete,
  onEdit,
  onOpenActions,
  onComplete,
  highlighted,
}: {
  item: ReminderItem;
  onToggle: (id: string, next: boolean) => void;
  onPress?: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onOpenActions?: (item: ReminderItem) => void;
  onComplete?: (id: string) => void;
  highlighted?: boolean;
}) => {
  const { colors } = useTheme();
  const c = getCategoryStyle(item.category);
  const timeLabel = item.scheduledTime
    ? (() => {
        const [hours, minutes] = item.scheduledTime.split(":");
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
      })()
    : "No time set";
  const dateLabel = item.scheduledDate
    ? new Date(item.scheduledDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "No date";
  const isOverdue = (() => {
    if (!item.scheduledDate) return false;
    const due = new Date(item.scheduledDate);
    if (Number.isNaN(due.getTime())) return false;
    if (item.scheduledTime) {
      const [hours, minutes] = item.scheduledTime.split(":").map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
      due.setHours(hours, minutes, 0, 0);
      return due.getTime() < Date.now();
    }
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
  })();
  const statusLabel = item.completed ? "Completed" : isOverdue ? "Overdue" : item.active ? "Active" : "Paused";
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      style={{
        backgroundColor: highlighted ? `${colors.accent}12` : colors.card,
        borderRadius: 18,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: highlighted ? colors.accent : colors.borderLight,
        ...SHADOWS.sm,
        opacity: item.completed ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${c.tint}22`,
            marginRight: SPACING.sm,
          }}
        >
          <Ionicons name={c.iconName as any} size={20} color={c.tint} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "800", color: colors.text, marginRight: 6 }}>
              {item.title}
            </Text>
            {item.hasNotification && (
              <View style={{
                backgroundColor: colors.bgSecondary,
                borderRadius: 999,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}>
                <Ionicons name="notifications" size={12} color={colors.warning} />
              </View>
            )}
          </View>
          {!!item.note && (
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
              {item.note}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => onToggle(item.id, !item.active)}
          style={{
            minWidth: 56,
            height: 32,
            borderRadius: 999,
            padding: 2,
            backgroundColor: item.active ? colors.accent : colors.borderLight,
            alignItems: item.active ? "flex-end" : "flex-start",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.card,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 3,
              elevation: 2,
            }}
          />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: SPACING.sm }}>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.bgSecondary,
          marginRight: 6,
          marginBottom: 6,
        }}>
          <Ionicons name="calendar-outline" size={14} color={colors.text} style={{ marginRight: 4 }} />
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>{dateLabel}</Text>
        </View>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.bgSecondary,
          marginRight: 6,
          marginBottom: 6,
        }}>
          <Ionicons name="time-outline" size={14} color={colors.text} style={{ marginRight: 4 }} />
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>{timeLabel}</Text>
        </View>
        {!!item.repeating && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.bgSecondary,
            marginRight: 6,
            marginBottom: 6,
          }}>
            <Ionicons name="repeat-outline" size={14} color={colors.text} style={{ marginRight: 4 }} />
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>{item.repeating}</Text>
          </View>
        )}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: colors.bgSecondary,
          marginRight: 6,
          marginBottom: 6,
        }}>
          <Ionicons name={c.iconName as any} size={14} color={c.tint} style={{ marginRight: 4 }} />
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>
            {item.category[0].toUpperCase() + item.category.slice(1)}
          </Text>
        </View>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: item.completed
            ? `${colors.success}22`
            : isOverdue
              ? `${colors.warning}22`
              : item.active
                ? `${colors.accent}18`
                : colors.bgSecondary,
          marginRight: 6,
          marginBottom: 6,
        }}>
          <Text style={{ 
            ...TYPOGRAPHY.sm, 
            color: item.completed ? colors.success : isOverdue ? colors.warning : item.active ? colors.accent : colors.textMuted 
          }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACING.sm, gap: SPACING.sm }}>
        <TouchableOpacity
          onPress={() => onComplete && onComplete(item.id)}
          style={{
            borderWidth: 1,
            borderColor: colors.success,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: `${colors.success}12`,
          }}
        >
          <Text style={{ color: colors.success, fontWeight: "600", fontSize: 12 }}>
            Mark complete
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onOpenActions && onOpenActions(item)}
          style={{
            borderWidth: 1,
            borderColor: colors.borderLight,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: colors.bgSecondary,
          }}
        >
          <Text style={{ color: colors.textMuted, fontWeight: "600", fontSize: 12 }}>
            Options
          </Text>
        </TouchableOpacity>
      </View>
      </TouchableOpacity>
  );
};

const defaultReminders: ReminderItem[] = [];

export default function RemindersScreen() {
  const { colors } = useTheme();
  const { registerAddReminderCallback } = useNavigation();
  const { activePetId, getActivePet } = usePets();
  const { user } = useAuth();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const [filter, setFilter] = useState<Filter>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [actionSheetTitle, setActionSheetTitle] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<ReminderItem[]>(defaultReminders);
  const [highlightedReminderId, setHighlightedReminderId] = useState<string | null>(null);
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const listRef = useRef<SectionList<ReminderItem>>(null);
  const itemsRef = useRef<ReminderItem[]>(items);
  const userIdRef = useRef<string | null>(user?.id || null);
  const activePetIdRef = useRef<string | null>(activePetId || null);
  const isCheckingRef = useRef(false);

  // Register callback to open add reminder modal
  useEffect(() => {
    registerAddReminderCallback(() => {
      setShowAddModal(true);
    });
  }, [registerAddReminderCallback]);

  useEffect(() => {
    const loadTarget = async () => {
      const raw = await storage.getItem("@kasper_notification_target");
      if (!raw) return;
      try {
        const target = JSON.parse(raw);
        if (target?.type === "reminder" && target?.id) {
          if (target?.action === "edit") {
            const found = items.find(reminder => reminder.id === target.id);
            if (found) {
              setEditingReminder(found);
              setShowEditModal(true);
              storage.removeItem("@kasper_notification_target").catch(() => {});
              return;
            }
          }
          setPendingTargetId(target.id);
        }
      } catch {
        return;
      }
    };
    loadTarget();
  }, [items]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    userIdRef.current = user?.id || null;
    activePetIdRef.current = activePetId || null;
  }, [user?.id, activePetId]);

  // Load reminders from Supabase on mount
  useEffect(() => {
    loadReminders();
  }, [activePetId, user?.id]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    let cancelled = false;
    const checkDueReminders = async () => {
      if (cancelled || isCheckingRef.current) return;
      const currentUserId = userIdRef.current;
      const currentPetId = activePetIdRef.current;
      const currentItems = itemsRef.current;
      if (!currentUserId || !currentPetId || currentItems.length === 0) return;
      isCheckingRef.current = true;
      try {
        const now = Date.now();
        const dueCandidates = currentItems.filter(item =>
          item.active &&
          !item.completed &&
          item.hasNotification &&
          item.scheduledDate &&
          item.scheduledTime
        );
        for (const reminder of dueCandidates) {
          if (cancelled) return;
          const dueAt = new Date(`${reminder.scheduledDate}T${reminder.scheduledTime}:00`);
          if (Number.isNaN(dueAt.getTime())) continue;
          const diffMs = dueAt.getTime() - now;
          const dueAtIso = dueAt.toISOString();
          if (diffMs <= 30 * 60 * 1000 && diffMs >= 0) {
            const exists = await hasReminderNotification(currentUserId, reminder.id, "reminder_due", dueAtIso);
            if (!exists) {
              await insertNotification(currentUserId, {
                petId: currentPetId,
                kind: "reminder",
                title: "Reminder due soon",
                message: `Upcoming: ${reminder.title} at ${dueAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`,
                ctaLabel: "View reminder",
                metadata: { type: "reminder_due", reminderId: reminder.id, dueAt: dueAtIso },
              });
            }
            continue;
          }
          if (now - dueAt.getTime() >= 2 * 60 * 60 * 1000) {
            const exists = await hasReminderNotification(currentUserId, reminder.id, "reminder_followup", dueAtIso);
            if (!exists) {
              await insertNotification(currentUserId, {
                petId: currentPetId,
                kind: "reminder",
                title: "Reminder follow-up",
                message: `Did you complete "${reminder.title}"?`,
                ctaLabel: "View reminder",
                metadata: { type: "reminder_followup", reminderId: reminder.id, dueAt: dueAtIso },
              });
            }
          }
        }
      } finally {
        isCheckingRef.current = false;
      }
    };
    checkDueReminders();
    const interval = setInterval(checkDueReminders, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, activePetId]);

  const loadReminders = async () => {
    if (!user?.id || !activePetId) {
      setItems([]);
              return;
            }
    try {
      const remote = await fetchReminders(user.id, activePetId);
      setItems(remote);
    } catch (error) {
      console.error("Failed to load reminders:", error);
      setItems([]);
    }
  };

  const filtered = useMemo(() => {
    const normalizeDate = (iso?: string) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isDueToday = (item: ReminderItem) => {
      const d = normalizeDate(item.scheduledDate);
      return d ? d.getTime() === today.getTime() : false;
    };
    const isUpcoming = (item: ReminderItem) => {
      const d = normalizeDate(item.scheduledDate);
      return d ? d.getTime() > today.getTime() : false;
    };
    switch (filter) {
      case "today": return items.filter(i => !i.completed && isDueToday(i));
      case "upcoming": return items.filter(i => !i.completed && isUpcoming(i));
      case "completed": return items.filter(i => !!i.completed);
      default: return items.filter(i => !i.completed);
    }
  }, [items, filter]);

  const sections = useMemo(() => {
    const map: Record<string, ReminderItem[]> = {};
    filtered.forEach(r => (map[r.dateKey] ||= []).push(r));
    const pref = ["Today", "Tomorrow", "This week", "Next week", "Later"];
    const keys = Object.keys(map).sort((a, b) => pref.indexOf(a) - pref.indexOf(b));
    return keys.map(k => ({ title: k, data: map[k] }));
  }, [filtered]);

  useEffect(() => {
    if (!pendingTargetId || sections.length === 0) return;
    const sectionIndex = sections.findIndex(section =>
      section.data.some(reminder => reminder.id === pendingTargetId)
    );
    if (sectionIndex === -1) return;
    const itemIndex = sections[sectionIndex].data.findIndex(
      reminder => reminder.id === pendingTargetId
    );
    if (itemIndex === -1) return;
    setHighlightedReminderId(pendingTargetId);
    listRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex,
      animated: true,
      viewPosition: 0.2,
    });
    storage.removeItem("@kasper_notification_target").catch(() => {});
    setPendingTargetId(null);
    setTimeout(() => setHighlightedReminderId(null), 6000);
  }, [pendingTargetId, sections]);

  const toggle = async (id: string, next: boolean) => {
    const updated = items.map(r => (r.id === id ? { ...r, active: next } : r));
    setItems(updated);
    if (!user?.id) return;
    try {
      await updateReminder(user.id, id, { active: next });
    } catch (error) {
      console.error("Failed to update reminder:", error);
    }
  };

  const complete = async (id: string) => {
    const updated = items.map(r => (r.id === id ? { ...r, completed: true, active: false } : r));
    setItems(updated);
    if (!user?.id) return;
    try {
      await updateReminder(user.id, id, { completed: true, active: false });
    } catch (error) {
      console.error("Failed to complete reminder:", error);
    }
  };

  const remove = async (id: string) => {
    const updated = items.filter(r => r.id !== id);
    setItems(updated);
    if (editingReminder?.id === id) {
      setShowEditModal(false);
      setEditingReminder(null);
    }
    if (!user?.id) return;
    try {
      await deleteReminder(user.id, id);
    } catch (error) {
      console.error("Failed to delete reminder:", error);
    }
  };

  const addReminder = async (reminder: Omit<ReminderItem, 'id'>) => {
    if (!user?.id || !activePetId) {
      Alert.alert("Sign in required", "Please sign in to save reminders.");
      return;
    }
    try {
      const inserted = await insertReminder(user.id, activePetId, reminder);
      const newReminder: ReminderItem = {
        ...reminder,
        id: inserted.id,
      };
      setItems(prev => [newReminder, ...prev]);
      Alert.alert("Success", "Reminder added successfully!");

      const whenParts: string[] = [];
      if (reminder.scheduledDate) {
        const date = new Date(reminder.scheduledDate);
        if (!Number.isNaN(date.getTime())) {
          whenParts.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
        }
      }
      if (reminder.scheduledTime) {
        const [hours, minutes] = reminder.scheduledTime.split(":").map(Number);
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
          const time = new Date();
          time.setHours(hours, minutes, 0, 0);
          whenParts.push(time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        }
      }
      const whenLabel = whenParts.length ? ` on ${whenParts.join(" at ")}` : "";
      insertNotification(user.id, {
        petId: activePetId,
        kind: "reminder",
        title: "Reminder set",
        message: `You set a reminder for ${reminder.title}${whenLabel}.`,
        ctaLabel: "View reminder",
        metadata: { reminderId: inserted.id },
      }).catch(error => {
        console.error("Failed to create reminder notification:", error);
      });
    } catch (error) {
      console.error("Failed to add reminder:", error);
      Alert.alert("Error", "Could not save reminder. Please try again.");
    }
  };

  const saveReminderEdits = async (reminder: Omit<ReminderItem, 'id'>) => {
    if (!user?.id || !editingReminder) return;
    try {
      setItems(prev =>
        prev.map(r => (r.id === editingReminder.id ? { ...r, ...reminder } : r))
      );
      await updateReminder(user.id, editingReminder.id, reminder);
      setShowEditModal(false);
      setEditingReminder(null);
      Alert.alert("Saved", "Reminder updated successfully!");
    } catch (error) {
      console.error("Failed to update reminder:", error);
      Alert.alert("Error", "Could not update reminder. Please try again.");
    }
  };

  const openReminderActions = (item: ReminderItem) => {
    setActionSheetTitle("Reminder");
    setActionSheetOptions([
      {
        label: "Edit",
        icon: "create-outline",
        onPress: () => {
          setEditingReminder(item);
          setShowEditModal(true);
        },
      },
      {
        label: "Delete",
        icon: "trash-outline",
        onPress: () => remove(item.id),
      },
    ]);
    setActionSheetVisible(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Screen Header */}
      <ScreenHeader
        title="Reminders"
        actionIcon="paw"
        onActionPress={() => setShowAddModal(true)}
        titleStyle={{ ...TYPOGRAPHY.base, fontWeight: "600", letterSpacing: -0.2 }}
        paddingTop={SPACING.lg}
        paddingBottom={SPACING.lg}
      />
      
      <View style={{ 
        paddingHorizontal: SPACING.lg, 
        paddingTop: SPACING.md, 
        paddingBottom: SPACING.md 
      }}>
        <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
          Never miss important moments with {petName}
        </Text>
      </View>

      <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm }}>
        <View style={{ 
          backgroundColor: colors.bgSecondary, 
          borderRadius: 999, 
          padding: 4,
          borderWidth: 1,
          borderColor: colors.borderLight,
          overflow: "hidden",
        }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: "row", paddingRight: 4 }}
          >
            {(["all", "today", "upcoming", "completed"] as const).map(f => {
              const active = f === filter;
              return (
                <TouchableOpacity 
                  key={f} 
                  onPress={() => setFilter(f)} 
                  style={{ 
                    paddingVertical: 8, 
                    paddingHorizontal: 14, 
                    borderRadius: 999, 
                    backgroundColor: active ? colors.card : "transparent", 
                    marginRight: 4,
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? colors.borderLight : "transparent",
                  }}
                >
                  <Text style={{ 
                    ...TYPOGRAPHY.base, 
                    color: active ? colors.accent : colors.text,
                    fontWeight: active ? "600" : "500"
                  }}>
                    {f === "all" ? "Active" : f[0].toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 120 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{ 
            ...TYPOGRAPHY.lg, 
            fontWeight: "800", 
            color: colors.text, 
            marginTop: SPACING.lg, 
            marginBottom: SPACING.sm 
          }}>
            {title}
          </Text>
        )}
        renderItem={({ item }) => (
          <ReminderCard
            item={item}
            onToggle={toggle}
            onComplete={complete}
            onDelete={(id) => remove(id)}
            onEdit={(id) => {
              const found = items.find(r => r.id === id);
              if (found) {
                setEditingReminder(found);
                setShowEditModal(true);
              }
            }}
            onOpenActions={openReminderActions}
            highlighted={item.id === highlightedReminderId}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="alarm-outline"
            title="No reminders yet"
            subtitle="Create a reminder for walks, meals, or meds."
            ctaLabel="Add reminder"
            onPress={() => setShowAddModal(true)}
          />
        }
      />

      {/* Floating add button intentionally removed */}

      {/* Add Reminder Modal */}
      <AddReminderModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={addReminder}
      />

      {/* Edit Reminder Modal */}
      <AddReminderModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingReminder(null);
        }}
        onSave={saveReminderEdits}
        onDelete={() => editingReminder && remove(editingReminder.id)}
        initialReminder={editingReminder}
      />

      <ActionSheet
        visible={actionSheetVisible}
        title={actionSheetTitle}
        options={actionSheetOptions}
        onClose={() => setActionSheetVisible(false)}
      />
    </View>
  );
}