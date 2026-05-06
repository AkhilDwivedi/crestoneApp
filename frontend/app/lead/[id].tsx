import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, Lead } from '../../src/api';
import { colors, formatINR, radius, spacing, tempColor, typography } from '../../src/theme';

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/leads/${id}`);
      setLead(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const generateSummary = async () => {
    if (!lead) return;
    setAiBusy(true);
    try {
      const { data } = await api.post(`/leads/${lead.id}/ai-summary`);
      setLead({ ...lead, ai_summary: data.ai_summary });
    } catch (e: any) {
      Alert.alert('AI Summary', e?.response?.data?.detail || 'Failed to generate summary');
    } finally {
      setAiBusy(false);
    }
  };

  const onCall = () => lead && Linking.openURL(`tel:${lead.phone.replace(/\s+/g, '')}`);
  const onWhatsApp = () => lead && Linking.openURL(`https://wa.me/${lead.phone.replace(/\D/g, '')}`);
  const onEmail = () => lead?.email && Linking.openURL(`mailto:${lead.email}`);

  const onDelete = () => {
    Alert.alert('Delete lead', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api.delete(`/leads/${id}`);
          router.back();
        },
      },
    ]);
  };

  if (loading || !lead) {
    return <SafeAreaView style={styles.loaderWrap}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  }

  const tc = tempColor(lead.temperature);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="lead-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead Details</Text>
        <TouchableOpacity onPress={onDelete} style={styles.iconBtn} testID="lead-delete">
          <Ionicons name="trash" size={20} color={colors.hot} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroAvatar, { backgroundColor: tc.bg }]}>
            <Text style={[styles.heroAvatarText, { color: tc.fg }]}>{lead.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.heroName}>{lead.name}</Text>
          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: tc.bg }]}>
              <Text style={[styles.badgeText, { color: tc.fg }]}>{lead.temperature}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.glass }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{lead.status}</Text>
            </View>
          </View>
          <Text style={styles.heroSub}>via {lead.source}</Text>
        </View>

        {/* Quick actions */}
        <View style={styles.actions}>
          <ActionBtn icon="call" label="Call" onPress={onCall} testID="lead-action-call" />
          <ActionBtn icon="logo-whatsapp" label="WhatsApp" onPress={onWhatsApp} testID="lead-action-whatsapp" />
          <ActionBtn icon="mail" label="Email" onPress={onEmail} disabled={!lead.email} testID="lead-action-email" />
        </View>

        {/* AI Summary */}
        <View style={styles.aiCard} testID="lead-ai-card">
          <View style={styles.aiHead}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.aiBadgeText}>AI Insights</Text>
            </View>
            <TouchableOpacity onPress={generateSummary} disabled={aiBusy} testID="lead-ai-generate">
              <Text style={styles.linkText}>{aiBusy ? 'Generating…' : (lead.ai_summary ? 'Regenerate' : 'Generate')}</Text>
            </TouchableOpacity>
          </View>
          {aiBusy ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : lead.ai_summary ? (
            <Text style={styles.aiText}>{lead.ai_summary}</Text>
          ) : (
            <Text style={styles.aiPlaceholder}>
              Tap "Generate" to create a personalised summary and next-step recommendations powered by AI.
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Row icon="call" label="Phone" value={lead.phone} />
          <Row icon="mail" label="Email" value={lead.email || '—'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          <Row icon="cash" label="Budget" value={formatINR(lead.budget)} />
          <Row icon="home" label="Interest" value={lead.interest || '—'} />
          <Row icon="document-text" label="Notes" value={lead.notes || '—'} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionBtn({ icon, label, onPress, disabled, testID }: any) {
  return (
    <TouchableOpacity style={[styles.actionBtn, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} testID={testID}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingTop: 8 },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  scroll: { padding: spacing.md, paddingBottom: 60 },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  heroAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { fontWeight: '800', fontSize: 32 },
  heroName: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 12 },
  heroBadges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  heroSub: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: spacing.lg },
  actionBtn: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  actionIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { color: colors.text, fontWeight: '600', fontSize: 12 },
  aiCard: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,107,0,0.25)',
    marginBottom: spacing.lg,
  },
  aiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aiBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  aiBadgeText: { color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 0.8 },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  aiText: { color: colors.text, fontSize: 14, lineHeight: 22, marginTop: 12 },
  aiPlaceholder: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 20 },
  section: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 12, gap: 12,
  },
  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  rowValue: { color: colors.text, fontSize: 14, marginTop: 2 },
});
