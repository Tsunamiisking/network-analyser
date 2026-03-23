import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS } from '../constants/theme';

export default function RadioButtonGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              value === option.value && styles.selectedOption
            ]}
            onPress={() => onChange(option.value)}
          >
            <View style={styles.optionContent}>
              <View style={styles.radio}>
                {value === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
              
              {option.icon && (
                <MaterialIcons 
                  name={option.icon} 
                  size={20} 
                  color={value === option.value ? COLORS.info : COLORS.textSecondary} 
                />
              )}
              
              <View style={styles.textContainer}>
                <Text style={[
                  styles.optionText,
                  value === option.value && styles.selectedOptionText
                ]}>
                  {option.label}
                </Text>
                {option.description && (
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  
  label: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  
  optionsContainer: {
    gap: SPACING.sm,
  },
  
  option: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  
  selectedOption: {
    borderColor: COLORS.info,
    backgroundColor: COLORS.background,
  },
  
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.info,
  },
  
  textContainer: {
    flex: 1,
  },
  
  optionText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
  },
  
  selectedOptionText: {
    fontFamily: FONTS.semibold,
    color: COLORS.info,
  },
  
  optionDescription: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
