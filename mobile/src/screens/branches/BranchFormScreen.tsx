import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme, SegmentedButtons, Surface } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { branchFormSchema } from '../../validations/schemas';
import apiClient from '../../services/api';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { showAlert, showConfirm } from '../../utils/alerts';

type BranchFormRouteProp = RouteProp<RootStackParamList, 'BranchForm'>;
type BranchFormNavigationProp = StackNavigationProp<RootStackParamList, 'BranchForm'>;

interface BranchFormScreenProps {
  route: BranchFormRouteProp;
  navigation: BranchFormNavigationProp;
}

export default function BranchFormScreen({ route, navigation }: BranchFormScreenProps) {
  const { branchId } = route.params;
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusVal, setStatusVal] = useState('ACTIVE');

  const { control, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      googleMapsLocation: '',
      rentDueDay: 5,
      status: 'ACTIVE',
    },
  });

  // Load existing data if editing
  useEffect(() => {
    if (branchId) {
      setIsLoading(true);
      apiClient.get(`/branches/${branchId}`)
        .then((response) => {
          const data = response.data;
          setValue('name', data.name);
          setValue('address', data.address);
          setValue('phone', data.phone);
          setValue('googleMapsLocation', data.googleMapsLocation || '');
          setValue('rentDueDay', data.rentDueDay);
          setValue('status', data.status);
          setStatusVal(data.status);
        })
        .catch((err) => {
          console.error('Fetch branch error:', err);
          showAlert('Failed to load branch details');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [branchId]);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const payload = { ...data, status: statusVal };

    try {
      if (branchId) {
        // Edit Mode
        await apiClient.put(`/branches/${branchId}`, payload);
        showAlert('Branch updated successfully', 'Success', () => navigation.goBack());
      } else {
        // Create Mode
        await apiClient.post('/branches', payload);
        showAlert('Branch created successfully', 'Success', () => navigation.goBack());
      }
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to save branch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    showConfirm(
      'Are you sure you want to delete this branch? All associated rooms and data will be permanently removed.',
      async () => {
        setIsSubmitting(true);
        try {
          await apiClient.delete(`/branches/${branchId}`);
          showAlert('Branch deleted', 'Success', () => navigation.navigate('Main'));
        } catch (err: any) {
          console.error(err);
          showAlert(err.response?.data?.error || 'Failed to delete branch');
        } finally {
          setIsSubmitting(false);
        }
      },
      { title: 'Delete Branch', confirmText: 'Delete', destructive: true }
    );
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
            {branchId ? 'Edit Branch' : 'Create New Branch'}
          </Text>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Branch Name *"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                mode="outlined"
                error={!!errors.name}
                style={styles.input}
              />
            )}
          />
          {errors.name && <HelperText type="error">{errors.name.message}</HelperText>}

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Address *"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                mode="outlined"
                multiline
                numberOfLines={3}
                error={!!errors.address}
                style={styles.input}
              />
            )}
          />
          {errors.address && <HelperText type="error">{errors.address.message}</HelperText>}

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Phone Number *"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                mode="outlined"
                keyboardType="phone-pad"
                error={!!errors.phone}
                style={styles.input}
              />
            )}
          />
          {errors.phone && <HelperText type="error">{errors.phone.message}</HelperText>}

          <Controller
            control={control}
            name="googleMapsLocation"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Google Maps URL (Optional)"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                mode="outlined"
                style={styles.input}
              />
            )}
          />

          <Controller
            control={control}
            name="rentDueDay"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Rent Due Day of Month (1-31) *"
                value={String(value)}
                onBlur={onBlur}
                onChangeText={(text) => onChange(Number(text) || 5)}
                mode="outlined"
                keyboardType="numeric"
                error={!!errors.rentDueDay}
                style={styles.input}
              />
            )}
          />
          {errors.rentDueDay && <HelperText type="error">{errors.rentDueDay.message}</HelperText>}

          {/* Status Segment */}
          <Text variant="labelMedium" style={styles.statusLabel}>Branch Status</Text>
          <View style={{ marginBottom: 20 }}>
            <SegmentedButtons
              value={statusVal}
              onValueChange={setStatusVal}
              buttons={[
                { value: 'ACTIVE', label: 'Active', icon: 'check-circle' },
                { value: 'INACTIVE', label: 'Inactive', icon: 'close-circle' },
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
            Save Branch Details
          </Button>

          {branchId && (
            <Button
              mode="text"
              onPress={handleDelete}
              textColor={theme.colors.error}
              style={{ marginTop: 10 }}
              disabled={isSubmitting}
            >
              Delete Branch
            </Button>
          )}
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
  statusLabel: {
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
