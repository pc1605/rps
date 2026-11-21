const { existsSync } = require("node:fs");
const path = require("node:path");

// app.json holds the app's settings; this adds the Firebase file for phone notifications (N1) when it
// is present. Without it the app builds and runs as before, just without notifications.
// The file comes from Firebase → Project settings → Your apps → Android (com.rpsworker.app).
const GOOGLE_SERVICES = "./google-services.json";

module.exports = ({ config }) => {
  const hasFirebase = existsSync(path.join(__dirname, GOOGLE_SERVICES));
  return {
    ...config,
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: GOOGLE_SERVICES } : {}),
    },
  };
};
