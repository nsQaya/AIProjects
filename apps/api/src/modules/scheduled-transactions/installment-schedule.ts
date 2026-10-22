const dayMs = 86_400_000;

/**
 * Due dates for each installment of a card purchase, anchored to the card's
 * real statement cycle rather than "purchase date + N months": a purchase on
 * or before the statement day closes on that same month's statement, a later
 * purchase rolls to next month's, and every following installment is one
 * calendar month after that.
 */
export function computeInstallmentDueDates(
  purchaseDate: Date,
  statementDay: number,
  paymentDueOffsetDays: number,
  installmentCount: number,
): Date[] {
  const firstMonthOffset = purchaseDate.getUTCDate() <= statementDay ? 0 : 1;
  return Array.from({ length: installmentCount }, (_, index) => {
    const closingDate = new Date(Date.UTC(
      purchaseDate.getUTCFullYear(),
      purchaseDate.getUTCMonth() + firstMonthOffset + index,
      statementDay,
    ));
    return new Date(closingDate.getTime() + paymentDueOffsetDays * dayMs);
  });
}
