// app/home.tsx
import { View, Text } from "react-native";
export default function Home() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#141416",
      }}
    >
      <Text style={{ color: "#fff" }}>Home</Text>
    </View>
  );
}
