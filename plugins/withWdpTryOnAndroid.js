const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
  withProjectBuildGradle,
} = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

const PLUGIN_NAME = "with-wdp-tryon-android";
const PLUGIN_VERSION = "1.0.0";

const ANDROID_SOURCE_DIR = path.join(__dirname, "android", "WdpTryOnSdk");
const ANDROID_FILES = ["WdpTryOnActivity.kt", "WdpTryOnModule.kt", "WdpTryOnPackage.kt"];
const DEFAULT_ANDROID_PACKAGE = "com.wdp.eyewear";

function resolveAndroidPackage(config) {
  return config.android?.package || DEFAULT_ANDROID_PACKAGE;
}

function withWdpTryOnAndroidSources(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const androidPackage = resolveAndroidPackage(modConfig);
      const packagePath = androidPackage.split(".").join(path.sep);

      const destinationDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        packagePath,
        "tryon"
      );

      fs.mkdirSync(destinationDir, { recursive: true });

      for (const fileName of ANDROID_FILES) {
        const sourcePath = path.join(ANDROID_SOURCE_DIR, fileName);
        const destinationPath = path.join(destinationDir, fileName);
        const content = fs
          .readFileSync(sourcePath, "utf8")
          .replace(/__APP_PACKAGE__/g, androidPackage);
        fs.writeFileSync(destinationPath, content, "utf8");
      }

      return modConfig;
    },
  ]);
}

function withWdpTryOnAndroidMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    const androidPackage = resolveAndroidPackage(modConfig);
    let src = modConfig.modResults.contents;
    const tryOnImport = `import ${androidPackage}.tryon.WdpTryOnPackage`;

    // Clean up legacy/manual duplicates before inserting generated blocks.
    src = src
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed !== tryOnImport && trimmed !== "add(WdpTryOnPackage())";
      })
      .join("\n");

    src = mergeContents({
      src,
      newSrc: tryOnImport,
      tag: "wdp-tryon-android-import",
      anchor: /import expo\.modules\.ReactNativeHostWrapper/,
      offset: 1,
      comment: "//",
    }).contents;

    src = mergeContents({
      src,
      newSrc: "              add(WdpTryOnPackage())",
      tag: "wdp-tryon-android-package",
      anchor: /\/\/ add\(MyReactNativePackage\(\)\)/,
      offset: 1,
      comment: "//",
    }).contents;

    modConfig.modResults.contents = src;
    return modConfig;
  });
}

function withWdpTryOnAndroidManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const androidPackage = resolveAndroidPackage(modConfig);
    const activityName = `${androidPackage}.tryon.WdpTryOnActivity`;
    const manifest = modConfig.modResults.manifest;
    const app = manifest?.application?.[0];
    if (!app) return modConfig;

    if (!Array.isArray(app.activity)) app.activity = [];
    const hasActivity = app.activity.some((activity) => {
      const name = activity?.$?.["android:name"];
      return (
        name === activityName ||
        name === ".tryon.WdpTryOnActivity" ||
        name === "tryon.WdpTryOnActivity"
      );
    });

    if (!hasActivity) {
      app.activity.push({
        $: {
          "android:name": activityName,
          "android:configChanges": "keyboard|keyboardHidden|orientation|screenSize|uiMode",
          "android:exported": "false",
          "android:screenOrientation": "portrait",
        },
      });
    }

    return modConfig;
  });
}

