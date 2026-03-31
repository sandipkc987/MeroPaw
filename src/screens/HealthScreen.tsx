import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, Platform, ActivityIndicator, RefreshControl, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@src/theme";
import { useTheme } from "@src/contexts/ThemeContext";
import { timeAgo } from "@src/utils/helpers";
import { useNavigation } from "@src/contexts/NavigationContext";
import { usePets } from "@src/contexts/PetContext";
import { useAuth } from "@src/contexts/AuthContext";
import { Button, Card, Chip, Input } from "@src/components/UI";
import ActionSheet, { ActionSheetOption } from "@src/components/ActionSheet";
import EmptyState from "@src/components/EmptyState";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@src/components/ScreenHeader";
import ReceiptViewer from "@src/components/ReceiptViewer";
import * as DocumentPicker from "expo-document-picker";
import { fetchHealthRecords, insertHealthRecord, updateHealthRecord, deleteHealthRecord, uploadHealthAttachment, insertNotification, fetchVetAppointments, insertVetAppointment, updateVetAppointment, deleteVetAppointment, getHealthAttachmentViewUrl, fetchWeightHistory, upsertWeightHistory } from "@src/services/supabaseData";
import { checkWeightChangeAndNotify } from "@src/services/weightChangeAlert";
import { getSupabaseClient } from "@src/services/supabaseClient";
import { supabaseUrl } from "@src/services/supabaseClient";
import analyzeClinicalSummary, { generateHealthSummary } from "@src/services/clinicalSummaryAnalysis";
import storage from "@src/utils/storage";

interface PDFAttachment {
  id: string;
  name: string;
  uri: string;
  size?: number;
  path?: string;
  extracted?: {
    weight?: { value: number; unit?: string; confidence: number };
    heartRate?: { value: number; unit?: string; confidence: number };
    respiratoryRate?: { value: number; unit?: string; confidence: number };
    attitude?: { value: string; confidence: number };
    visitDate?: { value: string; confidence: number };
    visitTitle?: { value: string; confidence: number };
    visitType?: { value: string; confidence: number };
    doctorName?: { value: string; confidence: number };
    clinicName?: { value: string; confidence: number };
    vaccinations?: Array<{ name: string; date?: string; dueDate?: string }>;
  };
}

interface HealthRecord {
  id: string;
  type: "vaccination" | "checkup" | "medication" | "grooming" | "other";
  title: string;
  date: string;
  createdAt?: string;
  notes?: string;
  vet?: string;
  pdfs?: PDFAttachment[];
}

interface VetAppointment {
  id: string;
  title: string;
  appointmentDate: string;
  appointmentTime?: string;
  clinicName?: string;
  doctorName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  reason?: string;
  notes?: string;
  status?: "scheduled" | "confirmed" | "completed" | "canceled";
  calendarEventId?: string;
}


const filterOptions = [
  { label: "All", value: "all" },
  { label: "Vaccinations", value: "vaccination" },
  { label: "Checkups", value: "checkup" },
  { label: "Medications", value: "medication" },
  { label: "Grooming", value: "grooming" },
  { label: "Other", value: "other" }
];

