# WDP Eyewear Mobile

A modern cross-platform mobile e-commerce application built with React Native (Expo), TypeScript, NativeWind (Tailwind CSS for React Native), and comprehensive tooling for a production-ready eyewear online store.

## 🚀 Tech Stack

### Core
- **React Native** - Cross-platform mobile framework
- **Expo (SDK 52+)** - React Native development platform & toolset
- **TypeScript 5** - Type safety
- **NativeWind (Tailwind CSS)** - Utility-first styling for React Native

### Navigation & Routing
- **Expo Router** - File-based routing for React Native (built on React Navigation)

### State Management & Data Fetching
- **Zustand** - Lightweight state management
- **TanStack Query** - Server state management & caching
- **Axios** - HTTP client

### Forms & Validation
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **@hookform/resolvers** - Form validation integration

### Authentication & Storage
- **Expo SecureStore** - Secure token & sensitive data storage
- **NextAuth / Custom JWT Integration** - Authentication flow with support for Credentials and Google OAuth

### Internationalization
- **i18next / react-i18next** - i18n support
- Languages: Vietnamese (default), English

### Code Quality
- **ESLint** - Linting rules
- **Prettier** - Code formatting
- **EditorConfig** - Consistent editor settings

## 📁 Project Structure

```
wdp-eyewear-mobile/
├── app/                        # Expo Router file-based routes
│   ├── (auth)/                 # Authentication group (login, register)
│   ├── (tabs)/                 # Bottom tab navigation group
│   │   ├── _layout.tsx         # Tab layout configuration
│   │   ├── index.tsx           # Home tab
│   │   ├── explore.tsx         # Search / Products catalog tab
│   │   ├── cart.tsx            # Shopping cart tab
│   │   └── profile.tsx         # User profile tab
│   ├── product/                # Product detail & dynamic routes
│   ├── checkout/               # Checkout & payment screens
│   ├── _layout.tsx             # Root layout with providers
│   └── +not-found.tsx          # Fallback 404 screen
├── src/
│   ├── api/                    # API client & endpoints
│   │   ├── client.ts           # Axios instance with interceptors & token injection
│   │   ├── auth.ts             # Auth API
│   │   └── products.ts         # Products API
│   ├── components/             # Atomic Design structure
│   │   ├── atoms/              # Basic UI elements (Button, Input, Typography)
│   │   ├── molecules/          # Composed components (SearchBar, ProductCard)
│   │   ├── organisms/          # Complex blocks (Header, CartItemList, ProductGrid)
│   │   └── templates/          # Screen layouts
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts          # Authentication hooks
│   │   └── useProducts.ts      # Product query hooks
│   ├── i18n/                   # Internationalization setup
│   │   └── index.ts            # i18n configuration & language loader
│   ├── lib/                    # Utilities & providers
│   │   ├── query-provider.tsx  # React Query provider
│   │   ├── storage.ts          # SecureStore wrappers
│   │   ├── utils.ts            # Utility functions
│   │   └── validation/         # Zod schemas
│   ├── stores/                 # Zustand stores
│   │   ├── authStore.ts        # Auth state & persistence
│   │   └── cartStore.ts        # Cart state
│   └── types/                  # TypeScript types
├── assets/                     # Images, icons, splash screens
├── locales/                    # i18n translation JSON files
│   ├── en.json                 # English translations
│   └── vi.json                 # Vietnamese translations
├── .env.example                # Environment variables template
├── .eslintrc.js                # ESLint config
├── .prettierrc                 # Prettier config
├── app.json                    # Expo configuration
├── tailwind.config.js          # NativeWind configuration
└── tsconfig.json               # TypeScript configuration
```

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- npm, yarn, or pnpm
- **Expo Go** app installed on your physical mobile device (iOS/Android), or an Android/iOS Simulator configured.

### Installation

1. Clone the repository
```bash
git clone https://github.com/datfullstacks/wdp-eyewear-mobile.git
cd wdp-eyewear-mobile
```

2. Install dependencies
```bash
npm install
```

3. Create environment file
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000
```
> *Note: Use your computer's local IP address instead of `localhost` when testing on a physical mobile device via Expo Go.*

### Development

Start the Expo development server:

```bash
npx expo start
```

- Scan the QR code using the **Expo Go** app (Android) or **Camera app** (iOS).
- Press `a` to open the Android emulator, or `i` to open the iOS simulator.

### Build (EAS Build)

```bash
# Build for Android (APK / App Bundle)
npx eas build --platform android

# Build for iOS
npx eas build --platform ios
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npx prettier --write .
```

## 🎨 Atomic Design Pattern

Components follow the Atomic Design methodology tailored for mobile architecture:

- **Atoms**: Basic UI elements (Button, Input, Text, Badge)
- **Molecules**: Combined components (ProductCard, SearchBar, InputField)
- **Organisms**: Complex layout sections (ProductGrid, HeaderBar, CartSummary)
- **Templates**: Reusable screen layouts
- **Pages / Screens**: Full mobile screens mapped via Expo Router

## 🌍 Internationalization

- Default language: **Vietnamese** (`vi`)
- Supported languages: `vi`, `en`
- Translation files managed under the `locales/` directory.

## 🔐 Authentication & Security

- Secure token caching using **Expo SecureStore**
- Credentials login (email/password) & Google OAuth integration
- Protected routing guards via Expo Router layout groups

## 📊 State Management

- **Server State**: TanStack Query for API caching and synchronization
- **Client State**: Zustand for cart items, user session, and UI preferences
- **Form State**: React Hook Form combined with Zod validation schematics

## 📝 Environment Variables

Required:
- `EXPO_PUBLIC_API_URL` - Backend API URL (accessible from your device/emulator)

## 📦 Key Dependencies

```json
{
  "expo": "~52.0.0",
  "react": "18.3.1",
  "react-native": "0.76.5",
  "expo-router": "~4.0.0",
  "nativewind": "^4.0.0",
  "tailwindcss": "^3.4.0",
  "zustand": "latest",
  "@tanstack/react-query": "latest",
  "axios": "latest",
  "react-hook-form": "latest",
  "zod": "latest",
  "i18next": "latest",
  "react-i18next": "latest"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting & verification
5. Submit a pull request

## 📄 License

ISC

## 👥 Author

WDP Team

## 🔗 Links

- Repository: [https://github.com/datfullstacks/wdp-eyewear-mobile](https://github.com/datfullstacks/wdp-eyewear-mobile)
- Issues: [https://github.com/datfullstacks/wdp-eyewear-mobile/issues](https://github.com/datfullstacks/wdp-eyewear-mobile/issues)
