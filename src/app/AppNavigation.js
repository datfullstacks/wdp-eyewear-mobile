// navigation/AppNavigation.js
import React, { useCallback, useEffect, useState } from "react";
import { NavigationContainer, CommonActions, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import { useSystemConfigStore } from "../store/systemConfigStore";
import { useFavoriteStore } from "../store/favoriteStore";
import { useSupportInboxStore } from "../store/supportInboxStore";

import LoginScreen from "../screens/LoginScreen";
import MaintenanceScreen from "../screens/MaintenanceScreen";
import RegisterScreen from "../screens/RegisterScreen";

import HomeScreen from "../screens/HomeScreen";
import ProductsScreen from "../screens/ProductsScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import CheckoutStatusScreen from "../screens/CheckoutStatusScreen";
import RefundRequestScreen from "../screens/RefundRequestScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OrdersScreen from "../screens/OrdersScreen";
import OrderDetailScreen from "../screens/OrderDetailScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import AddressBookScreen from "../screens/AddressBookScreen";
import PrescriptionScreen from "../screens/PrescriptionScreen";
// import PaymentsScreen from "../screens/PaymentsScreen";
import SupportScreen from "../screens/SupportScreen";
import SupportTicketDetailScreen from "../screens/SupportTicketDetailScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import TryOnARScreen from "../screens/TryOnARScreen";
import AppAlertHost from "../components/AppAlertHost";
import { installAppAlert } from "../store/appAlertStore";

import { getMyNotificationsApi } from "../services/userService";
import {
  connectRealtime,
  isNotificationRealtimeEvent,
} from "../services/realtimeService";

const PALETTE = {
  navy: "#0c2c5c",
  navySoft: "#17365D",
  navyTint: "#EEF3F8",
  gold: "#fcd675",
  goldSoft: "#F5E9C8",
  white: "#FFFFFF",
  bg: "#F7F8FA",
  text: "#162033",
  muted: "#6B7280",
  border: "#E3E8EF",
};

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HomeStack = createNativeStackNavigator();
const ProductsStack = createNativeStackNavigator();
const CartStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const FavoritesStack = createNativeStackNavigator();
const NotificationsStack = createNativeStackNavigator();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </HomeStack.Navigator>
  );
}

function ProductsStackScreen() {
  return (
    <ProductsStack.Navigator screenOptions={{ headerShown: false }}>
      <ProductsStack.Screen name="Products" component={ProductsScreen} />
      <ProductsStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </ProductsStack.Navigator>
  );
}

function CartStackScreen() {
  return (
    <CartStack.Navigator screenOptions={{ headerShown: false }}>
      <CartStack.Screen name="Cart" component={CartScreen} />
      <CartStack.Screen name="Checkout" component={CheckoutScreen} />
      <CartStack.Screen
        name="CheckoutStatus"
        component={CheckoutStatusScreen}
      />
      <CartStack.Screen
        name="RefundRequest"
        component={RefundRequestScreen}
      />
    </CartStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="Orders" component={OrdersScreen} />
      <ProfileStack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <ProfileStack.Screen name="AddressBook" component={AddressBookScreen} />
      <ProfileStack.Screen name="Prescription" component={PrescriptionScreen} />
      {/* <ProfileStack.Screen name="Payments" component={PaymentsScreen} /> */}
      <ProfileStack.Screen name="Support" component={SupportScreen} />
      <ProfileStack.Screen
        name="SupportTicketDetail"
        component={SupportTicketDetailScreen}
      />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
    </ProfileStack.Navigator>
  );
}

function NotificationsStackScreen({ onNotificationsChanged }) {
  return (
    <NotificationsStack.Navigator screenOptions={{ headerShown: false }}>
      <NotificationsStack.Screen name="Notifications">
        {(props) => (
          <NotificationsScreen
            {...props}
            onNotificationsChanged={onNotificationsChanged}
          />
        )}
      </NotificationsStack.Screen>
    </NotificationsStack.Navigator>
  );
}

// Favorites stack
function FavoritesStackScreen() {
  return (
    <FavoritesStack.Navigator screenOptions={{ headerShown: false }}>
      <FavoritesStack.Screen name="Favorites" component={FavoritesScreen} />
      <FavoritesStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </FavoritesStack.Navigator>
  );
}

function NotificationTabIcon({ color, focused, hasUnread }) {
  const iconName = focused ? "notifications" : "notifications-outline";

  return (
    <View style={styles.tabIconWrap}>
      <Ionicons name={iconName} size={22} color={color} />
      {hasUnread ? <View style={styles.notificationDot} /> : null}
    </View>
  );
}

