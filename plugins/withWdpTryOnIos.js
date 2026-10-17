const fs = require("fs");
const path = require("path");
const {
  IOSConfig,
  createRunOncePlugin,
  withDangerousMod,
  withPodfile,
  withXcodeProject,
} = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

const PLUGIN_NAME = "with-wdp-tryon-ios";
const PLUGIN_VERSION = "1.0.0";
const IOS_SOURCE_DIR = path.join(__dirname, "ios", "WdpTryOnSdk");
const IOS_FILES = [
  "WdpTryOnSdk.swift",
  "WdpTryOnSdkBridge.m",
  "WdpTryOnViewController.swift",
];

function withWdpTryOnIosSources(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const destinationDir = path.join(projectRoot, "ios", projectName, "TryOn");

      fs.mkdirSync(destinationDir, { recursive: true });

      for (const fileName of IOS_FILES) {
        const sourcePath = path.join(IOS_SOURCE_DIR, fileName);
        const destinationPath = path.join(destinationDir, fileName);
        fs.copyFileSync(sourcePath, destinationPath);
      }

      return modConfig;
    },
  ]);
}

function withWdpTryOnIosXcode(config) {
  return withXcodeProject(config, (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const groupName = `${projectName}/TryOn`;

    IOSConfig.XcodeUtils.ensureGroupRecursively(modConfig.modResults, groupName);

    for (const fileName of IOS_FILES) {
      modConfig.modResults = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: fileName,
        groupName,
        project: modConfig.modResults,
        verbose: true,
      });
    }

    return modConfig;
  });
}

function withWdpTryOnIosPods(config) {
  return withPodfile(config, (modConfig) => {
    let src = modConfig.modResults.contents;

    src = mergeContents({
      src,
      newSrc: [
        "banuba_enabled = (ENV['BANUBA_ENABLED'] || 'false').downcase == 'true'",
        "banuba_ios_sdk_version = ENV['BANUBA_IOS_SDK_VERSION'] || '1.17.+'",
        "banuba_ios_pod_name = ENV['BANUBA_IOS_POD_NAME'] || 'BanubaSDK'",
        "banuba_ios_podspec_source = ENV['BANUBA_IOS_PODSPEC_SOURCE']",
        "source banuba_ios_podspec_source if banuba_ios_podspec_source && !banuba_ios_podspec_source.empty?",
      ].join("\n"),
      tag: "wdp-tryon-ios-env",
      anchor: /platform :ios[^\\n]*/,
      offset: 1,
      comment: "#",
    }).contents;

    src = mergeContents({
      src,
      newSrc: [
        "  if banuba_enabled",
        "    pod banuba_ios_pod_name, banuba_ios_sdk_version",
        "  end",
      ].join("\n"),
      tag: "wdp-tryon-ios-pod",
      anchor: /\suse_expo_modules!/,
      offset: 1,
      comment: "#",
    }).contents;

    modConfig.modResults.contents = src;
    return modConfig;
  });
}

function withWdpTryOnIos(config) {
  config = withWdpTryOnIosSources(config);
  config = withWdpTryOnIosXcode(config);
  config = withWdpTryOnIosPods(config);
  return config;
}

module.exports = createRunOncePlugin(withWdpTryOnIos, PLUGIN_NAME, PLUGIN_VERSION);
module.exports.withWdpTryOnIos = withWdpTryOnIos;
