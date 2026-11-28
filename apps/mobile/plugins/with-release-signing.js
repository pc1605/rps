const { withAppBuildGradle } = require("expo/config-plugins");

// Release APKs are signed with RPS's own key, never the public debug key: phones accept an update only when it is
// signed by the same key as the installed app, so this key must never change (or every phone reinstalls and is set
// up again). The key file and its passwords live outside the repo — in ~/.gradle/gradle.properties:
//   RPS_RELEASE_STORE_FILE=/home/<you>/.rps/rps-release.keystore
//   RPS_RELEASE_STORE_PASSWORD=…
//   RPS_RELEASE_KEY_ALIAS=rps
//   RPS_RELEASE_KEY_PASSWORD=…
// A release build without them stops with an error instead of quietly using the debug key.
const MARKER = "// rps-release-signing";

const SIGNING_CONFIG = `
        release { ${MARKER}
            if (project.hasProperty('RPS_RELEASE_STORE_FILE')) {
                storeFile file(RPS_RELEASE_STORE_FILE)
                storePassword RPS_RELEASE_STORE_PASSWORD
                keyAlias RPS_RELEASE_KEY_ALIAS
                keyPassword RPS_RELEASE_KEY_PASSWORD
            }
        }`;

const GUARD = `
gradle.taskGraph.whenReady { graph -> ${MARKER}
    if (graph.allTasks.any { it.name.toLowerCase().contains("release") } && !project.hasProperty('RPS_RELEASE_STORE_FILE')) {
        throw new GradleException("RPS release signing is not set up: add RPS_RELEASE_STORE_FILE and the passwords to ~/.gradle/gradle.properties (see docs/rps-kb/05-mobile/expo-build-and-networking.md)")
    }
}
`;

function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  const withConfig = gradle.replace(/signingConfigs \{\n/, (m) => `${m}${SIGNING_CONFIG.slice(1)}\n`);
  const releaseBlock = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  const withRelease = withConfig.replace(releaseBlock, "$1signingConfig signingConfigs.release");

  if (withConfig === gradle || withRelease === withConfig) {
    throw new Error(
      "with-release-signing: android/app/build.gradle no longer has the expected layout — update the plugin",
    );
  }
  return withRelease + GUARD;
}

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });

module.exports.addReleaseSigning = addReleaseSigning;
