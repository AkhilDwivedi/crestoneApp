import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, Task } from '../../src/api';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function Tasks() {
  const router = useRouter();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/tasks');
    setItems(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (t: Task) => {
    if (t.completed) return;
    setItems((arr) => arr.map((x) => (x.id === t.id ? { ...x, completed: true } : x)));
    try {
      await api.put(`/tasks/${t.id}/complete`);
    } catch {
      load();
    }
  };

  if (loading) return <SafeAreaView style={styles.loaderWrap}><ActivityIndicator color={colors.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="tasks-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tasks & Follow-ups</Text>
        <View style={styles.iconBtn} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<Text style={[typography.body, { textAlign: 'center', marginTop: 40 }]}>No tasks yet</Text>}
        renderItem={({ item }) => {
          const due = new Date(item.due_at);
          const overdue = !item.completed && due.getTime() < Date.now();
          return (
            <TouchableOpacity
              style={[styles.card, item.completed && { opacity: 0.55 }]}
              onPress={() => toggle(item)}
              testID={`task-${item.id}`}
            >
              <View style={[styles.check, item.completed && { backgroundColor: colors.won, borderColor: colors.won }]}>
                {item.completed ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, item.completed && { textDecorationLine: 'line-through' }]}>{item.title}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name={item.type === 'Call' ? 'call' : item.type === 'Site Visit' ? 'location' : 'briefcase'} size={11} color={colors.textMuted} />
                  <Text style={styles.meta}>{item.type}</Text>
                  {item.related_to ? <Text style={styles.meta}>· {item.related_to}</Text> : null}
                </View>
                <Text style={[styles.due, overdue && { color: colors.hot }]}>
                  {due.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {overdue ? ' · overdue' : ''}
                </Text>
              </View>
              <View style={[styles.priority, {
                backgroundColor: item.priority === 'high' ? colors.hotBg : item.priority === 'medium' ? colors.warmBg : colors.coldBg,
              }]}>
                <Text style={[styles.priorityText, {
                  color: item.priority === 'high' ? colors.hot : item.priority === 'medium' ? colors.warm : colors.cold,
                }]}>{item.priority}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingTop: 8 },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg2,
    borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  check: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { color: colors.textMuted, fontSize: 11 },
  due: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  priority: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  priorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
});
