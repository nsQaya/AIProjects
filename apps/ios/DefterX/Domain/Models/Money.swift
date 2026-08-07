import Foundation

struct Money: Hashable, Codable, Sendable {
    let decimalString: String

    init(_ value: String) throws {
        let expression = try NSRegularExpression(pattern: "^-?(0|[1-9][0-9]{0,13})(\\.[0-9]{1,6})?$")
        let range = NSRange(value.startIndex..., in: value)
        guard expression.firstMatch(in: value, range: range) != nil,
              Decimal(string: value, locale: Locale(identifier: "en_US_POSIX")) != nil else {
            throw MoneyError.invalidDecimal
        }
        decimalString = value
    }

    var decimal: Decimal { Decimal(string: decimalString, locale: Locale(identifier: "en_US_POSIX"))! }
    func formatted(currency: String, locale: Locale = .current) -> String {
        decimal.formatted(.currency(code: currency).locale(locale))
    }
}

enum MoneyError: Error { case invalidDecimal }