function withWdpTryOnAndroidProjectBuildGradle(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    const legacyMavenBlockPattern =
      /[ \t]*def banubaAndroidMavenUrl = System\.getenv\("BANUBA_ANDROID_MAVEN_URL"\) \?: findProperty\("BANUBA_ANDROID_MAVEN_URL"\)\r?\n[ \t]*def banubaAndroidMavenUsername =\r?\n[ \t]*System\.getenv\("BANUBA_ANDROID_MAVEN_USERNAME"\) \?: findProperty\("BANUBA_ANDROID_MAVEN_USERNAME"\) \?: "sdk-banuba"\r?\n[ \t]*def banubaAndroidMavenPassword =\r?\n[ \t]*System\.getenv\("BANUBA_ANDROID_MAVEN_PASSWORD"\) \?: findProperty\("BANUBA_ANDROID_MAVEN_PASSWORD"\)\r?\n[ \t]*if \(banubaAndroidMavenUrl\) \{\r?\n[ \t]*maven \{\r?\n[ \t]*url banubaAndroidMavenUrl\r?\n[ \t]*if \(banubaAndroidMavenPassword\) \{\r?\n[ \t]*credentials \{\r?\n[ \t]*username banubaAndroidMavenUsername\r?\n[ \t]*password banubaAndroidMavenPassword\r?\n[ \t]*\}\r?\n[ \t]*\}\r?\n[ \t]*\}\r?\n[ \t]*\}\r?\n?/g;

    // Remove any stale non-generated insertion of the Banuba maven block.
    const src = modConfig.modResults.contents.replace(legacyMavenBlockPattern, "");
    modConfig.modResults.contents = mergeContents({
      src,
      newSrc: [
        "    def banubaAndroidMavenUrl = System.getenv(\"BANUBA_ANDROID_MAVEN_URL\") ?: findProperty(\"BANUBA_ANDROID_MAVEN_URL\")",
        "    def banubaAndroidMavenUsername =",
        "        System.getenv(\"BANUBA_ANDROID_MAVEN_USERNAME\") ?: findProperty(\"BANUBA_ANDROID_MAVEN_USERNAME\") ?: \"sdk-banuba\"",
        "    def banubaAndroidMavenPassword =",
        "        System.getenv(\"BANUBA_ANDROID_MAVEN_PASSWORD\") ?: findProperty(\"BANUBA_ANDROID_MAVEN_PASSWORD\")",
        "    if (banubaAndroidMavenUrl) {",
        "      maven {",
        "        url banubaAndroidMavenUrl",
        "        if (banubaAndroidMavenPassword) {",
        "          credentials {",
        "            username banubaAndroidMavenUsername",
        "            password banubaAndroidMavenPassword",
        "          }",
        "        }",
        "      }",
        "    }",
      ].join("\n"),
      tag: "wdp-tryon-android-maven",
      anchor: /maven \{ url 'https:\/\/www\.jitpack\.io' \}/,
      offset: 1,
      comment: "//",
    }).contents;
    return modConfig;
  });
}

