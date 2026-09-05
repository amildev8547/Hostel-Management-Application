import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import apiClient from '../../services/api';
import { showAlert } from '../../utils/alerts';

type Props = { route: RouteProp<RootStackParamList, 'BookingForm'>; navigation: StackNavigationProp<RootStackParamList, 'BookingForm'> };
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(12, 0, 0, 0); return date; };
const formatDateForApi = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function BookingFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [branchId, setBranchId] = useState(route.params?.branchId || '');
  const [roomId, setRoomId] = useState(''); const [joiningDate, setJoiningDate] = useState(tomorrow()); const [showCalendar, setShowCalendar] = useState(false); const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false);
  const { data: branches = [] } = useQuery<any[]>({ queryKey: ['branchesList', 'booking'], queryFn: async () => (await apiClient.get('/branches')).data });
  const { data: rooms = [] } = useQuery<any[]>({ queryKey: ['branchRooms', branchId], queryFn: async () => (await apiClient.get('/rooms', { params: { branchId } })).data, enabled: !!branchId });
  useEffect(() => { setRoomId(''); }, [branchId]);
  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomId), [rooms, roomId]);

  const save = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (name.trim().length < 2 || cleanPhone.length !== 10 || !branchId || !roomId) return showAlert('Please enter the name, 10-digit phone number, branch, room, and joining date.');
    setSaving(true);
    try {
      await apiClient.post('/bookings', { name: name.trim(), phone: cleanPhone, branchId, roomId, expectedJoiningDate: formatDateForApi(joiningDate), notes: notes.trim() || undefined });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['bookings'] }), queryClient.invalidateQueries({ queryKey: ['branchRooms'] }), queryClient.invalidateQueries({ queryKey: ['branchDashboard'] }), queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] })]);
      showAlert('Bed reserved successfully. You can now share the admission form.', 'Booking created', () => navigation.replace('BookingList'));
    } catch (error: any) {
      const status = error.response?.status;
      const message = status === 404
        ? 'The booking service is not available on the server yet. Deploy the latest backend to Render and try again.'
        : error.code === 'ECONNABORTED'
        ? 'The server took too long to respond. Please wait a moment and try again.'
        : error.response?.data?.error || 'Could not create the booking. Check your internet connection and try again.';
      showAlert(message);
    } finally { setSaving(false); }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowCalendar(false);
    if (event.type !== 'dismissed' && selectedDate) setJoiningDate(selectedDate);
  };

  return <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.info}><Text style={styles.title}>Book a bed</Text><Text style={styles.help}>Only basic information is needed now. The person can complete the remaining details later.</Text></View>
    <Card style={styles.card}><Card.Content>
      <TextInput mode="outlined" label="Person's full name *" value={name} onChangeText={setName} style={styles.input} />
      <TextInput mode="outlined" label="10-digit phone number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} style={styles.input} />
      <Text style={styles.section}>1. Choose hostel branch</Text>
      {branches.map((branch) => <Choice key={branch.id} selected={branchId === branch.id} label={branch.name} detail={branch.address} onPress={() => setBranchId(branch.id)} />)}
      {!!branchId && <><Text style={styles.section}>2. Choose room</Text>{rooms.filter((room) => room.vacant > 0 && room.status !== 'MAINTENANCE').map((room) => <Choice key={room.id} selected={roomId === room.id} label={`Room ${room.roomNumber}`} detail={`${room.vacant} free ${room.vacant === 1 ? 'bed' : 'beds'} · ${room.floor}`} onPress={() => setRoomId(room.id)} />)}{rooms.length > 0 && !rooms.some((room) => room.vacant > 0 && room.status !== 'MAINTENANCE') && <Text style={styles.emptyText}>No rooms have a free bed.</Text>}</>}
      {!!roomId && <View style={styles.autoBedInfo}><Icon name="bed-outline" size={24} color="#047857" /><Text style={styles.autoBedText}>An available bed in Room {selectedRoom?.roomNumber} will be selected automatically.</Text></View>}
      <Text style={styles.section}>3. Expected joining date</Text>
      <TouchableOpacity style={styles.dateField} onPress={() => setShowCalendar(true)} accessibilityRole="button" accessibilityLabel="Choose expected joining date">
        <Icon name="calendar-month-outline" size={26} color="#4F46E5" />
        <View style={{ flex: 1 }}><Text style={styles.dateLabel}>Expected joining date</Text><Text style={styles.dateValue}>{joiningDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text></View>
        <Icon name="chevron-down" size={24} color="#64748B" />
      </TouchableOpacity>
      {showCalendar && <DateTimePicker value={joiningDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'calendar'} minimumDate={new Date()} onChange={handleDateChange} />}
      <TextInput mode="outlined" label="Notes (optional)" value={notes} onChangeText={setNotes} multiline numberOfLines={3} style={styles.input} />
      <Button mode="contained" icon="bed" onPress={save} loading={saving} disabled={saving} style={styles.save}>Reserve this bed</Button>
    </Card.Content></Card>
  </ScrollView>;
}

function Choice({ selected, label, detail, onPress }: { selected: boolean; label: string; detail: string; onPress: () => void }) { return <TouchableOpacity onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View><View style={{ flex: 1 }}><Text style={styles.choiceLabel}>{label}</Text><Text style={styles.choiceDetail}>{detail}</Text></View></TouchableOpacity>; }
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, paddingBottom: 40 }, info: { backgroundColor: '#EEF2FF', borderRadius: 16, padding: 17, marginBottom: 14 }, title: { color: '#1E1B4B', fontSize: 22, fontWeight: '900' }, help: { color: '#475569', fontSize: 14, lineHeight: 20, marginTop: 5 }, card: { backgroundColor: '#FFFFFF', borderRadius: 16 }, input: { backgroundColor: '#FFFFFF', marginBottom: 14 }, section: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 10 }, choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, padding: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 13, marginBottom: 9 }, choiceSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF', borderWidth: 2 }, radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#94A3B8', justifyContent: 'center', alignItems: 'center' }, radioSelected: { borderColor: '#4F46E5' }, radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4F46E5' }, choiceLabel: { color: '#1E293B', fontSize: 16, fontWeight: '800' }, choiceDetail: { color: '#64748B', fontSize: 13, marginTop: 3 }, autoBedInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 4, marginBottom: 8 }, autoBedText: { color: '#065F46', fontSize: 14, fontWeight: '700', lineHeight: 20, flex: 1 }, dateField: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#94A3B8', borderRadius: 12, paddingHorizontal: 14, marginBottom: 14, backgroundColor: '#FFFFFF' }, dateLabel: { color: '#64748B', fontSize: 12 }, dateValue: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 3 }, save: { minHeight: 52, justifyContent: 'center', borderRadius: 12, marginTop: 4 }, emptyText: { color: '#B91C1C', fontWeight: '700', marginBottom: 12 } });
