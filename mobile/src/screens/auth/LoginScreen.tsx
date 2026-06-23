import React, { useState } from 'react';
import { View, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme, Surface } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '../../validations/schemas';
import { useAuth } from '../../services/AuthContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { login } = useAuth();
  const theme = useTheme();
  const [secureText, setSecureText] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login(data.email, data.password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check credentials.');
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
            <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
              HostelHub
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Branch & Occupancy Management
            </Text>
          </View>

          {errorMessage && (
            <Surface style={[styles.errorCard, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
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

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Password"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                secureTextEntry={secureText}
                mode="outlined"
                error={!!errors.password}
                style={styles.input}
                outlineColor="#CBD5E1"
                activeOutlineColor={theme.colors.primary}
                right={
                  <TextInput.Icon
                    icon={secureText ? 'eye-off' : 'eye'}
                    onPress={() => setSecureText(!secureText)}
                  />
                }
              />
            )}
          />
          {errors.password && (
            <HelperText type="error" visible={true}>
              {errors.password.message}
            </HelperText>
          )}

          <Button
            mode="text"
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotBtn}
            textColor={theme.colors.primary}
          >
            Forgot Password?
          </Button>

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.submitBtn}
            buttonColor={theme.colors.primary}
            labelStyle={styles.submitBtnLabel}
          >
            Login
          </Button>

          <View style={styles.demoBox}>
            <Text variant="labelMedium" style={{ color: '#475569', fontWeight: 'bold' }}>
              💡 Demo Owner Credentials:
            </Text>
            <Text variant="bodySmall" style={{ color: '#475569', marginTop: 2 }}>
              Email: owner@hostelhub.com | Pass: password123
            </Text>
          </View>
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
    letterSpacing: -1,
  },
  subtitle: {
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  submitBtn: {
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  submitBtnLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  demoBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
});
