import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Divider, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { showAlert, showConfirm } from '../../utils/alerts';

export default function OrganizationDetailScreen({ route }: any) {
  const { organizationId } = route.params;
  const queryClient = useQueryClient();
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [plan, setPlan] = useState('STANDARD');
  const [maxBranches, setMaxBranches] = useState('');
  const [maxBeds, setMaxBeds] = useState('');
  const organization = useQuery<any>({ queryKey: ['organization', organizationId], queryFn: async () => (await apiClient.get(`/super-admin/organizations/${organizationId}`)).data });
  const refresh = async () => { await organization.refetch(); await queryClient.invalidateQueries({ queryKey: ['organizations'] }); };
  const status = useMutation({ mutationFn: async (nextStatus: string) => apiClient.patch(`/super-admin/organizations/${organizationId}`, { status: nextStatus }), onSuccess: refresh });
  const reset = useMutation({ mutationFn: async (userId: string) => (await apiClient.post(`/super-admin/organizations/${organizationId}/admins/${userId}/reset-access`)).data, onSuccess: (data) => showAlert(`Temporary password: ${data.temporaryPassword}\n\nCopy it now. It is shown only once.`, 'Access reset') });
  const createAdmin = useMutation({ mutationFn: async () => (await apiClient.post(`/super-admin/organizations/${organizationId}/admins`, { name: adminName, email: adminEmail })).data, onSuccess: async (data) => { setShowAddAdmin(false); setAdminName(''); setAdminEmail(''); await refresh(); showAlert(`Email: ${data.admin.email}\nTemporary password: ${data.temporaryPassword}\n\nCopy it now. It is shown only once.`, 'Administrator created'); } });
  const adminStatus = useMutation({ mutationFn: async ({ userId, nextStatus }: { userId: string; nextStatus: string }) => apiClient.patch(`/super-admin/organizations/${organizationId}/admins/${userId}/status`, { status: nextStatus }), onSuccess: refresh });
  const saveLimits = useMutation({ mutationFn: async () => apiClient.patch(`/super-admin/organizations/${organizationId}`, { plan, maxBranches: maxBranches ? Number(maxBranches) : null, maxBeds: maxBeds ? Number(maxBeds) : null }), onSuccess: async () => { await refresh(); showAlert('Plan and limits saved.'); } });
  useEffect(() => {
    const item = organization.data;
    if (!item) return;
    setPlan(item.plan || 'STANDARD');
    setMaxBranches(item.maxBranches ? String(item.maxBranches) : '');
    setMaxBeds(item.maxBeds ? String(item.maxBeds) : '');
  }, [organization.data]);
  if (organization.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!organization.data) return <View style={styles.center}><Text>Hostel account not found.</Text></View>;
  const item = organization.data;
  const toggle = () => {
    const next = item.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    showConfirm(`${next === 'SUSPENDED' ? 'Suspend' : 'Activate'} ${item.name}?${next === 'SUSPENDED' ? ' Its administrators will be signed out.' : ''}`, () => status.mutate(next), { confirmText: next === 'SUSPENDED' ? 'Suspend' : 'Activate', destructive: next === 'SUSPENDED' });
  };

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Surface style={styles.hero} elevation={1}><View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.contactEmail || 'No contact email'} · {item.plan}</Text></View><Text style={[styles.badge, item.status !== 'ACTIVE' && styles.badgePaused]}>{item.status}</Text></Surface>
    <View style={styles.metrics}><Metric label="Branches" value={item.branches.length} /><Metric label="Rooms" value={item._count.rooms} /><Metric label="Residents" value={item._count.tenants} /></View>
    <Text style={styles.heading}>Plan and limits</Text>
    <Surface style={[styles.card, styles.addCard]} elevation={1}>
      <SegmentedButtons value={plan} onValueChange={setPlan} buttons={[{ value: 'FREE', label: 'Free' }, { value: 'STANDARD', label: 'Standard' }, { value: 'PREMIUM', label: 'Premium' }]} style={{ marginBottom: 12 }} />
      <View style={styles.limitRow}><TextInput label="Maximum branches" value={maxBranches} onChangeText={setMaxBranches} mode="outlined" keyboardType="number-pad" style={[styles.input, { flex: 1 }]} /><TextInput label="Maximum beds" value={maxBeds} onChangeText={setMaxBeds} mode="outlined" keyboardType="number-pad" style={[styles.input, { flex: 1 }]} /></View>
      <Text style={styles.limitHelp}>Leave a limit empty for unlimited access.</Text>
      <Button mode="contained-tonal" onPress={() => saveLimits.mutate()} loading={saveLimits.isPending}>Save plan and limits</Button>
    </Surface>
    <View style={styles.headingRow}><Text style={styles.heading}>Administrators</Text><Button mode="text" icon="plus" onPress={() => setShowAddAdmin((value) => !value)}>Add</Button></View>
    {showAddAdmin && <Surface style={[styles.card, styles.addCard]} elevation={1}><TextInput label="Administrator name" value={adminName} onChangeText={setAdminName} mode="outlined" style={styles.input} /><TextInput label="Email address" value={adminEmail} onChangeText={setAdminEmail} mode="outlined" autoCapitalize="none" keyboardType="email-address" style={styles.input} /><Button mode="contained" onPress={() => createAdmin.mutate()} loading={createAdmin.isPending} disabled={!adminName.trim() || !adminEmail.trim() || createAdmin.isPending}>Create administrator</Button></Surface>}
    <Surface style={styles.card} elevation={1}>{item.users.filter((admin: any) => admin.role === 'HOSTEL_ADMIN').map((admin: any, index: number) => <React.Fragment key={admin.id}>{index > 0 && <Divider />}<View style={styles.adminRow}><View style={{ flex: 1 }}><Text style={styles.adminName}>{admin.name}</Text><Text style={styles.adminEmail}>{admin.email}</Text><Text style={styles.adminStatus}>{admin.status}{admin.mustChangePassword ? ' · Must change password' : ''}</Text></View><View><Button mode="outlined" compact onPress={() => showConfirm(`Create a new temporary password for ${admin.name}?`, () => reset.mutate(admin.id), { confirmText: 'Reset access' })}>Reset</Button><Button compact textColor={admin.status === 'ACTIVE' ? '#DC2626' : '#059669'} onPress={() => showConfirm(`${admin.status === 'ACTIVE' ? 'Suspend' : 'Activate'} ${admin.name}?`, () => adminStatus.mutate({ userId: admin.id, nextStatus: admin.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }), { confirmText: admin.status === 'ACTIVE' ? 'Suspend' : 'Activate', destructive: admin.status === 'ACTIVE' })}>{admin.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</Button></View></View></React.Fragment>)}</Surface>
    <Text style={styles.heading}>Branches</Text>
    <Surface style={styles.card} elevation={1}>{item.branches.length ? item.branches.map((branch: any, index: number) => <React.Fragment key={branch.id}>{index > 0 && <Divider />}<View style={styles.branchRow}><View><Text style={styles.adminName}>{branch.name}</Text><Text style={styles.adminEmail}>{branch.address}</Text></View></View></React.Fragment>) : <Text style={styles.empty}>No branches added yet.</Text>}</Surface>
    <Button mode={item.status === 'ACTIVE' ? 'outlined' : 'contained'} textColor={item.status === 'ACTIVE' ? '#DC2626' : undefined} onPress={toggle} loading={status.isPending} style={styles.action}>{item.status === 'ACTIVE' ? 'Suspend hostel access' : 'Activate hostel access'}</Button>
    {item.status !== 'ARCHIVED' && <Button mode="text" textColor="#64748B" onPress={() => showConfirm(`Archive ${item.name}? Its data will be kept, but all access will stop.`, () => status.mutate('ARCHIVED'), { confirmText: 'Archive', destructive: true })} style={{ marginTop: 8 }}>Archive hostel account</Button>}
  </ScrollView>;
}

