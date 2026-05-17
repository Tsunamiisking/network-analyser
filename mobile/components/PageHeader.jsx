import { View, Text, StyleSheet } from "react-native";
import React from "react";
import { COLORS, FONTS, FONT_SIZES } from "../constants/theme";

const PageHeader = ({ title }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 64,
    backgroundColor: COLORS.background,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    justifyContent: "center",
  },
  headerText: {
    fontFamily: FONTS.header, // Poppins Bold
    fontSize: FONT_SIZES.header, // 24px
    color: COLORS.textPrimary,
    padding: 16,
    // textAlign: 'left'
  },
});
export default PageHeader;
