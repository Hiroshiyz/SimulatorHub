import { Injectable } from "@nestjs/common";

export interface RoutingFilterStrategy {
  match(filterValue: any, payload: any): boolean;
}

export class GeographicFilterStrategy implements RoutingFilterStrategy {
  match(filterValue: string[], payload: any): boolean {
    if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) {
      return true;
    }
    // Look for country/city/postalCode in payload
    const country = payload.country || payload.country_code || payload.countryCode;
    const city = payload.city;
    const postalCode = payload.postal_code || payload.postalCode;

    const matchVal = (val: string) =>
      filterValue.some((f) => f.toLowerCase() === val?.toLowerCase());

    if (country && matchVal(country)) return true;
    if (city && matchVal(city)) return true;
    if (postalCode && matchVal(postalCode)) return true;

    // If geographic fields are present but none matched, filter fails
    if (country || city || postalCode) {
      return false;
    }

    // If payload doesn't contain geographic fields, pass by default
    return true;
  }
}

export class PowerTypeFilterStrategy implements RoutingFilterStrategy {
  match(filterValue: string[], payload: any): boolean {
    if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) {
      return true;
    }

    // Payloads with evses (e.g. Locations)
    if (payload.evses && Array.isArray(payload.evses)) {
      for (const evse of payload.evses) {
        if (evse.connectors && Array.isArray(evse.connectors)) {
          for (const conn of evse.connectors) {
            if (
              conn.power_type &&
              filterValue.some((p) => p.toUpperCase() === conn.power_type.toUpperCase())
            ) {
              return true;
            }
          }
        }
      }
      return false; // evses exists, but none match
    }

    // Direct top-level fields (e.g. for connector/EVSE payload)
    if (
      payload.power_type &&
      filterValue.some((p) => p.toUpperCase() === payload.power_type.toUpperCase())
    ) {
      return true;
    }

    if (payload.power_types && Array.isArray(payload.power_types)) {
      return payload.power_types.some((p: string) =>
        filterValue.some((f) => f.toUpperCase() === p.toUpperCase())
      );
    }

    // If payload doesn't contain power type fields, pass by default
    return true;
  }
}

@Injectable()
export class RoutingFilterEngine {
  private readonly strategies: Record<string, RoutingFilterStrategy> = {
    geographic_regions: new GeographicFilterStrategy(),
    power_types: new PowerTypeFilterStrategy(),
  };

  evaluate(routingFilters: any, payload: any): boolean {
    if (!routingFilters || typeof routingFilters !== "object") {
      return true;
    }
    for (const [key, value] of Object.entries(routingFilters)) {
      const strategy = this.strategies[key];
      if (strategy) {
        if (!strategy.match(value, payload)) {
          return false;
        }
      }
    }
    return true;
  }
}
