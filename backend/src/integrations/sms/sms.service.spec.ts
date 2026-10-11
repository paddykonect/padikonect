import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('SmsService', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as { fetch: unknown }).fetch = fetchMock;
  });

  it('no-ops (no network call) when the API key is unset', async () => {
    const service = new SmsService(makeConfig({ 'sms.username': 'sandbox' }));
    expect(service.enabled).toBe(false);
    const sent = await service.send(['+2348012345678'], 'hi');
    expect(sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no-ops with no recipients even when configured', async () => {
    const service = new SmsService(makeConfig({ 'sms.apiKey': 'k' }));
    expect(await service.send([], 'hi')).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to the sandbox endpoint and counts accepted recipients', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          SMSMessageData: {
            Recipients: [{ number: '+2348012345678', status: 'Success' }],
          },
        }),
    });
    const service = new SmsService(
      makeConfig({ 'sms.apiKey': 'key-123', 'sms.username': 'sandbox' }),
    );
    const sent = await service.send(
      ['+2348012345678'],
      'Join my hangout: https://x',
    );
    expect(sent).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('sandbox.africastalking.com');
    expect((init.headers as Record<string, string>).apiKey).toBe('key-123');
    expect(init.body as string).toContain('to=%2B2348012345678');
  });

  it('returns 0 and does not throw on an HTTP error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });
    const service = new SmsService(makeConfig({ 'sms.apiKey': 'bad' }));
    expect(await service.send(['+2348012345678'], 'hi')).toBe(0);
  });
});
