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
// import { useFavoriteStore } from "../store/favoriteStore";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

import HomeScreen from "../screens/HomeScreen";
import ProductsScreen from "../screens/ProductsScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import CheckoutStatusScreen from "../screens/CheckoutStatusScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OrdersScreen from "../screens/OrdersScreen";
import OrderDetailScreen from "../screens/OrderDetailScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import AddressBookScreen from "../screens/AddressBookScreen";
import PrescriptionScreen from "../screens/PrescriptionScreen";
import PaymentsScreen from "../screens/PaymentsScreen";
import SupportScreen from "../screens/SupportScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import TryOnARScreen from "../screens/TryOnARScreen";

import { getMyNotificationsApi } from "../services/userService";
import {
  connectRealtime,
  isNotificationRealtimeEvent,
} from "../services/realtimeService";

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
      <CartStack.Screen name="CheckoutStatus" component={CheckoutStatusScreen} />
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
      <ProfileStack.Screen name="Payments" component={PaymentsScreen} />
      <ProfileStack.Screen name="Support" component={SupportScreen} />
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

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotifications();
    }, [loadUnreadNotifications])
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
          if (!isNotificationRealtimeEvent(payload)) return;
          void loadUnreadNotifications();
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
  }, [token, loadUnreadNotifications]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#EF4444",
        tabBarInactiveTintColor: "#6B7280",
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
        listeners={{
          tabPress: (e) => {
            if (!token) {
              e.preventDefault();
              navigation.navigate("Login");
            }
          },
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigation() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const isHydratingAuth = useAuthStore((s) => s.isHydrating);
  const userKey = useAuthStore((s) => s.userKey);

  const setCartUser = useCartStore((s) => s.setUser);
  const isHydratingCart = useCartStore((s) => s.isHydrating);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (!isHydratingAuth) {
      setCartUser(userKey);
    }
  }, [isHydratingAuth, userKey, setCartUser]);

  if (isHydratingAuth || isHydratingCart) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={MainTabs} />
        <RootStack.Screen name="TryOnAR" component={TryOnARScreen} />
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Register" component={RegisterScreen} />
        <RootStack.Screen name="CartFlow" component={CartStackScreen} />
      </RootStack.Navigator>
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