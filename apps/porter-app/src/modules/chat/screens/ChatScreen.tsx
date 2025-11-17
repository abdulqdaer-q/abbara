import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';

interface Message {
  id: string;
  text: string;
  sender: 'porter' | 'customer';
  timestamp: Date;
}

export const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');

  const sendMessage = () => {
    if (!inputText.trim()) return;
    setMessages([...messages, { id: Date.now().toString(), text: inputText, sender: 'porter', timestamp: new Date() }]);
    setInputText('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.messageContainer, item.sender === 'porter' ? styles.porterMessage : styles.customerMessage]}>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No messages yet</Text></View>}
      />
      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Type a message..." value={inputText} onChangeText={setInputText} multiline />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  messageContainer: { maxWidth: '80%', padding: 12, margin: 8, borderRadius: 12 },
  porterMessage: { alignSelf: 'flex-end', backgroundColor: '#4CAF50' },
  customerMessage: { alignSelf: 'flex-start', backgroundColor: '#fff' },
  messageText: { fontSize: 16, color: '#333' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginRight: 10, maxHeight: 100 },
  sendButton: { backgroundColor: '#4CAF50', borderRadius: 20, paddingHorizontal: 20, justifyContent: 'center' },
  sendButtonText: { color: '#fff', fontWeight: 'bold' },
});
