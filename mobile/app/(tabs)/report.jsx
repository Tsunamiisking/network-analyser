import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import PageHeader from '../../components/PageHeader';
import CustomPicker from '../../components/CustomPicker';
import RadioButtonGroup from '../../components/RadioButtonGroup';
import { submitReport } from '../../services/api';
import { COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const PROVIDER_OPTIONS = [
  { label: 'MTN', value: 'MTN' },
  { label: 'Airtel', value: 'Airtel' },
  { label: 'Glo', value: 'Glo' },
  { label: '9mobile', value: '9mobile' },
];

const WHEN_OPTIONS = [
  { label: 'Just now',       minutesAgo: 0   },
  { label: '~30 min ago',    minutesAgo: 30  },
  { label: '~1 hour ago',    minutesAgo: 60  },
  { label: '~2 hours ago',   minutesAgo: 120 },
  { label: 'Earlier today',  minutesAgo: 480 },
];

const ISSUE_TYPE_OPTIONS = [
  { 
    label: 'No Signal', 
    value: 'No Signal',
    icon: 'signal-cellular-off',
    description: 'Device shows no network bars'
  },
  { 
    label: 'No Data', 
    value: 'No Data',
    icon: 'cloud-off',
    description: 'Connected but no internet access'
  },
  { 
    label: 'Slow Internet', 
    value: 'Slow Internet',
    icon: 'network-check',
    description: 'Very slow data speeds'
  },
  { 
    label: 'Call Drop', 
    value: 'Call Drop',
    icon: 'phone-missed',
    description: 'Calls frequently disconnect'
  },
];

export default function Report() {
  const [provider, setProvider] = useState('');
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [whenHappened, setWhenHappened] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    // Validation
    if (!provider) {
      Alert.alert('Missing Field', 'Please select a network provider');
      return;
    }
    
    if (!issueType) {
      Alert.alert('Missing Field', 'Please select an issue type');
      return;
    }

    // Get current location
    setIsSubmitting(true);
    
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Please enable location access to submit a report. This helps us identify problem areas.',
          [{ text: 'OK' }]
        );
        setIsSubmitting(false);
        return;
      }

      // Get current position
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const occurredAt = whenHappened !== null
        ? new Date(Date.now() - whenHappened.minutesAgo * 60000).toISOString()
        : undefined;

      const reportData = {
        provider,
        issueType,
        description: description.trim(),
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        ...(occurredAt ? { occurredAt } : {}),
      };

      // Submit to backend
      const response = await submitReport(reportData);
      
      setIsSubmitting(false);
      
      if (response.success) {
        Alert.alert(
          'Report Submitted! 🎉',
          'Thank you for reporting this network issue. Your feedback helps improve coverage mapping.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setProvider('');
                setIssueType('');
                setDescription('');
                setWhenHappened(null);
              }
            }
          ]
        );
      } else {
        throw new Error(response.message || 'Failed to submit report');
      }
      
    } catch (error) {
      console.error('Report submission failed:', error);
      setIsSubmitting(false);
      Alert.alert(
        'Submission Failed',
        error.message || 'Failed to submit report. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const isFormValid = provider && issueType;
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="Report Outage" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={'padding'}
        // keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Info */}
          <View style={styles.headerInfo}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="report-problem" size={56} color={COLORS.warning} />
            </View>
            <Text style={styles.headerTitle}>Report Network Issue</Text>
            <Text style={styles.headerSubtitle}>
              Report recent or intermittent network issues like slow speeds, call drops, or connectivity problems
            </Text>
          </View>
          
          {/* Form */}
          <View style={styles.form}>
            {/* Provider Dropdown */}
            <CustomPicker
              label="Network Provider"
              placeholder="Select your provider"
              value={provider}
              options={PROVIDER_OPTIONS}
              onSelect={setProvider}
            />
            
            {/* Issue Type Radio Buttons */}
            <RadioButtonGroup
              label="Issue Type"
              options={ISSUE_TYPE_OPTIONS}
              value={issueType}
              onChange={setIssueType}
            />
            
            {/* Description Text Area */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Additional Details (Optional)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the issue you're experiencing..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
                maxLength={500}
              />
              <Text style={styles.charCount}>
                {description.length}/500
              </Text>
            </View>
            
            {/* When did this happen? */}
            <View style={styles.whenContainer}>
              <Text style={styles.label}>When did this happen? (Optional)</Text>
              <View style={styles.whenChips}>
                {WHEN_OPTIONS.map((opt) => {
                  const selected = whenHappened?.minutesAgo === opt.minutesAgo;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.whenChip, selected && styles.whenChipSelected]}
                      onPress={() => setWhenHappened(selected ? null : opt)}
                    >
                      <Text style={[styles.whenChipText, selected && styles.whenChipTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {whenHappened !== null && (
                <Text style={styles.whenHint}>
                  Issue will be marked as occurring ~{whenHappened.minutesAgo} min before submission
                </Text>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                !isFormValid && styles.submitButtonDisabled,
                isSubmitting && styles.submitButtonSubmitting
              ]}
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color={COLORS.textPrimary} />
                  <Text style={styles.submitButtonText}>Submitting...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="send" size={20} color={COLORS.textPrimary} />
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
            
            {/* Info Note */}
            <View style={styles.infoNote}>
              <MaterialIcons name="info-outline" size={18} color={COLORS.info} />
              <Text style={styles.infoNoteText}>
                For complete outages, our automatic background collection system captures dead zones. Use this form for intermittent issues or recently-resolved problems.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  keyboardView: {
    flex: 1,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  
  headerInfo: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingTop: SPACING.md,
  },
  
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.warning + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  
  headerTitle: {
    fontFamily: FONTS.header,
    fontSize: FONT_SIZES.header,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  
  form: {
    marginTop: SPACING.md,
  },
  
  inputContainer: {
    marginBottom: SPACING.sm,
  },
  
  label: {
    fontFamily: FONTS.headerSemibold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  
  textArea: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
    minHeight: 120,
    maxHeight: 200,
  },
  
  charCount: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.sm,
  },

  whenContainer: {
    marginBottom: SPACING.sm,
  },

  whenChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },

  whenChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },

  whenChipSelected: {
    borderColor: COLORS.info,
    backgroundColor: COLORS.info + '20',
  },

  whenChipText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },

  whenChipTextSelected: {
    fontFamily: FONTS.headerSemibold,
    color: COLORS.info,
  },

  whenHint: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.tiny,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.info,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
    ...SHADOWS.medium,
  },
  
  submitButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.5,
  },
  
  submitButtonSubmitting: {
    backgroundColor: COLORS.textMuted,
  },
  
  submitButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
  },
  
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.info + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.info + '30',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
  },
  
  infoNoteText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});