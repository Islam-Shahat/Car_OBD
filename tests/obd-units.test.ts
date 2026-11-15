import { describe, expect, it } from 'vitest';

import {
  celsiusToFahrenheit,
  convertMeasurement,
  fahrenheitToCelsius,
  kmhToMph,
  mphToKmh,
} from '../src/lib/obd/units';

describe('OBD unit conversions', () => {
  it('converts temperature between Celsius and Fahrenheit accurately', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
    expect(Math.round(celsiusToFahrenheit(90))).toBe(194); // Normal coolant temp

    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBe(100);
    expect(fahrenheitToCelsius(-40)).toBe(-40);
  });

  it('converts speed between km/h and mph accurately', () => {
    expect(Math.round(kmhToMph(100))).toBe(62);
    expect(Math.round(kmhToMph(60))).toBe(37);
    expect(kmhToMph(0)).toBe(0);

    expect(Math.round(mphToKmh(62.1371192))).toBe(100);
  });

  it('converts measurements based on preferences', () => {
    const celsiusPref = { temperature: 'celsius' as const, speed: 'kmh' as const };
    const fahrPref = { temperature: 'fahrenheit' as const, speed: 'mph' as const };

    const coolantC = convertMeasurement(90, 'celsius', celsiusPref);
    expect(coolantC.value).toBe(90);
    expect(coolantC.displayUnit).toBe('°C');

    const coolantF = convertMeasurement(90, 'celsius', fahrPref);
    expect(coolantF.value).toBe(194);
    expect(coolantF.displayUnit).toBe('°F');

    const speedKmh = convertMeasurement(100, 'kmh', celsiusPref);
    expect(speedKmh.value).toBe(100);
    expect(speedKmh.displayUnit).toBe('km/h');

    const speedMph = convertMeasurement(100, 'kmh', fahrPref);
    expect(Math.round(speedMph.value)).toBe(62);
    expect(speedMph.displayUnit).toBe('mph');

    // Untouched units
    const rpm = convertMeasurement(2500, 'rpm', fahrPref);
    expect(rpm.value).toBe(2500);
    expect(rpm.displayUnit).toBe('RPM');

    const trim = convertMeasurement(-3.5, 'percent', fahrPref);
    expect(trim.value).toBe(-3.5);
    expect(trim.displayUnit).toBe('%');
  });
});
