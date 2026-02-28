// navigation/AppNavigation.js
import React, { useEffect } from "react";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import { useFavoriteStore } from "../store/favoriteStore";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

import HomeScreen from "../screens/HomeScreen";
import ProductsScreen from "../screens/ProductsScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import CheckoutStatusScreen from "../screens/CheckoutStatusScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OrdersScreen from "../screens/OrdersScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import AddressBookScreen from "../screens/AddressBookScreen";
import PrescriptionScreen from "../screens/PrescriptionScreen";
import PaymentsScreen from "../screens/PaymentsScreen";
import SupportScreen from "../screens/SupportScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import TryOnARScreen from "../screens/TryOnARScreen";

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HomeStack = createNativeStackNavigator();
const ProductsStack = createNativeStackNavigator();
const CartStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const FavoritesStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();

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
      <ProfileStack.Screen name="AddressBook" component={AddressBookScreen} />
      <ProfileStack.Screen name="Prescription" component={PrescriptionScreen} />
      <ProfileStack.Screen name="Payments" component={PaymentsScreen} />
      <ProfileStack.Screen name="Support" component={SupportScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
    </ProfileStack.Navigator>
  );
}

function OrdersStackScreen() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="Orders" component={OrdersScreen} />
    </OrdersStack.Navigator>
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

function MainTabs({ navigation }) {
  const token = useAuthStore((s) => s.token);
  const insets = useSafeAreaInsets();

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
          if (route.name === "HomeTab") iconName = focused ? "home" : "home-outline";
          if (route.name === "ProductsTab") iconName = focused ? "cube" : "cube-outline";
          if (route.name === "FavTab") iconName = focused ? "heart" : "heart-outline";
          if (route.name === "OrdersTab") iconName = focused ? "clipboard" : "clipboard-outline";
          if (route.name === "ProfileTab") iconName = focused ? "person" : "person-outline";
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
        name="OrdersTab"
        component={OrdersStackScreen}
        options={{ tabBarLabel: "Đơn hàng" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (!token) {
              e.preventDefault();
              navigation.navigate("Login");
            }
          },
        })}
      />

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

  // cart: setUser sẽ tự hydrate theo key user
  const setCartUser = useCartStore((s) => s.setUser);
  const isHydratingCart = useCartStore((s) => s.isHydrating);

  // fav: setUser sẽ tự hydrate theo key user
  const setFavUser = useFavoriteStore((s) => s.setUser);
  const isHydratingFav = useFavoriteStore((s) => s.isHydrating);

  // 1) hydrate auth trước
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // 2) auth hydrate xong => set user cho cart + fav (tự hydrate đúng storage key)
  useEffect(() => {
    if (!isHydratingAuth) {
      setCartUser(userKey);
      setFavUser(userKey);
    }
  }, [isHydratingAuth, userKey, setCartUser, setFavUser]);

  if (isHydratingAuth || isHydratingCart || isHydratingFav) return null;

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
