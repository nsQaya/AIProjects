import { describe, expect, it } from "vitest";
import { assertBalancedEntries, mapTransactionToEntries, reconstructBalance, reverseEntries } from "../../src/modules/ledger/ledger-mapper";

const base={amount:"1000.125",currencyCode:"TRY",accountId:"cash",categoryAccountId:"category",targetAccountId:"target",contactAccountId:"contact",equityAccountId:"equity"};
describe("ledger mappings",()=>{
  it.each([
    ["INCOME",["cash:DEBIT","category:CREDIT"]],
    ["EXPENSE",["category:DEBIT","cash:CREDIT"]],
    ["TRANSFER",["target:DEBIT","cash:CREDIT"]],
    ["SALE",["contact:DEBIT","category:CREDIT"]],
    ["PURCHASE",["category:DEBIT","contact:CREDIT"]],
    ["COLLECTION",["cash:DEBIT","contact:CREDIT"]],
    ["PAYMENT",["contact:DEBIT","cash:CREDIT"]],
    ["OPENING_BALANCE",["cash:DEBIT","equity:CREDIT"]],
  ] as const)("maps and balances %s",(type,expected)=>{const entries=mapTransactionToEntries({...base,type});expect(entries.map(e=>`${e.accountId}:${e.direction}`)).toEqual(expected);expect(()=>assertBalancedEntries(entries)).not.toThrow();});
  it("rejects a zero amount",()=>expect(()=>mapTransactionToEntries({...base,type:"EXPENSE",amount:"0"})).toThrow());
  it("reversal exactly negates the original",()=>{const original=mapTransactionToEntries({...base,type:"INCOME"});const reversal=reverseEntries(original);expect(reconstructBalance("DEBIT",[...original,...reversal])).toBe("0");expect(()=>assertBalancedEntries(reversal)).not.toThrow();});
  it("reconstructs debit and credit normal balances",()=>{const entries=[...mapTransactionToEntries({...base,type:"INCOME"}),...mapTransactionToEntries({...base,type:"INCOME",amount:"250"})];expect(reconstructBalance("DEBIT",entries.filter(e=>e.accountId==='cash'))).toBe("1250.125");expect(reconstructBalance("CREDIT",entries.filter(e=>e.accountId==='category'))).toBe("1250.125");});
});

