'use client';
import { useState } from 'react';
import type { FlightSearchResponse } from '@/lib/types/flight';

interface SearchParams {
  from: string;
  to: string;
  date: string;
  returnDate: string;
  roundTrip: boolean;
}

type SearchResults = Record<string, FlightSearchResponse>;

export default function Home() {
  const [searchParams, setSearchParams] = useState<SearchParams>({
    from: 'PRN',
    to: 'STR',
    date: '2026-08-15',
    returnDate: '2026-08-22',
    roundTrip: false,
  });

  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (): Promise<void> => {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: searchParams.from,
          to: searchParams.to,
          date: searchParams.date,
          returnDate: searchParams.roundTrip ? searchParams.returnDate : undefined,
        }),
      });

      const data: SearchResults = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Search execution failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-10 bg-gray-100 min-h-screen">
      <div className="flex flex-col max-w-6xl mx-auto gap-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={searchParams.roundTrip}
              onChange={(e) => setSearchParams({ ...searchParams, roundTrip: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            Round Trip
          </label>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center bg-white border border-gray-300 rounded shadow-sm p-3 gap-2 w-full">
          <div className="flex-1 min-w-[120px] border-r border-gray-100 px-3">
            <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">From</label>
            <input
              type="text"
              className="w-full text-base font-medium outline-none text-gray-800"
              value={searchParams.from}
              onChange={(e) => setSearchParams({ ...searchParams, from: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="flex-1 min-w-[120px] border-r border-gray-100 px-3">
            <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">To</label>
            <input
              type="text"
              className="w-full text-base font-medium outline-none text-gray-800"
              value={searchParams.to}
              onChange={(e) => setSearchParams({ ...searchParams, to: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="flex-1 min-w-[140px] border-r border-gray-100 px-3">
            <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Departure</label>
            <input
              type="date"
              className="w-full text-base font-medium outline-none text-gray-800"
              value={searchParams.date}
              onChange={(e) => setSearchParams({ ...searchParams, date: e.target.value })}
            />
          </div>
          {searchParams.roundTrip && (
            <div className="flex-1 min-w-[140px] border-r border-gray-100 px-3">
              <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Return</label>
              <input
                type="date"
                className="w-full text-base font-medium outline-none text-gray-800"
                value={searchParams.returnDate}
                onChange={(e) => setSearchParams({ ...searchParams, returnDate: e.target.value })}
              />
            </div>
          )}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-[#004b93] hover:bg-[#00366b] disabled:bg-gray-400 text-white font-bold py-3 px-6 text-sm rounded whitespace-nowrap transition-colors ml-auto"
          >
            {loading ? 'Searching...' : 'Search flight'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading && (
          <div className="col-span-2 text-center py-4 font-semibold text-gray-700">
            Executing background browser automation and AI extraction workflows...
          </div>
        )}

        {results && Object.entries(results).map(([agency, res]) => (
          <div key={agency} className="bg-white rounded border border-gray-200 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#004b93] border-b-2 border-[#004b93] pb-2 mb-4">{agency}</h3>

            {res.error ? (
              <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 mb-4">
                Error gathering data: {res.message}
              </p>
            ) : !res.outbound.isAvailable && !(searchParams.roundTrip && res.inbound?.isAvailable) ? (
              <p className="text-sm text-gray-400 italic">No flight data recovered.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Outbound Flights</h4>
                  {!res.outbound.isAvailable ? (
                    <p className="text-xs text-gray-400 italic">No outbound flights found.</p>
                  ) : (
                    res.outbound.flights.map((flight, i) => (
                      <div key={`out-${i}`} className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded p-3 mb-2">
                        <div>
                          <div className="font-bold text-gray-800 text-sm">
                            {flight.departureTime} &rarr; {flight.arrivalTime}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {flight.flightNumber} | {flight.operator}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-red-600">
                          {flight.price != null ? `€${flight.price.toFixed(2)}` : flight.duration}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {searchParams.roundTrip && res.inbound && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-t pt-2">Return Flights</h4>
                    {!res.inbound.isAvailable ? (
                      <p className="text-xs text-gray-400 italic">No return flights found.</p>
                    ) : (
                      res.inbound.flights.map((flight, i) => {
                      return (
                        <div key={`ret-${i}`} className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded p-3 mb-2">
                          <div>
                            <div className="font-bold text-gray-800 text-sm">
                              {flight.departureTime} &rarr; {flight.arrivalTime}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {flight.flightNumber} | {flight.operator}
                            </div>
                          </div>
                          <div className="text-sm font-bold text-red-600">
                            {flight.price != null ? `€${flight.price.toFixed(2)}` : flight.duration}
                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
