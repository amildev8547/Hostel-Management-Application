import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp as StackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import apiClient from '../../services/api';
import { showAlert } from '../../utils/alerts';
import { invalidateHostelData } from '../../utils/queryInvalidation';
import DateInputField from '../../components/DateInputField';

type Props = {
  route: RouteProp<RootStackParamList, 'ExistingTenantForm'>;
  navigation: StackNavigationProp<RootStackParamList, 'ExistingTenantForm'>;
};
type RentStatus = 'PAID' | 'DUE' | 'SKIP';

const formatDateForApi = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function ExistingTenantFormScreen({ route, navigation }: Props) {
  const { branchId } = route.params;
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date());
  const [address, setAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [joiningFeeStatus, setJoiningFeeStatus] = useState<'PAID' | 'SKIP'>('PAID');
  const [currentRentStatus, setCurrentRentStatus] = useState<RentStatus>('DUE');
  const [saving, setSaving] = useState(false);

  const { data: rooms = [] } = useQuery<any[]>({
    queryKey: ['branchRooms', branchId],
    queryFn: async () => (await apiClient.get('/rooms', { params: { branchId } })).data,
  });
  const availableRooms = useMemo(() => rooms.filter((room) => room.vacant > 0), [rooms]);
  const selectedRoom = rooms.find((room) => room.id === roomId);

  const save = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');
    const cleanGuardianPhone = guardianPhone.replace(/\D/g, '');
    if (name.trim().length < 2) return showAlert('Enter the resident’s full name.');
    if (cleanPhone.length !== 10) return showAlert('Enter a valid 10-digit phone number.');
    if (cleanWhatsapp && cleanWhatsapp.length !== 10) return showAlert('Enter a valid WhatsApp number or leave it empty.');
    if (cleanGuardianPhone && cleanGuardianPhone.length !== 10) return showAlert('Enter a valid guardian phone number or leave it empty.');
    if (!roomId) return showAlert('Choose the room where this resident currently stays.');

    setSaving(true);
    try {
      const response = await apiClient.post('/tenants/existing', {
        branchId, roomId, name: name.trim(), phone: cleanPhone,
        whatsappNumber: cleanWhatsapp || undefined, joiningDate: formatDateForApi(joiningDate),
        address: address.trim() || undefined, guardianName: guardianName.trim() || undefined,
        guardianPhone: cleanGuardianPhone || undefined, occupation: occupation.trim() || undefined,
        workLocation: workLocation.trim() || undefined, joiningFeeStatus, currentRentStatus,
      });
      invalidateHostelData(queryClient, { branchId, roomId, tenantId: response.data.tenant.id });
      showAlert(response.data.message, 'Resident added', () => navigation.replace('TenantProfile', { tenantId: response.data.tenant.id }));
    } catch (error: any) {
      showAlert(error.response?.data?.error || 'Could not add this resident. Check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  return <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.intro}>
      <Icon name="account-plus-outline" size={28} color="#4F46E5" />
      <View style={{ flex: 1 }}><Text style={styles.title}>Add a current resident</Text><Text style={styles.help}>Use this for someone who already lives in this hostel.</Text></View>
    </View>

    <Card style={styles.card}><Card.Content>
      <Text style={styles.section}>Resident details</Text>
      <TextInput mode="outlined" label="Full name *" value={name} onChangeText={setName} style={styles.input} />
      <TextInput mode="outlined" label="Phone number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} style={styles.input} />
      <TextInput mode="outlined" label="WhatsApp number (same if empty)" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" maxLength={10} style={styles.input} />

      <Text style={styles.section}>Current room</Text>
      {availableRooms.map((room) => <TouchableOpacity key={room.id} onPress={() => setRoomId(room.id)} style={[styles.room, roomId === room.id && styles.roomSelected]}>
        <Icon name="door-open" size={24} color={roomId === room.id ? '#4F46E5' : '#64748B'} />
        <View style={{ flex: 1 }}><Text style={styles.roomName}>Room {room.roomNumber}</Text><Text style={styles.roomHelp}>{room.floor} · {room.vacant} free {room.vacant === 1 ? 'bed' : 'beds'}</Text></View>
        <Icon name={roomId === room.id ? 'check-circle' : 'circle-outline'} size={24} color={roomId === room.id ? '#4F46E5' : '#94A3B8'} />
      </TouchableOpacity>)}
      {!availableRooms.length && <Text style={styles.noRooms}>There are no rooms with a free bed.</Text>}

      <Text style={styles.section}>Original joining date</Text>
      <DateInputField value={joiningDate} onChange={setJoiningDate} label="Original joining date" maximumDate={new Date()} />

      <Text style={styles.section}>Payment records</Text>
      <Text style={styles.label}>Was the joining fee already paid?</Text>
      <SegmentedButtons value={joiningFeeStatus} onValueChange={(value) => setJoiningFeeStatus(value as 'PAID' | 'SKIP')} buttons={[{ value: 'PAID', label: 'Yes, paid', icon: 'check' }, { value: 'SKIP', label: 'Do not add' }]} style={styles.segments} />
      {!!selectedRoom && joiningFeeStatus === 'PAID' && <Text style={styles.note}>₹{selectedRoom.admissionFee} will be saved as previously paid.</Text>}
      <Text style={styles.label}>This month’s rent</Text>
      <SegmentedButtons value={currentRentStatus} onValueChange={(value) => setCurrentRentStatus(value as RentStatus)} buttons={[{ value: 'DUE', label: 'Still due' }, { value: 'PAID', label: 'Paid' }, { value: 'SKIP', label: 'Later' }]} style={styles.segments} />
      {!!selectedRoom && currentRentStatus !== 'SKIP' && <Text style={styles.note}>Monthly rent: ₹{selectedRoom.monthlyRent}</Text>}

      <Text style={styles.section}>More details (optional)</Text>
      <TextInput mode="outlined" label="Permanent address" value={address} onChangeText={setAddress} multiline style={styles.input} />
      <TextInput mode="outlined" label="Guardian name" value={guardianName} onChangeText={setGuardianName} style={styles.input} />
      <TextInput mode="outlined" label="Guardian phone" value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" maxLength={10} style={styles.input} />
      <TextInput mode="outlined" label="Occupation" value={occupation} onChangeText={setOccupation} style={styles.input} />
      <TextInput mode="outlined" label="Work location" value={workLocation} onChangeText={setWorkLocation} style={styles.input} />
      <Button mode="contained" icon="account-check" onPress={save} loading={saving} disabled={saving || !availableRooms.length} style={styles.save}>Add current resident</Button>
    </Card.Content></Card>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 16, paddingBottom: 44 }, intro: { flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 16, padding: 16, marginBottom: 14 }, title: { color: '#172554', fontSize: 20, fontWeight: '900' }, help: { color: '#52627A', fontSize: 14, lineHeight: 20, marginTop: 3 }, card: { backgroundColor: '#FFFFFF', borderRadius: 16 }, section: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 10 }, input: { backgroundColor: '#FFFFFF', marginBottom: 12 }, room: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 13, padding: 13, marginBottom: 9 }, roomSelected: { borderWidth: 2, borderColor: '#4F46E5', backgroundColor: '#EEF2FF' }, roomName: { color: '#1E293B', fontSize: 16, fontWeight: '800' }, roomHelp: { color: '#64748B', fontSize: 13, marginTop: 2 }, noRooms: { color: '#B91C1C', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 13, fontWeight: '700' }, label: { color: '#334155', fontSize: 14, fontWeight: '700', marginBottom: 8 }, segments: { marginBottom: 6 }, note: { color: '#64748B', fontSize: 13, marginBottom: 14 }, save: { minHeight: 52, justifyContent: 'center', borderRadius: 12, marginTop: 6 },
});
