import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../../services/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Could not sign in. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image source={require('../../../assets/brand-mark.png')} style={styles.logo} />
          <Text style={styles.title}>Welcome to HostelHub</Text>
          <Text style={styles.subtitle}>Sign in to manage your hostel</Text>
        </View>
        <Surface style={styles.card} elevation={1}>
          <TextInput label="Email address" value={email} onChangeText={setEmail} mode="outlined" autoCapitalize="none" keyboardType="email-address" left={<TextInput.Icon icon="email-outline" />} style={styles.input} />
          <TextInput label="Password" value={password} onChangeText={setPassword} mode="outlined" secureTextEntry={secure} left={<TextInput.Icon icon="lock-outline" />} right={<TextInput.Icon icon={secure ? 'eye-outline' : 'eye-off-outline'} onPress={() => setSecure((value) => !value)} />} onSubmitEditing={submit} style={styles.input} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button mode="contained" onPress={submit} loading={loading} disabled={loading || !email.trim() || password.length < 8} contentStyle={styles.buttonContent} style={styles.button}>Sign in</Button>
          <Text style={styles.help}>Use the email and temporary password provided by your HostelHub administrator.</Text>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 28 }, logo: { width: 78, height: 78, resizeMode: 'contain' },
  title: { marginTop: 18, fontSize: 27, lineHeight: 34, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  subtitle: { marginTop: 7, color: '#64748B', fontSize: 16 }, card: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 22, borderRadius: 18, backgroundColor: '#FFFFFF' },
  input: { marginBottom: 14, backgroundColor: '#FFFFFF' }, error: { color: '#DC2626', marginBottom: 12, lineHeight: 20 },
  button: { borderRadius: 12 }, buttonContent: { height: 52 }, help: { marginTop: 18, color: '#64748B', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
