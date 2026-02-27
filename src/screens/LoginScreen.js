import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "../store/authStore";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../services/supabaseClient";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({ path: "auth/callback" });

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export default function LoginScreen({ navigation }) {
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [apiError, setApiError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const createSessionFromUrl = useCallback(async (url) => {
    const { params, errorCode } = QueryParams.getQueryParams(url);
    if (errorCode) throw new Error(errorCode);

    const access_token = params.access_token;
    const refresh_token = params.refresh_token;
    if (!access_token || !refresh_token) return null;

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    return { session: data.session, access_token };
  }, []);
  
  const handleGoogleSignIn = useCallback(async () => {
    try {
      setApiError("");
      setGoogleLoading(true);

      console.log("redirectTo =", redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      const res = await WebBrowser.openAuthSessionAsync(
        data.url ?? "",
        redirectTo
      );

      if (res.type === "success") {
        const result = await createSessionFromUrl(res.url);
        if (!result?.access_token) {
          throw new Error("Không lấy được access_token từ Supabase");
        }
        await loginWithGoogle({ accessToken: result.access_token });

        Toast.show({
          type: "success",
          text1: "Đăng nhập Google thành công",
          text2: "Chào mừng bạn! 🎉",
        });
        navigation.replace("Tabs");
      }
    } catch (e) {
      setApiError(
        e?.response?.data?.message || e?.message || "Đăng nhập Google thất bại"
      );
      console.log("Google sign-in error", e);
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithGoogle, navigation, createSessionFromUrl]);

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

      Toast.show({
        type: "success",
        text1: "Đăng nhập thành công",
        text2: "Đã lưu dữ liệu",
      });

      navigation.replace("Tabs");
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
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            placeholder={placeholder}
            placeholderTextColor="rgba(15, 23, 42, 0.45)"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            style={[styles.input, errors[name] ? styles.inputErrorBorder : null]}
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
      {/* Soft pastel blobs */}
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
            <Text style={styles.title}>Đăng Nhập</Text>
            <Text style={styles.subtitle}>
              Hãy tiếp tục chuyến mua sắm trong mơ của bạn!✨
            </Text>

            <View style={{ gap: 14, marginTop: 18 }}>
              {renderInput({
                label: "Email",
                placeholder: "john@example.com",
                name: "email",
                keyboardType: "email-address",
                autoCapitalize: "none",
              })}

              {renderInput({
                label: "Mật khẩu",
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
                isSubmitting ? { opacity: 0.7 } : null,
                pressed ? { transform: [{ scale: 0.99 }] } : null,
              ]}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? "Đang đăng nhập..." : "Đăng Nhập"}
              </Text>
            </Pressable>

            {/* --- Divider --- */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* --- Google Sign-In Button --- */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              style={({ pressed }) => [
                styles.googleButton,
                googleLoading ? { opacity: 0.7 } : null,
                pressed ? { transform: [{ scale: 0.99 }] } : null,
              ]}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <Ionicons
                  name="logo-google"
                  size={20}
                  color="#4285F4"
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.googleButtonText}>
                {googleLoading
                  ? "Đang xử lý..."
                  : "Đăng nhập với Google"}
              </Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate("Register")}>
              <Text style={styles.footerText}>
                Chưa có tài khoản?{" "}
                <Text style={styles.footerLink}>Đăng ký</Text>
              </Text>
            </Pressable>

            {/* Optional: nút quay về Home nếu user không muốn login */}
            <Pressable onPress={() => navigation.replace("Tabs")}>
              <Text style={[styles.footerText, { marginTop: 10 }]}>
                Hoặc{" "}
                <Text style={styles.footerLink}>Tiếp tục xem Trang chủ</Text>
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
    backgroundColor: "#F6F7FB",
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
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.65)",
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(15, 23, 42, 0.7)",
    letterSpacing: 0.2,
  },

  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "rgba(15, 23, 42, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.10)",
    color: "#0F172A",
  },
  inputErrorBorder: {
    borderColor: "rgba(239, 68, 68, 0.65)",
    backgroundColor: "rgba(239, 68, 68, 0.04)",
  },

  errorText: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(239, 68, 68, 0.9)",
    fontWeight: "600",
  },

  apiErrorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.18)",
  },
  apiErrorText: {
    color: "rgba(185, 28, 28, 0.95)",
    fontSize: 12,
    fontWeight: "700",
  },

  button: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  buttonText: {
    color: "rgba(255,255,255,0.98)",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  footerText: {
    marginTop: 14,
    textAlign: "center",
    color: "rgba(15, 23, 42, 0.65)",
    fontSize: 13,
  },
  footerLink: {
    color: "#4F46E5",
    fontWeight: "900",
    textDecorationLine: "underline",
  },

  blob: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 280,
    opacity: 0.55,
  },
  blob1: {
    top: -90,
    left: -110,
    backgroundColor: "rgba(99, 102, 241, 0.25)",
  },
  blob2: {
    bottom: -130,
    right: -100,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
  },
  blob3: {
    top: 220,
    right: -150,
    backgroundColor: "rgba(236, 72, 153, 0.14)",
  },

  /* Divider */
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(15, 23, 42, 0.10)",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(15, 23, 42, 0.45)",
  },

  /* Google button */
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "rgba(15, 23, 42, 0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1F2A37",
    letterSpacing: 0.2,
  },
};
