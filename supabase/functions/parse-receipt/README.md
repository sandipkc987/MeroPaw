# parse-receipt Edge Function

This function:
- Authenticates the user via JWT
- Downloads the receipt from the `receipts` bucket
- Sends it to Google Document AI Expense Parser
- Stores raw JSON in `expense_extractions`
- Stores normalized fields in `expenses` (unless `saveExpense` is false)
- Updates `documents` status

