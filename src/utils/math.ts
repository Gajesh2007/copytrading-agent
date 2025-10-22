/**
 * Math utility functions for safe numeric operations.
 */

/**
 * Converts various types to a floating-point number, with safe fallbacks.
 *
 * @param value - Value to convert (string, number, bigint, or nullish)
 * @returns Parsed number, or 0 if nullish
 * @throws {Error} If string value cannot be parsed as a number
 */
export function toFloat(value: string | number | bigint | undefined | null): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse numeric value: ${value}`);
  }
  return parsed;
}

/**
 * Rounds a number to a specified number of decimal places.
 *
 * @param value - Number to round
 * @param decimals - Number of decimal places (default: 6)
 * @returns Rounded number
 */
export function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Clamps a number between a minimum and maximum value.
 *
 * @param value - Number to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped number
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Safely divides two numbers, returning a fallback if denominator is near zero.
 *
 * @param numerator - Numerator
 * @param denominator - Denominator
 * @param fallback - Value to return if denominator is ~0 (default: 0)
 * @returns Division result or fallback
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (Math.abs(denominator) < Number.EPSILON) {
    return fallback;
  }
  return numerator / denominator;
}