const HealthCard = ({
  record,
  onViewPDF,
  highlighted,
  onOpenActions,
}: {
  record: HealthRecord;
  onViewPDF?: (pdf: PDFAttachment) => void;
  highlighted?: boolean;
  onOpenActions?: () => void;
}) => {
  const { colors } = useTheme();
  const getTypeIcon = () => {
    switch (record.type) {
      case "vaccination": return "medical";
      case "checkup": return "checkmark-circle";
      case "medication": return "medkit";
      case "grooming": return "cut";
      default: return "document-text";
    }
  };

  const getTypeColor = () => {
    switch (record.type) {
      case "vaccination": return "#FF8A5B";
      case "checkup": return "#6E8BFF";
      case "medication": return "#F25DA2";
      case "grooming": return "#8F6CF3";
      default: return colors.accent;
    }
  };

  return (
    <View style={{
      marginBottom: SPACING.md,
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: highlighted ? colors.accent : colors.borderLight,
      overflow: "hidden",
      ...SHADOWS.sm,
    }}>
      <LinearGradient
        colors={[colors.accent + "14", colors.accent + "06", "transparent"]}
        style={{ height: 24 }}
      />
      <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, paddingTop: SPACING.sm }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: getTypeColor() + "15",
          alignItems: "center",
          justifyContent: "center",
          marginRight: SPACING.md
        }}>
          <Ionicons 
            name={getTypeIcon() as any}
            size={24} 
            color={getTypeColor()} 
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text, flex: 1 }}>
              {record.title}
            </Text>
            {onOpenActions && (
              <TouchableOpacity onPress={onOpenActions}>
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.xs, flexWrap: "nowrap" }}>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginLeft: 4 }} numberOfLines={1}>
              {record.date
                ? new Date(record.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Date not set"}
            </Text>
            {record.vet && (
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0, marginLeft: 8 }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginRight: 6 }}>•</Text>
                <Ionicons name="person-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, flex: 1 }} numberOfLines={1} ellipsizeMode="tail">
                  {record.vet}
                </Text>
              </View>
            )}
          </View>
          {record.notes && (
            <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, marginTop: SPACING.xs, lineHeight: 20 }}>
              {record.notes}
            </Text>
          )}
          
          {/* PDF Attachments */}
          {record.pdfs && record.pdfs.length > 0 && (
            <View style={{ marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, fontWeight: "600", marginBottom: SPACING.xs }}>
                Attachments ({record.pdfs.length})
              </Text>
              {record.pdfs.map((pdf) => (
                <TouchableOpacity
                  key={pdf.id}
                  onPress={() => onViewPDF?.(pdf)}
                  style={{
                    width: "100%",
                    marginTop: SPACING.xs,
                    backgroundColor: colors.surface,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 56, height: 56, backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="document-text-outline" size={22} color={colors.danger} />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>Attachment</Text>
                      <Text style={{ ...TYPOGRAPHY.base, color: colors.text, fontWeight: "600" }} numberOfLines={1}>
                        {pdf.name}
                      </Text>
                      <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                        Tap to view
                      </Text>
                    </View>
                    <View style={{ paddingRight: SPACING.md }}>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
      </View>
    </View>
  );
};

// ---------- Vaccination Helpers ----------
type WeightEntry = {
  weight: number;
  date: string;
  source?: "manual" | "pdf";
};

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

const AddHealthRecordModal = ({
  visible,
  onClose,
  onSave,
  onDelete,
  initialRecord,
  startMode = "manual",
  petId,
  petName,
  userId,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (record: Omit<HealthRecord, "id">) => Promise<void>;
  onDelete?: () => void;
  initialRecord?: HealthRecord | null;
  startMode?: "manual" | "upload";
  petId?: string | null;
  petName?: string;
  userId?: string | null;
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<HealthRecord["type"]>("checkup");
  const [showTypeOptions, setShowTypeOptions] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [vetName, setVetName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfs, setPdfs] = useState<PDFAttachment[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"success" | "warning" | null>(null);
  const [autoPickDone, setAutoPickDone] = useState(false);
  const [extractedRawText, setExtractedRawText] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const isEdit = !!initialRecord;
  const lastAnalyzedRef = useRef<string | null>(null);

  const formatLocalDate = (value: string) => {
    const trimmed = value.trim();
    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    const parsed = new Date(dateOnlyMatch ? `${trimmed}T00:00:00` : trimmed);
    if (Number.isNaN(parsed.getTime())) return "";
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newPDF: PDFAttachment = {
          id: String(Date.now()),
          name: asset.name || "document.pdf",
          uri: asset.uri,
          size: asset.size,
        };
        setPdfs(prev => [...prev, newPDF]);
      }
    } catch (error) {
      console.error("Error picking PDF:", error);
      Alert.alert("Error", "Failed to pick PDF");
    }
  };

  const removePDF = (pdfId: string) => {
    setPdfs(prev => prev.filter(pdf => pdf.id !== pdfId));
  };

  const handleSave = async () => {
    const typeLabels: Record<string, string> = {
      checkup: "Checkup",
      vaccination: "Vaccination",
      medication: "Medication",
      grooming: "Grooming",
      other: "Health visit",
    };
    const derivedTitle =
      title.trim() ||
      (type === "vaccination" && extractedVaccinations[0]?.name
        ? `Vaccination · ${extractedVaccinations[0].name}`
        : null) ||
      (clinicName.trim() ? `${typeLabels[type] || type} at ${clinicName.trim()}` : null) ||
      (vetName.trim() ? `${typeLabels[type] || type} · ${vetName.trim()}` : null) ||
      `${typeLabels[type] || type} visit`;
    try {
      setIsSaving(true);
      const vetLabel = [vetName.trim(), clinicName.trim()].filter(Boolean).join(" · ");
      await onSave({
      type,
      title: derivedTitle,
      date,
      vet: vetLabel || undefined,
      notes: notes.trim() || undefined,
      pdfs: pdfs.length > 0 ? pdfs : undefined,
    });
    // Reset form
    setTitle("");
    setType("checkup");
    setDate(new Date().toISOString().split('T')[0]);
    setVetName("");
    setClinicName("");
    setNotes("");
    setPdfs([]);
    setAnalysisSummary(null);
    setAnalysisStatus(null);
    setExtractedRawText(null);
    onClose();
    } catch (error) {
      console.error("HealthScreen: Failed to save health record", error);
      Alert.alert("Error", "Could not save health record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const applyVetLabel = (label: string) => {
    const parts = label.split("·").map(part => part.trim()).filter(Boolean);
    setVetName(parts[0] || "");
    setClinicName(parts.slice(1).join(" · "));
  };

  useEffect(() => {
    if (!visible) return;
    if (initialRecord) {
      setTitle(initialRecord.title || "");
      setType(initialRecord.type || "checkup");
      setDate(initialRecord.date || new Date().toISOString().split('T')[0]);
      applyVetLabel(initialRecord.vet || "");
      setNotes(initialRecord.notes || "");
      setPdfs(initialRecord.pdfs || []);
      return;
    }
    setTitle("");
    setType("checkup");
    setDate(new Date().toISOString().split('T')[0]);
    setVetName("");
    setClinicName("");
    setNotes("");
    setPdfs([]);
  }, [visible, initialRecord]);

  useEffect(() => {
    if (!visible) {
      setAutoPickDone(false);
      return;
    }
    if (startMode === "upload" && !autoPickDone && !isEdit) {
      setAutoPickDone(true);
      pickPDF();
    }
  }, [visible, startMode, autoPickDone, isEdit]);

  useEffect(() => {
    if (!visible) return;
    if (pdfs.length === 0) {
      setExtractedRawText(null);
      return;
    }
    const latest = pdfs[pdfs.length - 1];
    if (!latest?.id || lastAnalyzedRef.current === latest.id) return;
    lastAnalyzedRef.current = latest.id;

    const runAnalysis = async () => {
      let summarySet = false;
      try {
        setIsAnalyzing(true);
        setAnalysisSummary(null);
        setAnalysisStatus(null);
        if (Platform.OS === "web" && latest.uri) {
          const pdfjsLib = await loadPdfJs();
          if (pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
            const resp = await fetch(latest.uri);
            const buffer = await resp.arrayBuffer();
            const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
            let text = "";
            for (let i = 1; i <= doc.numPages; i += 1) {
              const page = await doc.getPage(i);
              const content = await page.getTextContent();
              text += `\n${content.items.map((item: any) => item.str || "").join(" ")}`;
            }
            const extraction = await analyzeClinicalSummary("", text, petId || undefined);
            setExtractedRawText(text);
            const visitDate = extraction?.normalized?.visitDate?.value;
            if (visitDate) {
              const formatted = formatLocalDate(visitDate);
              if (formatted) setDate(formatted);
            }
            const visitTitle = extraction?.normalized?.visitTitle?.value;
            if (visitTitle && !title.trim()) {
              setTitle(visitTitle);
            }
            const doctor = extraction?.normalized?.doctorName?.value;
            const clinic = extraction?.normalized?.clinicName?.value;
            const vetLabel = [doctor, clinic].filter(Boolean).join(" · ");
            if (vetLabel) {
              applyVetLabel(vetLabel);
            }
            if (visitDate || vetLabel || visitTitle) {
              setAnalysisSummary("Auto-filled visit details from this PDF.");
              setAnalysisStatus("success");
              summarySet = true;
            } else {
              setAnalysisSummary("We couldn't detect visit details. Please enter them manually.");
              setAnalysisStatus("warning");
              summarySet = true;
            }
            return;
          }
          // Fallback: upload + server-side extraction when pdf.js is unavailable
          if (!userId) {
            setAnalysisSummary("Sign in to auto-fill visit details.");
            setAnalysisStatus("warning");
            summarySet = true;
            return;
          }
        }

        if (!userId) {
          setAnalysisSummary("Sign in to auto-fill visit details.");
          setAnalysisStatus("warning");
          summarySet = true;
          return;
        }

        let filePath = latest.path;
        let viewUrl = latest.uri;
        if (!filePath && latest.uri) {
          const uploaded = await uploadHealthAttachment(userId, latest.uri, latest.name);
          filePath = uploaded.path;
          viewUrl = uploaded.uri;
          setPdfs(prev =>
            prev.map(item =>
              item.id === latest.id ? { ...item, uri: viewUrl, path: filePath } : item
            )
          );
        }
        if (!filePath) throw new Error("Upload missing file path");
        const extraction = await analyzeClinicalSummary(filePath, undefined, petId || undefined);
        const visitDate = extraction?.normalized?.visitDate?.value;
        if (visitDate) {
          const formatted = formatLocalDate(visitDate);
          if (formatted) setDate(formatted);
        }
        const visitTitle = extraction?.normalized?.visitTitle?.value;
        if (visitTitle && !title.trim()) {
          setTitle(visitTitle);
        }
        const doctor = extraction?.normalized?.doctorName?.value;
        const clinic = extraction?.normalized?.clinicName?.value;
        const vetLabel = [doctor, clinic].filter(Boolean).join(" · ");
        if (vetLabel) {
          applyVetLabel(vetLabel);
        }
        if (visitDate || vetLabel || visitTitle) {
          setAnalysisSummary("Auto-filled visit details from this PDF.");
          setAnalysisStatus("success");
          summarySet = true;
        } else {
          setAnalysisSummary("We couldn't detect visit details. Please enter them manually.");
          setAnalysisStatus("warning");
          summarySet = true;
        }
      } catch (error) {
        console.warn("HealthScreen: Failed to analyze PDF for autofill", error);
        setAnalysisSummary("We couldn't analyze this PDF. Please enter details manually.");
        setAnalysisStatus("warning");
        summarySet = true;
      } finally {
        if (!summarySet) {
          setAnalysisSummary("We couldn't analyze this PDF. Please enter details manually.");
          setAnalysisStatus("warning");
        }
        setIsAnalyzing(false);
      }
    };

    runAnalysis();
  }, [visible, pdfs, userId, petId]);

  const typeOptions: { label: string; value: HealthRecord["type"]; icon: string }[] = [
    { label: "Vaccination", value: "vaccination", icon: "medical" },
    { label: "Checkup", value: "checkup", icon: "checkmark-circle" },
    { label: "Medication", value: "medication", icon: "medkit" },
    { label: "Grooming", value: "grooming", icon: "cut" },
    { label: "Other", value: "other", icon: "document-text" },
  ];
  const selectedTypeLabel = typeOptions.find(option => option.value === type)?.label || "Select";

  const extractedVaccinations = useMemo(() => {
    const entries: Array<{ name: string; date?: string; dueDate?: string }> = [];
    pdfs.forEach((pdf) => {
      (pdf.extracted?.vaccinations || []).forEach((entry) => {
        if (!entry?.name || entry.name.trim().length < 3) return;
        entries.push({
          name: entry.name,
          date: entry.date,
          dueDate: entry.dueDate,
        });
      });
    });
    const deduped = new Map<string, { name: string; date?: string; dueDate?: string }>();
    entries.forEach((entry) => {
      const key = `${entry.name}|${entry.date || ""}|${entry.dueDate || ""}`;
      if (!deduped.has(key)) deduped.set(key, entry);
    });
    return Array.from(deduped.values());
  }, [pdfs]);

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
          maxHeight: "88%",
          borderWidth: 1,
          borderColor: colors.borderLight,
          overflow: "hidden",
          ...SHADOWS.lg
        }}>
          <View style={{ 
            flexDirection: "row", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: SPACING.md,
            paddingBottom: SPACING.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight
          }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
              {isEdit ? "Edit Health Record" : "Add Health Record"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: SPACING.sm }}
          >
            <View>
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Record type
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setShowTypeOptions(prev => !prev)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    backgroundColor: colors.cardSecondary,
                    borderRadius: RADIUS.lg,
                    paddingVertical: SPACING.sm,
                    paddingHorizontal: SPACING.md,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ ...TYPOGRAPHY.base, color: colors.text }}>{selectedTypeLabel}</Text>
                  <Ionicons name={showTypeOptions ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                </TouchableOpacity>
                {showTypeOptions && (
                  <View
                    style={{
                      marginTop: SPACING.xs,
                      borderWidth: 1,
                      borderColor: colors.borderLight,
                      borderRadius: RADIUS.lg,
                      backgroundColor: colors.card,
                      overflow: "hidden",
                    }}
                  >
                    {typeOptions.map((option, index) => {
                      const isSelected = option.value === type;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => {
                            setType(option.value);
                            setShowTypeOptions(false);
                          }}
                          style={{
                            paddingVertical: SPACING.sm,
                            paddingHorizontal: SPACING.md,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: isSelected ? colors.bgSecondary : "transparent",
                            borderTopWidth: index === 0 ? 0 : 1,
                            borderTopColor: colors.borderLight,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Ionicons
                              name={option.icon as any}
                              size={16}
                              color={isSelected ? colors.accent : colors.textMuted}
                              style={{ marginRight: SPACING.sm }}
                            />
                            <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }}>{option.label}</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Upload clinical summary (optional)
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm }}>
                  <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                    PDF Attachments
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={pickPDF}
                  activeOpacity={0.85}
                  style={{
                    padding: SPACING.md,
                    borderRadius: RADIUS.lg,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    backgroundColor: colors.cardSecondary,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.accent} />
                    <View style={{ marginLeft: SPACING.sm }}>
                      <Text style={{ ...TYPOGRAPHY.sm, color: colors.text, fontWeight: "600" }}>
                        Upload clinical summary
                      </Text>
                      <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                        PDF only • Auto-extract vitals
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>

                {analysisSummary && (
                  <View style={{
                    marginTop: SPACING.sm,
                    padding: SPACING.sm,
                    backgroundColor: analysisStatus === "warning" ? colors.warningLight : colors.successLight,
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: analysisStatus === "warning" ? colors.warning : colors.success,
                  }}>
                    <Text style={{
                      ...TYPOGRAPHY.sm,
                      color: analysisStatus === "warning" ? colors.warning : colors.success,
                      fontWeight: "600"
                    }}>
                      {analysisStatus === "warning" ? "Needs manual review" : "Clinical summary analyzed"}
                    </Text>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.text, marginTop: 2 }}>
                      {analysisSummary}
                    </Text>
                  </View>
                )}

                {pdfs.length > 0 && (
                  <View style={{ marginTop: SPACING.sm }}>
                    {pdfs.map((pdf) => (
                      <View
                        key={pdf.id}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: SPACING.sm,
                          backgroundColor: colors.bgSecondary,
                          borderRadius: RADIUS.md,
                          marginBottom: SPACING.xs,
                        }}
                      >
                        <Ionicons name="document-text" size={20} color={colors.accent} />
                        <View style={{ marginLeft: SPACING.sm, flex: 1 }}>
                          <Text style={{ ...TYPOGRAPHY.sm, color: colors.text }} numberOfLines={1}>
                            {pdf.name}
                          </Text>
                          {typeof pdf.size === "number" && (
                            <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                              {(pdf.size / 1024 / 1024).toFixed(2)} MB
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => removePDF(pdf.id)}>
                          <Ionicons name="close-circle" size={20} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                {isAnalyzing && (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: SPACING.md,
                    backgroundColor: colors.accent + "10",
                    borderRadius: RADIUS.md,
                    marginTop: SPACING.sm,
                  }}>
                    <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: SPACING.sm }} />
                    <Text style={{ ...TYPOGRAPHY.sm, color: colors.accent, fontWeight: "600" }}>
                      Analyzing clinical summary...
                    </Text>
                  </View>
                )}
              </View>

              {type === "vaccination" && extractedVaccinations.length > 0 && (
                <View style={{ marginBottom: SPACING.md }}>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                    Vaccinations found in this report
                  </Text>
                  <View style={{ borderWidth: 1, borderColor: colors.borderLight, borderRadius: RADIUS.lg, overflow: "hidden" }}>
                    {extractedVaccinations.map((entry, index) => (
                      <View
                        key={`${entry.name}-${entry.date || "nodate"}-${entry.dueDate || "nodue"}-${index}`}
                        style={{
                          paddingVertical: SPACING.sm,
                          paddingHorizontal: SPACING.md,
                          backgroundColor: colors.bgSecondary,
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderTopColor: colors.borderLight,
                        }}
                      >
                        <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text }}>
                          {entry.name}
                        </Text>
                        {entry.date ? (
                          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                            Given: {formatShortDate(entry.date)}
                          </Text>
                        ) : null}
                        {entry.dueDate && (
                          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                            Due: {formatShortDate(entry.dueDate)}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Visit title
                </Text>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Annual checkup"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  Visit date
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Auto-filled from receipt
                </Text>
                <Input
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Veterinarian
                </Text>
                <Input
                  value={vetName}
                  onChangeText={setVetName}
                  placeholder="Dr. Smith"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginBottom: SPACING.xs }}>
                  Clinic
                </Text>
                <Input
                  value={clinicName}
                  onChangeText={setClinicName}
                  placeholder="CityVet"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xs }}>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                    Additional notes (optional)
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      if (isGeneratingSummary) return;
                      const textToSummarize = extractedRawText || [
                        title && `Visit: ${title}`,
                        date && `Date: ${date}`,
                        vetName && `Veterinarian: ${vetName}`,
                        clinicName && `Clinic: ${clinicName}`,
                        notes && `Notes: ${notes}`,
                      ].filter(Boolean).join(". ");
                      if (!textToSummarize || textToSummarize.trim().length < 50) {
                        Alert.alert("Add more details", "Enter at least visit date, vet, clinic, or notes (about 50 characters) so we can generate a summary.");
                        return;
                      }
                      try {
                        setIsGeneratingSummary(true);
                        const summary = await generateHealthSummary(textToSummarize, petName || "your pet");
                          if (summary) {
                            const prefix = notes.trim() ? "\n\n" : "";
                            setNotes(prev => prev.trim() ? `${prev}${prefix}${summary}` : summary);
                        }
                      } catch (err) {
                        console.warn("HealthScreen: Generate summary failed", err);
                        Alert.alert("Error", "Could not generate summary. Please try again.");
                      } finally {
                        setIsGeneratingSummary(false);
                      }
                    }}
                    disabled={isGeneratingSummary}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    {isGeneratingSummary ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Ionicons name="sparkles" size={14} color={colors.accent} />
                    )}
                    <Text style={{ ...TYPOGRAPHY.xs, fontWeight: "600", color: colors.accent }}>
                      {isGeneratingSummary ? "Generating..." : "Generate summary"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes about the visit"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </ScrollView>

          <View style={{ 
            flexDirection: "row", 
            marginTop: SPACING.lg,
            paddingTop: SPACING.md,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight
          }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title={isSaving ? "Saving..." : (isEdit ? "Update" : "Save")}
              onPress={handleSave}
              disabled={isSaving}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
          {isEdit && onDelete && (
            <Button
              title="Delete Record"
              onPress={onDelete}
              style={{ marginTop: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.danger }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const AddAppointmentModal = ({
  visible,
  onClose,
  onSave,
  onDelete,
  initialAppointment
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (appointment: Omit<VetAppointment, "id">) => Promise<void>;
  onDelete?: () => void;
  initialAppointment?: VetAppointment | null;
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [appointmentTime, setAppointmentTime] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = !!initialAppointment;

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title");
      return;
    }
    if (!appointmentDate) {
      Alert.alert("Error", "Please enter a date");
      return;
    }
    try {
      setIsSaving(true);
      await onSave({
        title: title.trim(),
        appointmentDate,
        appointmentTime: appointmentTime.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        doctorName: doctorName.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        status: "scheduled",
      });
      setTitle("");
      setAppointmentDate(new Date().toISOString().split("T")[0]);
      setAppointmentTime("");
      setClinicName("");
      setDoctorName("");
      setAddressLine1("");
      setCity("");
      setState("");
      setZip("");
      setReason("");
      setNotes("");
      onClose();
    } catch (error) {
      console.error("HealthScreen: Failed to save appointment", error);
      Alert.alert("Error", "Could not save appointment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    if (initialAppointment) {
      setTitle(initialAppointment.title || "");
      setAppointmentDate(initialAppointment.appointmentDate || new Date().toISOString().split("T")[0]);
      setAppointmentTime(initialAppointment.appointmentTime || "");
      setClinicName(initialAppointment.clinicName || "");
      setDoctorName(initialAppointment.doctorName || "");
      setAddressLine1(initialAppointment.addressLine1 || "");
      setCity(initialAppointment.city || "");
      setState(initialAppointment.state || "");
      setZip(initialAppointment.zip || "");
      setReason(initialAppointment.reason || "");
      setNotes(initialAppointment.notes || "");
      return;
    }
    setTitle("");
    setAppointmentDate(new Date().toISOString().split("T")[0]);
    setAppointmentTime("");
    setClinicName("");
    setDoctorName("");
    setAddressLine1("");
    setCity("");
    setState("");
    setZip("");
    setReason("");
    setNotes("");
  }, [visible, initialAppointment]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "flex-end" }}>
        <View style={{ 
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.xl,
          borderTopRightRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "90%"
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg }}>
            <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text }}>
              {isEdit ? "Edit Vet Visit" : "Schedule Vet Visit"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View>
              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Title *"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Annual Checkup"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Date *"
                  value={appointmentDate}
                  onChangeText={setAppointmentDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Time"
                  value={appointmentTime}
                  onChangeText={setAppointmentTime}
                  placeholder="HH:MM"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Clinic"
                  value={clinicName}
                  onChangeText={setClinicName}
                  placeholder="Clinic name"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Doctor"
                  value={doctorName}
                  onChangeText={setDoctorName}
                  placeholder="Doctor name"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Address"
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  placeholder="Street address"
                />
              </View>

              <View style={{ flexDirection: "row", marginBottom: SPACING.md }}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Input
                    label="City"
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                  />
                </View>
                <View style={{ width: 90, marginRight: SPACING.sm }}>
                  <Input
                    label="State"
                    value={state}
                    onChangeText={setState}
                    placeholder="ST"
                  />
                </View>
                <View style={{ width: 100 }}>
                  <Input
                    label="ZIP"
                    value={zip}
                    onChangeText={setZip}
                    placeholder="ZIP"
                  />
                </View>
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Reason"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason for visit"
                />
              </View>

              <View style={{ marginBottom: SPACING.md }}>
                <Input
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional notes..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </ScrollView>

          <View style={{ flexDirection: "row", marginTop: SPACING.lg }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title={isSaving ? "Saving..." : (isEdit ? "Update" : "Save")}
              onPress={handleSave}
              disabled={isSaving}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
          {isEdit && onDelete && (
            <Button
              title="Delete Visit"
              onPress={onDelete}
              style={{ marginTop: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.danger }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const loadPdfJs = (() => {
  let loader: Promise<any> | null = null;
  return () => {
    if (Platform.OS !== "web") return Promise.resolve(null);
    if (typeof window === "undefined") return Promise.resolve(null);
    if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
    if (loader) return loader;
    loader = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js";
      script.onload = () => resolve((window as any).pdfjsLib);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return loader;
  };
})();

const ManualHealthStatusModal = ({
  visible,
  onClose,
  onSave,
  initialValues,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: { weight?: { value: number; unit?: string } | string; heartRate?: string; respiratoryRate?: string; attitude?: string }) => void;
  initialValues?: { weight?: { value: number; unit?: string } | string; heartRate?: string; respiratoryRate?: string; attitude?: string };
}) => {
  const { colors } = useTheme();
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");
  const [heartRate, setHeartRate] = useState(initialValues?.heartRate || "");
  const [respRate, setRespRate] = useState(initialValues?.respiratoryRate || "");
  const [attitude, setAttitude] = useState(initialValues?.attitude || "");
  const [weightError, setWeightError] = useState("");
  const [heartRateError, setHeartRateError] = useState("");
  const [respRateError, setRespRateError] = useState("");

  const parseWeight = (value?: { value: number; unit?: string } | string) => {
    if (!value) {
      setWeight("");
      setWeightUnit("lb");
      return;
    }
    if (typeof value === "object" && "value" in value) {
      setWeight(String(value.value ?? ""));
      setWeightUnit(value.unit === "kg" ? "kg" : "lb");
      return;
    }
    setWeight(String(value));
  };

  useEffect(() => {
    if (!visible) return;
    parseWeight(initialValues?.weight);
    setHeartRate(initialValues?.heartRate || "");
    setRespRate(initialValues?.respiratoryRate || "");
    setAttitude(initialValues?.attitude || "");
    setWeightError("");
    setHeartRateError("");
    setRespRateError("");
  }, [visible, initialValues]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: colors.black + "80", justifyContent: "center", padding: SPACING.lg }}>
        <View style={{
          backgroundColor: colors.card,
          borderRadius: RADIUS.xl,
          paddingTop: SPACING.lg,
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.xl,
          maxHeight: "90%",
          borderWidth: 1,
          borderColor: colors.borderLight,
          ...SHADOWS.lg
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xs }}>
            <View>
              <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "700", color: colors.text, letterSpacing: -0.2 }}>
                Update health status
              </Text>
              <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 2 }}>
                Enter current vitals
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: colors.borderLight, marginBottom: SPACING.md }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: SPACING.md }}>
              <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.textMuted }}>
                Vitals
              </Text>

              <View style={{
                padding: SPACING.sm,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: colors.borderLight,
                backgroundColor: colors.cardSecondary,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <Text style={{ ...TYPOGRAPHY.base, color: colors.text }}>Weight</Text>
                <View style={{ flexDirection: "row", borderRadius: RADIUS.pill, overflow: "hidden", borderWidth: 1, borderColor: colors.borderLight }}>
                  {(["lb", "kg"] as const).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      onPress={() => setWeightUnit(unit)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 14,
                        backgroundColor: weightUnit === unit ? colors.accent : "transparent",
                      }}
                    >
                      <Text style={{ ...TYPOGRAPHY.sm, color: weightUnit === unit ? colors.white : colors.textMuted, fontWeight: "600" }}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Input
                value={weight}
                onChangeText={setWeight}
                placeholder={`e.g., 25.4 ${weightUnit}`}
                keyboardType="decimal-pad"
              />
              {weightError ? (
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginTop: SPACING.xs }}>
                  {weightError}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ minHeight: 34, justifyContent: "flex-end" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, fontSize: 13 }} numberOfLines={1} ellipsizeMode="tail">
                      Heart rate (bpm)
                    </Text>
                  </View>
                  <Input
                    value={heartRate}
                    onChangeText={setHeartRate}
                    placeholder="140"
                    keyboardType="number-pad"
                  />
                  {heartRateError ? (
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginTop: SPACING.xs }}>
                      {heartRateError}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ minHeight: 34, justifyContent: "flex-end" }}>
                    <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", color: colors.text, fontSize: 13 }} numberOfLines={1} ellipsizeMode="tail">
                      Respiratory rate
                    </Text>
                  </View>
                  <Input
                    value={respRate}
                    onChangeText={setRespRate}
                    placeholder="35"
                    keyboardType="number-pad"
                  />
                  {respRateError ? (
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.danger, marginTop: SPACING.xs }}>
                      {respRateError}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View>
                <Text style={{ ...TYPOGRAPHY.sm, fontWeight: "600", marginBottom: SPACING.xs, color: colors.text }}>
                  Mental status
                </Text>
                <View style={{
                  flexDirection: "row",
                  borderRadius: RADIUS.md,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  backgroundColor: colors.cardSecondary,
                }}>
                  {["BAR", "QAR", "L", "D"].map((code, idx) => (
                    <TouchableOpacity
                      key={code}
                      onPress={() => setAttitude(code)}
                      style={{
                        flex: 1,
                        paddingVertical: SPACING.sm,
                        alignItems: "center",
                        borderRightWidth: idx === 3 ? 0 : 1,
                        borderRightColor: colors.borderLight,
                        backgroundColor: attitude === code ? colors.accent : "transparent",
                      }}
                    >
                      <Text style={{
                        ...TYPOGRAPHY.sm,
                        color: attitude === code ? colors.white : colors.textMuted,
                        fontWeight: attitude === code ? "600" : "500"
                      }}>
                        {code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.xs }}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginLeft: SPACING.xs }}>
                    What do these mean?
                  </Text>
                </View>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.xs }}>
                  BAR: Bright, Alert, Responsive
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  QAR: Quiet, Alert, Responsive
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  L: Lethargic
                </Text>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>
                  D: Depressed
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={{ height: 1, backgroundColor: colors.borderLight, marginTop: SPACING.lg }} />
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, textAlign: "center", marginTop: SPACING.sm }}>
            You can update this later.
          </Text>

          <View style={{ flexDirection: "row", marginTop: SPACING.md }}>
            <Button
              title="Cancel"
              onPress={onClose}
              style={{ flex: 1, marginRight: SPACING.sm, backgroundColor: colors.bgSecondary }}
              titleStyle={{ color: colors.text }}
            />
            <Button
              title="Save"
              onPress={() => {
                const isNumber = (val: string) => val.trim() === "" || !Number.isNaN(Number(val));
                const nextWeightError = isNumber(weight) ? "" : "Enter a valid weight";
                const nextHeartError = isNumber(heartRate) ? "" : "Enter a valid heart rate";
                const nextRespError = isNumber(respRate) ? "" : "Enter a valid respiratory rate";
                setWeightError(nextWeightError);
                setHeartRateError(nextHeartError);
                setRespRateError(nextRespError);
                if (nextWeightError || nextHeartError || nextRespError) return;
                const parsedWeight = weight.trim() !== ""
                  ? { value: Number(weight), unit: weightUnit }
                  : undefined;
                onSave({ weight: parsedWeight, heartRate, respiratoryRate: respRate, attitude });
              }}
              style={{ flex: 1, marginLeft: SPACING.sm }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};


