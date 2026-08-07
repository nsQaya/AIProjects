import {describe,expect,it}from'vitest';import{advanceRecurrence}from'../../src/modules/recurring-transactions/recurrence';
describe('recurrence',()=>{it('clamps month ends deterministically',()=>expect(advanceRecurrence(new Date('2025-01-31T10:00:00Z'),'MONTHLY',1).toISOString()).toBe('2025-02-28T10:00:00.000Z'));it('handles leap-year yearly runs',()=>expect(advanceRecurrence(new Date('2024-02-29T00:00:00Z'),'YEARLY',1).toISOString()).toBe('2025-02-28T00:00:00.000Z'));});

