import { useMutation } from '@tanstack/react-query';
import { scanReceiptImage } from '../services/bills.service';
import type { ParsedReceiptResult } from '../types';

export function useScanReceipt() {
  return useMutation<ParsedReceiptResult, Error, string>({
    mutationFn: (imageBase64: string) => scanReceiptImage(imageBase64),
  });
}
