import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../services/AuthContext';
import { showAlert } from '../../utils/alerts';

export default function AdminLoginScreen() {
  const theme = useTheme(); const { loading, sendLoginLink } = useAuth();
  const [email, setEmail] = useState('amildev8547@gmail.com'); const [sending, setSending] = useState(false); const [sent, setSent] = useState(false);
  if (loading) return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>;
  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return showAlert('Enter a valid administrator email address.');
    setSending(true); try { await sendLoginLink(email); setSent(true); } catch (error: any) { showAlert(error.message || 'Could not send the secure login link.'); } finally { setSending(false); }
  };
  return <KeyboardAvoidingView style={[styles.center, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Surface style={styles.card} elevation={2}><Text style={styles.title}>Administrator login</Text><Text style={styles.help}>{sent ? 'Open the secure link sent to your email. It will return you to HostelHub.' : 'Enter the approved owner email to securely open HostelHub.'}</Text><TextInput mode="outlined" label="Administrator email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} disabled={sending} style={styles.input} /><Button mode="contained" icon="email-lock-outline" onPress={submit} loading={sending} disabled={sending} contentStyle={styles.button}>{sent ? 'Send link again' : 'Send secure login link'}</Button></Surface>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', padding: 20 }, card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22 }, title: { color: '#0F172A', fontSize: 24, fontWeight: '900' }, help: { color: '#475569', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 18 }, input: { backgroundColor: '#FFFFFF', marginBottom: 14 }, button: { minHeight: 52 } });
