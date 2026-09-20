import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Searchbar, SegmentedButtons, Surface, Text } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import apiClient from '../../services/api';
import { useAuth } from '../../services/AuthContext';

export default function SuperAdminDashboardScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const metrics = useQuery({ queryKey: ['superAdminDashboard'], queryFn: async () => (await apiClient.get('/super-admin/dashboard')).data });
  const organizations = useQuery<any[]>({ queryKey: ['organizations', search, status], queryFn: async () => (await apiClient.get('/super-admin/organizations', { params: { ...(search ? { search } : {}), ...(status !== 'ALL' ? { status } : {}) } })).data });
  const refreshing = metrics.isRefetching || organizations.isRefetching;
  const refresh = () => { void metrics.refetch(); void organizations.refetch(); };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>SUPER ADMIN</Text><Text style={styles.title}>HostelHub platform</Text><Text style={styles.welcome}>{user?.name}</Text></View>
        <View><Button mode="text" icon="account-outline" onPress={() => navigation.navigate('AccountProfile')}>Account</Button><Button mode="text" icon="logout" onPress={logout}>Sign out</Button></View>
      </View>
      <View style={styles.metrics}>
        <Metric icon="office-building" label="Hostels" value={metrics.data?.organizations} />
        <Metric icon="check-circle-outline" label="Active" value={metrics.data?.activeOrganizations} color="#059669" />
        <Metric icon="account-group-outline" label="Residents" value={metrics.data?.activeResidents} />
        <Metric icon="bed-outline" label="Rooms" value={metrics.data?.rooms} />
        <Metric icon="bunk-bed-outline" label="Beds" value={metrics.data?.beds} />
      </View>
      <Button mode="outlined" icon="history" onPress={() => navigation.navigate('AuditLog')} style={{ alignSelf: 'flex-start', marginBottom: 22 }}>View admin activity</Button>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Hostel accounts</Text><Button mode="contained" icon="plus" onPress={() => navigation.navigate('OrganizationForm')}>Add hostel</Button></View>
      <Searchbar placeholder="Search hostel or email" value={search} onChangeText={setSearch} style={styles.search} />
      <SegmentedButtons value={status} onValueChange={setStatus} buttons={[{ value: 'ALL', label: 'All' }, { value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Paused' }, { value: 'ARCHIVED', label: 'Archived' }]} style={styles.filters} />
      {organizations.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : organizations.data?.map((organization) => (
        <TouchableOpacity key={organization.id} onPress={() => navigation.navigate('OrganizationDetail', { organizationId: organization.id })}>
          <Surface style={styles.organizationCard} elevation={1}>
            <View style={[styles.iconBox, organization.status !== 'ACTIVE' && styles.iconBoxPaused]}><Icon name="office-building-outline" size={25} color={organization.status === 'ACTIVE' ? '#4F46E5' : '#64748B'} /></View>
            <View style={{ flex: 1 }}><Text style={styles.orgName}>{organization.name}</Text><Text style={styles.orgMeta}>{organization._count.branches} branches · {organization._count.tenants} residents</Text><Text style={styles.orgAdmin}>{organization.users?.[0]?.email || 'No administrator'}</Text></View>
            <View style={styles.right}><Text style={[styles.status, organization.status !== 'ACTIVE' && styles.statusPaused]}>{organization.status === 'ACTIVE' ? 'Active' : organization.status}</Text><Icon name="chevron-right" size={23} color="#94A3B8" /></View>
          </Surface>
        </TouchableOpacity>
      ))}
      {!organizations.isLoading && !organizations.data?.length && <Text style={styles.empty}>No hostel accounts found.</Text>}
    </ScrollView>
  );
}

function Metric({ icon, label, value, color = '#4F46E5' }: any) {
  return <Surface style={styles.metricCard} elevation={0}><Icon name={icon} size={23} color={color} /><Text style={styles.metricValue}>{value ?? '—'}</Text><Text style={styles.metricLabel}>{label}</Text></Surface>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 20, paddingBottom: 40 }, headingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: '#4F46E5', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { fontSize: 27, fontWeight: '800', color: '#0F172A', marginTop: 2 }, welcome: { color: '#64748B', marginTop: 3 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }, metricCard: { minWidth: 142, flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' }, metricValue: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 10 }, metricLabel: { color: '#64748B', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' }, search: { backgroundColor: '#FFF', marginBottom: 12 }, filters: { marginBottom: 14 }, organizationCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12, borderRadius: 15, backgroundColor: '#FFF' }, iconBox: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF', marginRight: 13 }, iconBoxPaused: { backgroundColor: '#F1F5F9' }, orgName: { color: '#0F172A', fontWeight: '800', fontSize: 17 }, orgMeta: { color: '#64748B', marginTop: 4 }, orgAdmin: { color: '#64748B', fontSize: 12, marginTop: 4 }, right: { alignItems: 'flex-end', gap: 10 }, status: { color: '#047857', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, fontWeight: '700', fontSize: 11, overflow: 'hidden' }, statusPaused: { color: '#475569', backgroundColor: '#E2E8F0' }, empty: { color: '#64748B', textAlign: 'center', marginTop: 30 },
});
