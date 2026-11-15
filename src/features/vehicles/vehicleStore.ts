import { create } from 'zustand';

import type { Repositories } from '../../lib/db/repositories';
import type { Vehicle } from '../../lib/db/types';

/** Settings key that survives restarts; only the id is stored, never car data. */
export const SELECTED_VEHICLE_KEY = 'vehicle.selected.id';

interface SelectedVehicleState {
  selected: Vehicle | null;
  setSelected: (vehicle: Vehicle | null) => void;
}

export const useSelectedVehicleStore = create<SelectedVehicleState>((set) => ({
  selected: null,
  setSelected: (vehicle) => set({ selected: vehicle }),
}));

/** Reads the remembered car and keeps the store in sync. */
export async function restoreSelectedVehicle(repositories: Repositories): Promise<Vehicle | null> {
  const id = await repositories.settings.get(SELECTED_VEHICLE_KEY);
  const vehicle = id ? await repositories.vehicles.get(id) : null;
  useSelectedVehicleStore.getState().setSelected(vehicle);
  return vehicle;
}

/** Persists the active car, or forgets it when `vehicle` is null. */
export async function persistSelectedVehicle(
  repositories: Repositories,
  vehicle: Vehicle | null,
): Promise<void> {
  if (vehicle) {
    await repositories.settings.set(SELECTED_VEHICLE_KEY, vehicle.id);
  } else {
    await repositories.settings.delete(SELECTED_VEHICLE_KEY);
  }
  useSelectedVehicleStore.getState().setSelected(vehicle);
}
