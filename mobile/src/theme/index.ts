import { MD3LightTheme, configureFonts } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#4F46E5', // Indigo-600 (Main theme)
    primaryContainer: '#EEF2FF', // Indigo-50
    secondary: '#0F172A', // Slate-900
    secondaryContainer: '#F1F5F9', // Slate-100
    background: '#F8FAFC', // Slate-50 (SaaS background)
    surface: '#FFFFFF',
    surfaceVariant: '#F1F5F9',
    outline: '#CBD5E1', // Slate-300
    error: '#EF4444', // Red (Full)
    success: '#10B981', // Green (Available)
    warning: '#F59E0B', // Orange (Partial)
    info: '#3B82F6', // Blue (Info)
  },
};

export const occupancyColors = {
  AVAILABLE: '#10B981', // Green
  PARTIAL: '#F59E0B',   // Orange
  FULL: '#EF4444',      // Red
  MAINTENANCE: '#64748B' // Grey
};

export const occupancyLabels = {
  AVAILABLE: 'Available',
  PARTIAL: 'Partial',
  FULL: 'Full',
  MAINTENANCE: 'Maintenance'
};
