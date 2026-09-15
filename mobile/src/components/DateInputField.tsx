import React, { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { formatDate } from '../utils/date';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

const apiDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const localDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

export default function DateInputField({ value, onChange, label, minimumDate, maximumDate }: Props) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    const input = React.createElement('input' as any, {
      type: 'date',
      value: apiDate(value),
      min: minimumDate ? apiDate(minimumDate) : undefined,
      max: maximumDate ? apiDate(maximumDate) : undefined,
      onChange: (event: any) => event.target.value && onChange(localDate(event.target.value)),
      'aria-label': label || 'Choose date',
      style: {
        flex: 1, width: '100%', minWidth: 0, border: 0, outline: 'none', background: 'transparent',
        color: '#0F172A', fontSize: 16, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
      },
    });
    return <View style={styles.field}>
      <Icon name="calendar-month-outline" size={25} color="#4F46E5" />
      <View style={styles.webInput}><Text style={styles.value}>{formatDate(value)}</Text><View style={styles.hiddenWebInput}>{input}</View></View>
    </View>;
  }

  return <>
    <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label || 'Choose date'}>
      <Icon name="calendar-month-outline" size={25} color="#4F46E5" />
      <View style={styles.valueWrap}>
        {!!label && <Text style={styles.smallLabel}>{label}</Text>}
        <Text style={styles.value}>{formatDate(value)}</Text>
      </View>
      <Icon name="chevron-down" size={23} color="#64748B" />
    </TouchableOpacity>
    {open && <DateTimePicker
      value={value}
      mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onValueChange={(_event, date) => { if (Platform.OS === 'android') setOpen(false); if (date) onChange(date); }}
      onDismiss={() => setOpen(false)}
    />}
  </>;
}

const styles = StyleSheet.create({
  field: { minHeight: 62, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: '#94A3B8', borderRadius: 12, paddingHorizontal: 14, marginBottom: 10, backgroundColor: '#FFFFFF' },
  valueWrap: { flex: 1 }, value: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  smallLabel: { color: '#64748B', fontSize: 12, marginBottom: 2 }, webInput: { flex: 1, justifyContent: 'center', position: 'relative' }, hiddenWebInput: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 },
});
