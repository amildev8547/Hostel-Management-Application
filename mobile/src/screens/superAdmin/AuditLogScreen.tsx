import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Surface, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { formatDateTime } from '../../utils/date';

export default function AuditLogScreen() {
  const logs = useQuery<any[]>({ queryKey: ['auditLogs'], queryFn: async () => (await apiClient.get('/super-admin/audit-logs')).data });
  if (logs.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  return <FlatList style={styles.page} contentContainerStyle={styles.content} data={logs.data || []} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={logs.isRefetching} onRefresh={logs.refetch} />} ListEmptyComponent={<Text style={styles.empty}>No administrative activity yet.</Text>} renderItem={({ item }) => <Surface style={styles.card} elevation={1}><Text style={styles.action}>{String(item.action).toLowerCase().replace(/_/g, ' ')}</Text><Text style={styles.meta}>{item.actor?.name || 'System'}{item.organization?.name ? ` · ${item.organization.name}` : ''}</Text><Text style={styles.time}>{formatDateTime(item.createdAt)}</Text></Surface>} />;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 16, paddingBottom: 40 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, card: { padding: 16, borderRadius: 14, backgroundColor: '#FFF', marginBottom: 10 }, action: { color: '#0F172A', fontWeight: '800', fontSize: 16, textTransform: 'capitalize' }, meta: { color: '#64748B', marginTop: 5 }, time: { color: '#94A3B8', fontSize: 12, marginTop: 6 }, empty: { textAlign: 'center', color: '#64748B', marginTop: 40 } });
