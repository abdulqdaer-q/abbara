import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../utils/theme';

export const ChatScreen = ({ route }: any) => {
  const { orderId, porterName } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

  const handleSend = () => {
    if (message.trim()) {
      setMessages([...messages, { id: Date.now(), text: message, sender: 'me', timestamp: new Date() }]);
      setMessage('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <FlatList data={messages} keyExtractor={(item) => item.id.toString()} renderItem={({ item }) => (
          <View style={[styles.messageBubble, item.sender === 'me' ? styles.myMessage : styles.theirMessage]}>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )} contentContainerStyle={styles.messagesList} />
        <View style={styles.inputContainer}>
          <TextInput value={message} onChangeText={setMessage} placeholder="Type a message..." mode="outlined" style={styles.input} dense />
          <IconButton icon="send" size={24} onPress={handleSend} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  keyboardView: { flex: 1 },
  messagesList: { padding: spacing.md },
  messageBubble: { maxWidth: '80%', padding: spacing.md, borderRadius: 12, marginBottom: spacing.sm },
  myMessage: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: colors.gray[200] },
  messageText: { ...typography.body2 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.primary },
  input: { flex: 1, marginRight: spacing.sm },
});
