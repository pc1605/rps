import { useFocusEffect, useIsFocused, useNavigation } from "expo-router";
import { useCallback, useState } from "react";

/**
 * Delays mounting the camera preview until after navigation transitions finish.
 * On older Android devices, requesting the camera while the previous screen is still
 * releasing it during a transition causes a black screen preview.
 *
 * - Waits for navigation transitionEnd (with closing === false).
 * - Fallback: marks ready = true after 600ms if no transitionEnd fires.
 * - On blur, sets ready = false immediately via useFocusEffect cleanup.
 */
export function useCameraReady(): boolean {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        setReady(true);
      }, 600);

      // Navigation event: transitionEnd fires when push/pop transition animation completes
      const unsubscribe = (
        navigation as unknown as {
          addListener: (
            event: "transitionEnd",
            listener: (e: { data?: { closing?: boolean } }) => void,
          ) => () => void;
        }
      ).addListener("transitionEnd", (e) => {
        if (e?.data?.closing === false) {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          setReady(true);
        }
      });

      return () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        unsubscribe();
        setReady(false);
      };
    }, [navigation]),
  );

  return isFocused && ready;
}