export default function HealthScreen() {
  const { colors } = useTheme();
  const { registerAddHealthRecordCallback, navigateTo } = useNavigation();
  const { activePetId, getActivePet } = usePets();
  const { user } = useAuth();
  const activePet = getActivePet();
  const petName = activePet?.name?.trim() || "your pet";
  const petNamePossessive = petName === "your pet" ? "your pet's" : petName.endsWith("s") ? `${petName}'` : `${petName}'s`;
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [actionSheetTitle, setActionSheetTitle] = useState<string | undefined>(undefined);
  const [actionSheetVariant, setActionSheetVariant] = useState<"list" | "quick">("list");
  const [actionSheetFooter, setActionSheetFooter] = useState<string | undefined>(undefined);
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [healthRecordStartMode, setHealthRecordStartMode] = useState<"manual" | "upload">("manual");
  const [showManualStatusModal, setShowManualStatusModal] = useState(false);
  const [manualStatus, setManualStatus] = useState<{
    updatedAt: string;
    source?: "manual" | "auto";
    weight?: { value: number; unit?: string } | string;
    heartRate?: string;
    respiratoryRate?: string;
    attitude?: string;
  } | null>(null);
  const [manualStatusPrefill, setManualStatusPrefill] = useState<{
    weight?: { value: number; unit?: string } | string;
    heartRate?: string;
    respiratoryRate?: string;
    attitude?: string;
  } | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<{ type: "pdf"; url: string; name: string } | null>(null);
  const [showAttachmentViewer, setShowAttachmentViewer] = useState(false);
  const [appointments, setAppointments] = useState<VetAppointment[]>([]);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<VetAppointment | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const SCROLL_DOWN_THRESHOLD = 50;
  const SCROLL_UP_THRESHOLD = 35;
  const handleHealthScroll = useCallback((event: any) => {
    const y = event.nativeEvent?.contentOffset?.y ?? 0;
    if (y <= 0) {
      if (headerCompactRef.current) {
        headerCompactRef.current = false;
        setHeaderCompact(false);
      }
    } else {
      const nextCompact = y >= SCROLL_DOWN_THRESHOLD ? true : y <= SCROLL_UP_THRESHOLD ? false : headerCompactRef.current;
      if (nextCompact !== headerCompactRef.current) {
        headerCompactRef.current = nextCompact;
        setHeaderCompact(nextCompact);
      }
    }
  }, []);

  const loadWeightHistory = useCallback(async () => {
    if (!activePetId) {
      setWeightHistory([]);
      return;
    }
    const key = user?.id ? `@kasper_weight_history_${user.id}_${activePetId}` : "";
    let remoteEntries: WeightEntry[] = [];
    if (user?.id) {
      try {
        remoteEntries = await fetchWeightHistory(user.id, activePetId);
      } catch (error) {
        console.error("HealthScreen: Failed to load weight history", error);
      }
    }

    let localEntries: WeightEntry[] = [];
    if (key) {
      const raw = await storage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          localEntries = Array.isArray(parsed) ? parsed : [];
        } catch {
          localEntries = [];
        }
      }
    }

    const merged = normalizeWeightEntries([...remoteEntries, ...localEntries]);
    setWeightHistory(merged);

    if (user?.id && merged.length > remoteEntries.length) {
      upsertWeightHistory(user.id, activePetId, merged)
        .then(() => checkWeightChangeAndNotify(user.id, activePetId))
        .catch((error) => {
          console.warn("HealthScreen: Failed to sync weight history", error);
        });
    }
  }, [activePetId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadWeightHistory();
    };
    if (!cancelled) {
      run();
    }
    return () => {
      cancelled = true;
    };
  }, [loadWeightHistory]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadWeightHistory(),
        user?.id && activePetId
          ? fetchVetAppointments(user.id, activePetId).then(setAppointments)
          : Promise.resolve(),
      ]);
    } catch (e) {
      console.warn("HealthScreen: Refresh failed", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadWeightHistory, user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const key = `@kasper_weight_history_${user.id}_${activePetId}`;
    storage.setItem(key, JSON.stringify(weightHistory)).catch(() => {});
  }, [user?.id, activePetId, weightHistory]);

  useEffect(() => {
    registerAddHealthRecordCallback(async () => {
      const mode = await storage.getItem("@kasper_health_record_start_mode");
      if (mode === "upload" || mode === "manual") {
        setHealthRecordStartMode(mode);
      } else {
        setHealthRecordStartMode("manual");
      }
      storage.removeItem("@kasper_health_record_start_mode").catch(() => {});
      setShowAddModal(true);
    });
  }, [registerAddHealthRecordCallback]);

  useEffect(() => {
    const loadTarget = async () => {
      const raw = await storage.getItem("@kasper_notification_target");
      if (!raw) return;
      try {
        const target = JSON.parse(raw);
        if (target?.type === "health" && target?.id) {
          if (target?.action === "edit") {
            const found = healthRecords.find(record => record.id === target.id);
            if (found) {
              setEditingRecord(found);
              setShowEditModal(true);
              storage.removeItem("@kasper_notification_target").catch(() => {});
              return;
            }
          }
          setPendingRecordId(target.id);
        }
      } catch {
        return;
      }
    };
    loadTarget();
  }, [healthRecords, manualStatus]);

  const getStatusValue = (status: any, key: "weight" | "heartRate" | "respiratoryRate" | "attitude") => {
    if (!status) return "N/A";
    const value = status[key];
    if (value && typeof value === "object" && "value" in value) {
      return value.value ?? "N/A";
    }
    return value || "N/A";
  };

  const getStatusUnit = (status: any, key: "weight") => {
    if (!status) return "";
    const value = status[key];
    if (value && typeof value === "object" && "unit" in value) {
      return value.unit || "";
    }
    return "lb";
  };

  const getAppointmentTimestamp = (appointment: VetAppointment) => {
    const dateTs = new Date(appointment.appointmentDate).getTime();
    return Number.isNaN(dateTs) ? 0 : dateTs;
  };

  const nextAppointment = useMemo(() => {
    if (appointments.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = appointments
      .filter((appointment) => appointment.status !== "canceled")
      .filter((appointment) => getAppointmentTimestamp(appointment) >= today.getTime())
      .sort((a, b) => getAppointmentTimestamp(a) - getAppointmentTimestamp(b));
    return upcoming[0] || null;
  }, [appointments]);

  useEffect(() => {
    const loadHealthRecords = async () => {
      if (!user?.id || !activePetId) {
        setHealthRecords([]);
            return;
          }
      try {
        const remote = await fetchHealthRecords(user.id, activePetId);
        setHealthRecords(remote);
      } catch (error) {
        console.error("HealthScreen: Failed to load health records:", error);
        setHealthRecords([]);
      }
    };

    loadHealthRecords();
  }, [activePetId, user?.id]);

  const filteredRecords = healthRecords.filter(record => 
    selectedFilter === "all" || record.type === selectedFilter
  );
  const latestExtractedRecord = useMemo(() => {
    const entries = healthRecords
      .map((record) => {
        const recordTime = record.createdAt || record.date || new Date().toISOString();
        const extracted = (record.pdfs || [])
          .map((pdf) => pdf.extracted)
          .find((item) => item);
        if (!extracted) return null;
        return { extracted, recordTime };
      })
      .filter(Boolean) as { extracted: any; recordTime: string }[];
    if (entries.length === 0) return null;
    entries.sort((a, b) => new Date(b.recordTime).getTime() - new Date(a.recordTime).getTime());
    return entries[0] || null;
  }, [healthRecords]);

  const latestExtractedStatus = useMemo(() => {
    if (!manualStatus && !latestExtractedRecord) return null;
    if (!manualStatus) return latestExtractedRecord?.extracted || null;
    if (!latestExtractedRecord) return manualStatus;
    const manualTime = new Date(manualStatus.updatedAt).getTime();
    const extractedTime = new Date(latestExtractedRecord.recordTime).getTime();
    if (!Number.isFinite(manualTime)) return latestExtractedRecord.extracted;
    if (!Number.isFinite(extractedTime)) return manualStatus;
    return manualTime >= extractedTime ? manualStatus : latestExtractedRecord.extracted;
  }, [manualStatus, latestExtractedRecord]);

  const latestStatusMeta = useMemo(() => {
    if (!manualStatus && !latestExtractedRecord) return null;
    if (!manualStatus) {
      return {
        source: "From PDF",
        ts: new Date(latestExtractedRecord?.recordTime || Date.now()).getTime(),
      };
    }
    if (!latestExtractedRecord) {
      return {
        source: manualStatus.source === "auto" ? "From PDF" : "Manual entry",
        ts: new Date(manualStatus.updatedAt).getTime(),
      };
    }
    const manualTime = new Date(manualStatus.updatedAt).getTime();
    const extractedTime = new Date(latestExtractedRecord.recordTime).getTime();
    if (!Number.isFinite(manualTime)) return { source: "From PDF", ts: extractedTime };
    if (!Number.isFinite(extractedTime)) {
      return {
        source: manualStatus.source === "auto" ? "From PDF" : "Manual entry",
        ts: manualTime,
      };
    }
    return manualTime >= extractedTime
      ? { source: manualStatus.source === "auto" ? "From PDF" : "Manual entry", ts: manualTime }
      : { source: "From PDF", ts: extractedTime };
  }, [manualStatus, latestExtractedRecord]);

  const latestWeightEntry = useMemo(() => {
    if (!weightHistory.length) return null;
    return weightHistory[0] || null;
  }, [weightHistory]);

  const latestWeightTs = useMemo(() => {
    if (!latestWeightEntry) return null;
    const ts = new Date(latestWeightEntry.date).getTime();
    return Number.isFinite(ts) ? ts : null;
  }, [latestWeightEntry]);

  const healthStatusMeta = useMemo(() => {
    if (latestWeightTs && (!latestStatusMeta || latestWeightTs > latestStatusMeta.ts)) {
      return { source: "Weight history", ts: latestWeightTs };
    }
    return latestStatusMeta;
  }, [latestStatusMeta, latestWeightTs]);

  const latestVisitRecord = useMemo(() => {
    if (!healthRecords.length) return null;
    const sorted = [...healthRecords].sort((a, b) => {
      const aDate = new Date(a.date || a.createdAt || 0).getTime();
      const bDate = new Date(b.date || b.createdAt || 0).getTime();
      return bDate - aDate;
    });
    return sorted[0] || null;
  }, [healthRecords]);

  const latestVisitExtracted = useMemo(() => {
    if (!latestVisitRecord?.pdfs?.length) return null;
    return latestVisitRecord.pdfs.map((pdf) => pdf.extracted).find(Boolean) || null;
  }, [latestVisitRecord]);

  const latestVisitDetails = useMemo(() => {
    if (!latestVisitRecord) {
      return {
        clinicName: "",
        doctorName: "",
        visitDate: "",
      };
    }
    const extractedClinic = latestVisitExtracted?.clinicName?.value?.trim() || "";
    const extractedDoctor = latestVisitExtracted?.doctorName?.value?.trim() || "";
    let clinicName = extractedClinic;
    let doctorName = extractedDoctor;
    if ((!clinicName || !doctorName) && latestVisitRecord.vet) {
      const parts = latestVisitRecord.vet.split("·").map((part) => part.trim());
      if (!doctorName && parts[0]) doctorName = parts[0];
      if (!clinicName && parts[1]) clinicName = parts[1];
      if (!clinicName && parts[0] && !doctorName) clinicName = parts[0];
    }
    const visitDate = latestVisitExtracted?.visitDate?.value || latestVisitRecord.date || "";
    return { clinicName, doctorName, visitDate };
  }, [latestVisitRecord, latestVisitExtracted]);

  const vaccinationEntries = useMemo(() => {
    const entries: VaccinationEntry[] = [];
    healthRecords.forEach((record) => {
      if (record.type === "vaccination") {
        entries.push({
          name: record.title || "Vaccination",
          date: record.date,
          source: "manual",
          recordId: record.id,
        });
      }
      (record.pdfs || []).forEach((pdf) => {
        (pdf.extracted?.vaccinations || []).forEach((vax) => {
          if (!vax?.name) return;
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

  const nextVaccinationDue = useMemo(() => {
    const today = new Date();
    const upcoming = vaccinationEntries
      .filter((entry) => entry.dueDate && toValidDate(entry.dueDate))
      .map((entry) => ({ entry, ts: new Date(entry.dueDate as string).getTime() }))
      .filter(({ ts }) => ts >= today.getTime())
      .sort((a, b) => a.ts - b.ts)[0];
    return upcoming?.entry || null;
  }, [vaccinationEntries]);

  

  useEffect(() => {
    if (!pendingRecordId || healthRecords.length === 0) return;
    const exists = healthRecords.some(record => record.id === pendingRecordId);
    if (!exists) return;
    setHighlightedRecordId(pendingRecordId);
    storage.removeItem("@kasper_notification_target").catch(() => {});
    setPendingRecordId(null);
    setTimeout(() => setHighlightedRecordId(null), 6000);
  }, [pendingRecordId, healthRecords]);

  useEffect(() => {
    if (!user?.id || !activePetId) return;
    const loadPrefill = async () => {
      const key = `@kasper_health_status_prefill_${user.id}_${activePetId}`;
      const raw = await storage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const vetKey = `@kasper_schedule_vet_initial_${user.id}_${activePetId}`;
        await storage.setItem(vetKey, JSON.stringify(parsed));
        navigateTo("ScheduleVetVisit");
      } catch {
        return;
      } finally {
        storage.removeItem(key).catch(() => {});
      }
    };
    loadPrefill();
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId) {
      setAppointments([]);
      return;
    }
    const loadAppointments = async () => {
      try {
        const data = await fetchVetAppointments(user.id, activePetId);
        setAppointments(data);
      } catch (e) {
        console.warn("HealthScreen: Failed to load vet appointments", e);
        setAppointments([]);
      }
    };
    loadAppointments();
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!user?.id || !activePetId) {
      setManualStatus(null);
      return;
    }
    const key = `@kasper_manual_health_status_${user.id}_${activePetId}`;
    const loadManualStatus = async () => {
      const raw = await storage.getItem(key);
      if (!raw) {
        setManualStatus(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        setManualStatus(parsed);
      } catch {
        setManualStatus(null);
      }
    };
    loadManualStatus();
  }, [user?.id, activePetId]);

  useEffect(() => {
    if (!manualStatus?.weight) return;
    const weightValue = typeof manualStatus.weight === "object" && "value" in manualStatus.weight
      ? Number(manualStatus.weight.value)
      : Number(manualStatus.weight);
    if (!Number.isFinite(weightValue)) return;
    addWeightEntry({
      weight: weightValue,
      date: manualStatus.updatedAt || new Date().toISOString(),
      source: manualStatus.source === "auto" ? "pdf" : "manual",
    });
  }, [manualStatus]);


  const handleSaveManualStatus = async (payload: { weight?: { value: number; unit?: string } | string; heartRate?: string; respiratoryRate?: string; attitude?: string }) => {
    if (!user?.id || !activePetId) return;
    const base = latestExtractedStatus || manualStatus || {};
    const nextWeight = payload.weight ?? (base as any).weight ?? undefined;
    const next = {
      updatedAt: new Date().toISOString(),
      source: "manual" as const,
      weight: nextWeight,
      heartRate: payload.heartRate?.trim() || (base as any).heartRate || undefined,
      respiratoryRate: payload.respiratoryRate?.trim() || (base as any).respiratoryRate || undefined,
      attitude: payload.attitude?.trim() || (base as any).attitude || undefined,
    };
    if (payload.weight) {
      const weightValue = typeof payload.weight === "object" && "value" in payload.weight
        ? Number(payload.weight.value)
        : Number(payload.weight);
      if (Number.isFinite(weightValue)) {
        addWeightEntry({ weight: weightValue, date: next.updatedAt, source: "manual" });
      }
    }
    setManualStatus(next);
    setShowManualStatusModal(false);
    const key = `@kasper_manual_health_status_${user.id}_${activePetId}`;
    storage.setItem(key, JSON.stringify(next)).catch(() => {});
  };

  const buildManualPrefill = (extracted: any) => {
    if (!extracted) return null;
    const prefill = {
      weight: normalizeStatusValue(extracted.weight),
      heartRate: normalizeStatusValue(extracted.heartRate),
      respiratoryRate: normalizeStatusValue(extracted.respiratoryRate),
      attitude: normalizeStatusValue(extracted.attitude),
    };
    if (!prefill.weight && !prefill.heartRate && !prefill.respiratoryRate && !prefill.attitude) {
      return null;
    }
    return prefill;
  };

  const normalizeStatusValue = (value: any) => {
    if (value == null) return undefined;
    if (typeof value === "object" && "value" in value) {
      return value.value != null ? String(value.value) : undefined;
    }
    if (typeof value === "string") return value.trim() || undefined;
    if (typeof value === "number") return String(value);
    return undefined;
  };

  const toValidDateIso = (value?: string) => {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  };

  const normalizeWeightEntries = (entries: WeightEntry[]) => {
    const next = entries
      .filter((item) => Number.isFinite(item.weight))
      .filter((item) => !Number.isNaN(new Date(item.date).getTime()));
    const deduped = new Map<string, WeightEntry>();
    next.forEach((item) => {
      deduped.set(`${item.date}|${item.weight}`, item);
    });
    return Array.from(deduped.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const addWeightEntry = (entry: WeightEntry) => {
    setWeightHistory((prev) => {
      return normalizeWeightEntries([...prev, entry]);
    });
    const isValidEntry =
      Number.isFinite(entry.weight) && !Number.isNaN(new Date(entry.date).getTime());
    if (isValidEntry && user?.id && activePetId) {
      upsertWeightHistory(user.id, activePetId, [entry])
        .then(() => checkWeightChangeAndNotify(user.id, activePetId))
        .catch((error) => {
          console.warn("HealthScreen: Failed to sync weight entry", error);
        });
    }
  };

  const buildMergedStatusFromExtracted = (extracted: any, fallback: any) => {
    if (!extracted) return null;
    const next = {
      updatedAt: new Date().toISOString(),
      source: "auto" as const,
      weight: normalizeStatusValue(extracted.weight) ?? normalizeStatusValue(fallback?.weight),
      heartRate: normalizeStatusValue(extracted.heartRate) ?? normalizeStatusValue(fallback?.heartRate),
      respiratoryRate: normalizeStatusValue(extracted.respiratoryRate) ?? normalizeStatusValue(fallback?.respiratoryRate),
      attitude: normalizeStatusValue(extracted.attitude) ?? normalizeStatusValue(fallback?.attitude),
    };
    if (!next.weight && !next.heartRate && !next.respiratoryRate && !next.attitude) {
      return null;
    }
    return next;
  };

  const persistManualStatus = async (next: any) => {
    if (!user?.id || !activePetId || !next) return;
    setManualStatus(next);
    const key = `@kasper_manual_health_status_${user.id}_${activePetId}`;
    storage.setItem(key, JSON.stringify(next)).catch(() => {});
  };

  const getMissingVitals = (extracted: any) => {
    if (!extracted) return ["weight", "heartRate", "respiratoryRate", "attitude"];
    const missing = [];
    if (!normalizeStatusValue(extracted.weight)) missing.push("weight");
    if (!normalizeStatusValue(extracted.heartRate)) missing.push("heartRate");
    if (!normalizeStatusValue(extracted.respiratoryRate)) missing.push("respiratoryRate");
    if (!normalizeStatusValue(extracted.attitude)) missing.push("attitude");
    return missing;
  };

  const buildVetLabel = (extracted: any) => {
    if (!extracted) return undefined;
    const doctor = extracted.doctorName?.value || "";
    const clinic = extracted.clinicName?.value || "";
    if (doctor && clinic) return `${doctor} · ${clinic}`;
    return doctor || clinic || undefined;
  };

  const handleSaveRecord = async (recordData: Omit<HealthRecord, "id">) => {
    if (!user?.id || !activePetId) {
      Alert.alert("Sign in required", "Please sign in to save health records.");
      return;
    }
    try {
      let attachments = recordData.pdfs || [];
      if (attachments.length > 0) {
        const uploaded = await Promise.all(
          attachments.map(async pdf => {
            if (pdf.path) return pdf;
            try {
              const upload = await uploadHealthAttachment(user.id, pdf.uri, pdf.name);
              return { ...pdf, uri: upload.uri, path: upload.path };
            } catch (error) {
              console.error("HealthScreen: Failed to upload attachment", error);
              return pdf;
            }
          })
        );
        attachments = uploaded;
      }

      if (attachments.length > 0) {
        const enriched = await Promise.all(
          attachments.map(async pdf => {
            if (!pdf.path) return pdf;
            try {
              let rawText: string | undefined;
              if (Platform.OS === "web" && pdf.uri) {
                const pdfjsLib = await loadPdfJs();
                if (pdfjsLib) {
                  pdfjsLib.GlobalWorkerOptions.workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
                  const resp = await fetch(pdf.uri);
                  const buffer = await resp.arrayBuffer();
                  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
                  let text = "";
                  for (let i = 1; i <= doc.numPages; i += 1) {
                    const page = await doc.getPage(i);
                    const content = await page.getTextContent();
                    text += `\n${content.items.map((item: any) => item.str || "").join(" ")}`;
                  }
                  rawText = text;
                }
              }
              const extraction = await analyzeClinicalSummary(pdf.path, rawText, activePetId || undefined);
              if (extraction?.normalized) {
                return { ...pdf, extracted: extraction.normalized };
              }
            } catch (error) {
              console.warn("HealthScreen: Clinical summary extraction failed", error);
            }
            return pdf;
          })
        );
        attachments = enriched;
      }

      const extracted = attachments
        .map((pdf) => pdf.extracted)
        .find((item) => item);
      const inferredVet = buildVetLabel(extracted);
      const resolvedVet = recordData.vet || inferredVet;

      const nextRecordData = { ...recordData };
      if (recordData.type === "vaccination" && extracted?.vaccinations?.length) {
        const list = extracted.vaccinations
          .map((entry: any) => {
            const due = entry.dueDate ? ` (Due ${entry.dueDate})` : "";
            return `- ${entry.name}${due}`;
          })
          .join("\n");
        if (!nextRecordData.title?.trim()) {
          nextRecordData.title = `Vaccination · ${extracted.vaccinations[0].name}`;
        }
        if (!nextRecordData.notes?.trim()) {
          nextRecordData.notes = list;
        }
      }

      const inserted = await insertHealthRecord(user.id, activePetId, {
        ...nextRecordData,
        vet: resolvedVet,
        pdfs: attachments.length > 0 ? attachments : undefined,
      });

      const newRecord: HealthRecord = {
        ...nextRecordData,
        id: inserted.id,
        vet: resolvedVet,
        pdfs: attachments.length > 0 ? attachments : undefined,
      };
      setHealthRecords(prev => [newRecord, ...prev]);
      insertNotification(user.id, {
        petId: activePetId,
        kind: "health",
        title: "Health record added",
        message: recordData.title ? `Added: ${recordData.title}.` : "A new health record was added.",
        ctaLabel: "View health",
        metadata: { type: "health_record", recordId: inserted.id },
      }).catch(error => {
        console.error("HealthScreen: Failed to create notification:", error);
      });
      const previous = healthRecords.find(record => record.type === recordData.type && record.date);
      if (previous?.date) {
        const recordDate = new Date(recordData.date);
        const prevDate = new Date(previous.date);
        if (!Number.isNaN(recordDate.getTime()) && !Number.isNaN(prevDate.getTime())) {
          const deltaDays = Math.abs(
            Math.round((recordDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          if (deltaDays >= 30) {
            insertNotification(user.id, {
              petId: activePetId,
              kind: "health",
              title: "Health trend update",
              message: `Last ${recordData.type} was ${deltaDays} days ago.`,
              ctaLabel: "View health",
              metadata: { type: "health_trend", recordId: inserted.id, deltaDays },
            }).catch(error => {
              console.error("HealthScreen: Failed to create trend notification:", error);
            });
          }
        }
      }

      if (attachments.length > 0) {
        const extractedWeight = normalizeStatusValue(extracted?.weight);
        if (extractedWeight) {
          const weightValue = Number(extractedWeight);
          if (Number.isFinite(weightValue)) {
            addWeightEntry({
              weight: weightValue,
              date: toValidDateIso(recordData.date),
              source: "pdf",
            });
          }
        }
        const prefill = buildManualPrefill(extracted);
        const missing = getMissingVitals(extracted);
        const fallbackStatus = latestExtractedStatus || manualStatus;
        const mergedStatus = buildMergedStatusFromExtracted(extracted, fallbackStatus);
        if (mergedStatus) {
          persistManualStatus(mergedStatus).catch(() => {});
        }
        if (missing.length > 0) {
          Alert.alert(
            "Health record added",
            "Some vitals were missing. Do you want to enter them now?",
            [
              { text: "Not now", style: "cancel" },
              {
                text: "Enter manually",
                onPress: () => {
                  setManualStatusPrefill(prefill);
                  setShowManualStatusModal(true);
                },
              },
            ]
          );
        } else {
          Alert.alert("Success", "Health record added successfully!");
        }
      } else {
        Alert.alert("Success", "Health record added successfully!");
      }
    } catch (error) {
      console.error("HealthScreen: Failed to save health record:", error);
      Alert.alert("Error", "Could not save health record. Please try again.");
    }
  };

  const saveRecordEdits = async (recordData: Omit<HealthRecord, "id">) => {
    if (!user?.id || !editingRecord) return;
    try {
      let attachments = recordData.pdfs || [];
      if (attachments.length > 0) {
        const uploaded = await Promise.all(
          attachments.map(async pdf => {
            if (pdf.path) return pdf;
            try {
              const upload = await uploadHealthAttachment(user.id, pdf.uri, pdf.name);
              return { ...pdf, uri: upload.uri, path: upload.path };
            } catch (error) {
              console.error("HealthScreen: Failed to upload attachment", error);
              return pdf;
            }
          })
        );
        attachments = uploaded;
      }

      if (attachments.length > 0) {
        const enriched = await Promise.all(
          attachments.map(async pdf => {
            if (!pdf.path) return pdf;
            if (pdf.extracted) return pdf;
            try {
              let rawText: string | undefined;
              if (Platform.OS === "web" && pdf.uri) {
                const pdfjsLib = await loadPdfJs();
                if (pdfjsLib) {
                  pdfjsLib.GlobalWorkerOptions.workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
                  const resp = await fetch(pdf.uri);
                  const buffer = await resp.arrayBuffer();
                  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
                  let text = "";
                  for (let i = 1; i <= doc.numPages; i += 1) {
                    const page = await doc.getPage(i);
                    const content = await page.getTextContent();
                    text += `\n${content.items.map((item: any) => item.str || "").join(" ")}`;
                  }
                  rawText = text;
                }
              }
              const extraction = await analyzeClinicalSummary(pdf.path, rawText, activePetId || undefined);
              if (extraction?.normalized) {
                return { ...pdf, extracted: extraction.normalized };
              }
            } catch (error) {
              console.warn("HealthScreen: Clinical summary extraction failed", error);
            }
            return pdf;
          })
        );
        attachments = enriched;
      }

      await updateHealthRecord(user.id, editingRecord.id, {
        ...recordData,
        pdfs: attachments.length > 0 ? attachments : undefined,
      });
      setHealthRecords(prev =>
        prev.map(record =>
          record.id === editingRecord.id
            ? { ...record, ...recordData, pdfs: attachments.length > 0 ? attachments : undefined }
            : record
        )
      );
      setShowEditModal(false);
      setEditingRecord(null);
      Alert.alert("Saved", "Health record updated successfully!");
    } catch (error) {
      console.error("HealthScreen: Failed to update health record", error);
      Alert.alert("Error", "Could not update health record. Please try again.");
    }
  };

  const removeHealthRecord = async (recordId: string) => {
    if (!user?.id) return;
    try {
      setHealthRecords(prev => prev.filter(record => record.id !== recordId));
      await deleteHealthRecord(user.id, recordId);
      if (editingRecord?.id === recordId) {
        setShowEditModal(false);
        setEditingRecord(null);
      }
    } catch (error) {
      console.error("HealthScreen: Failed to delete health record", error);
      Alert.alert("Error", "Could not delete health record. Please try again.");
    }
  };

  const openHealthActions = (record: HealthRecord) => {
    setActionSheetVariant("list");
    setActionSheetTitle("Health record");
    setActionSheetFooter(undefined);
    setActionSheetOptions([
      {
        label: "Edit",
        icon: "create-outline",
        onPress: () => {
          setEditingRecord(record);
          setShowEditModal(true);
        },
      },
      {
        label: "Delete",
        icon: "trash-outline",
        onPress: () => removeHealthRecord(record.id),
      },
    ]);
    setActionSheetVisible(true);
  };

  const handleViewPDF = async (pdf: PDFAttachment) => {
    let url = pdf.uri;
    if (pdf.path) {
      url = (await getHealthAttachmentViewUrl(pdf.path)) || url;
    }
    if (!url) {
      Alert.alert("Attachment unavailable", "This attachment does not have a viewable link yet.");
      return;
    }
    setSelectedAttachment({ type: "pdf", url, name: pdf.name });
    setShowAttachmentViewer(true);
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Screen Header */}
      <ScreenHeader
        title="Health"
        actionIcon="paw"
        onActionPress={() => setShowAddModal(true)}
        centerTitle={headerCompact}
        titleStyle={headerCompact ? { ...TYPOGRAPHY.sm, fontWeight: "400" } : { ...TYPOGRAPHY.base, fontWeight: "400" }}
        paddingTop={SPACING.lg}
        paddingBottom={headerCompact ? SPACING.sm : SPACING.lg}
        insetSeparator
      />

      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 120
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        onScroll={handleHealthScroll}
        scrollEventThrottle={0}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm, backgroundColor: colors.bg }}>
          <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted }}>
            Track {petNamePossessive} health and medical history
          </Text>
        </View>

        {/* Health hub – single card: hero + metrics grid + actions */}
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <View style={{
            borderRadius: RADIUS.xxl,
            overflow: "hidden",
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderLight,
            ...SHADOWS.sm,
          }}>
            {/* Hero: latest visit with gradient */}
            <LinearGradient
              colors={[colors.accent + "14", colors.accent + "06", "transparent"]}
              style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.lg }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm }}>
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Latest visit
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setActionSheetVariant("quick");
                    setActionSheetTitle("Update health status");
                    setActionSheetFooter("You can edit your health record later.");
                    setActionSheetOptions([
                      { label: "Upload PDF", icon: "cloud-upload-outline", iconColor: "#7C3AED", subtitle: "Auto-fill from clinical report", onPress: () => { storage.setItem("@kasper_health_record_start_mode", "upload"); setShowAddModal(true); } },
                      { label: "Add manually", icon: "create-outline", iconColor: "#64748B", subtitle: "Enter details yourself", onPress: () => setShowManualStatusModal(true) },
                    ]);
                    setActionSheetVisible(true);
                  }}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: colors.surface }}
                >
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.text, fontWeight: "600" }}>Update</Text>
                </TouchableOpacity>
              </View>
              {latestVisitRecord && (latestVisitDetails.clinicName || latestVisitDetails.doctorName || latestVisitDetails.visitDate) ? (
                <>
                  <Text style={{ ...TYPOGRAPHY.xl, fontWeight: "700", color: colors.text, letterSpacing: -0.3 }}>
                    {latestVisitDetails.clinicName || "Visit"}
                  </Text>
                  <Text style={{ ...TYPOGRAPHY.sm, color: colors.textMuted, marginTop: 4 }}>
                    {[latestVisitDetails.doctorName, latestVisitDetails.visitDate && formatShortDate(latestVisitDetails.visitDate)].filter(Boolean).join(" · ")}
                  </Text>
                </>
              ) : (
                <Text style={{ ...TYPOGRAPHY.lg, fontWeight: "600", color: colors.text }}>No visit recorded yet</Text>
              )}

              {/* Health metrics – 2x2 grid pills */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: SPACING.lg, gap: SPACING.sm }}>
                {[
                  { label: "Weight", value: `${latestWeightEntry?.weight ?? getStatusValue(latestExtractedStatus, "weight")} ${latestWeightEntry ? "lb" : getStatusUnit(latestExtractedStatus, "weight") || ""}`.trim() },
                  { label: "Heart rate", value: getStatusValue(latestExtractedStatus, "heartRate") },
                  { label: "Resp. rate", value: getStatusValue(latestExtractedStatus, "respiratoryRate") },
                  { label: "Attitude", value: getStatusValue(latestExtractedStatus, "attitude") },
                ].map(({ label, value }) => (
                  <View key={label} style={{ flex: 1, minWidth: "45%", backgroundColor: colors.surface, borderRadius: RADIUS.lg, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md }}>
                    <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted }}>{label}</Text>
                    <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }} numberOfLines={1}>{value || "—"}</Text>
                  </View>
                ))}
              </View>
              {healthStatusMeta && (
                <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: SPACING.sm }}>
                  Last recorded {timeAgo(healthStatusMeta.ts)} ago
                </Text>
              )}
            </LinearGradient>

            {/* View Clinical Report – primary CTA */}
            {latestVisitRecord?.pdfs?.length ? (
              <TouchableOpacity
                onPress={() => { const pdf = latestVisitRecord.pdfs?.[0]; if (pdf) handleViewPDF(pdf); }}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: SPACING.lg,
                  paddingHorizontal: SPACING.lg,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderLight,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.accent,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: RADIUS.lg, backgroundColor: colors.accent + "18", alignItems: "center", justifyContent: "center", marginRight: SPACING.md }}>
                  <Ionicons name="document-text-outline" size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...TYPOGRAPHY.base, fontWeight: "700", color: colors.text }}>View Clinical Report</Text>
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>Latest visit PDF</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}

            {/* Schedule Vet Visit */}
            <TouchableOpacity
              onPress={() => navigateTo("ScheduleVetVisit")}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.lg,
                paddingHorizontal: SPACING.lg,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: RADIUS.lg, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginRight: SPACING.md }}>
                <Ionicons name="calendar-outline" size={22} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>Schedule Vet Visit</Text>
                {nextAppointment ? (
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>
                    {nextAppointment.status === "confirmed" ? "Confirmed · " : ""}Next: {formatShortDate(nextAppointment.appointmentDate)}
                  </Text>
                ) : (
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>Book an appointment</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Vaccination Status */}
            <TouchableOpacity
              onPress={() => navigateTo("VaccinationStatus")}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: SPACING.lg,
                paddingHorizontal: SPACING.lg,
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: RADIUS.lg, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginRight: SPACING.md }}>
                <Ionicons name="medical-outline" size={22} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPOGRAPHY.base, fontWeight: "600", color: colors.text }}>Vaccination Status</Text>
                {nextVaccinationDue ? (
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                    Next due: {nextVaccinationDue.name} — {formatShortDate(nextVaccinationDue.dueDate)}
                  </Text>
                ) : (
                  <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, marginTop: 2 }}>View vaccines & due dates</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Health History */}
        <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg }}>
          <Text style={{ ...TYPOGRAPHY.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.md }}>
            Health History
          </Text>
          
          {/* Filter Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ marginBottom: SPACING.md, paddingRight: SPACING.lg }}
          >
            {filterOptions.map((option, index) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={selectedFilter === option.value}
                onPress={() => setSelectedFilter(option.value)}
                style={{ marginRight: index < filterOptions.length - 1 ? SPACING.sm : 0 }}
              />
            ))}
          </ScrollView>

          {/* Health Records */}
          {filteredRecords.length === 0 ? (
            <Card>
              <EmptyState
                icon="medical-outline"
                title="No health records yet"
                subtitle="Add vaccinations, checkups, or medications."
                ctaLabel="Add health record"
                onPress={() => setShowAddModal(true)}
              />
            </Card>
          ) : (
            filteredRecords.map(record => (
              <HealthCard
                key={record.id}
                record={record}
                onViewPDF={handleViewPDF}
                highlighted={record.id === highlightedRecordId}
                onOpenActions={() => openHealthActions(record)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <AddHealthRecordModal
        visible={showAddModal}
        petName={petName}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveRecord}
        startMode={healthRecordStartMode}
        petId={activePetId}
        userId={user?.id || null}
      />

      <AddHealthRecordModal
        visible={showEditModal}
        petName={petName}
        onClose={() => {
          setShowEditModal(false);
          setEditingRecord(null);
        }}
        onSave={saveRecordEdits}
        onDelete={() => editingRecord && removeHealthRecord(editingRecord.id)}
        initialRecord={editingRecord}
        petId={activePetId}
        userId={user?.id || null}
      />

      <ActionSheet
        visible={actionSheetVisible}
        title={actionSheetTitle}
        options={actionSheetOptions}
        variant={actionSheetVariant}
        footerText={actionSheetFooter}
        onClose={() => {
          setActionSheetVisible(false);
          setActionSheetFooter(undefined);
        }}
      />

      <ManualHealthStatusModal
        visible={showManualStatusModal}
        onClose={() => {
          setShowManualStatusModal(false);
          setManualStatusPrefill(null);
        }}
        onSave={handleSaveManualStatus}
        initialValues={manualStatusPrefill || manualStatus || undefined}
      />

      {selectedAttachment && (
        <ReceiptViewer
          visible={showAttachmentViewer}
          onClose={() => {
            setShowAttachmentViewer(false);
            setSelectedAttachment(null);
          }}
          receipt={selectedAttachment}
        />
      )}
    </View>
  );
}