function withWdpTryOnAndroidAppBuildGradle(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let src = modConfig.modResults.contents;

    src = mergeContents({
      src,
      newSrc: [
        "def banubaEnabled = ((System.getenv(\"BANUBA_ENABLED\") ?: findProperty(\"BANUBA_ENABLED\") ?: \"false\")).toBoolean()",
        "def banubaRequiredMinSdk = 26",
        "def baseMinSdk = rootProject.ext.minSdkVersion as int",
        "def resolvedMinSdk = banubaEnabled ? Math.max(baseMinSdk, banubaRequiredMinSdk) : baseMinSdk",
        "def banubaAndroidSdkVersion =",
        "    System.getenv(\"BANUBA_ANDROID_SDK_VERSION\")",
        "        ?: findProperty(\"BANUBA_ANDROID_SDK_VERSION\")",
        "        ?: \"1.17.7\"",
        "def banubaAndroidMinimal = ((System.getenv(\"BANUBA_ANDROID_MINIMAL\") ?: findProperty(\"BANUBA_ANDROID_MINIMAL\") ?: \"false\")).toBoolean()",
        "def banubaAndroidSdkDependency =",
        "    System.getenv(\"BANUBA_ANDROID_SDK_DEPENDENCY\")",
        "        ?: findProperty(\"BANUBA_ANDROID_SDK_DEPENDENCY\")",
        "        ?: \"com.banuba.sdk:banuba_sdk:1.17.7\"",
        "def banubaAndroidSdkDependenciesRaw =",
        "    System.getenv(\"BANUBA_ANDROID_SDK_DEPENDENCIES\")",
        "        ?: findProperty(\"BANUBA_ANDROID_SDK_DEPENDENCIES\")",
        "        ?: \"\"",
        "def banubaAndroidSdkDependencies = banubaAndroidSdkDependenciesRaw",
        "    .split(\",\")",
        "    .collect { it.trim() }",
        "    .findAll { !it.isEmpty() }",
        "if (banubaAndroidMinimal && banubaAndroidSdkDependencies.isEmpty()) {",
        "    banubaAndroidSdkDependencies = [",
        "        \"com.banuba.sdk:sdk_api:${banubaAndroidSdkVersion}\",",
        "        \"com.banuba.sdk:face_tracker:${banubaAndroidSdkVersion}\"",
        "    ]",
        "}",
        "if (banubaAndroidSdkDependencies.isEmpty()) {",
        "    banubaAndroidSdkDependencies = [banubaAndroidSdkDependency]",
        "}",
      ].join("\n"),
      tag: "wdp-tryon-android-env",
      anchor: /def projectRoot = .*/,
      offset: 1,
      comment: "//",
    }).contents;

    src = mergeContents({
      src,
      newSrc: [
        "        buildConfigField \"boolean\", \"BANUBA_ENABLED\", \"${banubaEnabled}\"",
        "        buildConfigField \"String\", \"BANUBA_ANDROID_SDK_DEPENDENCY\", \"\\\"${banubaAndroidSdkDependency}\\\"\"",
        "        buildConfigField \"String\", \"BANUBA_ANDROID_SDK_DEPENDENCIES\", \"\\\"${banubaAndroidSdkDependencies.join(\",\")}\\\"\"",
      ].join("\n"),
      tag: "wdp-tryon-android-build-config",
      anchor: /buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL".*/,
      offset: 1,
      comment: "//",
    }).contents;

    src = mergeContents({
      src,
      newSrc: "        minSdkVersion resolvedMinSdk",
      tag: "wdp-tryon-android-min-sdk",
      anchor: /minSdkVersion rootProject\.ext\.minSdkVersion/,
      offset: 1,
      comment: "//",
    }).contents;

    src = mergeContents({
      src,
      newSrc: [
        "def banubaEffectsSrcDir = new File(projectRoot, \"effects\")",
        "def banubaEffectsDstDir = file(\"$projectDir/src/main/assets/bnb-resources/effects\")",
        "",
        "tasks.register(\"copyBanubaEffects\", Copy) {",
        "    onlyIf { banubaEnabled && banubaEffectsSrcDir.exists() }",
        "    from(banubaEffectsSrcDir)",
        "    into(banubaEffectsDstDir)",
        "}",
        "",
        "tasks.matching { it.name == \"preBuild\" }.configureEach {",
        "    dependsOn(\"copyBanubaEffects\")",
        "}",
      ].join("\n"),
      tag: "wdp-tryon-android-effects-copy",
      anchor: /dependencies \{/,
      offset: -1,
      comment: "//",
    }).contents;

    src = mergeContents({
      src,
      newSrc: [
        "    if (banubaEnabled) {",
        "        banubaAndroidSdkDependencies.each { dependencyNotation ->",
        "            implementation(dependencyNotation)",
        "        }",
        "    }",
        "",
      ].join("\n"),
      tag: "wdp-tryon-android-deps",
      anchor: /if \(hermesEnabled\.toBoolean\(\)\) \{/,
      offset: 0,
      comment: "//",
    }).contents;

    modConfig.modResults.contents = src;
    return modConfig;
  });
}

function withWdpTryOnAndroid(config) {
  config = withWdpTryOnAndroidSources(config);
  config = withWdpTryOnAndroidMainApplication(config);
  config = withWdpTryOnAndroidManifest(config);
  config = withWdpTryOnAndroidProjectBuildGradle(config);
  config = withWdpTryOnAndroidAppBuildGradle(config);
  return config;
}

module.exports = createRunOncePlugin(withWdpTryOnAndroid, PLUGIN_NAME, PLUGIN_VERSION);
module.exports.withWdpTryOnAndroid = withWdpTryOnAndroid;
