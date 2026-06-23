import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Share,
  Clipboard,
  Dimensions,
} from 'react-native';
import { Text, Button, Surface, useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation';
import { showAlert } from '../../utils/alerts';
import { getApplyUrl } from '../../utils/backendUrl';
import QRCode from 'react-native-qrcode-svg';

type QRCodeScreenRouteProp = RouteProp<RootStackParamList, 'QRCode'>;
type QRCodeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'QRCode'>;

interface QRCodeScreenProps {
  route: QRCodeScreenRouteProp;
  navigation: QRCodeScreenNavigationProp;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH - 96, 260);

export default function QRCodeScreen({ route, navigation }: QRCodeScreenProps) {
  const { branchId, branchName } = route.params;
  const theme = useTheme();
  const applyUrl = getApplyUrl(branchId);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Hello! Apply for hostel admission at ${branchName} by scanning this link:\n${applyUrl}`,
        title: `${branchName} – Admission Form`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(applyUrl);
    showAlert('Admission link copied to clipboard!');
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Decorative gradient header band */}
      <View style={styles.headerBand}>
        <View style={styles.gradientBg}>
          <View style={styles.gradientOverlay} />
        </View>
        <Icon name="qrcode-scan" size={36} color="#FFFFFF" style={{ marginBottom: 8 }} />
        <Text style={styles.headerTitle}>Scan to Apply</Text>
        <Text style={styles.headerSubtitle}>{branchName}</Text>
      </View>

      {/* QR Code Card */}
      <Surface style={styles.qrCard} elevation={3}>
        <View style={styles.qrWrapper}>
          <View style={styles.qrBorder}>
            <QRCode
              value={applyUrl}
              size={QR_SIZE}
              color="#1E1B4B"
              backgroundColor="#FFFFFF"
              ecl="M"
            />
          </View>
        </View>

        <Text style={styles.qrLabel}>
          Point the tenant's phone camera at this code
        </Text>

        <View style={styles.urlBox}>
          <Icon name="link-variant" size={16} color="#6366F1" />
          <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
            {applyUrl}
          </Text>
        </View>
      </Surface>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <Button
          mode="contained"
          icon="share-variant"
          onPress={handleShare}
          style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
          contentStyle={styles.actionBtnContent}
          labelStyle={styles.actionBtnLabel}
        >
          Share Link
        </Button>
        <Button
          mode="outlined"
          icon="content-copy"
          onPress={handleCopyLink}
          style={[styles.actionBtn, { borderColor: theme.colors.primary }]}
          contentStyle={styles.actionBtnContent}
          labelStyle={[styles.actionBtnLabel, { color: theme.colors.primary }]}
        >
          Copy URL
        </Button>
      </View>

      {/* Tip card */}
      <Surface style={styles.tipCard} elevation={1}>
        <View style={styles.tipHeader}>
          <Icon name="lightbulb-on-outline" size={20} color="#F59E0B" />
          <Text style={styles.tipTitle}>How it Works</Text>
        </View>
        <Text style={styles.tipText}>
          Show this QR code to the prospective tenant. They scan it with their
          phone's camera to open the admission form, fill in their details, upload
          documents, and pay the admission fee — all from their own device.
        </Text>
        <View style={styles.tipSteps}>
          <StepItem number="1" text="Tenant scans QR code" />
          <StepItem number="2" text="Fills the admission form" />
          <StepItem number="3" text="Pays admission fee online" />
          <StepItem number="4" text="You review & approve in app" />
        </View>
      </Surface>
    </ScrollView>
  );
}

function StepItem({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Header band */
  headerBand: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 40,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientBg: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: '#4F46E5',
  },
  gradientOverlay: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: '#7C3AED',
    opacity: 0.5,
    transform: [{ skewY: '-6deg' }, { scaleX: 1.3 }],
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '500',
  },

  /* QR Card */
  qrCard: {
    marginHorizontal: 20,
    marginTop: -28,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  qrBorder: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#E0E7FF',
    backgroundColor: '#FFFFFF',
  },
  qrLabel: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '100%',
  },
  urlText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '500',
    flexShrink: 1,
  },

  /* Action buttons */
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
  },
  actionBtnContent: {
    paddingVertical: 6,
  },
  actionBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Tip card */
  tipCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: '#FFFBEB',
    padding: 20,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  tipText: {
    fontSize: 13,
    color: '#78716C',
    lineHeight: 20,
    marginBottom: 12,
  },
  tipSteps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepText: {
    fontSize: 13,
    color: '#44403C',
    fontWeight: '600',
  },
});
