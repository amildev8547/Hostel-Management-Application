import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../../services/AuthContext';

export default function ChangePasswordScreen() {
  const { changePassword, logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.');
    if (newPassword.length < 10) return setError('Use at least 10 characters for the new password.');
    setError(''); setLoading(true);
    try { await changePassword(currentPassword, newPassword); }
    catch (requestError: any) { setError(requestError.response?.data?.error || 'Could not change the password.'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Surface style={styles.card} elevation={1}>
          <Text style={styles.title}>{user?.mustChangePassword ? 'Create your password' : 'Change password'}</Text>
          <Text style={styles.subtitle}>{user?.mustChangePassword ? 'Replace the temporary password before opening the app.' : 'Enter your current password, then choose a new one.'}</Text>
          <TextInput label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry mode="outlined" style={styles.input} />
          <TextInput label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry mode="outlined" style={styles.input} />
          <TextInput label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry mode="outlined" style={styles.input} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button mode="contained" onPress={submit} loading={loading} disabled={loading} contentStyle={styles.buttonContent}>Save password</Button>
          <Button mode="text" onPress={logout} disabled={loading} style={styles.signOut}>Sign out</Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { flexGrow: 1, justifyContent: 'center', padding: 24 }, card: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: 24, borderRadius: 18, backgroundColor: '#FFF' },
  title: { fontSize: 25, fontWeight: '800', color: '#0F172A' }, subtitle: { color: '#64748B', lineHeight: 21, marginTop: 7, marginBottom: 22 }, input: { marginBottom: 14, backgroundColor: '#FFF' }, error: { color: '#DC2626', marginBottom: 12 }, buttonContent: { height: 50 }, signOut: { marginTop: 8 },
});
