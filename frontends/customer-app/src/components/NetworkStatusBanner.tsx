import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Animated, Dimensions } from 'react-native';
import { useIsOnline } from '../hooks/useNetworkStatus';
import { offlineQueueService } from '../services/offline-queue.service';

const { width } = Dimensions.get('window');

/**
 * Network status banner component
 * Shows offline/online status and pending sync actions
 */
export function NetworkStatusBanner() {
  const isOnline = useIsOnline();
  const [previousOnlineState, setPreviousOnlineState] = useState(isOnline);
  const [slideAnim] = useState(new Animated.Value(-60));
  const [pendingActions, setPendingActions] = useState(0);
  const [showBanner, setShowBanner] = useState(!isOnline);

  // Check pending actions count
  useEffect(() => {
    const updatePendingCount = () => {
      setPendingActions(offlineQueueService.getQueueSize());
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 2000);

    return () => clearInterval(interval);
  }, []);

  // Handle online/offline transitions
  useEffect(() => {
    if (isOnline !== previousOnlineState) {
      setPreviousOnlineState(isOnline);

      if (!isOnline) {
        // Going offline - show banner
        setShowBanner(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      } else {
        // Coming back online - sync and hide after delay
        if (offlineQueueService.hasPendingActions()) {
          // Show "syncing" state briefly
          setShowBanner(true);
          offlineQueueService.sync().then(() => {
            // Hide banner after sync
            setTimeout(() => {
              Animated.timing(slideAnim, {
                toValue: -60,
                duration: 300,
                useNativeDriver: true,
              }).start(() => setShowBanner(false));
            }, 2000);
          });
        } else {
          // No pending actions, hide immediately
          Animated.timing(slideAnim, {
            toValue: -60,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowBanner(false));
        }
      }
    }
  }, [isOnline, previousOnlineState]);

  if (!showBanner) {
    return null;
  }

  const backgroundColor = isOnline ? '#4CAF50' : '#FF9800';
  const message = isOnline
    ? pendingActions > 0
      ? `Back online - Syncing ${pendingActions} action${pendingActions > 1 ? 's' : ''}...`
      : 'Back online'
    : pendingActions > 0
    ? `No connection - ${pendingActions} action${pendingActions > 1 ? 's' : ''} pending`
    : 'No connection';

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.indicator, { backgroundColor: isOnline ? '#fff' : '#FFF3E0' }]} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
