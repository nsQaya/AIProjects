import XCTest
@testable import DefterXMobile
final class MoneyTests:XCTestCase{func testExactDecimalRoundTrip()throws{let money=try Money("99999999999999.999999");XCTAssertEqual(money.decimalString,"99999999999999.999999")}func testRejectsFloatingPointNotation(){XCTAssertThrowsError(try Money("1e3"))}}

