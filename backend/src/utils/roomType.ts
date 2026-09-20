import { Prisma } from '@prisma/client';

export function effectiveRoomType(roomType: unknown, capacity: unknown): string {
  const type = String(roomType || '').trim();
  const people = Number(capacity);

  if (type.toLowerCase() === 'custom' && Number.isInteger(people) && people > 0) {
    return `${people} Share`;
  }

  return type;
}

export function preferredRoomTypeFilter(preferredRoomType: unknown): Prisma.RoomWhereInput {
  const type = String(preferredRoomType || '').trim();
  const match = type.match(/^(\d+)\s+Share$/i);

  if (!match) return { roomType: type };

  const capacity = Number(match[1]);
  return {
    OR: [
      { roomType: type },
      { roomType: 'Custom', capacity },
    ],
  };
}
