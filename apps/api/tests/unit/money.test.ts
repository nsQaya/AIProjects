import { describe,expect,it } from "vitest";import { Money } from "@defterx/shared";
describe("Money",()=>{it("keeps six-decimal precision without Number",()=>expect(Money.parse("99999999999999.999999").add(Money.parse("0.000001")).toString()).toBe("100000000000000"));it("rejects exponent and excessive scale",()=>{expect(()=>Money.parse("1e3")).toThrow();expect(()=>Money.parse("1.0000001")).toThrow();});});

