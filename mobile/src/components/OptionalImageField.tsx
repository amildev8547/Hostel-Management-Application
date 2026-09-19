import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Text } from 'react-native-paper';
import { showAlert } from '../utils/alerts';

export type SelectedImage = { uri: string; base64: string };

export default function OptionalImageField({ label, icon, value, existingUrl, onChange }: {
  label: string; icon: keyof typeof Icon.glyphMap; value?: SelectedImage; existingUrl?: string; onChange: (image: SelectedImage) => void;
}) {
  const choose = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return showAlert('Allow photo access to choose this image.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.65, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      onChange({ uri: asset.uri, base64: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` });
    }
  };
  const uri = value?.uri || existingUrl;
  return <TouchableOpacity style={styles.card} onPress={choose} accessibilityRole="button">
    {uri ? <Image source={{ uri }} style={styles.preview} /> : <View style={styles.placeholder}><Icon name={icon} size={30} color="#64748B" /></View>}
    <View style={{ flex: 1 }}><Text style={styles.label}>{label}</Text><Text style={styles.help}>{uri ? 'Tap to replace' : 'Optional · Tap to choose'}</Text></View>
    <Icon name="image-plus" size={23} color="#4F46E5" />
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 13, padding: 10, marginBottom: 10, backgroundColor: '#FFFFFF' },
  preview: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F1F5F9' },
  placeholder: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  label: { color: '#1E293B', fontSize: 15, fontWeight: '800' }, help: { color: '#64748B', fontSize: 12, marginTop: 3 },
});
