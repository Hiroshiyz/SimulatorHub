// CPOs that bill an idle (佔槍) fee: a remote STOP_SESSION only ends charging, and the
// session stays ACTIVE until the vehicle is unplugged (see 星舟快充佔槍費 OCPI 串接規格 v1.6)
export const IDLE_FEE_CPO_PARTY_IDS = ["SCT"];

export function isIdleFeeCpo(partyId: string) {
  return IDLE_FEE_CPO_PARTY_IDS.includes(partyId.toUpperCase());
}

// OCPI 2.2.1 CDR/Session durations are decimal hours
export function secondsToHours(seconds: number) {
  return Math.round((seconds / 3600) * 10000) / 10000;
}
