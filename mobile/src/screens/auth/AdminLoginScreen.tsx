import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../services/AuthContext';
import { showAlert } from '../../utils/alerts';

export default function AdminLoginScreen() {
  const theme = useTheme(); const { loading, signIn, sendPasswordSetup } = useAuth();
  const [email, setEmail] = useState('amildev8547@gmail.com'); const [password, setPassword] = useState(''); const [sending, setSending] = useState(false);
  if (loading) return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" /></View>;
  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return showAlert('Enter a valid administrator email address.');
    if (!password) return showAlert('Enter your password.');
    setSending(true); try { await signIn(email, password); } catch { showAlert('Email or password is incorrect. Please try again.'); } finally { setSending(false); }
  };
  const setupPassword = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return showAlert('Enter a valid email address first.');
    setSending(true);
    try { await sendPasswordSetup(email); showAlert('Password setup email sent. Open it once and choose your password.'); }
    catch (error: any) { showAlert(error?.status === 429 ? 'Too many emails were requested. Wait a few minutes and try once.' : (error.message || 'Could not send the password setup email.')); }
    finally { setSending(false); }
  };
  return <KeyboardAvoidingView style={[styles.center, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Surface style={styles.card} elevation={2}><Text style={styles.title}>Hostel owner login</Text><Text style={styles.help}>Enter your email and password to open HostelHub. You will stay signed in on this phone.</Text><TextInput mode="outlined" label="Email address" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} disabled={sending} style={styles.input} /><TextInput mode="outlined" label="Password" secureTextEntry value={password} onChangeText={setPassword} disabled={sending} style={styles.input} onSubmitEditing={submit} /><Button mode="contained" icon="login" onPress={submit} loading={sending} disabled={sending} contentStyle={styles.button}>Log in</Button><Button mode="text" onPress={setupPassword} disabled={sending} style={styles.setupButton}>Set password or forgot password</Button></Surface>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', padding: 20 }, card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22 }, title: { color: '#0F172A', fontSize: 24, fontWeight: '900' }, help: { color: '#475569', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 18 }, input: { backgroundColor: '#FFFFFF', marginBottom: 14 }, button: { minHeight: 52 }, setupButton: { marginTop: 10 } });
