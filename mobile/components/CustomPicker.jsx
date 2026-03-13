import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

export default function CustomPicker({ label, value, options, onSelect, placeholder = "Select an option" }) {
  const [modalVisible, setModalVisible] = useState(false);
  
  const selectedOption = options.find(opt => opt.value === value);
  
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity 
        style={styles.picker}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[
          styles.pickerText,
          !selectedOption && styles.placeholderText
        ]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={24} color={COLORS.textSecondary} />
      </TouchableOpacity>
      
      {/* Modal for options */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || "Select"}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.selectedOption
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    item.value === value && styles.selectedOptionText
                  ]}>
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <MaterialIcons name="check" size={20} color={COLORS.success} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  
  label: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  
  pickerText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
    flex: 1,
  },
  
  placeholderText: {
    color: COLORS.textMuted,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '60%',
    overflow: 'hidden',
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  
  modalTitle: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
  },
  
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  
  selectedOption: {
    backgroundColor: COLORS.background,
  },
  
  optionText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
  },
  
  selectedOptionText: {
    fontFamily: FONTS.semibold,
    color: COLORS.success,
  },
});
