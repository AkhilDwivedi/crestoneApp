import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, Deal } from '../../src/api';
import { colors, formatINR, radius, spacing, stageColor, typography } from '../../src/theme';

const STAGES = ['New', 'Contacted', 'Site Visit', 'Negotiation', 'Closed Won', 'Closed Lost'];

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get('/deals');
    setDeals(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const moveStage = async (deal: Deal, stage: string) => {
    if (deal.stage === stage) { setMoving(null); return; }
    setDeals((d) => d.map((x) => (x.id === deal.id ? { ...x, stage } : x)));
    setMoving(null);
    try {
      await api.put(`/deals/${deal.id}/stage`, { stage });
    } catch (e) {
      load();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const totalValue = deals
    .filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage))
    .reduce((s, d) => s + (d.value || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={typography.h1}>Pipeline</Text>
          <Text style={styles.sub}>Active value · {formatINR(totalValue)}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.board}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        testID="pipeline-board"
      >
        {STAGES.map((s) => {
          const items = deals.filter((d) => d.stage === s);
          const sum = items.reduce((a, b) => a + (b.value || 0), 0);
          const c = stageColor(s);
          return (
            <View key={s} style={styles.col} testID={`pipeline-col-${s}`}>
              <View style={styles.colHead}>
                <View style={[styles.stageDot, { backgroundColor: c.fg }]} />
                <Text style={styles.colTitle}>{s}</Text>
                <Text style={styles.colCount}>{items.length}</Text>
              </View>
              <Text style={styles.colSum}>{formatINR(sum)}</Text>

              <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
                {items.length === 0 ? (
                  <View style={styles.empty}><Text style={styles.emptyText}>No deals</Text></View>
                ) : (
                  items.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.dealCard}
                      onPress={() => setMoving(d)}
                      testID={`deal-card-${d.id}`}
                    >
                      <Text style={styles.dealTitle} numberOfLines={2}>{d.title}</Text>
                      <Text style={styles.dealClient}>{d.client_name}</Text>
                      <View style={styles.dealRow}>
                        <Text style={styles.dealValue}>{formatINR(d.value)}</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                      </View>
                      {d.property_title ? (
                        <Text style={styles.dealProp} numberOfLines={1}>🏢 {d.property_title}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!moving} transparent animationType="fade" onRequestClose={() => setMoving(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMoving(null)}>
          <Pressable style={styles.sheet} onPress={() => {}} testID="move-stage-sheet">
            <Text style={styles.sheetTitle}>Move "{moving?.title}"</Text>
            <Text style={styles.sheetSub}>Select new stage</Text>
            {STAGES.map((s) => {
              const c = stageColor(s);
              const active = moving?.stage === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.sheetItem, active && { borderColor: colors.primary }]}
                  onPress={() => moving && moveStage(moving, s)}
                  testID={`move-stage-${s}`}
                >
                  <View style={[styles.sheetDot, { backgroundColor: c.fg }]} />
                  <Text style={styles.sheetItemText}>{s}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingTop: 8 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  board: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 12 },
  col: {
    width: 280,
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1, borderColor: colors.border,
    maxHeight: 600,
  },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stageDot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { color: colors.text, fontWeight: '800', fontSize: 14, flex: 1, letterSpacing: -0.2 },
  colCount: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  colSum: { color: colors.primary, fontWeight: '800', fontSize: 16, marginTop: 4 },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 12 },
  dealCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 10,
  },
  dealTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  dealClient: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  dealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  dealValue: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  dealProp: { color: colors.textSecondary, fontSize: 11, marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    padding: 20, gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  sheetDot: { width: 10, height: 10, borderRadius: 5 },
  sheetItemText: { color: colors.text, fontWeight: '600', fontSize: 14, flex: 1 },
});
