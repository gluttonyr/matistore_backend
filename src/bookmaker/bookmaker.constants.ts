/** Bookmaker used when an app installed before the bookmaker choice sends none. */
export const DEFAULT_BOOKMAKER = '1XBET';

/** Name to show for a transaction's bookmaker; transactions created before the choice are 1XBET. */
export const bookmakerOf = (
  transaction?: { bookmaker?: string | null } | null,
): string => transaction?.bookmaker?.trim() || DEFAULT_BOOKMAKER;
