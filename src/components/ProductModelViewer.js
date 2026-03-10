import React, { Suspense, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { Canvas } from "@react-three/fiber/native";
import { OrbitControls, useGLTF } from "@react-three/drei/native";

function Model({
  uri,
  scale = [4.5, 4.5, 4.5],
  position = [0, -10, 0],
  rotation = [0, 0, 0],
}) {
  const gltf = useGLTF(uri);

  return (
    <primitive
      object={gltf.scene}
      rotation={rotation}
      scale={scale}
      position={position}
    />
  );
}

export default function ProductModelViewer({
  glbUrl,
  scale = [4.5, 4.5, 4.5],
  position = [0, -10, 0],
  rotation = [0, 0, 0],
  cameraZ = 95,
  fov = 45,
  style,
}) {
  const [localUri, setLocalUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    const downloadModel = async () => {
      try {
        setLoading(true);
        setErr("");

        if (!glbUrl) {
          throw new Error("Không có GLB URL");
        }

        const fileName = `model-${Date.now()}.glb`;
        const target = `${FileSystem.cacheDirectory}${fileName}`;
        const result = await FileSystem.downloadAsync(glbUrl, target);

        if (mounted) {
          setLocalUri(result.uri);
        }
      } catch (error) {
        if (mounted) {
          setErr(error?.message || "Không tải được model 3D");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    downloadModel();

    return () => {
      mounted = false;
    };
  }, [glbUrl]);

  if (loading) {
    return (
      <View style={[styles.center, style]}>
        <ActivityIndicator size="large" />
        <Text style={styles.msg}>Đang tải model 3D...</Text>
      </View>
    );
  }

  if (err || !localUri) {
    return (
      <View style={[styles.center, style]}>
        <Text style={styles.errText}>
          {err || "Không hiển thị được model 3D"}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.viewerContainer, style]}>
      <Canvas style={styles.canvas} camera={{ position: [0, 0, cameraZ], fov }}>
        <ambientLight intensity={2} />
        <directionalLight position={[20, 20, 20]} intensity={2} />
        <directionalLight position={[-20, -10, 15]} intensity={1.5} />

        <Suspense fallback={null}>
          <Model
            uri={localUri}
            scale={scale}
            position={position}
            rotation={rotation}
          />
          <OrbitControls enablePan enableZoom enableRotate />
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  viewerContainer: {
    width: "100%",
    height: "100%",
  },
  canvas: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#F9FAFB",
  },
  msg: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  errText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
    textAlign: "center",
    paddingHorizontal: 16,
  },
});