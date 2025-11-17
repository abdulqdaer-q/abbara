import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';

interface NotificationSettings {
  jobOffers: boolean;
  messages: boolean;
  earnings: boolean;
  promotions: boolean;
  systemUpdates: boolean;
}

interface AppSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoAcceptJobs: boolean;
  mapType: 'standard' | 'satellite' | 'hybrid';
  distanceUnit: 'mi' | 'km';
  language: string;
}

export const SettingsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationSettings>({
    jobOffers: true,
    messages: true,
    earnings: true,
    promotions: false,
    systemUpdates: true,
  });

  const [appSettings, setAppSettings] = useState<AppSettings>({
    darkMode: false,
    soundEnabled: true,
    vibrationEnabled: true,
    autoAcceptJobs: false,
    mapType: 'standard',
    distanceUnit: 'mi',
    language: 'English',
  });

  const updateNotification = (key: keyof NotificationSettings, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const updateAppSetting = (key: keyof AppSettings, value: any) => {
    setAppSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear the app cache?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Clear cache logic
            Alert.alert('Success', 'Cache cleared successfully');
          },
        },
      ]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to default. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setNotifications({
              jobOffers: true,
              messages: true,
              earnings: true,
              promotions: false,
              systemUpdates: true,
            });
            setAppSettings({
              darkMode: false,
              soundEnabled: true,
              vibrationEnabled: true,
              autoAcceptJobs: false,
              mapType: 'standard',
              distanceUnit: 'mi',
              language: 'English',
            });
            Alert.alert('Success', 'Settings reset to default');
          },
        },
      ]
    );
  };

  const renderSettingItem = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    description?: string
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 Notifications</Text>
        <View style={styles.card}>
          {renderSettingItem(
            'Job Offers',
            notifications.jobOffers,
            (value) => updateNotification('jobOffers', value),
            'Get notified when new jobs are available'
          )}
          {renderSettingItem(
            'Messages',
            notifications.messages,
            (value) => updateNotification('messages', value),
            'Notifications for new customer messages'
          )}
          {renderSettingItem(
            'Earnings',
            notifications.earnings,
            (value) => updateNotification('earnings', value),
            'Updates on your earnings and withdrawals'
          )}
          {renderSettingItem(
            'Promotions',
            notifications.promotions,
            (value) => updateNotification('promotions', value),
            'Special offers and bonus opportunities'
          )}
          {renderSettingItem(
            'System Updates',
            notifications.systemUpdates,
            (value) => updateNotification('systemUpdates', value),
            'Important app updates and announcements'
          )}
        </View>
      </View>

      {/* App Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ App Settings</Text>
        <View style={styles.card}>
          {renderSettingItem(
            'Dark Mode',
            appSettings.darkMode,
            (value) => updateAppSetting('darkMode', value),
            'Use dark theme throughout the app'
          )}
          {renderSettingItem(
            'Sound',
            appSettings.soundEnabled,
            (value) => updateAppSetting('soundEnabled', value),
            'Play sounds for notifications'
          )}
          {renderSettingItem(
            'Vibration',
            appSettings.vibrationEnabled,
            (value) => updateAppSetting('vibrationEnabled', value),
            'Vibrate for important alerts'
          )}
          {renderSettingItem(
            'Auto-Accept Jobs',
            appSettings.autoAcceptJobs,
            (value) => updateAppSetting('autoAcceptJobs', value),
            'Automatically accept jobs matching your preferences'
          )}

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Map Type</Text>
              <Text style={styles.settingDescription}>Current: {appSettings.mapType}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Distance Unit</Text>
              <Text style={styles.settingDescription}>
                {appSettings.distanceUnit === 'mi' ? 'Miles' : 'Kilometers'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Language</Text>
              <Text style={styles.settingDescription}>{appSettings.language}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Job Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Job Preferences</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Preferred Job Types</Text>
              <Text style={styles.settingDescription}>Furniture, Apartment Move</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Maximum Distance</Text>
              <Text style={styles.settingDescription}>15 miles</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Working Hours</Text>
              <Text style={styles.settingDescription}>9:00 AM - 6:00 PM</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Account</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Payment Methods</Text>
              <Text style={styles.settingDescription}>Manage bank accounts</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Vehicle Information</Text>
              <Text style={styles.settingDescription}>Update vehicle details</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Documents</Text>
              <Text style={styles.settingDescription}>License, insurance, etc.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Change Password</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>❓ Support & Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Help Center</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Contact Support</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Terms of Service</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>App Version</Text>
            <Text style={styles.versionText}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Advanced Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔧 Advanced</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingItem} onPress={handleClearCache}>
            <Text style={styles.settingLabel}>Clear Cache</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleResetSettings}>
            <Text style={[styles.settingLabel, { color: '#f44336' }]}>Reset Settings</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', paddingHorizontal: 15, marginBottom: 10, marginTop: 10 },
  card: { backgroundColor: '#fff' },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingLeft: { flex: 1, marginRight: 15 },
  settingLabel: { fontSize: 16, color: '#333', marginBottom: 2 },
  settingDescription: { fontSize: 12, color: '#999', marginTop: 2 },
  chevron: { fontSize: 20, color: '#ccc' },
  versionText: { fontSize: 14, color: '#999' },
});
