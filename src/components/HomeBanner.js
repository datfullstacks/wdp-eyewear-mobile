import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");
const SLIDE_W = width - 32; // paddingHorizontal 16*2

export default function HomeBanner({
  banners = [],
  onPressBanner,
  autoPlay = true,
  intervalMs = 3000,
}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const scrollRef = React.useRef(null);
  const timerRef = React.useRef(null);

  const handleEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    setActiveIndex(i);
  };

  // Auto slide
  React.useEffect(() => {
    if (!autoPlay) return;
    if (!banners?.length) return;
    if (banners.length === 1) return;

    // clear trước khi set mới
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * SLIDE_W, animated: true });
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoPlay, intervalMs, banners?.length]);

  // Nếu user swipe tay -> reset timer để cảm giác mượt hơn
  const resetTimer = React.useCallback(() => {
    if (!autoPlay) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * SLIDE_W, animated: true });
        return next;
      });
    }, intervalMs);
  }, [autoPlay, intervalMs, banners?.length]);

  if (!banners?.length) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          handleEnd(e);
          resetTimer();
        }}
        onScrollBeginDrag={resetTimer}
        scrollEventThrottle={16}
      >
        {banners.map((b, idx) => (
          <View key={b.id || String(idx)} style={{ width: SLIDE_W }}>
            <View style={styles.card}>
              <ImageBackground
                source={{ uri: b.image }}
                style={styles.bg}
                imageStyle={styles.image}
              >
                <View style={styles.overlay} />

                <View style={styles.content}>
                  <Text style={styles.title}>{b.title}</Text>

                  <TouchableOpacity
                    style={styles.btn}
                    activeOpacity={0.85}
                    onPress={() => onPressBanner?.(b, idx)}
                  >
                    <Text style={styles.btnText}>Mua ngay</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dots}>
                  {banners.map((_, dIdx) => (
                    <View
                      key={dIdx}
                      style={[styles.dot, dIdx === activeIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              </ImageBackground>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },

  card: {
    height: 160,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  bg: { flex: 1, justifyContent: "flex-end" },
  image: { borderRadius: 18 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.20)",
  },

  content: { padding: 16, gap: 10 },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    maxWidth: "80%",
  },

  btn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: { color: "#111827", fontWeight: "900" },

  dots: {
    position: "absolute",
    right: 14,
    bottom: 12,
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dotActive: {
    backgroundColor: "rgba(255,255,255,1)",
    width: 18,
    borderRadius: 6,
  },
});
