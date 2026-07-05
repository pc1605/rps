import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
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

  if (!checked)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );

  return <Redirect href={hasToken ? "/home" : "/login"} />;
}
