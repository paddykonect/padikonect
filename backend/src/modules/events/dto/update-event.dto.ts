import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

// Host can edit everything except privacy (kept fixed post-publish so
// already-joined attendees aren't surprised by a visibility change).
// joinPolicy was never client-settable in the first place.
export class UpdateEventDto extends PartialType(
  OmitType(CreateEventDto, ['privacy'] as const),
) {}
