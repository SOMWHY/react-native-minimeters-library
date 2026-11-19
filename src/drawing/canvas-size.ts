export function isCanvasReady(width: number, height: number): boolean {
  return (
    Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0
  );
}
