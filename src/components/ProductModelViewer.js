import React, { Suspense, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { GLTFLoader, OrbitControls as OrbitControlsImpl } from "three-stdlib";

function prepareSceneForNative(scene) {
  let hasUnsupportedPhysicalMaterial = false;

  scene.traverse((node) => {
    if (!node?.isMesh || !node.material || hasUnsupportedPhysicalMaterial) return;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    hasUnsupportedPhysicalMaterial = materials.some(
      (material) =>
        material?.isMeshPhysicalMaterial && (
          Number(material.transmission) > 0 ||
          Number(material.dispersion) > 0 ||
          Number(material.iridescence) > 0 ||
          Number(material.clearcoat) > 0 ||
          Number(material.anisotropy) > 0 ||
          Number(material.sheen) > 0
        )
    );
  });

  if (!hasUnsupportedPhysicalMaterial) {
    return { scene, disposableMaterials: [] };
  }

  const clonedScene = scene.clone(true);
  const materialCache = new Map();
  const disposableMaterials = [];

  const getPreparedMaterial = (material) => {
    if (!material) return material;

    const cachedMaterial = materialCache.get(material.uuid);
    if (cachedMaterial) return cachedMaterial;

    const hasUnsupportedPhysicalProps =
      material.isMeshPhysicalMaterial && (
        Number(material.transmission) > 0 ||
        Number(material.dispersion) > 0 ||
        Number(material.iridescence) > 0 ||
        Number(material.clearcoat) > 0 ||
        Number(material.anisotropy) > 0 ||
        Number(material.sheen) > 0
      );

    if (!hasUnsupportedPhysicalProps) {
      materialCache.set(material.uuid, material);
      return material;
    }

    const nextMaterial = material.clone();
    const transmission = Number(nextMaterial.transmission) || 0;
    const fallbackOpacity = Math.max(0.18, 1 - transmission * 0.82);

    nextMaterial.transmission = 0;
    nextMaterial.transmissionMap = null;
    nextMaterial.thickness = 0;
    nextMaterial.thicknessMap = null;
    nextMaterial.dispersion = 0;
    nextMaterial.iridescence = 0;
    nextMaterial.iridescenceMap = null;
    nextMaterial.iridescenceThicknessMap = null;
    nextMaterial.clearcoat = 0;
    nextMaterial.clearcoatMap = null;
    nextMaterial.clearcoatNormalMap = null;
    nextMaterial.clearcoatRoughnessMap = null;
    nextMaterial.sheen = 0;
    nextMaterial.sheenColorMap = null;
    nextMaterial.sheenRoughnessMap = null;
    nextMaterial.anisotropy = 0;
    nextMaterial.anisotropyMap = null;

    if (transmission > 0 && nextMaterial.opacity >= 0.999) {
      nextMaterial.opacity = fallbackOpacity;
    }

    nextMaterial.transparent = nextMaterial.opacity < 0.999;
    nextMaterial.depthWrite = nextMaterial.opacity >= 0.999;
    nextMaterial.needsUpdate = true;

    materialCache.set(material.uuid, nextMaterial);
    disposableMaterials.push(nextMaterial);
    return nextMaterial;
  };

  clonedScene.traverse((node) => {
    if (!node?.isMesh || !node.material) return;

    if (Array.isArray(node.material)) {
      node.material = node.material.map(getPreparedMaterial);
      return;
    }

    node.material = getPreparedMaterial(node.material);
  });

  return { scene: clonedScene, disposableMaterials };
}

function useGLTF(path) {
  return useLoader(GLTFLoader, path);
}

function NativeOrbitControls({
  enablePan = true,
  enableZoom = true,
  enableRotate = true,
  enableDamping = true,
}) {
  const invalidate = useThree((state) => state.invalidate);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const events = useThree((state) => state.events);
  const controls = useMemo(() => new OrbitControlsImpl(camera), [camera]);
  const domElement = events.connected || gl.domElement;

  useFrame(() => {
    if (controls.enabled) controls.update();
  }, -1);

  useEffect(() => {
    const handleChange = () => {
      invalidate();
    };

    controls.connect(domElement);
    controls.addEventListener("change", handleChange);

    return () => {
      controls.removeEventListener("change", handleChange);
      controls.dispose();
    };
  }, [controls, domElement, invalidate]);

  return (
    <primitive
      object={controls}
      enablePan={enablePan}
      enableZoom={enableZoom}
      enableRotate={enableRotate}
      enableDamping={enableDamping}
    />
  );
}

function Model({
  uri,
  scale = [4.5, 4.5, 4.5],
  position = [0, -10, 0],
  rotation = [0, 0, 0],
}) {
  const gltf = useGLTF(uri);
  const preparedScene = useMemo(() => {
    if (Platform.OS === "web") {
      return { scene: gltf.scene, disposableMaterials: [] };
    }

    return prepareSceneForNative(gltf.scene);
  }, [gltf.scene]);

  useEffect(() => {
    return () => {
      preparedScene.disposableMaterials.forEach((material) => material.dispose());
    };
  }, [preparedScene]);

  return (
    <primitive
      object={preparedScene.scene}
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
          <NativeOrbitControls enablePan enableZoom enableRotate />
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
