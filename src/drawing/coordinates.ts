export type NumericRange = readonly [number, number];

export function mapLinear(
  value: number,
  domain: NumericRange,
  range: NumericRange,
): number {
  const inputs = [value, domain[0], domain[1], range[0], range[1]];

  if (inputs.some((input) => !Number.isFinite(input))) {
    throw new TypeError('Coordinate mapping inputs must be finite numbers.');
  }

  if (domain[0] === domain[1]) {
    throw new RangeError('Coordinate mapping domain must have non-zero length.');
  }

  return (
    range[0] +
    ((value - domain[0]) / (domain[1] - domain[0])) * (range[1] - range[0])
  );
}