function MainTabs({ navigation }) {
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const refreshSupportUnread = useSupportInboxStore((s) => s.refreshUnreadFromApi);

  const loadUnreadNotifications = useCallback(async () => {
    if (!token) {
      setHasUnreadNotifications(false);
      return;
    }

    try {
      const data = await getMyNotificationsApi();
      const list = Array.isArray(data) ? data : [];
      const unread = list.some((item) => !item?.readAt);
      setHasUnreadNotifications(unread);
    } catch {
      setHasUnreadNotifications(false);
    }
  }, [token]);

  useEffect(() => {
    loadUnreadNotifications();
  }, [loadUnreadNotifications]);

  useEffect(() => {
    if (!token) return;
    void refreshSupportUnread().catch(() => {});
  }, [token, refreshSupportUnread]);

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotifications();
      void refreshSupportUnread().catch(() => {});
    }, [loadUnreadNotifications, refreshSupportUnread])
  );

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      socket = connectRealtime(token, {
        onMessage: (payload) => {
          if (isNotificationRealtimeEvent(payload)) {
            void loadUnreadNotifications();
          }
          void refreshSupportUnread().catch(() => {});
        },
        onClose: () => {
          if (isDisposed) return;
          reconnectTimer = setTimeout(() => {
            connect();
          }, 2000);
        },
      });
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [token, loadUnreadNotifications, refreshSupportUnread]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: PALETTE.navy,
        tabBarInactiveTintColor: "black",
        tabBarLabelStyle: { fontSize: 12, paddingBottom: 2 },
        tabBarStyle: {
          height: 56 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 0,
          elevation: 12,
        },
        tabBarIcon: ({ color, focused }) => {
          let iconName = "home-outline";

          if (route.name === "HomeTab") {
            iconName = focused ? "home" : "home-outline";
            return <Ionicons name={iconName} size={22} color={color} />;
          }

          if (route.name === "ProductsTab") {
            iconName = focused ? "cube" : "cube-outline";
            return <Ionicons name={iconName} size={22} color={color} />;
          }

          if (route.name === "FavTab") {
            iconName = focused ? "heart" : "heart-outline";
            return <Ionicons name={iconName} size={22} color={color} />;
          }

          if (route.name === "NotificationTab") {
            return (
              <NotificationTabIcon
                color={color}
                focused={focused}
                hasUnread={hasUnreadNotifications}
              />
            );
          }

          if (route.name === "ProfileTab") {
            iconName = focused ? "person" : "person-outline";
            return <Ionicons name={iconName} size={22} color={color} />;
          }

          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={{ tabBarLabel: "Trang chủ" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.navigate({
                name: "HomeTab",
                params: { screen: "Home" },
              })
            );
          },
        })}
      />

      <Tab.Screen
        name="ProductsTab"
        component={ProductsStackScreen}
        options={{ tabBarLabel: "Sản phẩm" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.navigate({
                name: "ProductsTab",
                params: { screen: "Products" },
              })
            );
          },
        })}
      />

      <Tab.Screen
        name="FavTab"
        component={FavoritesStackScreen}
        options={{ tabBarLabel: "Yêu thích" }}
        listeners={{
          tabPress: (e) => {
            if (!token) {
              e.preventDefault();
              navigation.navigate("Login");
            }
          },
        }}
      />

      <Tab.Screen
        name="NotificationTab"
        options={{ tabBarLabel: "Thông báo" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!token) {
              e.preventDefault();
              navigation.navigate("Login");
            }
          },
        })}
      >
        {(props) => (
          <NotificationsStackScreen
            {...props}
            onNotificationsChanged={loadUnreadNotifications}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackScreen}
        options={{ tabBarLabel: "Tài khoản" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!token) {
              e.preventDefault();
              navigation.navigate("Login");
              return;
            }
            e.preventDefault();
            navigation.dispatch(
              CommonActions.navigate({
                name: "ProfileTab",
                params: { screen: "Profile" },
              })
            );
          },
        })}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigation() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isHydratingAuth = useAuthStore((s) => s.isHydrating);
  const userKey = useAuthStore((s) => s.userKey);
  const user = useAuthStore((s) => s.user);
  const hydrateSystemConfig = useSystemConfigStore((s) => s.hydrate);
  const runtimeConfig = useSystemConfigStore((s) => s.config);
  const isHydratingRuntimeConfig = useSystemConfigStore((s) => s.isHydrating);

  const setCartUser = useCartStore((s) => s.setUser);
  const isHydratingCart = useCartStore((s) => s.isHydrating);
  const setSupportInboxUser = useSupportInboxStore((s) => s.setUser);
  const refreshSupportUnread = useSupportInboxStore((s) => s.refreshUnreadFromApi);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    hydrateSystemConfig();
  }, [hydrateSystemConfig]);

  useEffect(() => {
    if (!isHydratingAuth) {
      setCartUser(userKey);
      setSupportInboxUser(userKey);
      if (userKey) {
        void refreshSupportUnread().catch(() => {});
      }
    }
  }, [isHydratingAuth, userKey, setCartUser, setSupportInboxUser, refreshSupportUnread]);

  useEffect(() => {
    installAppAlert();
  }, []);

  if (isHydratingAuth || isHydratingCart || isHydratingRuntimeConfig) return null;

  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";
  const maintenanceMode = runtimeConfig?.maintenanceMode === true;

  return (
    <NavigationContainer>
      <>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {maintenanceMode && !isAdmin ? (
            <>
              <RootStack.Screen name="Maintenance" component={MaintenanceScreen} />
              <RootStack.Screen name="Login" component={LoginScreen} />
              <RootStack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            <>
              <RootStack.Screen name="Tabs" component={MainTabs} />
              <RootStack.Screen name="TryOnAR" component={TryOnARScreen} />
              <RootStack.Screen name="Login" component={LoginScreen} />
              <RootStack.Screen name="Register" component={RegisterScreen} />
              <RootStack.Screen name="CartFlow" component={CartStackScreen} />
              <RootStack.Screen name="Support" component={SupportScreen} />
              <RootStack.Screen
                name="SupportTicketDetail"
                component={SupportTicketDetailScreen}
              />
            </>
          )}
        </RootStack.Navigator>
        <AppAlertHost />
      </>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    top: -1,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
});
