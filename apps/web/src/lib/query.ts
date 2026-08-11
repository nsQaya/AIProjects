type QueryValue = string | number | boolean | null | undefined;

export function query(values: Record<string, QueryValue>): string {
  return new URLSearchParams(
    Object.entries(values)
      .filter((entry): entry is [string, string | number | boolean] => {
        const value = entry[1];
        return value !== undefined && value !== null && value !== "";
      })
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}
