"use client";

import { useEffect, useRef, createElement } from "react";
import NumberFlow, { CONNECT_EVENT } from "number-flow";

interface RollingNumberProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function RollingNumber({ 
  value, 
  className, 
  prefix = "", 
  suffix = "", 
  decimals = 0 
}: RollingNumberProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleConnect = () => {
      const numberFlowElement = element as unknown as NumberFlow;
      numberFlowElement.update(value);
    };

    // If already connected, update immediately
    if ((element as unknown as NumberFlow).connected) {
      handleConnect();
    } else {
      // Wait for the custom element to be connected
      element.addEventListener(CONNECT_EVENT, handleConnect);
    }

    return () => {
      element.removeEventListener(CONNECT_EVENT, handleConnect);
    };
  }, [value]);

  return createElement("number-flow", {
    ref,
    className,
    style: {
      fontVariantNumeric: "tabular-nums",
    },
    numberPrefix: prefix,
    numberSuffix: suffix,
    format: {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    },
  });
}

// Specialized components for different number types
export function RollingCurrency({ value, className, decimals = 0 }: { value: number; className?: string; decimals?: number }) {
  return (
    <RollingNumber 
      value={value} 
      className={className}
      prefix="$"
      decimals={decimals}
    />
  );
}

export function RollingPercent({ value, className, decimals = 1 }: { value: number; className?: string; decimals?: number }) {
  return (
    <RollingNumber 
      value={value} 
      className={className}
      suffix="%"
      decimals={decimals}
    />
  );
}

export function RollingNumberWithSuffix({ value, className, suffix, decimals = 0 }: { value: number; className?: string; suffix: string; decimals?: number }) {
  return (
    <RollingNumber 
      value={value} 
      className={className}
      suffix={suffix}
      decimals={decimals}
    />
  );
}