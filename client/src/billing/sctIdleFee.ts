// 星舟快充 (SCT) 佔槍費 OCPI 串接規格 v1.6
// Pure billing helpers: the tariff the simulator pushes, and the idle (佔槍) fee settlement.

export interface TariffRestrictions {
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  min_duration?: number;
  max_duration?: number;
}

export interface TariffPriceComponent {
  type: "ENERGY" | "FLAT" | "PARKING_TIME" | "TIME";
  price: number;
  step_size: number;
}

export interface TariffElement {
  price_components: TariffPriceComponent[];
  restrictions?: TariffRestrictions;
}

export interface OcpiTariff {
  country_code: string;
  party_id: string;
  id: string;
  currency: string;
  type: string;
  elements: TariffElement[];
  tariff_alt_text: { language: string; text: string }[];
  start_date_time: string;
  last_updated: string;
}

export const SCT_COUNTRY_CODE = "TW";
export const SCT_PARTY_ID = "SCT";
export const SCT_TARIFF_ID = "SCT-IDLE-TEST";

// Test values, not SCT's production prices: 1 minute free buffer, then NT$20 per started minute
export const SCT_TEST_CONFIG = {
  energyPricePerKwh: 5.5,
  idlePricePerMinute: 20,
  bufferMinutes: 1,
};

const TAIPEI_OFFSET_MS = 8 * 3600 * 1000;
const DAY_SECONDS = 86400;

export function isSctParty(partyId?: string | null) {
  return partyId?.toUpperCase() === SCT_PARTY_ID;
}

export function secondsToHours(seconds: number) {
  return Math.round((seconds / 3600) * 10000) / 10000;
}

