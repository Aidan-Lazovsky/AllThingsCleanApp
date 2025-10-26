import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export default function CategoryChip({ 
  label, 
  selected = false, 
  onPress,
  style 
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected && styles.chipActive,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  chipTextActive: {
    color: '#fff',
  },
});