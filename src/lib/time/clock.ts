/** שעון ניתן להחלפה, כדי שהלוגיקה תהיה טהורה וניתנת לבדיקה. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function fixedClock(iso: string): Clock {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`bad instant: ${iso}`);
  return () => new Date(d.getTime());
}
