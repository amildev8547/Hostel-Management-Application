import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme, Surface } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '../../validations/schemas';
import apiClient from '../../services/api';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation';

type ForgotPasswordNavigationProp = StackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

interface ForgotPasswordScreenProps {
  navigation: ForgotPasswordNavigationProp;
}

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: { email: string }) => {
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await apiClient.post('/auth/forgot-password', { email: data.email });
      setSuccessMessage(response.data.message || 'Reset link sent to your email.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to request reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Surface style={styles.card} elevation={2}>
          <View style={styles.header}>
            <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.primary }]}>
              Reset Password
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
          </View>

          {successMessage && (
            <Surface style={[styles.alertCard, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
              <Text style={{ color: '#047857', fontWeight: '600' }}>{successMessage}</Text>
            </Surface>
          )}

          {errorMessage && (
            <Surface style={[styles.alertCard, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
              <Text style={{ color: '#B91C1C', fontWeight: '600' }}>{errorMessage}</Text>
            </Surface>
          )}

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Email Address"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                error={!!errors.email}
                disabled={!!successMessage}
                style={styles.input}
                outlineColor="#CBD5E1"
                activeOutlineColor={theme.colors.primary}
              />
            )}
          />
          {errors.email && (
            <HelperText type="error" visible={true}>
              {errors.email.message}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting || !!successMessage}
            style={styles.submitBtn}
            buttonColor={theme.colors.primary}
            labelStyle={styles.submitBtnLabel}
          >
            Send Reset Link
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            textColor="#64748B"
            style={styles.backBtn}
          >
            Back to Login
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  submitBtn: {
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  submitBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  backBtn: {
    alignSelf: 'center',
  },
  alertCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
});
