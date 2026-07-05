// app/login.tsx
import { View, Text } from "react-native";
export default function Login() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#141416",
      }}
    >
      <Text style={{ color: "#f59e0b", fontSize: 24, fontWeight: "bold" }}>
        RPS Worker
      </Text>
      <Text style={{ color: "#888", marginTop: 8 }}>Boot OK — login next</Text>
    </View>
  );
}
