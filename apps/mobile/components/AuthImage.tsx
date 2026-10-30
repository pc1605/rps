import { useEffect, useState } from "react";
import { Image, type ImageStyle, type StyleProp, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { apiOrigin, authHeaders } from "../lib/api-client";
import { Skeleton } from "./ui/Skeleton";

interface Props {
  url: string;
  accessibilityLabel: string;
  aspectRatio?: number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain";
}

export function AuthImage({ url, accessibilityLabel, aspectRatio = 1, style, resizeMode = "cover" }: Props) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authHeaders().then((h) => {
      if (active) setHeaders(h);
    });
    return () => {
      active = false;
    };
  }, []);

  const fullUri = url.startsWith("http") ? url : `${apiOrigin()}${url}`;

  return (
    <View style={[styles.container(aspectRatio), style]}>
      {(!headers || loading) && (
        <View style={StyleSheet.absoluteFillObject}>
          <Skeleton width="100%" height="100%" />
        </View>
      )}
      {headers && (
        <Image
          source={{ uri: fullUri, headers }}
          style={styles.image(aspectRatio)}
          resizeMode={resizeMode}
          accessibilityLabel={accessibilityLabel}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
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
}));
