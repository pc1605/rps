import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Screen } from "../components/ui/Screen";
import { Skeleton } from "../components/ui/Skeleton";
import { tokenStore } from "../lib/api-client";

export default function Index() {
  const [checked, setChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    tokenStore.get().then((t) => {
      setHasToken(!!t);
      setChecked(true);
    });
  }, []);

  if (!checked) {
    return (
      <Screen centered>
        <View style={styles.center}>
          <Skeleton width="40%" height={24} />
        </View>
      </Screen>
    );
  }

  return <Redirect href={hasToken ? "/home" : "/login"} />;
}

const styles = StyleSheet.create(() => ({
  center: {
    alignItems: "center",
  },
}));
