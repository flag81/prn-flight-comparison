import { NextRequest, NextResponse } from 'next/server';
import { scrapeFlyKsaWithDevToolsAgent } from '@/lib/scrapers/flyksa';
import { scrapeWithDevToolsAgent, scrapePrishtinaTicketWithDevToolsAgent } from '@/lib/scrapers/flyrbp';

// POST handler drives Playwright against each provider and parses flight data from the results DOM
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { from, to, date, returnDate }: { from: string; to: string; date: string; returnDate?: string } = await request.json();

    const results = await Promise.allSettled([
      scrapeFlyKsaWithDevToolsAgent(from, to, date, returnDate ? { returnDate } : undefined),
      scrapeWithDevToolsAgent(from, to, date, {
        providerName: 'Reiseburo Prishtina',
        returnDate,
      }),
      scrapePrishtinaTicketWithDevToolsAgent(from, to, date, { returnDate }),
    ]);

    const outputData: Record<string, unknown> = {};
    const providers = ['FlyKSA Agency', 'Reiseburo Prishtina', 'PrishtinaTicket'];

    results.forEach((result, index) => {
      const name = providers[index];
      if (result.status === 'fulfilled') {
        outputData[name] = result.value;
      } else {
        outputData[name] = {
          error: true,
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
    });

    return NextResponse.json(outputData);
  } catch (globalError: unknown) {
    const message = globalError instanceof Error ? globalError.message : String(globalError);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}