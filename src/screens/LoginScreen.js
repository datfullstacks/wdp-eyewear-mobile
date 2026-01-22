import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "../store/authStore";
import Toast from "react-native-toast-message";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export default function LoginScreen({ navigation }) {
  const login = useAuthStore((s) => s.login);
  const [apiError, setApiError] = useState("");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values) => {
    try {
      setApiError("");
      await login(values);
      // AppNavigation sẽ tự chuyển stack khi token có
      Toast.show({
        type: "success",
        text1: "Đăng nhập thành công",
        text2: "Đã lưu dữ liệu",
      });
    } catch (e) {
      setApiError(e?.response?.data?.message || "Đăng nhập thất bại");
      console.log("Login error", e);
    }
  };

  const renderInput = ({
    label,
    placeholder,
    secureTextEntry,
    keyboardType,
    autoCapitalize,
    name,
  }) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.55)"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            style={[
              styles.input,
              errors[name] ? styles.inputErrorBorder : null,
            ]}
          />
        )}
      />
      {!!errors[name] && (
        <Text style={styles.errorText}>{errors[name].message}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Dreamy background blobs */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.centerWrap}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Let’s continue your dreamy shopping ✨</Text>

            <View style={{ gap: 14, marginTop: 14 }}>
              {renderInput({
                label: "Email",
                placeholder: "john@example.com",
                name: "email",
                keyboardType: "email-address",
                autoCapitalize: "none",
              })}

              {renderInput({
                label: "Password",
                placeholder: "••••••••",
                name: "password",
                secureTextEntry: true,
                autoCapitalize: "none",
              })}
            </View>

            {!!apiError && (
              <View style={styles.apiErrorBox}>
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.button,
                isSubmitting ? { opacity: 0.65 } : null,
                pressed ? { transform: [{ scale: 0.99 }] } : null,
              ]}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? "Signing in..." : "Login"}
              </Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate("Register")}>
              <Text style={styles.footerText}>
                Chưa có tài khoản?{" "}
                <Text style={styles.footerLink}>Register</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = {
  root: {
    flex: 1,
    backgroundColor: "#0B1020",
  },
  centerWrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 22,
  },

  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: "hidden",
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(255,255,255,0.70)",
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.78)",
    letterSpacing: 0.2,
  },

  input: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.92)",
  },
  inputErrorBorder: {
    borderColor: "rgba(255,120,180,0.85)",
  },

  errorText: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(255,160,200,0.95)",
  },

  apiErrorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 80, 140, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 120, 180, 0.28)",
  },
  apiErrorText: {
    color: "rgba(255,200,220,0.95)",
    fontSize: 12,
    fontWeight: "600",
  },

  button: {
    marginTop: 14,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  footerText: {
    marginTop: 14,
    textAlign: "center",
    color: "rgba(255,255,255,0.70)",
    fontSize: 13,
  },
  footerLink: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "800",
    textDecorationLine: "underline",
  },

  blob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 260,
    opacity: 0.55,
  },
  blob1: {
    top: -80,
    left: -90,
    backgroundColor: "rgba(155, 120, 255, 0.45)",
  },
  blob2: {
    bottom: -120,
    right: -90,
    backgroundColor: "rgba(80, 200, 255, 0.35)",
  },
  blob3: {
    top: 220,
    right: -140,
    backgroundColor: "rgba(255, 120, 200, 0.22)",
  },
};
