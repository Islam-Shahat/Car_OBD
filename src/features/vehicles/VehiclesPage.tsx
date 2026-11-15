import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../app/EmptyState';
import { PageHeader } from '../../app/PageHeader';
import { IconAlert, IconCar, IconCheck } from '../../app/icons';
import { useStorage } from '../../lib/db/StorageProvider';
import type { CatalogEntry, CatalogMake, Vehicle } from '../../lib/db/types';
import {
  persistSelectedVehicle,
  restoreSelectedVehicle,
  useSelectedVehicleStore,
} from './vehicleStore';

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** Localized make keys are static so the typed i18n catalog accepts them. */
const MAKE_NAME_KEYS = {
  toyota: 'vehicles.makeNames.toyota',
  nissan: 'vehicles.makeNames.nissan',
  hyundai: 'vehicles.makeNames.hyundai',
  kia: 'vehicles.makeNames.kia',
  chevrolet: 'vehicles.makeNames.chevrolet',
  ford: 'vehicles.makeNames.ford',
  honda: 'vehicles.makeNames.honda',
  mitsubishi: 'vehicles.makeNames.mitsubishi',
  mazda: 'vehicles.makeNames.mazda',
  suzuki: 'vehicles.makeNames.suzuki',
  renault: 'vehicles.makeNames.renault',
  peugeot: 'vehicles.makeNames.peugeot',
  fiat: 'vehicles.makeNames.fiat',
  opel: 'vehicles.makeNames.opel',
  volkswagen: 'vehicles.makeNames.volkswagen',
  skoda: 'vehicles.makeNames.skoda',
  bmw: 'vehicles.makeNames.bmw',
  'mercedes-benz': 'vehicles.makeNames.mercedes-benz',
  audi: 'vehicles.makeNames.audi',
  chery: 'vehicles.makeNames.chery',
  geely: 'vehicles.makeNames.geely',
  mg: 'vehicles.makeNames.mg',
  byd: 'vehicles.makeNames.byd',
  changan: 'vehicles.makeNames.changan',
  'great-wall': 'vehicles.makeNames.great-wall',
  haval: 'vehicles.makeNames.haval',
  daewoo: 'vehicles.makeNames.daewoo',
  lada: 'vehicles.makeNames.lada',
  dacia: 'vehicles.makeNames.dacia',
  citroen: 'vehicles.makeNames.citroen',
  jeep: 'vehicles.makeNames.jeep',
  dodge: 'vehicles.makeNames.dodge',
  chrysler: 'vehicles.makeNames.chrysler',
} as const;

type MakeNameKey = (typeof MAKE_NAME_KEYS)[keyof typeof MAKE_NAME_KEYS];

function makeNameKey(slug: string): MakeNameKey | null {
  return (MAKE_NAME_KEYS as Record<string, MakeNameKey>)[slug] ?? null;
}

/** Latin make/model names and their Arabic catalog aliases both work. */
function vehicleLabel(vehicle: Vehicle): string {
  const make = vehicle.make ?? vehicle.makeText ?? '';
  const model = vehicle.model ?? vehicle.modelText ?? '';
  return [make, model].filter(Boolean).join(' ');
}

type FormMode = 'catalog' | 'free';

