"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type OrderVisualContextValue = {
  eventCovers: Map<number, string>;
  eventsLoaded: boolean;
};

const OrderVisualContext = createContext<OrderVisualContextValue>({
  eventCovers: new Map(),
  eventsLoaded: false,
});

export function OrderVisualProvider({ children }: { children: ReactNode }) {
  const [eventCovers, setEventCovers] = useState<Map<number, string>>(new Map());
  const [eventsLoaded, setEventsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/fotografo/events-mine", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((events) => {
        if (!active || !Array.isArray(events)) return;
        const map = new Map<number, string>();
        for (const event of events) {
          if (typeof event?.id === "number" && typeof event?.coverUrl === "string" && event.coverUrl) {
            map.set(event.id, event.coverUrl);
          }
        }
        setEventCovers(map);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setEventsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ eventCovers, eventsLoaded }),
    [eventCovers, eventsLoaded]
  );

  return <OrderVisualContext.Provider value={value}>{children}</OrderVisualContext.Provider>;
}

export function useOrderVisualContext() {
  return useContext(OrderVisualContext);
}
