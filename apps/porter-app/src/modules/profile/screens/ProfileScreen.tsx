import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootState } from '../../../store';
import { logout } from '../../../store/slices/authSlice';
import { ProfileStackParamList } from '../../../navigation/ProfileNavigator';

type ProfileScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

interface Props {
  navigation: ProfileScreenNavigationProp;
}

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => dispatch(logout()), style: 'destructive' },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'P'}</Text>
        </View>
        <Text style={styles.name}>{user?.name || 'Porter'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.badge, user?.verified ? styles.badgeVerified : styles.badgeUnverified]}>
          <Text style={styles.badgeText}>{user?.verified ? 'Verified' : 'Pending Verification'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('EditProfile')}>
        <Text style={styles.menuItemText}>Edit Profile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Verification')}>
        <Text style={styles.menuItemText}>Verification Documents</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Ratings')}>
        <Text style={styles.menuItemText}>Ratings & Reviews</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.menuItemText}>Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.menuItem, styles.logoutButton]} onPress={handleLogout}>
        <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', padding: 30, alignItems: 'center', marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  email: { fontSize: 14, color: '#666', marginBottom: 10 },
  badge: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20 },
  badgeVerified: { backgroundColor: '#4CAF50' },
  badgeUnverified: { backgroundColor: '#FF9800' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  menuItem: { backgroundColor: '#fff', padding: 20, marginHorizontal: 15, marginBottom: 10, borderRadius: 8 },
  menuItemText: { fontSize: 16, color: '#333' },
  logoutButton: { marginTop: 20 },
  logoutText: { color: '#f44336', fontWeight: 'bold' },
});
