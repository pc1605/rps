import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useOnline() {
  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
  }, []);

  return isOnline;
}