// Asia/Taipei has no DST, so a fixed +08:00 offset is exact
function taipeiDate(at: Date) {
  return new Date(at.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

function taipeiSecondOfDay(at: Date) {
  const shifted = new Date(at.getTime() + TAIPEI_OFFSET_MS);
  return shifted.getUTCHours() * 3600 + shifted.getUTCMinutes() * 60 + shifted.getUTCSeconds();
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function taipeiInstant(date: string, secondOfDay: number) {
  return new Date(new Date(`${date}T00:00:00+08:00`).getTime() + secondOfDay * 1000);
}

function parseTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
}

// Date/time part of the restrictions only; durations are evaluated per billing entry
function matchesDateTime(r: TariffRestrictions | undefined, at: Date) {
  if (!r) return true;
  const date = taipeiDate(at);
  if (r.start_date && date < r.start_date) return false;
  if (r.end_date && date >= r.end_date) return false;
  if (!r.start_time && !r.end_time) return true;

  const sod = taipeiSecondOfDay(at);
  const start = parseTime(r.start_time ?? "00:00");
  // 日末以 00:00 表示
  const end = r.end_time && r.end_time !== "00:00" ? parseTime(r.end_time) : DAY_SECONDS;
  return start < end ? sod >= start && sod < end : sod >= start || sod < end;
}

function hasComponent(element: TariffElement, ...types: TariffPriceComponent["type"][]) {
  return element.price_components.some((c) => types.includes(c.type));
}

// Elements expanded per day as the spec requires, for today and the next two days (Taipei)
export function buildSctTariff(now = new Date()): OcpiTariff {
  const today = taipeiDate(now);
  const { energyPricePerKwh, idlePricePerMinute, bufferMinutes } = SCT_TEST_CONFIG;
  const elements: TariffElement[] = [];

  for (let i = 0; i < 3; i++) {
    const day = { start_date: addDays(today, i), end_date: addDays(today, i + 1) };
    elements.push(
      {
        price_components: [{ type: "ENERGY", price: energyPricePerKwh, step_size: 1 }],
        restrictions: { ...day, start_time: "00:00", end_time: "00:00" },
      },
      {
        price_components: [{ type: "PARKING_TIME", price: idlePricePerMinute * 60, step_size: 60 }],
        restrictions: { ...day, start_time: "00:00", end_time: "00:00", min_duration: 0 },
      },
    );
  }

  const effectiveFrom = taipeiInstant(today, 0).toISOString().replace(".000Z", "Z");
  return {
    country_code: SCT_COUNTRY_CODE,
    party_id: SCT_PARTY_ID,
    id: SCT_TARIFF_ID,
    currency: "TWD",
    type: "REGULAR",
    elements,
    tariff_alt_text: [
      { language: "zh", text: "日期與時間以臺北時間為準。佔槍費自充電結束後未拔槍起計算。" },
      {
        language: "zh",
        text: `開始佔槍的免費緩衝：全日 ${bufferMinutes} 分鐘。同一次佔槍只有一次緩衝，緩衝結束後開始計費。`,
      },
      {
        language: "zh",
        text: "進入不同的佔槍費率時段或跨日時，計費時間重新從 0 起算，已產生的費用照算，不再給緩衝；只有充電費率切換時不重算。",
      },
      {
        language: "zh",
        text: "按分鐘計費時，每次進入時段的計費時間不足 1 分鐘以 1 分鐘計，各段金額四捨五入至整元後加總。",
      },
    ],
    start_date_time: effectiveFrom,
    last_updated: effectiveFrom,
  };
}

export function sctEnergyCost(tariff: OcpiTariff, kwh: number, chargingStart: Date) {
  const element = tariff.elements.find(
    (e) => hasComponent(e, "ENERGY") && matchesDateTime(e.restrictions, chargingStart),
  );
  const price = element?.price_components.find((c) => c.type === "ENERGY")?.price ?? 0;
  return Math.round(kwh * price);
}

// Buffer minutes are not in elements (spec 1.2.3); the simulator uses one value for all zones
export function sctBufferMinutes() {
  return SCT_TEST_CONFIG.bufferMinutes;
}

export interface IdlePeriod {
  start: Date;
  end: Date;
  billable: boolean;
}

export interface IdleFeeResult {
  // ChargingPeriods of the idle phase: split at idle zone changes, day changes and buffer end
  periods: IdlePeriod[];
  bufferEnd: Date;
  idleSeconds: number;
  idleCost: number;
}

// Which idle-fee elements apply at a moment, ignoring durations. A change of key means a new
// 佔槍費率時段 (or a new day), which restarts the billing seconds.
function idleZoneKey(idleElements: TariffElement[], at: Date) {
  const matching = idleElements
    .map((e, i) => (matchesDateTime(e.restrictions, at) ? i : -1))
    .filter((i) => i >= 0);
  return `${taipeiDate(at)}|${matching.join(",")}`;
}

function entryCost(idleElements: TariffElement[], entryStart: Date, seconds: number) {
  let cost = 0;
  for (const element of idleElements) {
    if (!matchesDateTime(element.restrictions, entryStart)) continue;
    const minDuration = element.restrictions?.min_duration ?? 0;
    const maxDuration = element.restrictions?.max_duration ?? Infinity;

    for (const component of element.price_components) {
      if (component.type === "PARKING_TIME") {
        // Round the entry up to whole steps first, then price the slice inside [min, max)
        const step = component.step_size || 1;
        const billed = Math.ceil(seconds / step) * step;
        const slice = Math.max(0, Math.min(billed, maxDuration) - minDuration);
        cost += Math.round((slice / 3600) * component.price);
      } else if (component.type === "FLAT" && seconds > minDuration) {
        // 分段定額: each segment is charged once billing time actually passes its start
        cost += component.price;
      }
    }
  }
  return cost;
}

export function computeIdleFee(
  tariff: OcpiTariff,
  chargingEnd: Date,
  unplug: Date,
  bufferMinutes = sctBufferMinutes(),
): IdleFeeResult {
  const bufferEnd = new Date(chargingEnd.getTime() + bufferMinutes * 60 * 1000);
  const idleSeconds = Math.max(0, (unplug.getTime() - chargingEnd.getTime()) / 1000);
  if (idleSeconds === 0) {
    return { periods: [], bufferEnd, idleSeconds: 0, idleCost: 0 };
  }

  const idleElements = tariff.elements.filter((e) => hasComponent(e, "PARKING_TIME", "FLAT"));

  // Candidate split points: buffer end, Taipei midnights and every restriction start/end time
  const cuts = new Set<number>([bufferEnd.getTime()]);
  const lastDate = taipeiDate(unplug);
  for (let date = taipeiDate(chargingEnd); date <= lastDate; date = addDays(date, 1)) {
    cuts.add(taipeiInstant(date, 0).getTime());
    cuts.add(taipeiInstant(date, DAY_SECONDS).getTime());
    for (const element of idleElements) {
      for (const time of [element.restrictions?.start_time, element.restrictions?.end_time]) {
        if (time) cuts.add(taipeiInstant(date, parseTime(time)).getTime());
      }
    }
  }
  const points = [
    chargingEnd.getTime(),
    ...[...cuts].filter((t) => t > chargingEnd.getTime() && t < unplug.getTime()).sort((a, b) => a - b),
    unplug.getTime(),
  ];

  const periods: (IdlePeriod & { zone: string })[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = new Date(points[i]);
    const zone = idleZoneKey(idleElements, start);
    const billable = points[i] >= bufferEnd.getTime();
    const prev = periods[periods.length - 1];
    if (prev && prev.zone === zone && prev.billable === billable) {
      prev.end = new Date(points[i + 1]);
    } else {
      periods.push({ start, end: new Date(points[i + 1]), billable, zone });
    }
  }

  // Each billable period is one entry into an idle zone; its billing seconds start from 0
  const idleCost = periods
    .filter((p) => p.billable)
    .reduce((sum, p) => sum + entryCost(idleElements, p.start, (p.end.getTime() - p.start.getTime()) / 1000), 0);

  return {
    periods: periods.map(({ start, end, billable }) => ({ start, end, billable })),
    bufferEnd,
    idleSeconds,
    idleCost,
  };
}
