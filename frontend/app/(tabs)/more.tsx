import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

const SECTIONS = [
  { key: 'tasks', label: 'Tasks & Follow-ups', icon: 'checkmark-circle', href: '/tasks' },
  { key: 'contacts', label: 'Contacts', icon: 'people', href: '/contacts' },
];

export default function More() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const onLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}>
        <Text style={typography.h1}>More</Text>

        {/* Profile card */}
        <View style={styles.profile} testID="profile-card">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name?.[0] || 'A').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        <View style={{ marginTop: spacing.lg, gap: 10 }}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={styles.row}
              onPress={() => router.push(s.href as any)}
              testID={`more-${s.key}`}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={s.icon as any} size={20} color={colors.primary} />
              </View>
              <Text style={styles.rowText}>{s.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}

          <View style={[styles.row, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />

          <TouchableOpacity style={[styles.row, styles.logoutRow]} onPress={onLogout} testID="logout-button">
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Ionicons name="log-out-outline" size={20} color={colors.hot} />
            </View>
            <Text style={[styles.rowText, { color: colors.hot }]}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appInfoTitle}>Crestone Realty</Text>
          <Text style={styles.appInfoText}>v1.0.0 · Turning Dreams Into Doorways</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.bg2,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.md,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 24 },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    marginTop: 6,
  },
  roleText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bg2,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  logoutRow: { borderColor: 'rgba(239,68,68,0.3)' },
  appInfo: { alignItems: 'center', marginTop: spacing.xl },
  appInfoTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  appInfoText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
