// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "DefterXMobile",
    platforms: [.iOS(.v17)],
    products: [.library(name: "DefterXMobile", targets: ["DefterXMobile"])],
    dependencies: [.package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0")],
    targets: [
        .target(name: "DefterXMobile", dependencies: [.product(name: "GRDB", package: "GRDB.swift")], path: "DefterX", exclude: ["App/DefterXApp.swift"]),
        .testTarget(name: "DefterXMobileTests", dependencies: ["DefterXMobile"], path: "DefterXTests")
    ]
)

