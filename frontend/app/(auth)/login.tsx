import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, formatApiError } from '../../src/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@propflo.com');
  const [password, setPassword] = useState('admin123');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async () => {
    setErr('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setErr(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <View style={styles.brandIcon}>
              <Ionicons name="business" size={28} color={colors.text} />
            </View>
            <Text style={styles.brandName}>PropFlo</Text>
            <Text style={styles.brandTag}>Real Estate CRM</Text>
          </View>

          <View style={styles.card} testID="login-card">
            <Text style={typography.h2}>Welcome back</Text>
            <Text style={[typography.body, { marginTop: 4, marginBottom: 24 }]}>
              Sign in to manage your leads, deals & tasks
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@company.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
              />
              <TouchableOpacity onPress={() => setShowPwd((s) => !s)} style={styles.eye} testID="login-toggle-password">
                <Ionicons name={showPwd ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {err ? (
              <Text style={styles.err} testID="login-error">{err}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={busy}
              testID="login-submit-button"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={typography.body}>New to PropFlo?</Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity testID="goto-register-link">
                  <Text style={styles.linkText}> Create account</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Demo credentials</Text>
              <Text style={styles.demoText}>admin@propflo.com / admin123</Text>
              <Text style={styles.demoText}>agent@propflo.com / agent123</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  brandWrap: { alignItems: 'center', marginBottom: spacing.xl },
  brandIcon: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    marginBottom: 12,
  },
  brandName: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  brandTag: { fontSize: 13, color: colors.textMuted, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.bg2,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pwdWrap: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  eye: { position: 'absolute', right: 12, padding: 8 },
  err: { color: colors.hot, marginTop: 12, fontSize: 13 },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  linkText: { color: colors.primary, fontWeight: '700' },
  demoBox: {
    marginTop: spacing.lg,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.25)',
  },
  demoTitle: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  demoText: { color: colors.text, fontSize: 13, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
});
