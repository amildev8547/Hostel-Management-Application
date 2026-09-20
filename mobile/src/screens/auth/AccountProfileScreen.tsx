import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import apiClient from '../../services/api';
import { useAuth } from '../../services/AuthContext';

export default function AccountProfileScreen({ navigation }: any) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError(''); setLoading(true);
    try {
      const response = await apiClient.patch('/auth/me', { name: name.trim(), email: email.trim(), currentPassword });
      await updateUser(response.data);
      navigation.goBack();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Could not update the account.');
    } finally { setLoading(false); }
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Surface style={styles.card} elevation={1}>
      <Text style={styles.title}>Your account</Text><Text style={styles.subtitle}>Enter your current password to save a name or email change.</Text>
      <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" style={styles.input} />
      <TextInput label="Email address" value={email} onChangeText={setEmail} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Current password" value={currentPassword} onChangeText={setCurrentPassword} mode="outlined" secureTextEntry style={styles.input} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button mode="contained" onPress={save} loading={loading} disabled={loading || !name.trim() || !email.trim() || currentPassword.length < 8} contentStyle={{ height: 50 }}>Save account details</Button>
      <Button mode="text" icon="lock-outline" onPress={() => navigation.navigate('ChangePassword')} style={{ marginTop: 8 }}>Change password</Button>
      <Button mode="text" icon="devices" onPress={() => navigation.navigate('Sessions')}>Active sessions</Button>
    </Surface>
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 20 }, card: { padding: 20, borderRadius: 16, backgroundColor: '#FFF' }, title: { fontSize: 24, fontWeight: '800', color: '#0F172A' }, subtitle: { color: '#64748B', lineHeight: 20, marginTop: 6, marginBottom: 20 }, input: { backgroundColor: '#FFF', marginBottom: 14 }, error: { color: '#DC2626', marginBottom: 12 } });
