import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

type AppSplashScreenProps = {
  onFinish: () => void;
  prepareApp: (signal: AbortSignal) => Promise<void>;
};

const MINIMUM_SPLASH_DURATION = 3000;
const MAXIMUM_SPLASH_DURATION = 20000;

function HostelHubMark({ size }: { size: number }) {
  return (
    <View style={[styles.markContainer, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Image
        source={require('../../assets/brand-mark.png')}
        style={{ width: size * 0.9, height: size * 0.9 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export default function AppSplashScreen({ onFinish, prepareApp }: AppSplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const entrance = useRef(new Animated.Value(0)).current;
  const loadingMotion = useRef(new Animated.Value(-1)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const isFinishing = useRef(false);
  const [loadingMessage, setLoadingMessage] = useState('Connecting to HostelHub');

  const finishSplash = useCallback(() => {
    if (isFinishing.current) return;
    isFinishing.current = true;

    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 300,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [exitOpacity, onFinish]);

  useEffect(() => {
    const entranceAnimation = Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const loadingAnimation = Animated.loop(
      Animated.timing(loadingMotion, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    entranceAnimation.start();
    loadingAnimation.start();

    return () => {
      entranceAnimation.stop();
      loadingAnimation.stop();
    };
  }, [entrance, loadingMotion]);

  useEffect(() => {
    const requestController = new AbortController();
    let minimumTimeElapsed = false;
    let appIsReady = false;

    const finishWhenReady = () => {
      if (minimumTimeElapsed && appIsReady) finishSplash();
    };

    const minimumTimer = setTimeout(() => {
      minimumTimeElapsed = true;
      finishWhenReady();
    }, MINIMUM_SPLASH_DURATION);

    const recordsMessageTimer = setTimeout(() => {
      if (!isFinishing.current) setLoadingMessage('Opening your hostel records');
    }, 4500);

    const reassuranceTimer = setTimeout(() => {
      if (!isFinishing.current) setLoadingMessage('Almost ready — thank you for waiting');
    }, 10500);

    const maximumTimer = setTimeout(() => {
      requestController.abort();
      finishSplash();
    }, MAXIMUM_SPLASH_DURATION);

    prepareApp(requestController.signal)
      .catch(() => undefined)
      .finally(() => {
        appIsReady = true;
        finishWhenReady();
      });

    return () => {
      requestController.abort();
      clearTimeout(minimumTimer);
      clearTimeout(recordsMessageTimer);
      clearTimeout(reassuranceTimer);
      clearTimeout(maximumTimer);
    };
  }, [finishSplash, prepareApp]);

  const compact = height < 620 || width < 340;
  const markSize = compact ? 78 : Math.min(96, width * 0.24);

  return (
    <Animated.View style={[styles.screen, { opacity: exitOpacity }]} accessibilityLabel={loadingMessage}>
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
        <Text style={styles.loadingText}>{loadingMessage}</Text>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                transform: [
                  {
                    translateX: loadingMotion.interpolate({
                      inputRange: [-1, 1],
                      outputRange: [-110, 110],
                    }),
                  },
                ],
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
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
    width: 62,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4F46E5',
  },
});
