// navigation/AppNavigation.js
import React, { useEffect } from "react";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../store/cartStore";
import { useFavoriteStore } from "../store/favoriteStore"; // ✅ add

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";

import HomeScreen from "../screens/HomeScreen";
import ProductsScreen from "../screens/ProductsScreen";
import CartScreen from "../screens/CartScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import FavoritesScreen from "../screens/FavoritesScreen"; // ✅ add

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HomeStack = createNativeStackNavigator();
const ProductsStack = createNativeStackNavigator();
const CartStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const FavoritesStack = createNativeStackNavigator(); // ✅ add

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
    </CartStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
    </ProfileStack.Navigator>
  );
}

// ✅ Favorites stack
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
          if (route.name === "FavTab") iconName = focused ? "heart" : "heart-outline"; // ✅ add
          if (route.name === "CartTab") iconName = focused ? "clipboard" : "clipboard-outline";
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

      {/* ✅ Favorites Tab */}
      <Tab.Screen
        name="FavTab"
        component={FavoritesStackScreen}
        options={{ tabBarLabel: "Yêu thích" }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.navigate({
                name: "FavTab",
                params: { screen: "Favorites" },
              })
            );
          },
        })}
      />

      <Tab.Screen
        name="CartTab"
        component={CartStackScreen}
        options={{ tabBarLabel: "Đơn hàng" }}
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

  const hydrateCart = useCartStore((s) => s.hydrate);
  const isHydratingCart = useCartStore((s) => s.isHydrating);

  // ✅ hydrate favorites
  const hydrateFav = useFavoriteStore((s) => s.hydrate);
  const isHydratingFav = useFavoriteStore((s) => s.isHydrating);

  useEffect(() => {
    hydrateAuth();
    hydrateCart();
    hydrateFav();
  }, [hydrateAuth, hydrateCart, hydrateFav]);

  if (isHydratingAuth || isHydratingCart || isHydratingFav) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={MainTabs} />
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="Register" component={RegisterScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
