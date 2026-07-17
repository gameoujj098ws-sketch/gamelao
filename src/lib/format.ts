export const formatKip = (n: number | bigint | null | undefined) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US") + " ₭";
};
