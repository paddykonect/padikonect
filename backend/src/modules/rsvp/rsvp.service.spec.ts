/* eslint-disable @typescript-eslint/no-unsafe-member-access -- untyped jest.fn() mock.calls */
import { PrismaService } from '../../database/prisma.service';
import { RsvpService } from './rsvp.service';

function makeLockedEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'event-1',
    hostId: 'host-1',
    title: 'Padi Meetup',
    capacity: 2,
    status: 'PUBLISHED',
    startAt: new Date(Date.now() + 3600_000),
    endAt: null,
    joinPolicy: 'OPEN',
    ...overrides,
  };
}

function makeTx(
  eventRow: ReturnType<typeof makeLockedEventRow> | undefined,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    $queryRaw: jest.fn().mockResolvedValue(eventRow ? [eventRow] : []),
    rsvp: {
      count: jest.fn().mockResolvedValue(0),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: unknown }) =>
          Promise.resolve(create),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: unknown }) =>
          Promise.resolve(data),
        ),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { waitlistPosition: null } }),
    },
    conversation: { findUnique: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
    conversationParticipant: { upsert: jest.fn() },
    ...overrides,
  };
}

function makeService(tx: ReturnType<typeof makeTx>) {
  const prisma = {
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
  } as unknown as PrismaService;
  return new RsvpService(prisma);
}

describe('RsvpService', () => {
  describe('join', () => {
    it('throws EVENT_NOT_FOUND when the event row is missing', async () => {
      const tx = makeTx(undefined);
      const service = makeService(tx);
      await expect(service.join('missing', 'user-1')).rejects.toMatchObject({
        code: 'EVENT_NOT_FOUND',
      });
    });

    it('throws EVENT_CANCELLED for a cancelled event', async () => {
      const tx = makeTx(makeLockedEventRow({ status: 'CANCELLED' }));
      const service = makeService(tx);
      await expect(service.join('event-1', 'user-1')).rejects.toMatchObject({
        code: 'EVENT_CANCELLED',
      });
    });

    it('throws EVENT_ENDED once endAt (or startAt with no endAt) has passed', async () => {
      const tx = makeTx(
        makeLockedEventRow({
          startAt: new Date(Date.now() - 1000),
          endAt: null,
        }),
      );
      const service = makeService(tx);
      await expect(service.join('event-1', 'user-1')).rejects.toMatchObject({
        code: 'EVENT_ENDED',
      });
    });

    it('throws CANNOT_JOIN_OWN_EVENT when the host tries to join their own event', async () => {
      const tx = makeTx(makeLockedEventRow({ hostId: 'user-1' }));
      const service = makeService(tx);
      await expect(service.join('event-1', 'user-1')).rejects.toMatchObject({
        code: 'CANNOT_JOIN_OWN_EVENT',
      });
    });

    it('goes straight to REQUESTED for an APPROVAL-policy event regardless of capacity', async () => {
      const tx = makeTx(makeLockedEventRow({ joinPolicy: 'APPROVAL' }));
      tx.rsvp.count.mockResolvedValue(0);
      const service = makeService(tx);
      const rsvp = (await service.join('event-1', 'user-1')) as {
        status: string;
      };
      expect(rsvp.status).toBe('REQUESTED');
    });

    it('auto-approves for an OPEN-policy event with spare capacity', async () => {
      const tx = makeTx(
        makeLockedEventRow({ joinPolicy: 'OPEN', capacity: 5 }),
      );
      tx.rsvp.count.mockResolvedValue(2);
      const service = makeService(tx);
      const rsvp = (await service.join('event-1', 'user-1')) as {
        status: string;
      };
      expect(rsvp.status).toBe('APPROVED');
      expect(tx.conversationParticipant.upsert).toHaveBeenCalled();
    });

    it('waitlists for an OPEN-policy event that is already full — never exceeds capacity', async () => {
      const tx = makeTx(
        makeLockedEventRow({ joinPolicy: 'OPEN', capacity: 2 }),
      );
      tx.rsvp.count.mockResolvedValue(2);
      tx.rsvp.aggregate.mockResolvedValue({ _max: { waitlistPosition: 3 } });
      const service = makeService(tx);
      const rsvp = (await service.join('event-1', 'user-1')) as {
        status: string;
        waitlistPosition: number;
      };
      expect(rsvp.status).toBe('WAITLISTED');
      expect(rsvp.waitlistPosition).toBe(4);
      expect(tx.conversationParticipant.upsert).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('throws RSVP_NOT_FOUND when there is no pending request for that user', async () => {
      const tx = makeTx(makeLockedEventRow());
      tx.rsvp.findUnique.mockResolvedValue(null);
      const service = makeService(tx);
      await expect(service.approve('event-1', 'user-1')).rejects.toMatchObject({
        code: 'RSVP_NOT_FOUND',
      });
    });

    it('approves when capacity remains', async () => {
      const tx = makeTx(makeLockedEventRow({ capacity: 5 }));
      tx.rsvp.findUnique.mockResolvedValue({
        id: 'rsvp-1',
        status: 'REQUESTED',
        waitlistPosition: null,
      });
      tx.rsvp.count.mockResolvedValue(1);
      const service = makeService(tx);
      const result = (await service.approve('event-1', 'user-1')) as {
        status: string;
      };
      expect(result.status).toBe('APPROVED');
    });

    it('falls back to WAITLISTED if capacity filled since the request was made — never overbooks', async () => {
      const tx = makeTx(makeLockedEventRow({ capacity: 2 }));
      tx.rsvp.findUnique.mockResolvedValue({
        id: 'rsvp-1',
        status: 'REQUESTED',
        waitlistPosition: null,
      });
      tx.rsvp.count.mockResolvedValue(2);
      tx.rsvp.aggregate.mockResolvedValue({ _max: { waitlistPosition: null } });
      const service = makeService(tx);
      const result = (await service.approve('event-1', 'user-1')) as {
        status: string;
      };
      expect(result.status).toBe('WAITLISTED');
    });
  });

  describe('cancel', () => {
    it('promotes the next-in-line waitlisted user when an approved attendee cancels', async () => {
      const tx = makeTx(makeLockedEventRow());
      tx.rsvp.findUnique.mockResolvedValue({
        id: 'rsvp-1',
        status: 'APPROVED',
      });
      tx.rsvp.findFirst.mockResolvedValue({
        id: 'rsvp-2',
        userId: 'waitlisted-user',
      });
      const service = makeService(tx);
      await service.cancel('event-1', 'user-1');

      const promotionCall = tx.rsvp.update.mock.calls.find(
        (call) => (call[0] as { where: { id: string } }).where.id === 'rsvp-2',
      ) as [
        {
          where: { id: string };
          data: {
            status: string;
            waitlistPosition: number | null;
            respondedAt: Date;
          };
        },
      ];
      expect(promotionCall).toBeDefined();
      expect(promotionCall[0].data.status).toBe('APPROVED');
      expect(promotionCall[0].data.waitlistPosition).toBeNull();
      expect(promotionCall[0].data.respondedAt).toBeInstanceOf(Date);
      expect(tx.conversationParticipant.upsert).toHaveBeenCalled();
    });

    it('does not attempt promotion when the cancelling RSVP was not approved', async () => {
      const tx = makeTx(makeLockedEventRow());
      tx.rsvp.findUnique.mockResolvedValue({
        id: 'rsvp-1',
        status: 'REQUESTED',
      });
      const service = makeService(tx);
      await service.cancel('event-1', 'user-1');

      expect(tx.rsvp.findFirst).not.toHaveBeenCalled();
    });
  });
});
