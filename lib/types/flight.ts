export interface FlightSegment {
  departureTime: string;
  arrivalTime: string;
  duration: string;
  flightNumber: string;
  operator: string;
  price?: number | null;
}

export interface FlightLegDetails {
  date: string;
  price: number | null;
  currency: string;
  isAvailable: boolean;
  flights: FlightSegment[];
}

export interface FlightSearchResponse {
  provider: string;
  error?: boolean;
  message?: string;
  outbound: FlightLegDetails;
  inbound?: FlightLegDetails;
}