import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Avatar, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { colors, spacing, typography } from '../../utils/theme';

export const ProfileScreen = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: async () => await logout(), style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.profileHeader}>
          <Avatar.Text size={80} label={user?.displayName?.charAt(0).toUpperCase() || 'U'} />
          <Text style={styles.name}>{user?.displayName}</Text>
          <Text style={styles.email}>{user?.email || user?.phone}</Text>
        </View>
        <View style={styles.section}>
          <List.Section>
            <List.Item title="Edit Profile" left={props => <List.Icon {...props} icon="account-edit" />} onPress={() => {}} />
            <List.Item title="Order History" left={props => <List.Icon {...props} icon="history" />} onPress={() => {}} />
            <List.Item title="Payment Methods" left={props => <List.Icon {...props} icon="credit-card" />} onPress={() => {}} />
            <List.Item title="Notifications" left={props => <List.Icon {...props} icon="bell" />} onPress={() => {}} />
            <List.Item title="Help & Support" left={props => <List.Icon {...props} icon="help-circle" />} onPress={() => {}} />
            <List.Item title="Settings" left={props => <List.Icon {...props} icon="cog" />} onPress={() => {}} />
          </List.Section>
        </View>
        <View style={styles.logoutContainer}>
          <Button mode="outlined" onPress={handleLogout} style={styles.logoutButton} textColor={colors.error}>Logout</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  profileHeader: { alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border.primary },
  name: { ...typography.h4, color: colors.text.primary, marginTop: spacing.md },
  email: { ...typography.body2, color: colors.text.secondary, marginTop: spacing.xs },
  section: { marginTop: spacing.md },
  logoutContainer: { padding: spacing.lg },
  logoutButton: { borderColor: colors.error },
});
