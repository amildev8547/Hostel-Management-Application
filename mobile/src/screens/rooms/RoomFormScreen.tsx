import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme, SegmentedButtons, Surface } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { roomFormSchema } from '../../validations/schemas';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { showAlert } from '../../utils/alerts';

type RoomFormRouteProp = RouteProp<RootStackParamList, 'RoomForm'>;
type RoomFormNavigationProp = StackNavigationProp<RootStackParamList, 'RoomForm'>;

interface RoomFormScreenProps {
  route: RoomFormRouteProp;
  navigation: RoomFormNavigationProp;
}

export default function RoomFormScreen({ route, navigation }: RoomFormScreenProps) {
  const { branchId, roomId } = route.params;
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusVal, setStatusVal] = useState('AVAILABLE');
  const [roomTypeVal, setRoomTypeVal] = useState('2 Share');

  const { control, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      roomNumber: '',
      floor: '',
      roomType: '2 Share',
      capacity: 2,
      monthlyRent: 5000,
      admissionFee: 1500,
      status: 'AVAILABLE',
    },
  });

  // Automatically update capacity value based on sharing type selection
  const handleRoomTypeChange = (type: string) => {
    setRoomTypeVal(type);
    setValue('roomType', type);

    if (type === '2 Share') setValue('capacity', 2);
    else if (type === '3 Share') setValue('capacity', 3);
    else if (type === '4 Share') setValue('capacity', 4);
    else if (type === '5 Share') setValue('capacity', 5);
  };

  // Load existing data if editing
  useEffect(() => {
    if (roomId) {
      setIsLoading(true);
      apiClient.get(`/rooms/${roomId}`)
        .then((response) => {
          const data = response.data;
          setValue('roomNumber', data.roomNumber);
          setValue('floor', data.floor);
          setValue('roomType', data.roomType);
          setValue('capacity', data.capacity);
          setValue('monthlyRent', data.monthlyRent);
          setValue('admissionFee', data.admissionFee);
          setValue('status', data.status);
          setStatusVal(data.status);
          setRoomTypeVal(data.roomType);
        })
        .catch((err) => {
          console.error('Fetch room details error:', err);
          showAlert('Failed to load room details');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [roomId]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const payload = {
      ...data,
      branchId,
      status: statusVal,
      roomType: roomTypeVal,
    };

    try {
      if (roomId) {
        // Edit Mode
        await apiClient.put(`/rooms/${roomId}`, payload);
        showAlert('Room details updated successfully', 'Success', () => navigation.goBack());
      } else {
        // Create Mode
        await apiClient.post('/rooms', payload);
        showAlert('Room created successfully', 'Success', () => navigation.goBack());
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to save room details');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading details...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleLarge" style={styles.title}>
            {roomId ? `Edit Room` : 'Add New Room'}
          </Text>

          <Controller
            control={control}
            name="roomNumber"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Room Number *"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                mode="outlined"
                error={!!errors.roomNumber}
                style={styles.input}
              />
            )}
          />
          {errors.roomNumber && <HelperText type="error">{errors.roomNumber.message}</HelperText>}

          <Controller
            control={control}
            name="floor"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Floor / Level *"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                mode="outlined"
                placeholder="e.g. Ground Floor, 1st Floor"
                error={!!errors.floor}
                style={styles.input}
              />
            )}
          />
          {errors.floor && <HelperText type="error">{errors.floor.message}</HelperText>}

          {/* Sharing Select Segment */}
          <Text variant="labelMedium" style={styles.sectionLabel}>Sharing Type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <SegmentedButtons
              value={roomTypeVal}
              onValueChange={handleRoomTypeChange}
              buttons={[
                { value: '2 Share', label: '2 Share' },
                { value: '3 Share', label: '3 Share' },
                { value: '4 Share', label: '4 Share' },
                { value: '5 Share', label: '5 Share' },
                { value: 'Custom', label: 'Custom' },
              ]}
              style={{ width: 450 }}
            />
          </ScrollView>

          {roomTypeVal === 'Custom' && (
            <Controller
              control={control}
              name="capacity"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Bed Capacity *"
                  value={String(value)}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(Number(text) || 1)}
                  mode="outlined"
                  keyboardType="numeric"
                  error={!!errors.capacity}
                  style={styles.input}
                />
              )}
            />
          )}

          <Controller
            control={control}
            name="monthlyRent"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Monthly Rent (₹) *"
                value={String(value)}
                onBlur={onBlur}
                onChangeText={(text) => onChange(Number(text) || 0)}
                mode="outlined"
                keyboardType="numeric"
                error={!!errors.monthlyRent}
                style={styles.input}
              />
            )}
          />
          {errors.monthlyRent && <HelperText type="error">{errors.monthlyRent.message}</HelperText>}

          <Controller
            control={control}
            name="admissionFee"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="One-Time Admission Fee (₹) *"
                value={String(value)}
                onBlur={onBlur}
                onChangeText={(text) => onChange(Number(text) || 0)}
                mode="outlined"
                keyboardType="numeric"
                error={!!errors.admissionFee}
                style={styles.input}
              />
            )}
          />
          {errors.admissionFee && <HelperText type="error">{errors.admissionFee.message}</HelperText>}

          {/* Status Options */}
          <Text variant="labelMedium" style={styles.sectionLabel}>Room Status</Text>
          <View style={{ marginBottom: 20 }}>
            <SegmentedButtons
              value={statusVal}
              onValueChange={setStatusVal}
              buttons={[
                { value: 'AVAILABLE', label: 'Available' },
                { value: 'MAINTENANCE', label: 'Maintenance' },
              ]}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.submitBtn}
          >
            Save Room Details
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontWeight: '800',
    marginBottom: 20,
    color: '#0F172A',
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  sectionLabel: {
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
    marginBottom: 8,
  },
  submitBtn: {
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
