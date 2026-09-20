import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { formatDateTime } from '../../utils/date';
import { showConfirm } from '../../utils/alerts';

export default function SessionsScreen() {
  const { logout } = useAuth();
  const sessions = useQuery<any[]>({ queryKey: ['sessions'], queryFn: async () => (await apiClient.get('/auth/sessions')).data });
  const signOutEverywhere = () => showConfirm('Sign out this account on every phone and browser?', async () => { try { await apiClient.post('/auth/logout-all'); } finally { await logout(); } }, { confirmText: 'Sign out all', destructive: true });
  return <View style={styles.page}><FlatList contentContainerStyle={styles.content} data={sessions.data || []} keyExtractor={(item) => item.id} ListHeaderComponent={<Text style={styles.help}>Devices currently allowed to open this account.</Text>} ListEmptyComponent={<Text style={styles.empty}>{sessions.isLoading ? 'Loading sessions…' : 'No active sessions.'}</Text>} renderItem={({ item }) => <Surface style={styles.card} elevation={1}><Text style={styles.device}>{item.deviceName || item.platform || 'Unknown device'} {item.current ? '· This device' : ''}</Text><Text style={styles.meta}>Last used {formatDateTime(item.lastUsedAt)}</Text><Text style={styles.meta}>Expires {formatDateTime(item.expiresAt)}</Text></Surface>} ListFooterComponent={<Button mode="outlined" textColor="#DC2626" onPress={signOutEverywhere} style={styles.button}>Sign out on all devices</Button>} /></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 16, paddingBottom: 40 }, help: { color: '#64748B', marginBottom: 14 }, card: { padding: 16, borderRadius: 14, backgroundColor: '#FFF', marginBottom: 10 }, device: { color: '#0F172A', fontSize: 16, fontWeight: '800' }, meta: { color: '#64748B', fontSize: 13, marginTop: 5 }, empty: { color: '#64748B', textAlign: 'center', marginVertical: 30 }, button: { borderColor: '#FCA5A5', marginTop: 20 } });
