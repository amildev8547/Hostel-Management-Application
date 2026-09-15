export function formatRoomType(roomType: unknown, capacity: unknown, usePeopleLabel = false): string {
  const type = String(roomType || '').trim();
  const customCapacity = Number(capacity);
  const shareMatch = type.match(/^(\d+)\s+Share$/i);
  const people = type.toLowerCase() === 'custom' ? customCapacity : Number(shareMatch?.[1]);

  if (Number.isInteger(people) && people > 0) {
    return usePeopleLabel
      ? `${people} ${people === 1 ? 'person' : 'people'}`
      : `${people} Share`;
  }

  return type || 'Room type not set';
}
