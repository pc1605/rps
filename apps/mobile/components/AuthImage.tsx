import { useState } from "react";
import { Image, type ImageStyle, type StyleProp, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { apiOrigin } from "../lib/api-client";
import { Skeleton } from "./ui/Skeleton";

interface Props {
  url: string;
  accessibilityLabel: string;
  aspectRatio?: number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain";
}

export function AuthImage({ url, accessibilityLabel, aspectRatio = 1, style, resizeMode = "cover" }: Props) {
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(!url);

  const fullUri = url.startsWith("http") ? url : `${apiOrigin()}${url}`;

  return (
    <View style={[styles.container(aspectRatio), style]}>
      {loading && !error && (
        <View style={StyleSheet.absoluteFillObject}>
          <Skeleton width="100%" height="100%" />
        </View>
      )}
      {error ? (
        <View style={styles.errorPlaceholder}>
          <Text style={styles.errorText}>📷</Text>
        </View>
      ) : (
        <Image
          source={{ uri: fullUri }}
          style={styles.image(aspectRatio)}
          resizeMode={resizeMode}
          accessibilityLabel={accessibilityLabel}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: (aspectRatio: number) => ({
    aspectRatio,
    overflow: "hidden",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
  }),
  image: (aspectRatio: number) => ({
    width: "100%",
    aspectRatio,
  }),
  errorPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  errorText: {
    ...theme.text.small,
    color: theme.colors.textMuted,
  },
}));
