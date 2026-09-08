import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type AppSplashScreenProps = {
  onFinish: () => void;
};

function HostelHubMark({ size }: { size: number }) {
  return (
    <View style={[styles.markContainer, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 64 64" accessibilityElementsHidden>
        <Path
          d="M10 29.5 32 12l22 17.5v23a3.5 3.5 0 0 1-3.5 3.5h-37A3.5 3.5 0 0 1 10 52.5v-23Z"
          fill="#FFFFFF"
        />
        <Path d="M5.5 31.5 32 10l26.5 21.5" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="19" y="34" width="26" height="15" rx="3" fill="#4F46E5" />
        <Rect x="22.5" y="37.5" width="8" height="4.5" rx="1.5" fill="#FFFFFF" />
        <Rect x="33.5" y="37.5" width="8" height="4.5" rx="1.5" fill="#FFFFFF" />
        <Path d="M22 48v5M42 48v5" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export default function AppSplashScreen({ onFinish }: AppSplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const entrance = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1150,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const finishTimer = setTimeout(() => {
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, 1200);

    return () => clearTimeout(finishTimer);
  }, [entrance, exitOpacity, onFinish, progress]);

  const compact = height < 620 || width < 340;
  const markSize = compact ? 78 : Math.min(96, width * 0.24);

  return (
    <Animated.View style={[styles.screen, { opacity: exitOpacity }]} accessibilityLabel="HostelHub is starting">
      <View style={[styles.glow, styles.glowTop, { width: width * 0.78, height: width * 0.78 }]} />
      <View style={[styles.glow, styles.glowBottom, { width: width * 0.58, height: width * 0.58 }]} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
              },
              {
                scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
              },
            ],
          },
        ]}
      >
        <HostelHubMark size={markSize} />
        <Text style={[styles.brandName, compact && styles.brandNameCompact]}>HostelHub</Text>
        <Text style={styles.tagline}>Your hostel, simply managed</Text>

        <View style={styles.featurePill}>
          <Text style={styles.featureText}>Rooms</Text>
          <View style={styles.featureDot} />
          <Text style={styles.featureText}>Residents</Text>
          <View style={styles.featureDot} />
          <Text style={styles.featureText}>Rent</Text>
        </View>
      </Animated.View>

      <View style={[styles.loadingArea, { bottom: compact ? 28 : Math.max(42, height * 0.065) }]}>
        <Text style={styles.loadingText}>Getting everything ready</Text>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                transform: [{ scaleX: progress }],
              },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F5F3FF',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#E0E7FF',
  },
  glowTop: {
    top: '-18%',
    right: '-30%',
    opacity: 0.78,
  },
  glowBottom: {
    bottom: '-12%',
    left: '-24%',
    backgroundColor: '#DDD6FE',
    opacity: 0.62,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    shadowColor: '#312E81',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  brandName: {
    marginTop: 24,
    color: '#111827',
    fontSize: 36,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1,
  },
  brandNameCompact: {
    marginTop: 18,
    fontSize: 31,
    lineHeight: 38,
  },
  tagline: {
    marginTop: 7,
    color: '#5B6476',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    textAlign: 'center',
  },
  featurePill: {
    marginTop: 25,
    minHeight: 42,
    maxWidth: '100%',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#D9D6FE',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  featureText: {
    color: '#4338CA',
    fontSize: 13,
    fontWeight: '700',
  },
  featureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A5B4FC',
  },
  loadingArea: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginBottom: 12,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: Platform.OS === 'web' ? 0.1 : 0.25,
  },
  progressTrack: {
    width: 160,
    height: 4,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: '#DDD6FE',
  },
  progressBar: {
    width: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4F46E5',
  },
});