function Metric({ label, value }: any) { return <Surface style={styles.metric} elevation={0}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Surface>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 20, paddingBottom: 40 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, hero: { padding: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF' }, name: { fontSize: 23, fontWeight: '800', color: '#0F172A' }, meta: { color: '#64748B', marginTop: 5 }, badge: { color: '#047857', backgroundColor: '#D1FAE5', fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' }, badgePaused: { color: '#475569', backgroundColor: '#E2E8F0' }, metrics: { flexDirection: 'row', gap: 10, marginTop: 14 }, metric: { flex: 1, padding: 15, borderRadius: 13, backgroundColor: '#EEF2FF' }, metricValue: { fontSize: 22, fontWeight: '800', color: '#312E81' }, metricLabel: { color: '#64748B', marginTop: 2 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }, heading: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 24, marginBottom: 10 }, card: { backgroundColor: '#FFF', borderRadius: 15, overflow: 'hidden' }, addCard: { padding: 14, marginBottom: 12 }, input: { backgroundColor: '#FFF', marginBottom: 10 }, limitRow: { flexDirection: 'row', gap: 10 }, limitHelp: { color: '#64748B', fontSize: 12, marginBottom: 12 }, adminRow: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, branchRow: { padding: 16 }, adminName: { color: '#1E293B', fontWeight: '700', fontSize: 16 }, adminEmail: { color: '#64748B', marginTop: 3 }, adminStatus: { color: '#4F46E5', fontSize: 12, marginTop: 5, fontWeight: '600' }, empty: { color: '#64748B', padding: 18 }, action: { marginTop: 28, borderColor: '#FCA5A5' } });
