export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type SpeedUnit = 'kmh' | 'mph';

export interface UnitPreferences {
  temperature: TemperatureUnit;
  speed: SpeedUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  temperature: 'celsius',
  speed: 'kmh',
};

/** Converts Celsius to Fahrenheit. */
export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/** Converts Fahrenheit to Celsius. */
export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** Converts km/h to mph. */
export function kmhToMph(kmh: number): number {
  return kmh * 0.621371192;
}

/** Converts mph to km/h. */
export function mphToKmh(mph: number): number {
  return mph / 0.621371192;
}

export interface ConvertedMeasurement {
  value: number;
  unit: string;
  displayUnit: string;
  decimals: number;
}

/**
 * Converts a raw measurement according to user preferences.
 * For non-convertible units (percent, rpm, volts, etc.), leaves them unchanged.
 */
export function convertMeasurement(
  value: number,
  originalUnit: string,
  preferences: UnitPreferences,
): ConvertedMeasurement {
  if (originalUnit === 'celsius') {
    if (preferences.temperature === 'fahrenheit') {
      return {
        value: celsiusToFahrenheit(value),
        unit: 'fahrenheit',
        displayUnit: '°F',
        decimals: 0,
      };
    }
    return {
      value,
      unit: 'celsius',
      displayUnit: '°C',
      decimals: 0,
    };
  }

  if (originalUnit === 'kmh') {
    if (preferences.speed === 'mph') {
      return {
        value: kmhToMph(value),
        unit: 'mph',
        displayUnit: 'mph',
        decimals: 0,
      };
    }
    return {
      value,
      unit: 'kmh',
      displayUnit: 'km/h',
      decimals: 0,
    };
  }

  // Units that remain as-is
  const displayMap: Record<string, string> = {
    percent: '%',
    rpm: 'RPM',
    gps: 'g/s',
    volts: 'V',
    seconds: 's',
    minutes: 'min',
    km: 'km',
    count: '',
  };

  return {
    value,
    unit: originalUnit,
    displayUnit: displayMap[originalUnit] ?? originalUnit,
    decimals: originalUnit === 'gps' || originalUnit === 'volts' ? 2 : 1,
  };
}
