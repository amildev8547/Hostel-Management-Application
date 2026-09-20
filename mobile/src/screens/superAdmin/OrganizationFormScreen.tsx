import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../services/api';
import { showAlert } from '../../utils/alerts';

export default function OrganizationFormScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ name: '', contactName: '', contactPhone: '', contactEmail: '', adminName: '', adminEmail: '' });
  const [plan, setPlan] = useState('STANDARD');
  const [maxBranches, setMaxBranches] = useState('');
  const [maxBeds, setMaxBeds] = useState('');
  const update = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const create = useMutation({
    mutationFn: async () => (await apiClient.post('/super-admin/organizations', { ...values, plan, ...(maxBranches ? { maxBranches: Number(maxBranches) } : {}), ...(maxBeds ? { maxBeds: Number(maxBeds) } : {}) })).data,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      await queryClient.invalidateQueries({ queryKey: ['superAdminDashboard'] });
      showAlert(`Email: ${data.admin.email}\nTemporary password: ${data.temporaryPassword}\n\nCopy this password now. It is shown only once.`, 'Hostel account created', () => navigation.replace('OrganizationDetail', { organizationId: data.organization.id }));
    },
  });
  const submit = () => create.mutate();

  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Create hostel account</Text><Text style={styles.subtitle}>The administrator will sign in with a temporary password and create a new password.</Text>
    <Surface style={styles.card} elevation={1}>
      <Text style={styles.section}>Hostel details</Text>
      <Field label="Hostel or company name *" value={values.name} onChangeText={(v: string) => update('name', v)} />
      <Field label="Contact person" value={values.contactName} onChangeText={(v: string) => update('contactName', v)} />
      <Field label="Contact phone" value={values.contactPhone} onChangeText={(v: string) => update('contactPhone', v)} keyboardType="phone-pad" />
      <Field label="Contact email" value={values.contactEmail} onChangeText={(v: string) => update('contactEmail', v)} keyboardType="email-address" autoCapitalize="none" />
      <Text style={[styles.section, { marginTop: 12 }]}>Plan and optional limits</Text>
      <SegmentedButtons value={plan} onValueChange={setPlan} buttons={[{ value: 'FREE', label: 'Free' }, { value: 'STANDARD', label: 'Standard' }, { value: 'PREMIUM', label: 'Premium' }]} style={{ marginBottom: 12 }} />
      <ScrollView horizontal contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled"><TextInput label="Maximum branches" value={maxBranches} onChangeText={setMaxBranches} mode="outlined" keyboardType="number-pad" style={styles.limitInput} /><TextInput label="Maximum beds" value={maxBeds} onChangeText={setMaxBeds} mode="outlined" keyboardType="number-pad" style={styles.limitInput} /></ScrollView>
      <Text style={[styles.section, { marginTop: 12 }]}>First administrator</Text>
      <Field label="Administrator name *" value={values.adminName} onChangeText={(v: string) => update('adminName', v)} />
      <Field label="Administrator email *" value={values.adminEmail} onChangeText={(v: string) => update('adminEmail', v)} keyboardType="email-address" autoCapitalize="none" />
      {!!create.error && <Text style={styles.error}>{(create.error as any).response?.data?.error || 'Could not create the hostel account.'}</Text>}
      <Button mode="contained" onPress={submit} loading={create.isPending} disabled={create.isPending || !values.name.trim() || !values.adminName.trim() || !values.adminEmail.trim()} contentStyle={{ height: 50 }}>Create account</Button>
    </Surface>
  </ScrollView>;
}

function Field(props: any) { return <TextInput {...props} mode="outlined" style={styles.input} />; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F8FAFC' }, content: { padding: 20, paddingBottom: 40 }, title: { color: '#0F172A', fontSize: 25, fontWeight: '800' }, subtitle: { color: '#64748B', lineHeight: 21, marginTop: 6, marginBottom: 20 }, card: { padding: 20, borderRadius: 16, backgroundColor: '#FFF' }, section: { color: '#334155', fontSize: 17, fontWeight: '800', marginBottom: 13 }, input: { backgroundColor: '#FFF', marginBottom: 13 }, limitInput: { width: 185, backgroundColor: '#FFF', marginBottom: 13 }, error: { color: '#DC2626', marginBottom: 12 } });