export function VehiclesPage() {
  const { t } = useTranslation();
  const { repositories, status: storageStatus, error: storageError } = useStorage();
  const selected = useSelectedVehicleStore((state) => state.selected);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [makes, setMakes] = useState<CatalogMake[]>([]);
  const [makeQuery, setMakeQuery] = useState('');
  const [makeSlug, setMakeSlug] = useState<string | null>(null);
  const [modelQuery, setModelQuery] = useState('');
  const [models, setModels] = useState<CatalogEntry[]>([]);
  const [entry, setEntry] = useState<CatalogEntry | null>(null);
  const [year, setYear] = useState('');
  const [mode, setMode] = useState<FormMode>('catalog');
  const [freeMake, setFreeMake] = useState('');
  const [freeModel, setFreeModel] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!repositories) return undefined;

    void Promise.all([
      repositories.vehicles.list(),
      repositories.catalog.makes(),
      restoreSelectedVehicle(repositories),
    ])
      .then(([saved, catalogMakes]) => {
        if (cancelled) return;
        setVehicles(saved);
        setMakes(catalogMakes);
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(t('vehicles.errors.loadFailed'));
        if (!cancelled) setDetail(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repositories, t]);

  useEffect(() => {
    let cancelled = false;
    if (!repositories || !makeSlug) return undefined;

    void repositories.catalog
      .search(modelQuery, makeSlug)
      .then((rows) => {
        if (!cancelled) setModels(rows);
      })
      .catch(() => {
        // The free-text path stays available when the catalog cannot be read.
        if (!cancelled) setModels([]);
      });

    return () => {
      cancelled = true;
    };
  }, [repositories, makeSlug, modelQuery]);

  const visibleMakes = useMemo(() => {
    const needle = makeQuery.trim().toLowerCase();
    if (!needle) return makes;
    return makes.filter((make) => {
      const key = makeNameKey(make.makeSlug);
      const localName = key ? t(key).toLowerCase() : '';
      return (
        make.make.toLowerCase().includes(needle) ||
        make.makeSlug.includes(needle) ||
        localName.includes(needle)
      );
    });
  }, [makes, makeQuery, t]);

  const selectedMake = makes.find((make) => make.makeSlug === makeSlug) ?? null;
  const makeLabel = (make: CatalogMake) => {
    const key = makeNameKey(make.makeSlug);
    return key ? t(key) : make.make;
  };
  const yearNumber = year.trim() === '' ? null : Number(year);
  const yearValid =
    yearNumber === null ||
    (Number.isInteger(yearNumber) && yearNumber >= MIN_YEAR && yearNumber <= MAX_YEAR);

  const canSave =
    !saving &&
    yearValid &&
    (mode === 'catalog'
      ? entry !== null
      : freeMake.trim().length > 0 && freeModel.trim().length > 0);

  const resetForm = () => {
    setMakeQuery('');
    setMakeSlug(null);
    setModelQuery('');
    setModels([]);
    setEntry(null);
    setYear('');
    setFreeMake('');
    setFreeModel('');
  };

  const remember = async (vehicle: Vehicle | null) => {
    if (!repositories) return;
    try {
      await persistSelectedVehicle(repositories, vehicle);
    } catch (error) {
      setFailure(t('vehicles.errors.selectFailed'));
      setDetail(error instanceof Error ? error.message : String(error));
    }
  };

  const saveVehicle = async () => {
    if (!repositories || !canSave) return;
    if (!yearValid) {
      setFailure(t('vehicles.errors.yearRange'));
      return;
    }

    setSaving(true);
    setFailure(null);
    setDetail(null);
    try {
      const created = await repositories.vehicles.create(
        mode === 'catalog' && entry
          ? {
              catalogId: entry.id,
              make: entry.make,
              model: entry.model,
              year: yearNumber,
            }
          : {
              makeText: freeMake.trim(),
              modelText: freeModel.trim(),
              year: yearNumber,
            },
      );
      setVehicles((current) => [created, ...current]);
      await remember(created);
      resetForm();
      setMode('catalog');
    } catch (error) {
      setFailure(t('vehicles.errors.saveFailed'));
      setDetail(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const removeVehicle = async (vehicle: Vehicle) => {
    if (!repositories) return;
    try {
      await repositories.vehicles.softDelete(vehicle.id);
      setVehicles((current) => current.filter((row) => row.id !== vehicle.id));
      if (selected?.id === vehicle.id) await remember(null);
    } catch (error) {
      setFailure(t('vehicles.errors.deleteFailed'));
      setDetail(error instanceof Error ? error.message : String(error));
    }
  };

  if (storageStatus === 'error') {
    return (
      <>
        <PageHeader title={t('pages.vehicles.title')} subtitle={t('pages.vehicles.subtitle')} />
        <EmptyState
          icon={<IconCar className="size-7" />}
          badge={t('vehicles.storageBadge')}
          title={t('vehicles.storageTitle')}
          body={t('vehicles.storageUnavailable')}
        />
        {storageError && (
          <p dir="ltr" className="mt-3 font-mono text-xs text-slate-500 dark:text-slate-400">
            {storageError}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('pages.vehicles.title')} subtitle={t('pages.vehicles.subtitle')} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">{t('vehicles.selectedTitle')}</h2>
        {selected ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg bg-blue-600/10 px-3 py-2 text-sm font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-200">
              <IconCar className="size-4" />
              {vehicleLabel(selected)}
              {selected.year !== null && (
                <span dir="ltr" className="font-mono text-xs opacity-80">
                  {selected.year}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => void remember(null)}
              className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('vehicles.clearSelection')}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('vehicles.selectedNone')}
          </p>
        )}
      </section>

      {failure && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
        >
          <p className="flex items-start gap-2">
            <IconAlert className="mt-0.5 size-4 shrink-0" />
            <span>{failure}</span>
          </p>
          {detail && (
            <p dir="ltr" className="mt-2 ps-6 font-mono text-xs break-words opacity-80">
              {detail}
            </p>
          )}
        </div>
      )}

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{t('vehicles.addTitle')}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {mode === 'catalog' ? t('vehicles.catalogHint') : t('vehicles.freeHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'catalog' ? 'free' : 'catalog');
              setFailure(null);
            }}
            className="text-xs font-semibold text-blue-700 underline-offset-4 hover:underline dark:text-blue-300"
          >
            {mode === 'catalog' ? t('vehicles.notListed') : t('vehicles.backToCatalog')}
          </button>
        </div>

        {mode === 'catalog' ? (
          <div className="mt-4 grid gap-5">
            <div>
              <label htmlFor="vehicle-make-search" className="text-xs font-semibold">
                {t('vehicles.make')}
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  id="vehicle-make-search"
                  type="search"
                  value={makeQuery}
                  onChange={(event) => setMakeQuery(event.target.value)}
                  placeholder={t('vehicles.makeSearch')}
                  className="h-10 min-w-48 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                {selectedMake && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    {makeLabel(selectedMake)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {visibleMakes.map((make) => (
                  <button
                    key={make.makeSlug}
                    type="button"
                    aria-pressed={make.makeSlug === makeSlug}
                    onClick={() => {
                      setMakeSlug(make.makeSlug);
                      setEntry(null);
                      setModelQuery('');
                      setModels([]);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      make.makeSlug === makeSlug
                        ? 'border-blue-600 bg-blue-600/10 text-blue-700 dark:border-blue-500 dark:text-blue-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {makeLabel(make)}
                    <span className="ms-1 text-[10px] opacity-60">{make.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {makeSlug && (
              <div>
                <label htmlFor="vehicle-model-search" className="text-xs font-semibold">
                  {t('vehicles.model')}
                </label>
                <input
                  id="vehicle-model-search"
                  type="search"
                  value={modelQuery}
                  onChange={(event) => {
                    setModelQuery(event.target.value);
                    setEntry(null);
                  }}
                  placeholder={t('vehicles.modelSearch')}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                {models.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t('vehicles.noResults')}
                  </p>
                ) : (
                  <ul className="mt-2 grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
                    {models.map((model) => (
                      <li key={model.id}>
                        <button
                          type="button"
                          aria-pressed={entry?.id === model.id}
                          onClick={() => setEntry(model)}
                          className={`w-full rounded-lg border px-3 py-2 text-start text-xs font-medium transition-colors ${
                            entry?.id === model.id
                              ? 'border-blue-600 bg-blue-600/10 text-blue-700 dark:border-blue-500 dark:text-blue-300'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          {model.model}
                          {(model.yearFrom !== null || model.yearTo !== null) && (
                            <span dir="ltr" className="ms-2 font-mono text-[10px] opacity-60">
                              {model.yearFrom ?? ''}–{model.yearTo ?? ''}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              {t('vehicles.freeMake')}
              <input
                type="text"
                value={freeMake}
                onChange={(event) => setFreeMake(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="text-xs font-semibold">
              {t('vehicles.freeModel')}
              <input
                type="text"
                value={freeModel}
                onChange={(event) => setFreeModel(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold">
            {t('vehicles.year')}
            <span className="ms-1 font-normal text-slate-500 dark:text-slate-400">
              ({t('vehicles.yearOptional')})
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={year}
              onChange={(event) => setYear(event.target.value)}
              placeholder={t('vehicles.yearPlaceholder')}
              className="mt-1 block h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <button
            type="button"
            onClick={() => void saveVehicle()}
            disabled={!canSave}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconCar className="size-4" />
            {saving ? t('vehicles.saving') : t('vehicles.save')}
          </button>
          {!yearValid && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('vehicles.errors.yearRange')}
            </p>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">{t('vehicles.savedTitle')}</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('vehicles.loading')}</p>
        ) : vehicles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('vehicles.savedEmpty')}
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {vehicles.map((vehicle) => {
              const isSelected = selected?.id === vehicle.id;
              return (
                <li
                  key={vehicle.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-500/10'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{vehicleLabel(vehicle)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {vehicle.year ?? t('vehicles.yearUnknown')}
                      {isSelected && (
                        <span className="ms-2 rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          {t('vehicles.selectedBadge')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isSelected && (
                      <button
                        type="button"
                        onClick={() => void remember(vehicle)}
                        className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        {t('vehicles.use')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeVehicle(vehicle)}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {t('vehicles.remove')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
